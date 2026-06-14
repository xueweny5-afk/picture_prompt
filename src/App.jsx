import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  CaretDown,
  Check,
  Copy,
  Eye,
  EyeSlash,
  FileImage,
  Gear,
  Heart,
  ImageSquare,
  LinkSimple,
  ListBullets,
  MagicWand,
  MagnifyingGlass,
  Moon,
  PencilSimple,
  Plus,
  ShieldCheck,
  SignOut,
  Sparkle,
  SpinnerGap,
  SquaresFour,
  Sun,
  Trash,
  UploadSimple,
  Warning,
  X,
} from "@phosphor-icons/react";

const emptyMeta = { models: [], categories: [], styles: [], scenes: [] };
const ADMIN_MODELS = ["GPT Image", "GPT Image 2", "Midjourney", "Seedream / Jimeng", "Stable Diffusion"];
const ASPECT_RATIOS = ["原图", "1:1", "4:5", "3:4", "16:9", "9:16", "4:3", "3:2", "2:3"];
const PUBLIC_LABELS = {
  model: {
    "GPT Image": "GPT 图像",
    "GPT Image 2": "GPT 图像 2",
    Midjourney: "Midjourney（MJ）",
    "Seedream / Jimeng": "即梦 / Seedream",
    "Stable Diffusion": "稳定扩散",
  },
  category: {
    "Architecture & Spaces": "建筑与空间",
    "Brand & Logos": "品牌与标志",
    "Characters & People": "角色与人物",
    "Charts & Infographics": "图表与信息图",
    "Documents & Publishing": "文档与出版",
    "History & Classical Themes": "历史与古典主题",
    "Illustration & Art": "插画与艺术",
    "Other Use Cases": "其他用途",
    "Photography & Realism": "摄影与写实",
    "Posters & Typography": "海报与字体设计",
    "Products & E-commerce": "产品与电商",
    "Scenes & Storytelling": "场景与叙事",
    "UI & Interfaces": "用户界面",
  },
  tag: {
    "3D": "三维",
    Architecture: "建筑",
    Brand: "品牌",
    Character: "角色",
    Characters: "角色",
    Charts: "图表",
    Classical: "古典",
    Commerce: "商业",
    Creative: "创意",
    Documents: "文档",
    Education: "教育",
    Fashion: "时尚",
    Food: "美食",
    History: "历史",
    Illustration: "插画",
    Infographic: "信息图",
    "Other Use Cases": "其他用途",
    Photography: "摄影",
    Poster: "海报",
    Product: "产品",
    Products: "产品",
    Realistic: "写实",
    Scenes: "场景",
    Social: "社交",
    Story: "叙事",
    Tech: "科技",
    Travel: "旅行",
    UI: "界面",
  },
};

function publicLabel(type, value) {
  return PUBLIC_LABELS[type]?.[value] || value;
}

function uniqueByPublicLabel(type, values) {
  const labels = new Set();
  return values.filter((value) => {
    const label = publicLabel(type, value);
    if (labels.has(label)) return false;
    labels.add(label);
    return true;
  });
}

const emptyForm = {
  title: "",
  slug: "",
  description: "",
  prompt: "",
  negative_prompt: "",
  model: "GPT Image 2",
  category: "Other Use Cases",
  image_url: "",
  aspect_ratio: "4:5",
  source_name: "",
  source_url: "",
  github_url: "",
  styles: [],
  scenes: [],
  published: true,
  featured: false,
};
const emptyProvider = {
  provider_name: "",
  base_url: "https://api.openai.com/v1",
  api_type: "responses",
  model: "",
  api_key: "",
  enabled: false,
  daily_limit: 3,
  key_configured: false,
};

async function request(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data;
}

function Brand({ compact = false }) {
  return (
    <a className={`brand ${compact ? "brand--compact" : ""}`} href="/" aria-label="灵感提示词首页">
      <span className="brand__mark"><Sparkle weight="fill" /></span>
      <span>
        <strong>灵感提示词</strong>
        {!compact && <small>AI 图像提示词库<br />由一人精选整理</small>}
      </span>
    </a>
  );
}

function HeaderActions({ light, onTheme, onAbout }) {
  return (
    <nav className="header-actions">
      <a className="reverse-link" href="/reverse"><MagicWand size={17} /> 图片反推</a>
      <button onClick={onTheme} type="button" aria-label="切换主题">
        {light ? <Sun size={20} /> : <Moon size={20} />}
      </button>
      {onAbout && <button className="about-link" onClick={onAbout} type="button">关于本站</button>}
    </nav>
  );
}

