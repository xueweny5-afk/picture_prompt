import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const appPort = 4321;
const mockPort = 4322;
const tempDb = path.join(root, "output", "integration-test.db");
const uploadDir = path.join(root, "public", "uploads");
const analysis = {
  subject: "窗边花影人像",
  subject_en: "Portrait by a flower-shadowed window",
  composition: ["人物近景居中"],
  composition_en: ["Centered close portrait"],
  camera: ["85mm 人像镜头"],
  camera_en: ["85mm portrait lens"],
  lighting: ["暖色侧光"],
  lighting_en: ["Warm side lighting"],
  colors: ["琥珀色与深棕色"],
  colors_en: ["Amber and dark brown palette"],
  materials: ["自然皮肤与干花"],
  materials_en: ["Natural skin and dried flowers"],
  text_elements: [],
  text_elements_en: [],
  category: "人像",
  category_en: "Portrait",
  styles: ["Realistic", "Photography"],
  scenes: ["Story"],
  negative_prompt: "plastic skin, watermark",
  aspect_ratio: "4:5",
};
const upstreamRequests = [];

function dataUrlFromRequest(body) {
  const responseImage = body?.input?.[0]?.content?.find?.((part) => part.type === "input_image");
  const chatImage = body?.messages?.[0]?.content?.find?.((part) => part.type === "image_url");
  return responseImage?.image_url || chatImage?.image_url?.url || "";
}

for (const suffix of ["", "-wal", "-shm"]) {
  fs.rmSync(`${tempDb}${suffix}`, { force: true });
}
fs.mkdirSync(path.dirname(tempDb), { recursive: true });

const mockServer = http.createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  assert.equal(request.headers.authorization, "Bearer test-provider-key");
  assert.ok(body.model);
  upstreamRequests.push(body);

  response.setHeader("Content-Type", "application/json");
  if (request.url.endsWith("/responses")) {
    response.end(JSON.stringify({ output_text: JSON.stringify(analysis) }));
    return;
  }
  if (request.url.endsWith("/chat/completions")) {
    response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(analysis) } }] }));
    return;
  }
  response.statusCode = 404;
  response.end(JSON.stringify({ error: { message: "not found" } }));
});

await new Promise((resolve) => mockServer.listen(mockPort, "127.0.0.1", resolve));

