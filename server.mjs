import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import multer from "multer";
import { openDatabase, parseJsonList, serializePrompt } from "./lib/database.mjs";
import { loadRuntimeSecrets } from "./lib/runtime-secrets.mjs";
import {
  analyzeImage,
  encryptApiKey,
  hasUsableApiKey,
  maskedProviderSettings,
  validateProviderSettings,
} from "./lib/reverse-provider.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === "production" || process.argv.includes("--production");
const port = Number(process.env.PORT || 4173);
const adminPassword = process.env.ADMIN_PASSWORD || "prompt123";
const runtimeSecrets = loadRuntimeSecrets(__dirname);
const sessionSecret = process.env.SESSION_SECRET || runtimeSecrets.sessionSecret;
const ipHashSecret = process.env.IP_HASH_SECRET || runtimeSecrets.ipHashSecret;
process.env.PROVIDER_ENCRYPTION_KEY ||= runtimeSecrets.providerEncryptionKey;
const uploadDir = path.join(__dirname, "public", "uploads");
const MAX_REVERSE_FILE_SIZE = 8 * 1024 * 1024;
const DEFAULT_PAGE_SIZE = 21;
const MAX_PAGE_SIZE = 60;
const PASSWORD_KEY_LENGTH = 64;

fs.mkdirSync(uploadDir, { recursive: true });
const db = openDatabase(__dirname);
db.prepare(`
  UPDATE provider_settings
  SET provider_name = '阿里云百炼',
      api_type = 'chat_completions',
      model = 'qwen3.7-plus',
      updated_at = CURRENT_TIMESTAMP
  WHERE lower(provider_name) LIKE 'qwen3.7%'
     OR lower(model) IN ('qwen3.7', 'qwen-3.7')
`).run();

const seedPrompts = [
  {
    title: "窗边花影",
    slug: "window-flower-portrait",
    description: "电影感人像摄影，温暖侧光与细腻肤质。",
    prompt:
      "Cinematic close portrait of an elegant East Asian woman in warm late-afternoon window light, delicate dried flower near her face, subtle leaf shadows across natural skin, quiet introspective expression, premium editorial photography, shallow depth of field, amber chiaroscuro, 85mm lens",
    negative_prompt: "plastic skin, heavy retouching, harsh flash, text, watermark",
    model: "Midjourney",
    category: "人像",
    image_url: "/artworks/portrait.png",
    aspect_ratio: "4:5",
    featured: 0,
  },
  {
    title: "海岸流线居所",
    slug: "organic-coastal-villa",
    description: "未来主义生态建筑，海边悬崖与流线型设计。",
    prompt:
      "Breathtaking futuristic organic white villa built into a Mediterranean cliff above a calm blue sea, flowing biomorphic concrete curves, glass walls, terraces filled with pine and olive trees, hyperreal architectural visualization, clear soft morning sunlight, 8k detail",
    negative_prompt: "people, city skyline, text, low detail, distorted structure",
    model: "Seedream / Jimeng",
    category: "建筑",
    image_url: "/artworks/villa.png",
    aspect_ratio: "16:9",
    featured: 1,
  },
  {
    title: "琥珀香气",
    slug: "amber-perfume",
    description: "高端香水产品摄影，极简构图与柔和光影。",
    prompt:
      "Minimalist luxury perfume bottle with amber liquid standing on a rough pale limestone pedestal, warm beige studio wall, one soft-edged diagonal beam of sunlight, realistic glass refraction, premium fragrance campaign photography, tactile and sophisticated",
    negative_prompt: "brand logo, readable text, clutter, oversaturated, plastic",
    model: "GPT Image",
    category: "产品",
    image_url: "/artworks/perfume.png",
    aspect_ratio: "4:5",
    featured: 0,
  },
  {
    title: "雾镜雪山",
    slug: "alpine-mirror",
    description: "宁静清晨的雪山倒影，薄雾与冷调自然摄影。",
    prompt:
      "Dramatic snow-capped mountain range reflected perfectly in a still alpine lake, thin morning mist over a dark pine shoreline, cool blue dawn, ultra-real landscape photography, symmetrical composition, natural atmospheric depth",
    negative_prompt: "people, buildings, fantasy colors, text, watermark",
    model: "Stable Diffusion",
    category: "自然",
    image_url: "/artworks/mountains.png",
    aspect_ratio: "4:3",
    featured: 0,
  },
  {
    title: "金枝花语",
    slug: "golden-branch-guofeng",
    description: "现代国风插画，白色牡丹与金色枝叶。",
    prompt:
      "Graceful young East Asian woman surrounded by oversized white peony flowers and delicate gold branches, flowing black hair, calm gaze, contemporary guofeng digital illustration, watercolor textures, fine ink details, parchment cream and muted gold palette",
    negative_prompt: "3d render, photorealistic, neon colors, typography, watermark",
    model: "Midjourney",
    category: "插画",
    image_url: "/artworks/guofeng.png",
    aspect_ratio: "1:1",
    featured: 0,
  },
  {
    title: "静谧拱窗",
    slug: "quiet-arch-interior",
    description: "侘寂极简室内，柔和自然光与雕塑感家具。",
    prompt:
      "Serene minimalist room with tall rounded arch window, one sculptural dark lounge chair, delicate bare tree branch in a ceramic vessel, distant pale desert outside, high-end interior photography, warm plaster, diffuse morning light, wabi-sabi atmosphere",
    negative_prompt: "clutter, people, bright colors, ornate decor, text",
    model: "Stable Diffusion",
    category: "室内",
    image_url: "/artworks/interior.png",
    aspect_ratio: "4:5",
    featured: 0,
  },
  {
    title: "赤色远征",
    slug: "red-planet-expedition",
    description: "宇航员置身火星峡谷，宏大尺度的科幻电影感。",
    prompt:
      "Lone astronaut standing in a vast rust-red Martian canyon, enormous pale planet low in the dusty sky, layered rocks and long shadows, tiny human scale against monumental landscape, cinematic photoreal science-fiction film still, late-day copper light",
    negative_prompt: "multiple astronauts, spaceship, city, text, low detail",
    model: "Midjourney",
    category: "电影感",
    image_url: "/artworks/mars.png",
    aspect_ratio: "4:5",
    featured: 0,
  },
];