function SearchBar({ value, onChange }) {
  return (
    <label className="search">
      <MagnifyingGlass size={21} />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder="搜索场景、风格或关键词" />
      {value && <button onClick={() => onChange("")} type="button" aria-label="清空搜索"><X size={16} /></button>}
      <kbd>⌘ K</kbd>
    </label>
  );
}

function FilterGroup({ label, values, active, onChange, allLabel, valueType }) {
  const options = [allLabel, ...values];
  return (
    <div className="filter-group">
      <span className="filter-label">{label}</span>
      <div className="filter-list">
        {options.map((value) => (
          <button className={active === value ? "active" : ""} key={value} onClick={() => onChange(value)} type="button">
            {value === allLabel ? value : publicLabel(valueType, value)}
          </button>
        ))}
      </div>
    </div>
  );
}

function TagRow({ item }) {
  const tags = uniqueByPublicLabel("tag", [...(item.styles || []), ...(item.scenes || [])]).slice(0, 8);
  return tags.length ? (
    <div className="tag-row">{tags.map((tag) => <span key={tag}>{publicLabel("tag", tag)}</span>)}</div>
  ) : null;
}

function ArtworkCard({ item, index, onOpen, onCopy }) {
  return (
    <article
      className={`art-card art-card--${index % 7} ${item.featured ? "art-card--featured" : ""}`}
      onClick={() => onOpen(item)}
      tabIndex={0}
      onKeyDown={(event) => event.key === "Enter" && onOpen(item)}
    >
      <img src={item.image_url} alt={item.title} loading="lazy" />
      <div className="art-card__shade" />
      <span className="model-badge">{publicLabel("model", item.model)}</span>
      <div className="art-card__content">
        <h2>{item.title}</h2>
        <p>{item.description}</p>
        <div className="art-card__actions">
          <button
            className="copy-button"
            onClick={(event) => {
              event.stopPropagation();
              onCopy(item.prompt);
            }}
            type="button"
          >
            <Copy size={16} />复制提示词
          </button>
          <button className="icon-button" onClick={(event) => event.stopPropagation()} type="button" aria-label="收藏">
            <Heart size={19} />
          </button>
        </div>
      </div>
    </article>
  );
}