const app = spawn(process.execPath, ["server.mjs"], {
  cwd: root,
  env: {
    ...process.env,
    PORT: String(appPort),
    ADMIN_PASSWORD: "integration-password",
    SESSION_SECRET: "integration-session-secret",
    IP_HASH_SECRET: "integration-ip-secret",
    PROVIDER_ENCRYPTION_KEY: "integration-encryption-key-with-more-than-32-characters",
    PROMPT_DB_PATH: tempDb,
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});

let appOutput = "";
app.stdout.on("data", (chunk) => { appOutput += chunk.toString(); });
app.stderr.on("data", (chunk) => { appOutput += chunk.toString(); });

async function waitForApp() {
  let lastResult = "";
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${appPort}/api/reverse-status`);
      if (response.ok) return;
      lastResult = `${response.status} ${await response.text()}`;
    } catch (error) {
      lastResult = error.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`App did not start (${lastResult}):\n${appOutput}`);
}

function imageForm(size = 68, type = "image/png") {
  const bytes = Buffer.alloc(size);
  const form = new FormData();
  form.append("image", new Blob([bytes], { type }), "test.png");
  return form;
}

async function jsonFetch(url, options = {}) {
  const response = await fetch(`http://127.0.0.1:${appPort}${url}`, options);
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

try {
  await waitForApp();
  const uploadCountBefore = fs.existsSync(uploadDir)
    ? fs.readdirSync(uploadDir).length
    : 0;

  let result = await jsonFetch("/api/admin/provider");
  assert.equal(result.response.status, 401);

  result = await jsonFetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "integration-password" }),
  });
  assert.equal(result.response.status, 200);
  let cookie = result.response.headers.get("set-cookie").split(";")[0];

  result = await jsonFetch("/api/admin/password", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      current_password: "wrong-password",
      new_password: "updated-integration-password",
    }),
  });
  assert.equal(result.response.status, 400);

  result = await jsonFetch("/api/admin/password", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      current_password: "integration-password",
      new_password: "short",
    }),
  });
  assert.equal(result.response.status, 400);

  const oldCookie = cookie;
  result = await jsonFetch("/api/admin/password", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      current_password: "integration-password",
      new_password: "updated-integration-password",
    }),
  });
  assert.equal(result.response.status, 200);
  cookie = result.response.headers.get("set-cookie").split(";")[0];

  result = await jsonFetch("/api/admin/session", { headers: { Cookie: oldCookie } });
  assert.equal(result.data.authenticated, false);

  result = await jsonFetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "integration-password" }),
  });
  assert.equal(result.response.status, 401);

  result = await jsonFetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "updated-integration-password" }),
  });
  assert.equal(result.response.status, 200);

  const securityDb = new DatabaseSync(tempDb, { readOnly: true });
  const security = securityDb
    .prepare("SELECT password_hash, password_salt, auth_version FROM admin_settings WHERE id = 1")
    .get();
  securityDb.close();
  assert.ok(security.password_hash);
  assert.ok(security.password_salt);
  assert.equal(security.password_hash.includes("updated-integration-password"), false);
  assert.equal(Number(security.auth_version), 2);

  result = await jsonFetch("/api/admin/prompts", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      title: "来源字段测试",
      description: "用于验证来源出处。",
      prompt: "test prompt",
      model: "GPT Image 2",
      category: "测试",
      image_url: "/test-source.jpg",
      source_name: "测试作者备注",
      source_url: "https://example.com/source",
      styles: ["自定义风格", "自定义风格", " 电影感 "],
      scenes: ["自定义场景"],
    }),
  });
  assert.equal(result.response.status, 201);
  const promptId = result.data.id;

  result = await jsonFetch("/api/admin/prompts", { headers: { Cookie: cookie } });
  let sourcePrompt = result.data.find((item) => item.id === promptId);
  assert.equal(sourcePrompt.source_name, "测试作者备注");
  assert.equal(sourcePrompt.source_url, "https://example.com/source");
  assert.deepEqual(sourcePrompt.styles, ["自定义风格", "电影感"]);
  assert.deepEqual(sourcePrompt.scenes, ["自定义场景"]);

  result = await jsonFetch("/api/prompts/meta");
  assert.ok(result.data.styles.includes("自定义风格"));
  assert.ok(result.data.scenes.includes("自定义场景"));

  result = await jsonFetch(`/api/admin/prompts/${promptId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      ...sourcePrompt,
      source_name: "更新后的出处备注",
      source_url: "https://example.com/updated-source",
      styles: ["更新风格"],
      scenes: ["更新场景", "更新场景"],
    }),
  });
  assert.equal(result.response.status, 200);

  result = await jsonFetch("/api/admin/prompts", { headers: { Cookie: cookie } });
  sourcePrompt = result.data.find((item) => item.id === promptId);
  assert.equal(sourcePrompt.source_name, "更新后的出处备注");
  assert.equal(sourcePrompt.source_url, "https://example.com/updated-source");
  assert.deepEqual(sourcePrompt.styles, ["更新风格"]);
  assert.deepEqual(sourcePrompt.scenes, ["更新场景"]);

  result = await jsonFetch("/api/admin/provider", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      provider_name: "Mock Responses",
      base_url: `http://127.0.0.1:${mockPort}/v1`,
      api_type: "responses",
      model: "mock-vision",
      api_key: "test-provider-key",
      enabled: true,
      daily_limit: 3,
    }),
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.data.key_configured, true);
  assert.equal("api_key" in result.data, false);

  result = await jsonFetch("/api/admin/provider", { headers: { Cookie: cookie } });
  assert.equal(result.response.status, 200);
  assert.equal("api_key_ciphertext" in result.data, false);

  result = await jsonFetch("/api/admin/provider/test", { method: "POST", headers: { Cookie: cookie } });
  assert.equal(result.response.status, 200);
  const probeDataUrl = dataUrlFromRequest(upstreamRequests[0]);
  assert.match(probeDataUrl, /^data:image\/png;base64,/);
  const probePng = Buffer.from(probeDataUrl.split(",")[1], "base64");
  assert.equal(probePng.toString("ascii", 1, 4), "PNG");
  assert.ok(probePng.readUInt32BE(16) > 10);
  assert.ok(probePng.readUInt32BE(20) > 10);

  result = await jsonFetch("/api/reverse-status", { headers: { "X-Forwarded-For": "203.0.113.10" } });
  assert.equal(result.data.available, true);
  assert.equal(result.data.remaining, 3);

  result = await jsonFetch("/api/reverse-prompt", {
    method: "POST",
    headers: { "X-Forwarded-For": "203.0.113.11" },
    body: imageForm(12, "text/plain"),
  });
  assert.equal(result.response.status, 400);

  for (let count = 0; count < 3; count += 1) {
    result = await jsonFetch("/api/reverse-prompt", {
      method: "POST",
      headers: { "X-Forwarded-For": "203.0.113.10" },
      body: imageForm(),
    });
    assert.equal(result.response.status, 200);
    for (const expected of [
      analysis.subject,
      analysis.composition[0],
      analysis.camera[0],
      analysis.lighting[0],
      analysis.colors[0],
      analysis.materials[0],
      analysis.styles[0],
      analysis.scenes[0],
      analysis.category,
      analysis.aspect_ratio,
    ]) {
      assert.ok(result.data.analysis.prompt_zh.includes(expected));
    }
    assert.ok(Array.isArray(result.data.similar));
    assert.equal(result.data.remaining, 2 - count);
  }

  result = await jsonFetch("/api/reverse-prompt", {
    method: "POST",
    headers: { "X-Forwarded-For": "203.0.113.10" },
    body: imageForm(),
  });
  assert.equal(result.response.status, 429);

  result = await jsonFetch("/api/admin/provider", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      provider_name: "Mock Chat",
      base_url: `http://127.0.0.1:${mockPort}/v1`,
      api_type: "chat_completions",
      model: "mock-vision",
      api_key: "",
      enabled: true,
      daily_limit: 3,
    }),
  });
  assert.equal(result.response.status, 200);

  result = await jsonFetch("/api/reverse-prompt", {
    method: "POST",
    headers: { "X-Forwarded-For": "203.0.113.12" },
    body: imageForm(),
  });
  assert.equal(result.response.status, 200);
  for (const expected of [
    analysis.subject_en,
    analysis.composition_en[0],
    analysis.camera_en[0],
    analysis.lighting_en[0],
    analysis.colors_en[0],
    analysis.materials_en[0],
    analysis.styles[0],
    analysis.scenes[0],
    analysis.category_en,
    analysis.aspect_ratio,
  ]) {
    assert.ok(result.data.analysis.prompt_en.includes(expected));
  }

  result = await jsonFetch("/api/reverse-prompt", {
    method: "POST",
    headers: { "X-Forwarded-For": "203.0.113.13" },
    body: imageForm(8 * 1024 * 1024 + 1),
  });
  assert.equal(result.response.status, 413);

  const uploadCountAfter = fs.existsSync(uploadDir)
    ? fs.readdirSync(uploadDir).length
    : 0;
  assert.equal(uploadCountAfter, uploadCountBefore);

  console.log("integration tests passed");
} finally {
  app.kill();
  await new Promise((resolve) => app.once("exit", resolve));
  await new Promise((resolve) => mockServer.close(resolve));
  for (const suffix of ["", "-wal", "-shm"]) {
    fs.rmSync(`${tempDb}${suffix}`, { force: true });
  }
}