if (db.prepare("SELECT COUNT(*) AS count FROM prompts").get().count === 0) {
  const insert = db.prepare(`
    INSERT INTO prompts
      (title, slug, description, prompt, negative_prompt, model, category, image_url, aspect_ratio, featured)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const item of seedPrompts) {
    insert.run(
      item.title,
      item.slug,
      item.description,
      item.prompt,
      item.negative_prompt,
      item.model,
      item.category,
      item.image_url,
      item.aspect_ratio,
      item.featured,
    );
  }
}

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(uploadDir));
app.get("/favicon.ico", (_request, response) => response.status(204).end());

const adminUpload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_request, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase() || ".png";
      callback(null, `${Date.now()}-${crypto.randomBytes(5).toString("hex")}${extension}`);
    },
  }),
  limits: { fileSize: MAX_REVERSE_FILE_SIZE },
  fileFilter: (_request, file, callback) => {
    callback(null, ["image/png", "image/jpeg", "image/webp"].includes(file.mimetype));
  },
});

const reverseUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: MAX_REVERSE_FILE_SIZE },
  fileFilter: (_request, file, callback) => {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.mimetype)) {
      const error = new Error("仅支持 PNG、JPG 和 WebP 图片");
      error.code = "INVALID_IMAGE_TYPE";
      return callback(error);
    }
    callback(null, true);
  },
});

function cookieMap(request) {
  return Object.fromEntries(
    (request.headers.cookie || "")
      .split(";")
      .map((item) => item.trim().split("="))
      .filter(([key, value]) => key && value),
  );
}

function adminSettings() {
  return db.prepare("SELECT * FROM admin_settings WHERE id = 1").get();
}

function safeEqualText(leftValue, rightValue) {
  const left = Buffer.from(String(leftValue || ""));
  const right = Buffer.from(String(rightValue || ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function verifyAdminPassword(password) {
  const candidatePassword = String(password || "");
  if (!candidatePassword || candidatePassword.length > 128) return false;
  const settings = adminSettings();
  if (!settings.password_hash || !settings.password_salt) {
    return safeEqualText(candidatePassword, adminPassword);
  }

  const candidate = crypto
    .scryptSync(candidatePassword, Buffer.from(settings.password_salt, "hex"), PASSWORD_KEY_LENGTH)
    .toString("hex");
  return safeEqualText(candidate, settings.password_hash);
}

function hashAdminPassword(password) {
  const salt = crypto.randomBytes(16);
  return {
    passwordHash: crypto.scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString("hex"),
    passwordSalt: salt.toString("hex"),
  };
}

function makeSession(authVersion = adminSettings().auth_version) {
  const expires = Date.now() + 1000 * 60 * 60 * 24 * 7;
  const payload = `${expires}:${authVersion}`;
  const signature = crypto.createHmac("sha256", sessionSecret).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

function isAdmin(request) {
  const token = cookieMap(request).prompt_admin;
  if (!token) return false;
  const [payload, signature] = token.split(".");
  const [expires, authVersion] = String(payload || "").split(":");
  if (!expires || !authVersion || !signature || Number(expires) < Date.now()) return false;
  if (Number(authVersion) !== Number(adminSettings().auth_version)) return false;
  const expected = crypto.createHmac("sha256", sessionSecret).update(payload).digest("hex");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function requireAdmin(request, response, next) {
  if (!isAdmin(request)) return response.status(401).json({ error: "请先登录" });
  next();
}

function slugify(value) {
  const slug = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || `prompt-${Date.now()}`;
}

function positiveInteger(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

function cleanTags(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value
    .map((item) => String(item || "").trim().replace(/^#/, "").slice(0, 40))
    .filter((item) => {
      const key = item.toLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20);
}

function getProviderSettings() {
  return db.prepare("SELECT * FROM provider_settings WHERE id = 1").get();
}

function providerAvailable(settings = getProviderSettings()) {
  return Boolean(
    settings.enabled
      && settings.provider_name
      && settings.base_url
      && settings.model
      && hasUsableApiKey(settings),
  );
}

function secureCookie(request) {
  const forwardedProtocol = String(request.get("x-forwarded-proto") || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  return request.secure || forwardedProtocol === "https";
}

function clientIp(request) {
  const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || request.ip || request.socket.remoteAddress || "unknown";
}

function ipHash(request) {
  return crypto.createHmac("sha256", ipHashSecret).update(clientIp(request)).digest("hex");
}

function dayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function usageFor(request) {
  const settings = getProviderSettings();
  const limit = positiveInteger(settings.daily_limit, 3, 1000);
  const count = Number(
    db.prepare("SELECT request_count FROM reverse_usage WHERE day = ? AND ip_hash = ?")
      .get(dayKey(), ipHash(request))?.request_count || 0,
  );
  return { limit, count, remaining: Math.max(0, limit - count) };
}

function reserveUsage(request, limit) {
  const result = db.prepare(`
    INSERT INTO reverse_usage (day, ip_hash, request_count)
    VALUES (?, ?, 1)
    ON CONFLICT(day, ip_hash) DO UPDATE SET
      request_count = request_count + 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE request_count < ?
  `).run(dayKey(), ipHash(request), limit);
  return Boolean(result.changes);
}

function releaseUsage(request) {
  db.prepare(`
    UPDATE reverse_usage
    SET request_count = CASE WHEN request_count > 0 THEN request_count - 1 ELSE 0 END,
        updated_at = CURRENT_TIMESTAMP
    WHERE day = ? AND ip_hash = ?
  `).run(dayKey(), ipHash(request));
}

function promptMeta() {
  const rows = db
    .prepare("SELECT model, category, styles_json, scenes_json FROM prompts WHERE published = 1")
    .all();
  return {
    models: [...new Set(rows.map((row) => row.model).filter(Boolean))].sort(),
    categories: [...new Set(rows.map((row) => row.category).filter(Boolean))].sort(),
    styles: [...new Set(rows.flatMap((row) => parseJsonList(row.styles_json)))].sort(),
    scenes: [...new Set(rows.flatMap((row) => parseJsonList(row.scenes_json)))].sort(),
  };
}

function similarPrompts(analysis) {
  const targetStyles = new Set(analysis.styles.map((item) => item.toLowerCase()));
  const targetScenes = new Set(analysis.scenes.map((item) => item.toLowerCase()));
  return db
    .prepare("SELECT * FROM prompts WHERE published = 1")
    .all()
    .map((row) => {
      const styles = parseJsonList(row.styles_json);
      const scenes = parseJsonList(row.scenes_json);
      let score = row.category.toLowerCase() === analysis.category.toLowerCase() ? 6 : 0;
      score += styles.filter((item) => targetStyles.has(item.toLowerCase())).length * 3;
      score += scenes.filter((item) => targetScenes.has(item.toLowerCase())).length * 2;
      return { row, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.row.import_rank - right.row.import_rank)
    .slice(0, 6)
    .map(({ row }) => serializePrompt(row));
}

app.get("/api/prompts/meta", (_request, response) => {
  response.json(promptMeta());
});

app.get("/api/prompts", (request, response) => {
  const q = String(request.query.q || "").trim();
  const model = String(request.query.model || "").trim();
  const category = String(request.query.category || "").trim();
  const tag = String(request.query.tag || "").trim();
  const page = positiveInteger(request.query.page, 1);
  const limit = positiveInteger(request.query.limit, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const clauses = ["published = 1"];
  const params = [];

  if (q) {
    clauses.push(
      "(title LIKE ? OR description LIKE ? OR prompt LIKE ? OR styles_json LIKE ? OR scenes_json LIKE ?)",
    );
    params.push(...Array(5).fill(`%${q}%`));
  }
  if (model) {
    clauses.push("model = ?");
    params.push(model);
  }
  if (category) {
    clauses.push("category = ?");
    params.push(category);
  }
  if (tag) {
    clauses.push("(styles_json LIKE ? OR scenes_json LIKE ?)");
    params.push(`%${tag}%`, `%${tag}%`);
  }

  const where = clauses.join(" AND ");
  const total = Number(db.prepare(`SELECT COUNT(*) AS count FROM prompts WHERE ${where}`).get(...params).count);
  const rows = db.prepare(`
    SELECT * FROM prompts
    WHERE ${where}
    ORDER BY import_rank ASC, id ASC
    LIMIT ? OFFSET ?
  `).all(...params, limit, (page - 1) * limit);

  response.json({
    items: rows.map(serializePrompt),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasMore: page * limit < total,
    },
  });
});

app.get("/api/prompts/:id", (request, response) => {
  const row = db
    .prepare("SELECT * FROM prompts WHERE id = ? AND published = 1")
    .get(Number(request.params.id));
  if (!row) return response.status(404).json({ error: "内容不存在" });
  response.json(serializePrompt(row));
});

app.get("/api/reverse-status", (request, response) => {
  const settings = getProviderSettings();
  const usage = usageFor(request);
  response.json({
    available: providerAvailable(settings),
    remaining: usage.remaining,
    dailyLimit: usage.limit,
    maxFileSize: MAX_REVERSE_FILE_SIZE,
    acceptedTypes: ["image/png", "image/jpeg", "image/webp"],
  });
});

app.post("/api/reverse-prompt", (request, response, next) => {
  reverseUpload.single("image")(request, response, async (uploadError) => {
    if (uploadError) return next(uploadError);
    if (!request.file?.buffer?.length) return response.status(400).json({ error: "请选择需要分析的图片" });

    const settings = getProviderSettings();
    if (!providerAvailable(settings)) {
      return response.status(503).json({ error: "图片反推服务暂未开放" });
    }

    const usage = usageFor(request);
    if (!reserveUsage(request, usage.limit)) {
      return response.status(429).json({ error: "今日体验次数已用完，请明天再试" });
    }

    try {
      const analysis = await analyzeImage(settings, request.file);
      response.json({
        analysis,
        similar: similarPrompts(analysis),
        remaining: Math.max(0, usage.remaining - 1),
      });
    } catch (error) {
      releaseUsage(request);
      console.warn("Reverse prompt failed", {
        provider: settings.provider_name,
        status: error.status || null,
        message: String(error.message || "unknown").slice(0, 240),
      });
      response.status(error.status === 429 ? 503 : 502).json({
        error: error.status === 429 ? "上游接口繁忙，请稍后重试" : "图片分析失败，请检查后台 API 配置",
      });
    }
  });
});

app.post("/api/admin/login", (request, response) => {
  if (!verifyAdminPassword(request.body.password)) {
    return response.status(401).json({ error: "密码不正确" });
  }
  response.setHeader(
    "Set-Cookie",
    `prompt_admin=${makeSession()}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${
      secureCookie(request) ? "; Secure" : ""
    }`,
  );
  response.json({ ok: true });
});

app.post("/api/admin/logout", (request, response) => {
  response.setHeader(
    "Set-Cookie",
    `prompt_admin=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secureCookie(request) ? "; Secure" : ""}`,
  );
  response.json({ ok: true });
});

app.get("/api/admin/session", (request, response) => {
  response.json({ authenticated: isAdmin(request) });
});

app.put("/api/admin/password", requireAdmin, (request, response) => {
  const currentPassword = String(request.body.current_password || "");
  const newPassword = String(request.body.new_password || "");
  if (!verifyAdminPassword(currentPassword)) {
    return response.status(400).json({ error: "当前密码不正确" });
  }
  if (newPassword.length < 8 || newPassword.length > 128) {
    return response.status(400).json({ error: "新密码长度需为 8 到 128 个字符" });
  }
  if (safeEqualText(currentPassword, newPassword)) {
    return response.status(400).json({ error: "新密码不能与当前密码相同" });
  }

  const { passwordHash, passwordSalt } = hashAdminPassword(newPassword);
  const result = db.prepare(`
    UPDATE admin_settings
    SET password_hash = ?, password_salt = ?, auth_version = auth_version + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
    RETURNING auth_version
  `).get(passwordHash, passwordSalt);

  response.setHeader(
    "Set-Cookie",
    `prompt_admin=${makeSession(result.auth_version)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${
      secureCookie(request) ? "; Secure" : ""
    }`,
  );
  response.json({ ok: true });
});

app.get("/api/admin/prompts", requireAdmin, (_request, response) => {
  response.json(
    db.prepare("SELECT * FROM prompts ORDER BY import_rank ASC, id ASC").all().map(serializePrompt),
  );
});

app.post("/api/admin/upload", requireAdmin, adminUpload.single("image"), (request, response) => {
  if (!request.file) return response.status(400).json({ error: "请选择 PNG、JPG 或 WebP 图片" });
  response.json({ url: `/uploads/${request.file.filename}` });
});

app.post("/api/admin/prompts", requireAdmin, (request, response) => {
  const item = request.body;
  if (!item.title || !item.prompt || !item.model || !item.category || !item.image_url) {
    return response.status(400).json({ error: "请完整填写标题、提示词、模型、分类和图片" });
  }
  try {
    const result = db.prepare(`
      INSERT INTO prompts
        (title, slug, description, prompt, negative_prompt, model, category, image_url,
         aspect_ratio, published, featured, source_name, source_url, github_url,
         styles_json, scenes_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      item.title,
      slugify(item.slug || item.title),
      item.description || "",
      item.prompt,
      item.negative_prompt || "",
      item.model,
      item.category,
      item.image_url,
      item.aspect_ratio || "4:5",
      item.published === false ? 0 : 1,
      item.featured ? 1 : 0,
      String(item.source_name || "").trim(),
      String(item.source_url || "").trim(),
      String(item.github_url || "").trim(),
      JSON.stringify(cleanTags(item.styles)),
      JSON.stringify(cleanTags(item.scenes)),
    );
    response.status(201).json({ id: Number(result.lastInsertRowid) });
  } catch (error) {
    response.status(409).json({ error: error.message.includes("UNIQUE") ? "slug 已存在" : "保存失败" });
  }
});

