# 灵感提示词

一个面向 AI 生图创作者的自托管提示词画廊，用于整理、展示和复用优秀的图片生成提示词。

项目提供公开画廊、内容管理后台和图片反推工具。访客无需登录即可浏览、筛选和复制提示词；管理员可以维护作品、标签、来源及展示状态，并接入兼容的视觉模型 API，从参考图片生成结构化分析和中英文提示词。

## 功能

- 瀑布流提示词画廊，支持搜索、模型、分类、风格和场景筛选
- 提示词详情展示与一键复制
- GPT Image、Midjourney、Seedream / Jimeng、Stable Diffusion 等多模型标记
- 中文界面及中文化筛选标签
- 管理员登录、密码修改和会话管理
- 提示词新增、编辑、删除、草稿与重点展示
- 自定义风格标签和场景标签
- 列表、缩略图和下拉三种后台内容视图
- 本地图片上传与来源信息记录
- 图片反推：解析主体、构图、镜头、光线、色彩、材质等信息
- 根据结构化分析自动整合中文和英文生图提示词
- 支持 OpenAI 兼容接口，并内置阿里云百炼 Qwen3.7 配置预设
- SQLite 本地存储，API Key 加密保存在服务端

## 技术栈

- React 19
- Vite 6
- Express 4
- Node.js SQLite
- Phosphor Icons

## 本地运行

需要安装支持 `node:sqlite` 的 Node.js 版本，推荐 Node.js 22 或更高版本。

```bash
git clone https://github.com/xueweny5-afk/picture_prompt.git
cd picture_prompt
npm install
npm run dev
```

打开：

- 公开画廊：<http://localhost:4173/>
- 图片反推：<http://localhost:4173/reverse>
- 内容管理：<http://localhost:4173/admin>

本地首次启动时，默认管理员密码为 `prompt123`。登录后台后请立即修改密码。

## 环境配置

项目可以直接本地运行，并会在 `data/` 中自动生成数据库和运行密钥。正式部署时，建议参考 `.env.example`，通过服务器、容器或进程管理工具注入以下环境变量：

主要配置：

```dotenv
PORT=4173
ADMIN_PASSWORD=replace-with-a-strong-password
SESSION_SECRET=replace-with-a-long-random-secret
IP_HASH_SECRET=replace-with-a-separate-long-random-secret
PROVIDER_ENCRYPTION_KEY=replace-with-at-least-32-random-characters
```

`.env`、本地数据库、上传图片、日志和 API 密钥均已通过 `.gitignore` 排除，不会提交到仓库。

## 图片反推配置

进入后台的“图片反推 API 设置”，填写：

1. 提供商名称
2. 接口类型
3. Base URL
4. 视觉模型
5. API Key
6. 每个 IP 的每日调用次数

使用阿里云百炼时，可以点击“应用百炼 Qwen3.7 预设”，再填写 API Key 并测试连接。

## 常用命令

```bash
npm run dev              # 启动本地服务
npm run build            # 构建前端
npm start                # 以生产模式启动
npm run check            # 检查服务端语法并构建前端
npm run test:integration # 运行接口集成测试
```

## 数据与文件

- `data/`：SQLite 数据库、会话及加密运行密钥
- `public/uploads/`：后台上传的图片
- `public/artworks/`：项目内置示例图片
- `dist/`：生产构建结果

运行数据不会进入 Git 仓库。迁移实例时，请单独备份 `data/` 和 `public/uploads/`。

## 第三方内容

部分提示词案例和示例图片可通过导入脚本取自
[`freestylefly/awesome-gpt-image-2`](https://github.com/freestylefly/awesome-gpt-image-2)。
这些内容仅用于学习、研究和展示，不代表已获得商业使用授权。具体说明请查看
[THIRD_PARTY_NOTICE.md](./THIRD_PARTY_NOTICE.md)。

## 当前状态

这是项目的第一版，当前重点是个人维护、公开浏览和提示词复用。作者账户、社区投稿、审核与多人协作暂未纳入这一版本。
