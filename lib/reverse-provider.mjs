import crypto from "node:crypto";

const ALLOWED_API_TYPES = new Set(["responses", "chat_completions"]);
const REQUIRED_ARRAY_FIELDS = [
  "composition",
  "camera",
  "lighting",
  "colors",
  "materials",
  "text_elements",
  "styles",
  "scenes",
];
const ENGLISH_ARRAY_FIELDS = [
  "composition_en",
  "camera_en",
  "lighting_en",
  "colors_en",
  "materials_en",
  "text_elements_en",
];

const ANALYSIS_INSTRUCTION = `
You are a senior visual prompt engineer. Analyze the supplied image and return one JSON object only.
Do not claim to recover the original prompt. Return evidence-based structured observations.
Every English field must faithfully translate its corresponding Chinese field item by item.

Required JSON shape:
{
  "subject": "concise Chinese description",
  "subject_en": "faithful English translation of subject",
  "composition": ["Chinese observations"],
  "composition_en": ["matching English translations in the same order"],
  "camera": ["Chinese observations"],
  "camera_en": ["matching English translations in the same order"],
  "lighting": ["Chinese observations"],
  "lighting_en": ["matching English translations in the same order"],
  "colors": ["Chinese observations"],
  "colors_en": ["matching English translations in the same order"],
  "materials": ["Chinese observations"],
  "materials_en": ["matching English translations in the same order"],
  "text_elements": ["visible text or typography observations; empty if none"],
  "text_elements_en": ["matching English translations in the same order"],
  "category": "one concise category",
  "category_en": "English translation of category",
  "styles": ["concise style tags"],
  "scenes": ["concise scene tags"],
  "negative_prompt": "comma-separated negative constraints",
  "aspect_ratio": "recommended ratio such as 1:1, 4:5, 3:4, 16:9 or 9:16"
}

Do not return prompt_zh or prompt_en. The server will assemble them exclusively from these structured fields.
Keep arrays focused and evidence-based. Preserve exact visible text when legible. Do not wrap JSON in Markdown.
`.trim();

