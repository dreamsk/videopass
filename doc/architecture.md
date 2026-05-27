# VideoPass - 架构设计文档

## 1. 系统架构

```
┌──────────────────────────────────────────────────────────────────┐
│                       Browser (Client)                            │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐ │
│  │  UrlInput   │  │  VideoCard  │  │  FormatSel  │  │ VideoPlayer│ │
│  │ (单个/批量) │  │ (封面/播放) │  │  (画质选择) │  │(倍速/全屏) │ │
│  └──────┬─────┘  └──────▲─────┘  └──────┬─────┘  └──────▲─────┘ │
│         │               │               │               │        │
│         │   ┌───────────┴───────────┐   │               │        │
│         └───┤    Main Page (State)   ├───┘               │        │
│             └───────────┬───────────┘                    │        │
│                         │                                │        │
└─────────────────────────┼────────────────────────────────┼────────┘
                          │ HTTP POST/GET                  │
                          ▼                                │
┌──────────────────────────────────────────────────────────────────┐
│                    Next.js Server (API Routes)                    │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────┐ ┌───────────┐ │
│  │ /api/extract  │ │ /api/download│ │/api/thumbnail│ │/api/stream│ │
│  │ (元数据提取)  │ │ (流式下载)   │ │(封面图代理) │ │(流式播放) │ │
│  └──────┬───────┘ └──────┬───────┘ └──────┬─────┘ └─────┬─────┘ │
│         │                │                │              │       │
│         ▼                ▼                │              ▼       │
│  ┌─────────────────────────────────────┐  │  ┌──────────────────┐│
│  │        lib/yt-dlp.ts (封装层)       │  │  │ prepareStream()  ││
│  │  extractVideoInfo()  getVideoStream()│  │  │ + Range 播放     ││
│  └────────────────┬────────────────────┘  │  └────────┬─────────┘│
│                   │                       │           │          │
└───────────────────┼───────────────────────┼───────────┼──────────┘
                    │ Child Process         │ HTTP      │ Child Process
                    ▼                       ▼           ▼
┌──────────────────────┐  ┌───────────────────┐  ┌──────────────────┐
│   yt-dlp (Python)    │  │  远程 CDN 服务器   │  │  yt-dlp + ffmpeg │
│  提取元数据 + 下载   │  │  (hdslb.com 等)   │  │  合并下载到临时   │
└──────────────────────┘  └───────────────────┘  └──────────────────┘
```

## 2. 目录结构

```
d:/VideoPass/
├── app/
│   ├── page.tsx                    # 主页面（单个/批量提取、状态管理）
│   ├── layout.tsx                  # 根布局（暗色模式、Geist 字体）
│   ├── globals.css                 # Tailwind + shadcn 主题变量
│   └── api/
│       ├── extract/
│       │   └── route.ts            # POST: URL -> 视频元数据 JSON
│       ├── download/
│       │   └── route.ts            # POST: URL + format_id -> 流式下载
│       ├── thumbnail/
│       │   └── route.ts            # GET: url -> 代理封面图（解决 403）
│       └── stream/
│           └── route.ts            # POST: 准备播放 / GET: Range 流式播放
├── components/
│   ├── ui/                         # shadcn/ui 组件
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── textarea.tsx
│   │   ├── card.tsx
│   │   ├── skeleton.tsx
│   │   ├── badge.tsx
│   │   └── separator.tsx
│   ├── url-input.tsx               # URL 输入（单个/批量模式、粘贴自动分行）
│   ├── video-card.tsx              # 视频卡片（封面保存、在线播放触发）
│   ├── video-player.tsx            # 视频播放器（倍速、全屏、音量）
│   ├── format-selector.tsx         # 画质/格式选择按钮组
│   ├── history-list.tsx            # 提取历史列表（缩略图+标题+时间）
│   ├── platform-logos.tsx          # 支持平台图标展示
│   └── skeleton-card.tsx           # 加载骨架屏
├── lib/
│   ├── types.ts                    # TypeScript 接口定义
│   ├── platforms.ts                # 平台 URL 模式检测（8 个平台）
│   ├── yt-dlp.ts                   # yt-dlp 封装（提取、下载、播放流）
│   ├── history.ts                  # 提取历史 localStorage 读写
│   └── utils.ts                    # 工具函数
├── doc/                            # 项目文档
│   ├── requirements.md             # 需求文档
│   ├── dev-plan.md                 # 开发计划
│   ├── architecture.md             # 架构设计
│   └── changelog.md                # 开发修改记录
```