function PromptModal({ item, onClose, onCopy }) {
  useEffect(() => {
    const close = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  if (!item) return null;
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="prompt-modal" onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} type="button" aria-label="关闭"><X size={20} /></button>
        <div className="prompt-modal__image"><img src={item.image_url} alt={item.title} /></div>
        <div className="prompt-modal__body">
          <div className="prompt-modal__meta">
            <span>{publicLabel("model", item.model)}</span><span>{publicLabel("category", item.category)}</span><span>{item.aspect_ratio}</span>
          </div>
          <h2>{item.title}</h2>
          <p className="prompt-modal__description">{item.description}</p>
          <TagRow item={item} />
          <div className="prompt-block">
            <div>
              <span>原始提示词</span>
              <button onClick={() => onCopy(item.prompt)} type="button"><Copy size={16} /> 复制</button>
            </div>
            <p>{item.prompt}</p>
          </div>
          {item.negative_prompt && (
            <div className="prompt-block prompt-block--muted">
              <div><span>反向提示词</span></div><p>{item.negative_prompt}</p>
            </div>
          )}
          {(item.source_name || item.source_url || item.github_url) && (
            <div className="source-block">
              <span>来源出处</span>
              <p>{item.source_name || "awesome-gpt-image-2 社区案例"}</p>
              <div>
                {item.source_url && <a href={item.source_url} target="_blank" rel="noreferrer"><LinkSimple /> 查看来源</a>}
                {item.github_url && <a href={item.github_url} target="_blank" rel="noreferrer"><LinkSimple /> 上游案例</a>}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function chunk(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

function GalleryApp() {
  const [prompts, setPrompts] = useState([]);
  const [meta, setMeta] = useState(emptyMeta);
  const [pagination, setPagination] = useState({ page: 1, total: 0, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [model, setModel] = useState("全部模型");
  const [category, setCategory] = useState("全部分类");
  const [tag, setTag] = useState("全部标签");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState("");
  const [light, setLight] = useState(false);
  const [about, setAbout] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = light ? "light" : "dark";
  }, [light]);

  useEffect(() => {
    request("/api/prompts/meta").then(setMeta).catch((error) => setToast(error.message));
  }, []);

  useEffect(() => {
    setPage(1);
    setPrompts([]);
  }, [query, model, category, tag]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: "21" });
      if (query) params.set("q", query);
      if (model !== "全部模型") params.set("model", model);
      if (category !== "全部分类") params.set("category", category);
      if (tag !== "全部标签") params.set("tag", tag);
      try {
        const data = await request(`/api/prompts?${params}`, { signal: controller.signal });
        setPrompts((current) => page === 1 ? data.items : [...current, ...data.items]);
        setPagination(data.pagination);
      } catch (error) {
        if (error.name !== "AbortError") setToast(error.message);
      } finally {
        setLoading(false);
      }
    }, query ? 180 : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, model, category, tag, page]);

  useEffect(() => {
    const shortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.querySelector(".search input")?.focus();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  async function copyPrompt(text) {
    await navigator.clipboard.writeText(text);
    setToast("提示词已复制");
    setTimeout(() => setToast(""), 1800);
  }

  return (
    <main className="site-shell">
      <header className="site-header">
        <Brand />
        <SearchBar value={query} onChange={setQuery} />
        <HeaderActions light={light} onTheme={() => setLight((value) => !value)} onAbout={() => setAbout(true)} />
      </header>

      <section className="filters">
        <FilterGroup label="模型" valueType="model" values={meta.models} active={model} onChange={setModel} allLabel="全部模型" />
        <FilterGroup label="分类" valueType="category" values={meta.categories} active={category} onChange={setCategory} allLabel="全部分类" />
        <FilterGroup
          label="风格 / 场景"
          valueType="tag"
          values={uniqueByPublicLabel("tag", [...meta.styles, ...meta.scenes]).slice(0, 30)}
          active={tag}
          onChange={setTag}
          allLabel="全部标签"
        />
      </section>

      {loading && page === 1 ? (
        <div className="gallery-skeleton" aria-label="正在加载">
          {Array.from({ length: 7 }, (_, index) => <span key={index} />)}
        </div>
      ) : prompts.length ? (
        <>
          <div className="gallery-summary">共 {pagination.total} 条提示词</div>
          {chunk(prompts, 7).map((group, groupIndex) => (
            <section
              className={`art-grid ${group.length < 7 ? "art-grid--partial" : ""}`}
              key={group[0]?.id || groupIndex}
            >
              {group.map((item, index) => (
                <ArtworkCard key={item.id} item={item} index={index} onOpen={setSelected} onCopy={copyPrompt} />
              ))}
            </section>
          ))}
        </>
      ) : (
        <section className="empty-state">
          <MagnifyingGlass size={30} />
          <h2>没有找到对应灵感</h2>
          <p>换一个关键词或清除筛选条件试试。</p>
          <button type="button" onClick={() => {
            setQuery(""); setModel("全部模型"); setCategory("全部分类"); setTag("全部标签");
          }}>清除筛选</button>
        </section>
      )}

      {pagination.hasMore && (
        <button className="load-more" type="button" disabled={loading} onClick={() => setPage((value) => value + 1)}>
          {loading ? <SpinnerGap className="spin" /> : <>加载更多 <ArrowDown size={16} /></>}
        </button>
      )}

      <footer>
        <span>灵感提示词 © 2026</span>
        <span><a href="/reverse">图片反推</a><a href="/admin">内容管理</a></span>
      </footer>

      <PromptModal item={selected} onClose={() => setSelected(null)} onCopy={copyPrompt} />
      {about && (
        <div className="modal-backdrop" onMouseDown={() => setAbout(false)}>
          <section className="about-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setAbout(false)} type="button"><X size={20} /></button>
            <Sparkle className="about-sparkle" weight="fill" />
            <h2>让好提示词更容易被发现</h2>
            <p>本站保留提示词、适用模型、来源和效果参考，免费开放浏览与复制。</p>
            <p className="legal-copy">部分案例来自 awesome-gpt-image-2 及公开社区，仅供学习研究，不代表已获得商业使用授权。如涉及权利问题，可按来源记录申请修正或下架。</p>
            <a className="notice-link" href="https://github.com/freestylefly/awesome-gpt-image-2" target="_blank" rel="noreferrer">查看上游项目与声明</a>
          </section>
        </div>
      )}
      {toast && <div className="toast"><Check size={17} weight="bold" />{toast}</div>}
    </main>
  );
}

async function prepareImage(file) {
  const bitmap = await createImageBitmap(file);
  const maxSide = Math.max(bitmap.width, bitmap.height);
  if (maxSide <= 2048) {
    bitmap.close();
    return file;
  }
  const scale = 2048 / maxSide;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("图片压缩失败")), "image/jpeg", 0.9);
  });
}

function ResultList({ title, items }) {
  if (!items?.length) return null;
  return (
    <section className="analysis-card">
      <h3>{title}</h3>
      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>
  );
}

function CopyBlock({ title, text, onCopy }) {
  return (
    <section className="result-prompt">
      <div><h3>{title}</h3><button type="button" onClick={() => onCopy(text)}><Copy />复制</button></div>
      <p>{text}</p>
    </section>
  );
}

