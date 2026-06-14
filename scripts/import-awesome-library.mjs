import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "../lib/database.mjs";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const defaultSource = "C:\\Users\\大文\\Desktop\\awesome-gpt-image-2-main\\awesome-gpt-image-2-main";
const sourceRoot = path.resolve(process.argv[2] || process.env.AWESOME_GPT_IMAGE_2_PATH || defaultSource);
const casesPath = path.join(sourceRoot, "data", "cases.json");
const sourceImages = path.join(sourceRoot, "data", "images");
const targetRoot = path.join(projectRoot, "public", "awesome-gpt-image-2");
const targetImages = path.join(targetRoot, "images");

if (!fs.existsSync(casesPath)) {
  throw new Error(`找不到案例数据：${casesPath}`);
}
if (!fs.existsSync(sourceImages)) {
  throw new Error(`找不到案例图片目录：${sourceImages}`);
}

fs.mkdirSync(targetImages, { recursive: true });

const dataset = JSON.parse(fs.readFileSync(casesPath, "utf8"));
const cases = Array.isArray(dataset.cases) ? dataset.cases : [];
const db = openDatabase(projectRoot);

function inferAspectRatio(prompt) {
  const text = String(prompt || "");
  const direct = text.match(/(?:aspect ratio|比例|画幅)[^0-9]{0,20}(\d{1,2}\s*:\s*\d{1,2})/i);
  if (direct) return direct[1].replace(/\s/g, "");
  const generic = text.match(/\b(1:1|2:3|3:2|3:4|4:3|4:5|5:4|9:16|16:9)\b/);
  return generic?.[1] || "原图";
}

const categoryNames = {
  "Architecture & Spaces": "建筑与空间",
  "Brand & Logos": "品牌标志",
  "Characters & People": "人物角色",
  "Charts & Infographics": "信息图表",
  "Documents & Publishing": "文档出版",
  "History & Classical Themes": "历史古典",
  "Illustration & Art": "插画艺术",
  "Other Use Cases": "综合创意",
  "Photography & Realism": "写实摄影",
  "Posters & Typography": "海报版式",
  "Products & E-commerce": "产品电商",
  "Scenes & Storytelling": "场景叙事",
  "UI & Interfaces": "界面设计",
};

function fallbackSummary(item) {
  const category = categoryNames[item.category] || item.category || "视觉创意";
  const title = truncateText(String(item.title || "未命名案例"), 22);
  const tags = [...new Set([...(item.styles || []), ...(item.scenes || [])])].slice(0, 2);
  const tagCopy = tags.length ? `，突出 ${tags.join("、")} 等视觉元素` : "";
  return truncateText(`以“${title}”为主题的${category}案例${tagCopy}。`, 60);
}

function fallbackSummaryV1(item) {
  const category = categoryNames[item.category] || item.category || "视觉创意";
  const tags = [...new Set([...(item.styles || []), ...(item.scenes || [])])].slice(0, 3);
  const tagCopy = tags.length ? `，突出 ${tags.join("、")} 等视觉元素` : "";
  return `以“${item.title || "未命名案例"}”为主题的${category}案例${tagCopy}。`;
}

function truncateText(text, maxLength) {
  const characters = [...String(text || "").trim()];
  if (characters.length <= maxLength) return characters.join("");
  return `${characters.slice(0, maxLength - 1).join("").replace(/[，,；;。\s]+$/, "")}…`;
}