**注意**: 历史记录存储在浏览器 localStorage 中，key 为 `videopass_history`，最多 20 条。
├── CLAUDE.md                       # 项目工作指引
├── package.json
├── next.config.ts
├── tsconfig.json
└── components.json                 # shadcn/ui 配置
```

## 3. API 设计

### 3.1 提取接口

**POST** `/api/extract`

请求体：
```typescript
{ url: string }
```

成功响应 (200)：
```typescript
{
  success: true,
  data: {
    id: string,
    title: string,
    thumbnail: string,
    duration: number,
    uploader: string,
    platform: string,
    url: string,
    formats: [{ format_id, ext, resolution, filesize, hasVideo, hasAudio, quality }]
  }
}
```

### 3.2 下载接口

**POST** `/api/download`

请求体：
```typescript
{ url: string, format_id: string, filename?: string }
```

响应：二进制流（已合并视频+音频）
- `Content-Type: application/octet-stream`
- `Content-Disposition: attachment; filename="..."; filename*=UTF-8''...`

### 3.3 封面图代理接口

**GET** `/api/thumbnail?url=<encoded_url>`

代理获取视频封面图，解决 CDN 的 403 问题（如 Bilibili hdslb.com 需要 Referer 头）。

响应：图片二进制流
- `Content-Type: image/jpeg` (或原图类型)
- `Cache-Control: public, max-age=86400`

### 3.4 流式播放接口

**POST** `/api/stream`

准备视频播放，下载合并视频到临时文件。

请求体：`{ url: string, format_id: string }`

响应：`{ success: true, streamId: string }`

**GET** `/api/stream?id=<stream_id>`

流式播放视频，支持 HTTP Range 请求。

- `Content-Type: video/mp4`
- `Accept-Ranges: bytes`
- Range 请求返回 `206 Partial Content` + `Content-Range`
- 临时文件 30 分钟自动清理

## 4. 数据流

### 4.1 提取流程

```
用户粘贴 URL（批量模式：多行 URL）
    ↓
前端 POST /api/extract { url }
    ↓
API 路由验证 URL 格式
    ↓
调用 lib/yt-dlp.ts extractVideoInfo(url)
    ↓
execFile 执行 yt-dlp --dump-single-json
    ↓
解析 JSON，normalizeFormats() 清洗格式列表
    ↓
返回 VideoInfo 给前端
    ↓
前端渲染 VideoCard 组件
```

### 4.2 下载流程

```
用户选择画质，点击下载
    ↓
前端 POST /api/download { url, format_id }
    ↓
qualityToFormatSelector() 将画质标签转为合并选择器
如 "1080p" -> "bestvideo[height<=1080]+bestaudio/bestvideo+bestaudio/best"
    ↓
yt-dlp + ffmpeg 下载到临时目录，自动合并视频+音频流
    ↓
合并完成后，fs.createReadStream 流式返回
    ↓
前端创建 Blob，触发浏览器下载
    ↓
临时文件自动清理
```

### 4.3 在线播放流程

```
用户点击封面图播放按钮
    ↓
前端 POST /api/stream { url, format_id }
    ↓
yt-dlp + ffmpeg 下载合并到临时文件
    ↓
返回 streamId，设置 30 分钟自动清理
    ↓
前端创建 <video src="/api/stream?id=xxx">
    ↓
浏览器发起 GET 请求（支持 Range）
    ↓
服务端返回 206 Partial Content 流式播放
    ↓
用户拖动进度条 → 浏览器发 Range 请求 → 服务端返回对应片段
```

### 4.4 批量提取流程

```
用户在 textarea 输入/粘贴多条链接
    ↓
前端逐个 POST /api/extract
    ↓
每完成一个立即渲染对应 VideoCard
    ↓
显示进度 "正在提取 2/5..."
    ↓
单个失败不影响其他，失败项显示错误信息
```

## 5. 关键设计决策

| 决策 | 原因 |
|------|------|
| 使用普通 `<img>` 而非 Next.js `<Image>` | 封面图来自 1700+ 不同域名，无需逐一配置 remotePatterns |
| 封面图通过代理接口加载 | 部分平台 CDN 需要特定 Referer 头，直接加载会 403 |
| 下载到临时文件再流式传输 | yt-dlp + ffmpeg 合并需要文件系统操作，不能直接 pipe |
| 画质标签作为 format_id | 下载时动态生成合并选择器，无需维护 format ID 映射 |
| 流式下载而非完整缓冲 | 避免大文件（数 GB）导致服务器内存溢出 |
| child_process 直接调用 yt-dlp | youtube-dl-exec 的 tinyspawn 在 Turbopack 下不兼容 |
| 暗色主题为默认 | 媒体工具惯例，减少用户配置 |
| 格式按画质去重 | yt-dlp 返回大量重复格式，需清洗后展示给用户 |
| 原生 `<video>` 播放器 | 需求简单（倍速+全屏），无需引入第三方播放器库 |
| 播放临时文件 30 分钟清理 | 避免磁盘空间泄漏，同时支持视频多次播放 |
| 粘贴自动分行使用 `split(/(?=https?:\/\/)/)` | 简洁有效地处理粘连 URL 的边界识别 |

## 6. 错误处理策略

| 错误类型 | 错误码 | HTTP 状态码 | 用户提示 |
|----------|--------|-------------|----------|
| URL 格式无效 | INVALID_URL | 400 | 请输入有效的视频链接 |
| 不支持的平台 | UNSUPPORTED_PLATFORM | 422 | 暂不支持该网站，请尝试其他平台 |
| 私有/删除视频 | PRIVATE_VIDEO | 403 | 视频不可用，请检查是否为私有视频 |
| 地区限制 | GEO_RESTRICTED | 403 | 视频在当前地区不可用 |
| 请求过于频繁 | RATE_LIMITED | 429 | 请求过于频繁，请稍后再试 |
| 其他错误 | EXTRACTION_FAILED | 500 | 提取失败，请稍后重试 |