app.put("/api/admin/prompts/:id", requireAdmin, (request, response) => {
  const item = request.body;
  const result = db.prepare(`
    UPDATE prompts SET
      title = ?, slug = ?, description = ?, prompt = ?, negative_prompt = ?,
      model = ?, category = ?, image_url = ?, aspect_ratio = ?,
      published = ?, featured = ?, source_name = ?, source_url = ?, github_url = ?,
      styles_json = ?, scenes_json = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    item.title,
    slugify(item.slug || item.title),
    item.description || "",
    item.prompt,
    item.negative_prompt || "",
    item.model,
    item.category,
    item.image_url,
    item.aspect_ratio || "4:5",
    item.published === false ? 0 : 1,
    item.featured ? 1 : 0,
    String(item.source_name || "").trim(),
    String(item.source_url || "").trim(),
    String(item.github_url || "").trim(),
    JSON.stringify(cleanTags(item.styles)),
    JSON.stringify(cleanTags(item.scenes)),
    Number(request.params.id),
  );
  if (!result.changes) return response.status(404).json({ error: "内容不存在" });
  response.json({ ok: true });
});

app.delete("/api/admin/prompts/:id", requireAdmin, (request, response) => {
  const result = db.prepare("DELETE FROM prompts WHERE id = ?").run(Number(request.params.id));
  if (!result.changes) return response.status(404).json({ error: "内容不存在" });
  response.json({ ok: true });
});

app.get("/api/admin/provider", requireAdmin, (_request, response) => {
  response.json(maskedProviderSettings(getProviderSettings()));
});

app.put("/api/admin/provider", requireAdmin, (request, response) => {
  const current = getProviderSettings();
  const next = {
    ...current,
    provider_name: String(request.body.provider_name || "").trim(),
    base_url: String(request.body.base_url || "").trim().replace(/\/+$/, ""),
    api_type: String(request.body.api_type || "responses"),
    model: String(request.body.model || "").trim(),
    enabled: request.body.enabled ? 1 : 0,
    daily_limit: positiveInteger(request.body.daily_limit, 3, 1000),
  };

  try {
    validateProviderSettings(next);
    const apiKey = String(request.body.api_key || "").trim();
    if (apiKey) {
      const encrypted = encryptApiKey(apiKey);
      next.api_key_ciphertext = encrypted.ciphertext;
      next.api_key_iv = encrypted.iv;
      next.api_key_auth_tag = encrypted.authTag;
    }
    if (next.enabled && !hasUsableApiKey(next)) throw new Error("启用服务前请重新配置 API Key");

    db.prepare(`
      UPDATE provider_settings SET
        provider_name = ?, base_url = ?, api_type = ?, model = ?,
        api_key_ciphertext = ?, api_key_iv = ?, api_key_auth_tag = ?,
        enabled = ?, daily_limit = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(
      next.provider_name,
      next.base_url,
      next.api_type,
      next.model,
      next.api_key_ciphertext || "",
      next.api_key_iv || "",
      next.api_key_auth_tag || "",
      next.enabled,
      next.daily_limit,
    );
    response.json(maskedProviderSettings(getProviderSettings()));
  } catch (error) {
    const message = error.code === "PROVIDER_ENCRYPTION_KEY_NOT_CONFIGURED"
      ? "请先配置至少 32 位的 PROVIDER_ENCRYPTION_KEY"
      : error.message;
    response.status(400).json({ error: message });
  }
});