function buildSummaryV1(item) {
  const preview = String(item.promptPreview || item.prompt || "").replace(/\s+/g, " ").trim();
  const hasChinese = /[\u3400-\u9fff]/.test(preview);
  const isInstruction = /^(根据|生成|创建|设计|制作|请|画一张|绘制)/.test(preview);
  if (!preview || !hasChinese || /^[{[]/.test(preview) || isInstruction) return fallbackSummaryV1(item);

  const clauses = preview.split(/(?<=[，,。！？!?；;])/u).filter(Boolean);
  let summary = "";
  for (const clause of clauses) {
    if (summary.length + clause.length > 52 && summary.length >= 24) break;
    summary += clause;
    if (summary.length >= 28) break;
  }
  summary = summary.replace(/[，,；;]\s*$/, "。").trim();
  if (!/[。！？!?]$/.test(summary)) summary += "。";
  return summary || fallbackSummaryV1(item);
}

function buildSummary(item) {
  const preview = String(item.promptPreview || item.prompt || "").replace(/\s+/g, " ").trim();
  const hasChinese = /[\u3400-\u9fff]/.test(preview);
  const isInstruction = /^(根据|生成|创建|设计|制作|请|画一张|绘制)/.test(preview);
  if (!preview || !hasChinese || /^[{[]/.test(preview) || /^[A-Za-z]/.test(preview) || isInstruction) {
    return fallbackSummary(item);
  }

  const clauses = preview.split(/(?<=[，,。！？!?；;])/u).filter(Boolean);
  let summary = "";
  for (const clause of clauses) {
    if (summary.length + clause.length > 52 && summary.length >= 24) break;
    summary += clause;
    if (summary.length >= 28) break;
  }
  summary = summary.replace(/[，,；;]\s*$/, "。").trim();
  if (!/[。！？!?]$/.test(summary)) summary += "。";
  return truncateText(summary || fallbackSummary(item), 60);
}

function copyIfNeeded(source, target) {
  const sourceStat = fs.statSync(source);
  const targetStat = fs.existsSync(target) ? fs.statSync(target) : null;
  if (!targetStat || targetStat.size !== sourceStat.size) {
    fs.copyFileSync(source, target);
    return true;
  }
  return false;
}

const upsert = db.prepare(`
  INSERT INTO prompts (
    title, slug, description, prompt, negative_prompt, model, category, image_url,
    aspect_ratio, published, featured, source_name, source_url, github_url,
    styles_json, scenes_json, source_key, import_rank
  )
  VALUES (?, ?, ?, ?, '', 'GPT Image 2', ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT DO UPDATE SET
    title = excluded.title,
    slug = excluded.slug,
    description = excluded.description,
    prompt = excluded.prompt,
    model = excluded.model,
    category = excluded.category,
    image_url = excluded.image_url,
    aspect_ratio = excluded.aspect_ratio,
    featured = excluded.featured,
    source_name = excluded.source_name,
    source_url = excluded.source_url,
    github_url = excluded.github_url,
    styles_json = excluded.styles_json,
    scenes_json = excluded.scenes_json,
    import_rank = excluded.import_rank,
    updated_at = CURRENT_TIMESTAMP
`);
const findExisting = db.prepare("SELECT description FROM prompts WHERE source_key = ?");

let copied = 0;
let imported = 0;

db.exec("BEGIN");
try {
  for (const item of [...cases].sort((left, right) => Number(left.id) - Number(right.id))) {
    const imageName = path.basename(String(item.image || ""));
    const sourceImage = path.join(sourceImages, imageName);
    if (!imageName || !fs.existsSync(sourceImage)) {
      throw new Error(`案例 ${item.id} 缺少图片：${sourceImage}`);
    }

    if (copyIfNeeded(sourceImage, path.join(targetImages, imageName))) copied += 1;

    const sourceKey = `awesome-gpt-image-2:${item.id}`;
    const legacyDescription = String(item.promptPreview || "").trim();
    const existingDescription = String(findExisting.get(sourceKey)?.description || "").trim();
    const description = !existingDescription
      || existingDescription === legacyDescription
      || existingDescription === buildSummaryV1(item)
      ? buildSummary(item)
      : existingDescription;

    upsert.run(
      String(item.title || `案例 ${item.id}`),
      `awesome-gpt-image-2-${item.id}`,
      description,
      String(item.prompt || "").trim(),
      String(item.category || "Other Use Cases"),
      `/awesome-gpt-image-2/images/${imageName}`,
      inferAspectRatio(item.prompt),
      item.featured ? 1 : 0,
      String(item.sourceLabel || ""),
      String(item.sourceUrl || ""),
      String(item.githubUrl || ""),
      JSON.stringify(item.styles || []),
      JSON.stringify(item.scenes || []),
      sourceKey,
      1000 + Number(item.id),
    );
    imported += 1;
  }
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
}

for (const [source, target] of [
  [path.join(sourceRoot, "LICENSE"), path.join(targetRoot, "LICENSE.txt")],
  [path.join(sourceRoot, "docs", "disclaimer.md"), path.join(targetRoot, "DISCLAIMER.md")],
]) {
  if (fs.existsSync(source)) fs.copyFileSync(source, target);
}

const totals = db.prepare(`
  SELECT
    COUNT(*) AS total,
    SUM(CASE WHEN source_key LIKE 'awesome-gpt-image-2:%' THEN 1 ELSE 0 END) AS imported
  FROM prompts
`).get();

console.log(JSON.stringify({
  sourceRoot,
  processed: imported,
  imagesCopied: copied,
  databaseTotal: Number(totals.total),
  importedTotal: Number(totals.imported),
}, null, 2));
