# VideoPass 项目工作指引

## 项目简介

VideoPass 是一个视频提取网页应用，支持从各种视频平台链接中提取视频信息、封面图，并下载视频文件。支持封面图保存、在线视频播放（倍速/全屏）、批量链接提取（仅 Bilibili）、提取历史展示。

## 技术栈

- **框架**: Next.js 14+ (App Router)
- **语言**: TypeScript
- **UI**: shadcn/ui + Tailwind CSS
- **视频提取**: yt-dlp (通过 child_process 直接调用，yt-dlp 二进制位于 `node_modules/youtube-dl-exec/bin/yt-dlp.exe`)
- **视频合并**: ffmpeg (通过 `choco install ffmpeg` 安装，用于合并分离的视频+音频流)
- **包管理**: npm

## 项目文档路径

| 文档 | 路径 | 用途 |
|------|------|------|
| 需求文档 | [doc/requirements.md](doc/requirements.md) | 功能需求、支持平台、UI 需求 |
| 开发计划 | [doc/dev-plan.md](doc/dev-plan.md) | 实施步骤、功能点状态追踪 |
| 架构设计 | [doc/architecture.md](doc/architecture.md) | 目录结构、API 设计、数据流 |
| 修改记录 | [doc/changelog.md](doc/changelog.md) | 开发过程中的修改、修复、测试记录 |

## 功能点状态追踪

详细的功能点完成状态请查看 [doc/dev-plan.md](doc/dev-plan.md)。

状态标记说明：
- `[ ]` 未开始
- `[~]` 进行中
- `[x]` 已完成

### 当前进度汇总

| 阶段 | 状态 |
|------|------|
| Step 0: 文档体系搭建 | [x] |
| Step 1: 项目初始化 | [x] |
| Step 2: 核心库层 | [x] |
| Step 3: API 路由 | [x] |
| Step 4: 前端组件 | [x] |
| Step 5: 样式与测试 | [~] (Bilibili 全功能通过，YouTube 网络受限) |

## 开发规范

### 代码风格

- 使用 TypeScript 严格模式
- 组件使用函数式组件 + Hooks
- 客户端组件需标注 `"use client"`
- 使用 shadcn/ui 组件，避免自定义 UI 代码

### 文件命名

- 组件文件: `kebab-case.tsx` (如 `video-card.tsx`)
- 工具函数: `kebab-case.ts` (如 `utils.ts`)
- API 路由: `app/api/[name]/route.ts`

### API 设计

- 统一响应格式: `{ success: boolean, data?: T, error?: string, code?: string }`
- 错误处理: 使用 ErrorCode 枚举，返回人类可读错误信息
- 流式下载: 使用 Web ReadableStream，避免内存溢出

### 提交规范

提交信息格式: `<type>(<scope>): <subject>`

类型:
- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建/工具链更新

## 常用命令

```bash
# 开发服务器
npm run dev

# 构建
npm run build

# 启动生产服务器
npm start

# 代码检查
npm run lint

# 添加 shadcn 组件
npx shadcn@latest add <component-name>

# 更新 yt-dlp 二进制
npx youtube-dl-exec --update
```

## 注意事项

1. **yt-dlp 二进制**: 通过 `pip install yt-dlp` 安装后复制到 `node_modules/youtube-dl-exec/bin/yt-dlp.exe`。不依赖 youtube-dl-exec 的 postinstall 脚本
2. **yt-dlp 调用方式**: 使用 `child_process.execFile/spawn` 直接调用 yt-dlp 二进制，不使用 youtube-dl-exec 的 JS API（Turbopack 兼容问题）
3. **封面图代理**: 通过 `/api/thumbnail?url=...` 代理加载封面图，解决 Bilibili 等平台 CDN 的 403 问题（需 Referer 头）
4. **视频合并下载**: 下载时 yt-dlp + ffmpeg 自动合并分离的视频+音频流，需先下载到临时文件再流式传输
5. **ffmpeg 依赖**: 视频合并需要 ffmpeg，通过 `choco install ffmpeg` 安装。未安装 ffmpeg 时下载可能失败
6. **流式播放**: `/api/stream` 先 POST 准备（下载到临时文件，30 分钟自动清理），再 GET 流式播放，支持 Range 请求
7. **批量提取**: 批量模式下逐个调用 `/api/extract`，单个失败不影响其他，进度实时更新
8. **提取历史**: localStorage 持久化（key `videopass_history`），最多 20 条，同 URL 去重
9. **错误处理**: 所有 API 路由必须有完善的错误处理和友好的错误提示
10. **Python 依赖**: yt-dlp 通过 pip 安装，需要 Python 3.9+
11. **工作规范**: 每完成一个功能点，必须同步更新 `doc/`目录下的所有文档 和 `CLAUDE.md` 中的状态标记