function encryptionKey() {
  const secret = String(process.env.PROVIDER_ENCRYPTION_KEY || "");
  if (secret.length < 32) {
    const error = new Error("PROVIDER_ENCRYPTION_KEY_NOT_CONFIGURED");
    error.code = "PROVIDER_ENCRYPTION_KEY_NOT_CONFIGURED";
    throw error;
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptApiKey(apiKey) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptApiKey(settings) {
  if (!settings.api_key_ciphertext || !settings.api_key_iv || !settings.api_key_auth_tag) {
    return "";
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(settings.api_key_iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(settings.api_key_auth_tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(settings.api_key_ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function hasUsableApiKey(settings) {
  if (!settings.api_key_ciphertext) return false;
  try {
    return Boolean(decryptApiKey(settings));
  } catch {
    return false;
  }
}

export function validateProviderSettings(settings, { requireKey = false } = {}) {
  const providerName = String(settings.provider_name || "").trim();
  const baseUrl = String(settings.base_url || "").trim().replace(/\/+$/, "");
  const apiType = String(settings.api_type || "");
  const model = String(settings.model || "").trim();

  if (!providerName) throw new Error("请填写提供商名称");
  if (!baseUrl) throw new Error("请填写 Base URL");
  let parsedUrl;
  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    throw new Error("Base URL 格式不正确");
  }
  const localHttp = parsedUrl.protocol === "http:"
    && ["127.0.0.1", "localhost", "::1"].includes(parsedUrl.hostname);
  if (parsedUrl.protocol !== "https:" && !localHttp) {
    throw new Error("Base URL 必须使用 HTTPS，本地测试可使用 localhost");
  }
  if (!ALLOWED_API_TYPES.has(apiType)) throw new Error("接口类型不受支持");
  if (!model) throw new Error("请填写视觉模型");
  if (requireKey && !settings.api_key_ciphertext) throw new Error("请配置 API Key");

  return { providerName, baseUrl, apiType, model };
}

function endpointFor(baseUrl, apiType) {
  return `${baseUrl}${apiType === "responses" ? "/responses" : "/chat/completions"}`;
}

function requestBody(settings, dataUrl) {
  if (settings.api_type === "responses") {
    return {
      model: settings.model,
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: ANALYSIS_INSTRUCTION },
          { type: "input_image", image_url: dataUrl },
        ],
      }],
      max_output_tokens: 3000,
      text: { format: { type: "json_object" } },
    };
  }

  return {
    model: settings.model,
    messages: [{
      role: "user",
      content: [
        { type: "text", text: ANALYSIS_INSTRUCTION },
        { type: "image_url", image_url: { url: dataUrl } },
      ],
    }],
    max_tokens: 3000,
    response_format: { type: "json_object" },
    ...(new URL(settings.base_url).hostname.endsWith("aliyuncs.com")
      ? { enable_thinking: false }
      : {}),
  };
}

function outputText(payload, apiType) {
  if (apiType === "chat_completions") {
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content.map((part) => part?.text || "").join("");
    }
    return "";
  }

  if (typeof payload?.output_text === "string") return payload.output_text;
  return (payload?.output || [])
    .flatMap((item) => item?.content || [])
    .map((part) => part?.text || "")
    .join("");
}

function parseJsonOutput(text) {
  const normalized = String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  if (!normalized) throw new Error("模型没有返回分析结果");

  try {
    return JSON.parse(normalized);
  } catch {
    const start = normalized.indexOf("{");
    const end = normalized.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(normalized.slice(start, end + 1));
    throw new Error("模型返回的 JSON 无法解析");
  }
}

function cleanString(value, maxLength = 12000) {
  return String(value || "").trim().slice(0, maxLength);
}

function cleanList(value) {
  return Array.isArray(value)
    ? value.map((item) => cleanString(item, 500)).filter(Boolean).slice(0, 12)
    : [];
}

function section(label, values) {
  return values.length ? `${label}${values.join("、")}` : "";
}

function assembleChinesePrompt(result) {
  return [
    result.subject,
    section("构图：", result.composition),
    section("镜头：", result.camera),
    section("光线：", result.lighting),
    section("色彩：", result.colors),
    section("材质与质感：", result.materials),
    section("文字元素：", result.text_elements),
    section("风格：", result.styles),
    section("场景：", result.scenes),
    result.category ? `类别：${result.category}` : "",
    result.aspect_ratio ? `画面比例：${result.aspect_ratio}` : "",
  ].filter(Boolean).join("；");
}

function assembleEnglishPrompt(result) {
  const english = [
    result.subject_en,
    section("Composition: ", result.composition_en),
    section("Camera: ", result.camera_en),
    section("Lighting: ", result.lighting_en),
    section("Colors: ", result.colors_en),
    section("Materials and texture: ", result.materials_en),
    section("Text elements: ", result.text_elements_en),
    section("Style: ", result.styles),
    section("Scene: ", result.scenes),
    result.category_en ? `Category: ${result.category_en}` : "",
    result.aspect_ratio ? `Aspect ratio: ${result.aspect_ratio}` : "",
  ].filter(Boolean);
  return english.join("; ");
}

export function normalizeAnalysis(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("模型返回的数据结构不正确");
  }
  const result = {
    subject: cleanString(value.subject, 1000),
    subject_en: cleanString(value.subject_en, 1000),
    category: cleanString(value.category, 120),
    category_en: cleanString(value.category_en, 120),
    negative_prompt: cleanString(value.negative_prompt, 4000),
    aspect_ratio: cleanString(value.aspect_ratio, 40),
  };
  for (const field of REQUIRED_ARRAY_FIELDS) {
    result[field] = cleanList(value[field]);
  }
  for (const field of ENGLISH_ARRAY_FIELDS) {
    result[field] = cleanList(value[field]);
  }
  if (!result.subject || !result.subject_en || !result.category || !result.category_en) {
    throw new Error("模型返回结果缺少必要字段");
  }
  result.prompt_zh = assembleChinesePrompt(result);
  result.prompt_en = assembleEnglishPrompt(result);
  return result;
}

export async function analyzeImage(settings, file, { timeoutMs = 90000 } = {}) {
  validateProviderSettings(settings, { requireKey: true });
  const apiKey = decryptApiKey(settings);
  const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpointFor(settings.base_url, settings.api_type), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(requestBody(settings, dataUrl)),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.error?.message || payload?.message || `上游接口返回 ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    return normalizeAnalysis(parseJsonOutput(outputText(payload, settings.api_type)));
  } catch (error) {
    if (error.name === "AbortError") throw new Error("上游接口响应超时");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function maskedProviderSettings(settings) {
  const keyConfigured = Boolean(settings.api_key_ciphertext);
  const keyUsable = hasUsableApiKey(settings);
  return {
    provider_name: settings.provider_name || "",
    base_url: settings.base_url || "",
    api_type: settings.api_type || "responses",
    model: settings.model || "",
    enabled: Boolean(settings.enabled),
    daily_limit: Number(settings.daily_limit || 3),
    key_configured: keyUsable,
    key_reentry_required: keyConfigured && !keyUsable,
  };
}