app.post("/api/admin/provider/test", requireAdmin, async (_request, response) => {
  const settings = getProviderSettings();
  try {
    validateProviderSettings(settings, { requireKey: true });
    const image = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAdSURBVDhPY3i2LeA/JZgBXYBUPGrAqAGjBgwWAwDCc+sfxHsbtwAAAABJRU5ErkJggg==",
      "base64",
    );
    await analyzeImage(settings, { mimetype: "image/png", buffer: image }, { timeoutMs: 30000 });
    response.json({ ok: true });
  } catch (error) {
    const message = error.code === "PROVIDER_ENCRYPTION_KEY_NOT_CONFIGURED"
      ? "请先配置 PROVIDER_ENCRYPTION_KEY"
      : `连接测试失败：${error.message}`;
    response.status(400).json({ error: message });
  }
});

app.use((error, _request, response, _next) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return response.status(413).json({ error: "图片不能超过 8MB" });
  }
  if (error?.code === "INVALID_IMAGE_TYPE") {
    return response.status(400).json({ error: error.message });
  }
  console.error(error);
  response.status(500).json({ error: "服务器处理请求失败" });
});

if (!isProduction) {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  const distDir = path.join(__dirname, "dist");
  app.use(express.static(distDir));
  app.get("*", (_request, response) => response.sendFile(path.join(distDir, "index.html")));
}

app.listen(port, "127.0.0.1", () => {
  console.log(`Prompt Gallery running at http://127.0.0.1:${port}`);
  if (!process.env.ADMIN_PASSWORD) console.log("Local admin password: prompt123");
});
