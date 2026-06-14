# 灵感提示词

这是一个用来收藏和分享 AI 生图提示词的网站。

你可以把自己觉得好用的提示词和效果图保存进来，按模型、风格或场景查找。其他人打开网站后，不需要注册账号，就能浏览和复制提示词。

## 它能做什么？

### 浏览提示词

- 像逛图片网站一样浏览作品
- 搜索想要的画面、风格或关键词
- 按 GPT Image、Midjourney、即梦、Stable Diffusion 等模型筛选
- 查看效果图、原始提示词和来源
- 一键复制提示词

### 管理自己的内容

网站带有一个管理后台，可以：

- 添加、修改和删除提示词
- 上传效果图
- 设置风格和场景标签
- 记录作者、平台或原始链接
- 决定内容公开展示还是保存为草稿

### 根据图片反推提示词

上传一张参考图后，AI 会分析画面中的人物、构图、镜头、光线、颜色和材质，并整理成可以继续使用的中文、英文提示词。

目前支持接入 OpenAI 兼容接口，也提供阿里云百炼 Qwen3.7 的快速配置。

## 快速开始

请先安装 Node.js 22 或更高版本。

在命令行中运行：

```bash
git clone https://github.com/xueweny5-afk/picture_prompt.git
cd picture_prompt
npm install
npm run dev
```

看到服务启动后，打开以下地址：

- 网站首页：<http://localhost:4173/>
- 图片反推：<http://localhost:4173/reverse>
- 管理后台：<http://localhost:4173/admin>

第一次登录后台时，默认密码是：

```text
prompt123
```

登录后请尽快在后台修改密码。

## 怎样配置图片反推？

1. 打开管理后台。
2. 找到“图片反推 API 设置”。
3. 填写服务地址、模型名称和 API Key。
4. 点击“测试连接”。
5. 测试成功后保存设置并开启服务。

如果使用阿里云百炼，可以先点击“应用百炼 Qwen3.7 预设”，然后只需填写自己的 API Key。

API Key 会加密保存在网站服务端，不会显示在公开页面中。

## 数据保存在哪里？

提示词、后台密码和设置保存在本机的 `data/` 文件夹中，上传的图片保存在 `public/uploads/` 中。

这些内容不会上传到 GitHub。需要更换电脑或服务器时，请记得备份这两个文件夹：

```text
data/
public/uploads/
```

## 常用命令

```bash
npm run dev              # 启动网站
npm run build            # 构建正式版本
npm start                # 启动正式版本
npm run check            # 检查项目能否正常构建
npm run test:integration # 运行接口测试
```

## 使用到的技术

项目使用 React、Vite、Express 和 SQLite 开发。所有数据默认保存在自己的电脑或服务器上。

## 关于示例内容

部分示例提示词和图片来自公开社区及
[`awesome-gpt-image-2`](https://github.com/freestylefly/awesome-gpt-image-2)，主要用于学习、研究和展示，不代表可以直接用于商业用途。

详细说明请查看 [THIRD_PARTY_NOTICE.md](./THIRD_PARTY_NOTICE.md)。

## 目前的版本

这是项目的第一版，主要适合个人维护提示词，并开放给其他人浏览和复制。

用户注册、社区投稿、内容审核和多人协作暂时还没有加入。
