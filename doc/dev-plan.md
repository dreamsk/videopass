# VideoPass - 开发计划

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 框架 | Next.js 14+ (App Router) | 前后端统一，API Routes 处理后端逻辑 |
| 语言 | TypeScript | 类型安全 |
| UI 库 | shadcn/ui + Tailwind CSS | 暗色主题，组件丰富 |
| 图标 | Lucide React | 与 shadcn/ui 配套 |
| 视频提取 | yt-dlp (child_process 直接调用) | 支持 1700+ 平台 |
| 视频合并 | ffmpeg | 合并分离的视频+音频流 |
| 包管理 | npm | |

## 实施步骤与功能点追踪

### Step 0: 项目文档体系搭建

| 功能点 | 文件 | 状态 |
|--------|------|------|
| 项目需求文档 | `doc/requirements.md` | [x] |
| 开发计划文档 | `doc/dev-plan.md` | [x] |
| 架构设计文档 | `doc/architecture.md` | [x] |
| 开发修改记录 | `doc/changelog.md` | [x] |
| CLAUDE.md 工作指引 | `CLAUDE.md` | [x] |

### Step 1: 项目初始化

| 功能点 | 描述 | 状态 |
|--------|------|------|
| 创建 Next.js 项目 | `create-next-app` 初始化 | [x] |
| 初始化 shadcn/ui | 配置主题和组件系统 | [x] |
| 添加 shadcn 组件 | button, input, card, skeleton, badge, separator, textarea | [x] |
| 安装依赖 | youtube-dl-exec (--ignore-scripts), lucide-react | [x] |

### Step 2: 核心库层

| 功能点 | 文件 | 描述 | 状态 |
|--------|------|------|------|
| 类型定义 | `lib/types.ts` | TypeScript 接口定义 | [x] |
| 平台检测 | `lib/platforms.ts` | URL 模式匹配和平台识别 | [x] |
| yt-dlp 封装 | `lib/yt-dlp.ts` | 视频信息提取、流式下载、播放流准备 | [x] |
| 工具函数 | `lib/utils.ts` | 时长格式化、文件大小等 | [x] |

### Step 3: API 路由

| 功能点 | 文件 | 描述 | 状态 |
|--------|------|------|------|
| 提取接口 | `app/api/extract/route.ts` | URL -> 视频元数据 JSON | [x] |
| 下载接口 | `app/api/download/route.ts` | URL + format_id -> 流式下载（合并视频+音频） | [x] |
| 封面图代理 | `app/api/thumbnail/route.ts` | 代理封面图加载（解决 CDN 403） | [x] |
| 流式播放接口 | `app/api/stream/route.ts` | POST 准备播放 + GET Range 流式播放 | [x] |

### Step 4: 前端组件

| 功能点 | 文件 | 描述 | 状态 |
|--------|------|------|------|
| 根布局 | `app/layout.tsx` | 暗色模式、字体、metadata | [x] |
| URL 输入组件 | `components/url-input.tsx` | 输入框 + 平台检测 + 单个/批量模式 + 粘贴自动分行 | [x] |
| 视频预览卡片 | `components/video-card.tsx` | 封面、标题、格式选择、下载、封面保存、在线播放 | [x] |
| 格式选择器 | `components/format-selector.tsx` | 画质/格式按钮组 | [x] |
| 视频播放器 | `components/video-player.tsx` | 播放/暂停、进度条、倍速(0.5x-2x)、音量、全屏 | [x] |
| 平台图标 | `components/platform-logos.tsx` | 支持平台图标展示 | [x] |
| 骨架屏 | `components/skeleton-card.tsx` | 加载状态占位符 | [x] |
| 提取历史列表 | `components/history-list.tsx` | 历史记录展示、单条删除、清空 | [x] |
| 历史记录工具 | `lib/history.ts` | localStorage 读写、最大 20 条 | [x] |
| 主页面 | `app/page.tsx` | 状态管理、单个/批量提取、历史集成 | [x] |

### Step 5: 样式完善与测试

| 功能点 | 描述 | 状态 |
|--------|------|------|
| 暗色主题 | shadcn neutral + dark class | [x] |
| 响应式布局 | max-w-2xl 居中，移动端适配 | [x] |
| TypeScript 编译 | `npx tsc --noEmit` 零错误 | [x] |
| Bilibili 测试 | 提取 + 合并下载 + 封面代理验证通过 | [x] |
| YouTube 测试 | 网络超时（当前环境无法访问 YouTube） | [!] |
| 封面图保存 | 悬浮下载按钮，fetch 代理图片触发浏览器下载 | [x] |
| 在线视频播放 | HTML5 播放器 + `/api/stream` Range 请求 | [x] |
| 播放器倍速 | 0.5x/0.75x/1x/1.25x/1.5x/2x 切换 | [x] |
| 播放器全屏 | requestFullscreen API | [x] |
| 批量视频提取 | textarea 多行输入，逐个提取（仅 Bilibili） | [x] |
| 粘贴自动分行 | 粘连链接自动识别 `https://` 边界并分行 | [x] |
| 提取历史展示 | localStorage 持久化、点击恢复、单条删除、清空 | [x] |
| 错误场景测试 | 无效链接、私有视频等 | [ ] |

> 详细修改记录见 [doc/changelog.md](changelog.md)

## 开发顺序依赖

```
Step 0 (文档) [x]
    ↓
Step 1 (项目初始化) [x]
    ↓
Step 2 (核心库层) [x]
    ↓
Step 3 (API 路由) [x]
    ↓
Step 4 (前端组件) [x]
    ↓
Step 5 (样式与测试) [~]
```

## 状态标记说明

- `[ ]` 未开始
- `[~]` 进行中
- `[x]` 已完成
- `[!]` 受阻（非代码问题）