function ReverseApp() {
  const [status, setStatus] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [light, setLight] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = light ? "light" : "dark";
  }, [light]);

  useEffect(() => {
    request("/api/reverse-status").then(setStatus).catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function chooseFile(nextFile) {
    setError("");
    setResult(null);
    if (!nextFile) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(nextFile.type)) {
      setError("仅支持 PNG、JPG 和 WebP 图片");
      return;
    }
    if (nextFile.size > 8 * 1024 * 1024) {
      setError("图片不能超过 8MB");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(nextFile);
    setPreview(URL.createObjectURL(nextFile));
  }

  async function analyze() {
    if (!file || busy || !status?.available) return;
    setBusy(true);
    setError("");
    try {
      const prepared = await prepareImage(file);
      const body = new FormData();
      body.append("image", prepared, prepared === file ? file.name : "compressed-image.jpg");
      const data = await request("/api/reverse-prompt", { method: "POST", body });
      setResult(data);
      setStatus((current) => ({ ...current, remaining: data.remaining }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function copy(text) {
    await navigator.clipboard.writeText(text);
    setToast("已复制到剪贴板");
    setTimeout(() => setToast(""), 1800);
  }

  const analysis = result?.analysis;
  return (
    <main className="reverse-shell">
      <header className="reverse-header">
        <Brand />
        <nav>
          <a href="/"><ArrowLeft /> 返回画廊</a>
          <button onClick={() => setLight((value) => !value)} type="button">{light ? <Sun /> : <Moon />}</button>
        </nav>
      </header>

      <section className="reverse-hero">
        <span>IMAGE TO PROMPT</span>
        <h1>从画面拆解出可复现的提示词</h1>
        <p>识别主体、构图、镜头、光线、色彩与材质，生成可编辑的中英文 Prompt。结果是基于画面的专业重建，不是原始提示词恢复。</p>
      </section>

      <section className="reverse-workspace">
        <div className="upload-panel">
          <div className="panel-heading"><span>01</span><div><h2>上传参考图</h2><p>PNG、JPG 或 WebP，最大 8MB</p></div></div>
          <label
            className={`reverse-dropzone ${preview ? "has-image" : ""}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              chooseFile(event.dataTransfer.files?.[0]);
            }}
          >
            {preview ? <img src={preview} alt="待分析图片" /> : (
              <div><FileImage size={38} /><strong>拖入图片或点击选择</strong><span>浏览器会将长边压缩至 2048px</span></div>
            )}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => chooseFile(event.target.files?.[0])} />
          </label>
          <div className="privacy-note"><ShieldCheck />图片仅随本次请求发送，不写入服务器磁盘。</div>
          {!status?.available && status && <div className="service-warning"><Warning />服务暂未开放，请等待管理员配置视觉 API。</div>}
          {error && <div className="service-warning"><Warning />{error}</div>}
          <button className="analyze-button" type="button" disabled={!file || !status?.available || busy || status?.remaining <= 0} onClick={analyze}>
            {busy ? <><SpinnerGap className="spin" /> 正在拆解画面</> : <><MagicWand /> 开始反推提示词</>}
          </button>
          <p className="quota-copy">今日剩余 {status?.remaining ?? "-"} / {status?.dailyLimit ?? 3} 次</p>
        </div>

        <div className="result-panel">
          <div className="panel-heading"><span>02</span><div><h2>结构化结果</h2><p>分析完成后可逐项复制与修改</p></div></div>
          {!analysis && <div className="result-placeholder"><ImageSquare size={34} /><p>上传图片后，分析结果会显示在这里。</p></div>}
          {analysis && (
            <div className="analysis-results">
              <section className="analysis-summary">
                <div><span>主体</span><strong>{analysis.subject}</strong></div>
                <div><span>分类</span><strong>{analysis.category}</strong></div>
                <div><span>建议比例</span><strong>{analysis.aspect_ratio}</strong></div>
              </section>
              <div className="analysis-grid">
                <ResultList title="构图" items={analysis.composition} />
                <ResultList title="镜头" items={analysis.camera} />
                <ResultList title="光线" items={analysis.lighting} />
                <ResultList title="色彩" items={analysis.colors} />
                <ResultList title="材质" items={analysis.materials} />
                <ResultList title="文字元素" items={analysis.text_elements} />
              </div>
              <TagRow item={analysis} />
              <CopyBlock title="中文 Prompt · 由上方分析自动整合" text={analysis.prompt_zh} onCopy={copy} />
              <CopyBlock title="English Prompt · Assembled from the analysis above" text={analysis.prompt_en} onCopy={copy} />
              <CopyBlock title="负面约束" text={analysis.negative_prompt} onCopy={copy} />
            </div>
          )}
        </div>
      </section>

      {result?.similar?.length > 0 && (
        <section className="similar-section">
          <div><span>RELATED CASES</span><h2>相似案例</h2></div>
          <div className="similar-grid">
            {result.similar.map((item) => (
              <article key={item.id}>
                <img src={item.image_url} alt={item.title} />
                <div><span>{publicLabel("category", item.category)}</span><h3>{item.title}</h3><button type="button" onClick={() => copy(item.prompt)}><Copy />复制案例 Prompt</button></div>
              </article>
            ))}
          </div>
        </section>
      )}
      {toast && <div className="toast"><Check />{toast}</div>}
    </main>
  );
}

function Login({ onSuccess }) {
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      onSuccess();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <a className="back-link" href="/"><ArrowLeft size={17} /> 返回画廊</a>
      <form className="login-card" onSubmit={submit}>
        <Brand compact />
        <div><h1>内容管理</h1><p>登录后管理提示词与图片反推 API。</p></div>
        <label>
          管理密码
          <span className="password-field">
            <input type={visible ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoFocus />
            <button onClick={() => setVisible((value) => !value)} type="button">{visible ? <EyeSlash /> : <Eye />}</button>
          </span>
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button" disabled={busy} type="submit">{busy ? "正在登录…" : "进入管理后台"}</button>
        <small>本地首次登录密码为 prompt123，登录后可在安全设置中修改。会话与 API 加密密钥会在本机自动生成并持久化。</small>
      </form>
    </main>
  );
}

function TagEditor({ label, values, suggestions, onChange, placeholder }) {
  const [draft, setDraft] = useState("");
  const normalizedValues = Array.isArray(values) ? values : [];
  const available = uniqueByPublicLabel(
    "tag",
    suggestions.filter((item) => !normalizedValues.includes(item)),
  );

  function add(rawValue) {
    const next = String(rawValue || "").trim().replace(/^#/, "");
    if (!next || normalizedValues.some((item) => item.toLowerCase() === next.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...normalizedValues, next]);
    setDraft("");
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add(draft);
    }
    if (event.key === "Backspace" && !draft && normalizedValues.length) {
      onChange(normalizedValues.slice(0, -1));
    }
  }

  return (
    <div className="tag-editor">
      <span className="tag-editor__label">{label}</span>
      <div className="tag-editor__control">
        {normalizedValues.map((item) => (
          <span className="tag-editor__chip" key={item}>
            {publicLabel("tag", item)}
            <button type="button" onClick={() => onChange(normalizedValues.filter((value) => value !== item))} aria-label={`删除标签 ${item}`}>
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => add(draft)}
          placeholder={normalizedValues.length ? "继续添加…" : placeholder}
          maxLength="40"
        />
      </div>
      {available.length > 0 && (
        <div className="tag-editor__suggestions">
          <span>已有标签</span>
          {available.slice(0, 16).map((item) => (
            <button type="button" key={item} onClick={() => add(item)}>+ {publicLabel("tag", item)}</button>
          ))}
        </div>
      )}
      <small>输入后按回车或逗号创建自定义标签。</small>
    </div>
  );
}

function PromptForm({ value, setValue, onSubmit, onCancel, busy, meta }) {
  const [uploading, setUploading] = useState(false);
  const update = (key, next) => setValue((current) => ({ ...current, [key]: next }));
  const modelOptions = [...new Set([value.model, ...ADMIN_MODELS, ...meta.models].filter(Boolean))];
  const aspectRatioOptions = [...new Set([value.aspect_ratio, ...ASPECT_RATIOS].filter(Boolean))];

  async function uploadImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const body = new FormData();
    body.append("image", file);
    try {
      const data = await request("/api/admin/upload", { method: "POST", body });
      update("image_url", data.url);
    } catch (error) {
      window.alert(error.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <form className="editor-form" onSubmit={onSubmit}>
      <div className="form-heading">
        <div><span>{value.id ? "编辑内容" : "新建内容"}</span><h2>{value.id ? value.title : "添加提示词"}</h2></div>
        {value.id && <button className="text-button" onClick={onCancel} type="button">取消编辑</button>}
      </div>
      <div className="form-grid">
        <label>标题<input required value={value.title} onChange={(event) => update("title", event.target.value)} /></label>
        <label>Slug<input value={value.slug} onChange={(event) => update("slug", event.target.value)} placeholder="留空则自动生成" /></label>
        <label>模型<select value={value.model} onChange={(event) => update("model", event.target.value)}>{modelOptions.map((item) => <option key={item} value={item}>{publicLabel("model", item)}</option>)}</select></label>
        <label>画面比例<select value={value.aspect_ratio} onChange={(event) => update("aspect_ratio", event.target.value)}>{aspectRatioOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="check-label"><input type="checkbox" checked={Boolean(value.featured)} onChange={(event) => update("featured", event.target.checked)} /> 首页重点展示</label>
      </div>
      <div className="form-grid tag-editor-grid">
        <TagEditor
          label="风格标签"
          values={value.styles}
          suggestions={meta.styles}
          onChange={(next) => update("styles", next)}
          placeholder="例如：电影感、写实、复古"
        />
        <TagEditor
          label="场景标签"
          values={value.scenes}
          suggestions={meta.scenes}
          onChange={(next) => update("scenes", next)}
          placeholder="例如：旅行、室内、商业"
        />
      </div>
      <label>
        图片概括
        <textarea
          rows="2"
          maxLength="120"
          value={value.description}
          onChange={(event) => update("description", event.target.value)}
          placeholder="用一句话概括画面内容，将显示在卡片和详情标题下方"
        />
      </label>
      <label>原始提示词<textarea required rows="6" value={value.prompt} onChange={(event) => update("prompt", event.target.value)} /></label>
      <label>反向提示词<textarea rows="3" value={value.negative_prompt} onChange={(event) => update("negative_prompt", event.target.value)} /></label>
      <div className="upload-row">
        <label className="upload-button"><UploadSimple />{uploading ? "上传中…" : "上传效果图"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadImage} /></label>
        <input className="image-url" value={value.image_url} onChange={(event) => update("image_url", event.target.value)} placeholder="图片地址" required />
        {value.image_url && <img src={value.image_url} alt="效果预览" />}
      </div>
      <div className="form-grid">
        <label>
          来源备注
          <input
            maxLength="160"
            value={value.source_name || ""}
            onChange={(event) => update("source_name", event.target.value)}
            placeholder="例如作者、平台、账号或图片出处"
          />
        </label>
        <label>
          来源链接
          <input
            type="url"
            value={value.source_url || ""}
            onChange={(event) => update("source_url", event.target.value)}
            placeholder="https://..."
          />
        </label>
      </div>
      <div className="publish-row">
        <label className="switch-label">
          <input type="checkbox" checked={Boolean(value.published)} onChange={(event) => update("published", event.target.checked)} />
          <span />{value.published ? "公开展示" : "保存为草稿"}
        </label>
        <button className="primary-button" disabled={busy} type="submit">{busy ? "保存中…" : value.id ? "保存修改" : "发布提示词"}</button>
      </div>
    </form>
  );
}

function ProviderSettings({ value, setValue, onSave, onTest, busy, testing }) {
  const update = (key, next) => setValue((current) => ({ ...current, [key]: next }));
  const applyQwenPreset = () => setValue((current) => ({
    ...current,
    provider_name: "阿里云百炼",
    base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    api_type: "chat_completions",
    model: "qwen3.7-plus",
  }));
  return (
    <form className="provider-settings" onSubmit={onSave}>
      <div className="provider-heading">
        <div><span>VISION PROVIDER</span><h2><Gear /> 图片反推 API 设置</h2></div>
        <div className="provider-heading-actions">
          <button className="preset-button" type="button" onClick={applyQwenPreset}>应用百炼 Qwen3.7 预设</button>
          <label className="switch-label">
            <input type="checkbox" checked={Boolean(value.enabled)} onChange={(event) => update("enabled", event.target.checked)} />
            <span />{value.enabled ? "公开服务已启用" : "公开服务已关闭"}
          </label>
        </div>
      </div>
      <div className="provider-grid">
        <label>提供商名称<input required value={value.provider_name} onChange={(event) => update("provider_name", event.target.value)} placeholder="例如 OpenAI" /></label>
        <label>接口类型<select value={value.api_type} onChange={(event) => update("api_type", event.target.value)}><option value="responses">Responses API</option><option value="chat_completions">Chat Completions</option></select></label>
        <label className="wide-field">Base URL<input required value={value.base_url} onChange={(event) => update("base_url", event.target.value)} placeholder="https://api.openai.com/v1" /></label>
        <label>视觉模型<input required value={value.model} onChange={(event) => update("model", event.target.value)} placeholder="支持图片输入的模型名称" /></label>
        <label>每天每 IP 次数<input type="number" min="1" max="1000" value={value.daily_limit} onChange={(event) => update("daily_limit", Number(event.target.value))} /></label>
        <label className="wide-field">
          API Key
          <input type="password" value={value.api_key} onChange={(event) => update("api_key", event.target.value)} placeholder={value.key_configured ? "已配置，留空保持不变" : "输入百炼 API Key"} autoComplete="new-password" />
        </label>
      </div>
      {value.key_reentry_required && <div className="service-warning"><Warning />服务器加密主密钥已更新，请重新输入一次 API Key。</div>}
      <div className="provider-actions">
        <p><ShieldCheck />密钥仅在服务端加密保存，前端接口不会返回明文。</p>
        <div>
          <button className="secondary-button" type="button" onClick={onTest} disabled={testing || !value.key_configured}>{testing ? <SpinnerGap className="spin" /> : "测试连接"}</button>
          <button className="primary-button" type="submit" disabled={busy}>{busy ? "保存中…" : "保存 API 设置"}</button>
        </div>
      </div>
    </form>
  );
}

function SecuritySettings({ onMessage }) {
  const [passwords, setPasswords] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  function update(key, value) {
    setPasswords((current) => ({ ...current, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (passwords.new_password !== passwords.confirm_password) {
      onMessage("两次输入的新密码不一致");
      return;
    }
    setBusy(true);
    try {
      await request("/api/admin/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: passwords.current_password,
          new_password: passwords.new_password,
        }),
      });
      setPasswords({ current_password: "", new_password: "", confirm_password: "" });
      onMessage("管理员密码已修改，其他登录会话已失效");
    } catch (error) {
      onMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="provider-settings security-settings" onSubmit={submit}>
      <div className="provider-heading">
        <div><span>SECURITY</span><h2><ShieldCheck /> 安全设置</h2></div>
        <button className="text-button" type="button" onClick={() => setVisible((value) => !value)}>
          {visible ? <><EyeSlash /> 隐藏密码</> : <><Eye /> 显示密码</>}
        </button>
      </div>
      <div className="provider-grid">
        <label className="wide-field">
          当前密码
          <input
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            required
            value={passwords.current_password}
            onChange={(event) => update("current_password", event.target.value)}
          />
        </label>
        <label>
          新密码
          <input
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            minLength="8"
            maxLength="128"
            required
            value={passwords.new_password}
            onChange={(event) => update("new_password", event.target.value)}
            placeholder="至少 8 个字符"
          />
        </label>
        <label>
          确认新密码
          <input
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            minLength="8"
            maxLength="128"
            required
            value={passwords.confirm_password}
            onChange={(event) => update("confirm_password", event.target.value)}
          />
        </label>
      </div>
      <div className="provider-actions">
        <p><ShieldCheck />新密码使用 scrypt 哈希保存，修改后其他登录会话会立即失效。</p>
        <button className="primary-button" type="submit" disabled={busy}>
          {busy ? "修改中…" : "修改管理员密码"}
        </button>
      </div>
    </form>
  );
}

function AdminDashboard({ onLogout }) {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(emptyMeta);
  const [form, setForm] = useState(emptyForm);
  const [provider, setProvider] = useState(emptyProvider);
  const [busy, setBusy] = useState(false);
  const [providerBusy, setProviderBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [contentView, setContentView] = useState(() => {
    const saved = window.localStorage.getItem("prompt-admin-content-view");
    return ["list", "grid", "compact"].includes(saved) ? saved : "list";
  });

  function changeContentView(nextView) {
    setContentView(nextView);
    window.localStorage.setItem("prompt-admin-content-view", nextView);
  }

  function editItem(item) {
    setForm({ ...item, published: Boolean(item.published), featured: Boolean(item.featured) });
    window.scrollTo({ top: 620, behavior: "smooth" });
  }

  async function load() {
    const [promptItems, promptMeta, providerSettings] = await Promise.all([
      request("/api/admin/prompts"),
      request("/api/prompts/meta"),
      request("/api/admin/provider"),
    ]);
    setItems(promptItems);
    setMeta(promptMeta);
    setProvider({ ...emptyProvider, ...providerSettings, api_key: "" });
  }

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, []);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await request(form.id ? `/api/admin/prompts/${form.id}` : "/api/admin/prompts", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm(emptyForm);
      setMessage(form.id ? "修改已保存" : "内容已发布");
      await load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveProvider(event) {
    event.preventDefault();
    setProviderBusy(true);
    try {
      const saved = await request("/api/admin/provider", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(provider),
      });
      setProvider({ ...emptyProvider, ...saved, api_key: "" });
      setMessage("API 设置已保存");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setProviderBusy(false);
    }
  }

  async function testProvider() {
    setTesting(true);
    try {
      await request("/api/admin/provider/test", { method: "POST" });
      setMessage("连接测试成功");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setTesting(false);
    }
  }

  async function remove(item) {
    if (!window.confirm(`确认删除“${item.title}”？`)) return;
    await request(`/api/admin/prompts/${item.id}`, { method: "DELETE" });
    if (form.id === item.id) setForm(emptyForm);
    setMessage("内容已删除");
    await load();
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <Brand compact />
        <div><a href="/">查看公开画廊</a><a href="/reverse">图片反推</a><button onClick={onLogout} type="button"><SignOut /> 退出</button></div>
      </header>
      <section className="admin-intro">
        <div><span>CURATION DESK</span><h1>管理你的灵感收藏</h1><p>维护公开画廊、内容来源与图片反推服务。</p></div>
        <div className="admin-stat"><strong>{items.length}</strong><span>条内容</span></div>
      </section>

      <ProviderSettings value={provider} setValue={setProvider} onSave={saveProvider} onTest={testProvider} busy={providerBusy} testing={testing} />
      <SecuritySettings onMessage={setMessage} />

      <div className="admin-layout">
        <PromptForm value={form} setValue={setForm} onSubmit={save} onCancel={() => setForm(emptyForm)} busy={busy} meta={meta} />
        <section className="content-list">
          <div className="content-list__header">
            <div><span>内容库</span><h2>已收录提示词</h2></div>
            <div className="content-list__tools">
              <div className="view-switcher" aria-label="内容库视图">
                <button className={contentView === "list" ? "active" : ""} onClick={() => changeContentView("list")} type="button" title="列表视图" aria-label="列表视图"><ListBullets /></button>
                <button className={contentView === "grid" ? "active" : ""} onClick={() => changeContentView("grid")} type="button" title="缩略图视图" aria-label="缩略图视图"><SquaresFour /></button>
                <button className={contentView === "compact" ? "active" : ""} onClick={() => changeContentView("compact")} type="button" title="下拉视图" aria-label="下拉视图"><CaretDown /></button>
              </div>
              <button className="new-content-button" onClick={() => setForm(emptyForm)} type="button"><Plus /> 新建</button>
            </div>
          </div>
          <div className={`content-items content-items--${contentView}`}>
            {items.map((item) => contentView === "compact" ? (
              <details className="content-compact" key={item.id}>
                <summary>
                  <span><CaretDown /></span>
                  <strong>{item.title}</strong>
                  <small>{publicLabel("model", item.model)} · {publicLabel("category", item.category)}</small>
                  <em className={item.published ? "status-live" : "status-draft"}>{item.published ? "已公开" : "草稿"}</em>
                </summary>
                <div className="content-compact__body">
                  <img src={item.image_url} alt="" loading="lazy" />
                  <div><p>{item.description || "暂无图片概括"}</p><small>{item.aspect_ratio} · {(item.styles || []).map((tag) => publicLabel("tag", tag)).join(" / ") || "未设置标签"}</small></div>
                  <div className="row-actions">
                    <button onClick={() => editItem(item)} type="button" aria-label="编辑"><PencilSimple /></button>
                    <button onClick={() => remove(item)} type="button" aria-label="删除"><Trash /></button>
                  </div>
                </div>
              </details>
            ) : (
              <article className="content-row" key={item.id}>
                <img src={item.image_url} alt="" loading="lazy" />
                <div className="content-row__body">
                  <div><h3>{item.title}</h3><p>{publicLabel("model", item.model)} · {publicLabel("category", item.category)} · {item.aspect_ratio}</p></div>
                  <span className={item.published ? "status-live" : "status-draft"}>{item.published ? "已公开" : "草稿"}</span>
                </div>
                <div className="row-actions">
                  <button onClick={() => editItem(item)} type="button" aria-label="编辑"><PencilSimple /></button>
                  <button onClick={() => remove(item)} type="button" aria-label="删除"><Trash /></button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
      {message && <div className="toast"><Check />{message}</div>}
    </main>
  );
}

function AdminApp() {
  const [authenticated, setAuthenticated] = useState(null);
  useEffect(() => {
    request("/api/admin/session").then((data) => setAuthenticated(data.authenticated)).catch(() => setAuthenticated(false));
  }, []);
  if (authenticated === null) return <div className="admin-loading"><Sparkle /></div>;
  if (!authenticated) return <Login onSuccess={() => setAuthenticated(true)} />;
  async function logout() {
    await request("/api/admin/logout", { method: "POST" });
    setAuthenticated(false);
  }
  return <AdminDashboard onLogout={logout} />;
}

export function App() {
  const route = useMemo(() => window.location.pathname, []);
  if (route.startsWith("/admin")) return <AdminApp />;
  if (route.startsWith("/reverse")) return <ReverseApp />;
  return <GalleryApp />;
}
