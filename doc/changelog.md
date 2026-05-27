# VideoPass - 开发修改记录

## 2026-05-27

### 项目初始化阶段

| 修改 | 说明 |
|------|------|
| 项目命名 | `VideoPass` 含大写字母，npm 不允许，创建于 tmp-init 子目录后迁移，package.json 中名称为 `videopass` |
| lucide-react 图标替换 | `Youtube`、`Twitter`、`Instagram` 图标在当前版本不存在，替换为 `Play`、`MessageCircle`、`Camera` |
| youtube-dl-exec 安装 | 网络无法访问 GitHub，使用 `--ignore-scripts` 安装，yt-dlp 二进制单独处理 |
| yt-dlp 二进制来源 | 通过 `pip install yt-dlp` 安装后复制到 `node_modules/youtube-dl-exec/bin/yt-dlp.exe` |

### Turbopack 兼容性

| 修改 | 说明 |
|------|------|
| youtube-dl-exec JS API 不可用 | `tinyspawn` 模块在 Next.js Turbopack 环境下 parse 函数返回空错误，完全弃用 JS API |
| 改用 child_process | 重写 `lib/yt-dlp.ts`，使用 `execFile` 提取元数据、`spawn` 流式下载 |
| NodeJS.Readable 类型错误 | `NodeJS.Readable` 命名空间无导出成员，改为 `import { Readable } from "node:stream"` |

### Bilibili 兼容性

| 修改 | 说明 |
|------|------|
| addHeader 导致 403 | yt-dlp 调用中 `addHeader` 选项触发 Bilibili HTTP 403 Forbidden，已移除 |
| 封面图 HTTP→HTTPS | Bilibili 封面图返回 `http://` URL，浏览器 mixed content 策略阻止加载，自动升级为 `https://` |
| 封面图 CDN 403 | HTTPS 升级后 Bilibili CDN (`hdslb.com`) 仍返回 403（需 Referer 头），新增 `/api/thumbnail` 代理接口解决 |
| HTTP Referer 处理 | 代理接口检测 `hdslb.com` 域名时自动设置 `Referer: https://www.bilibili.com/` |

### 视频下载合并

| 修改 | 说明 |
|------|------|
| 单流下载问题 | Bilibili 视频和音频分离存储，单个 format_id 只能下载视频流或音频流 |
| ffmpeg 安装 | 通过 `choco install ffmpeg` 安装，用于合并分离的视频+音频流 |
| 合并选择器设计 | 将画质标签（如 `480p`）作为 format_id，下载时动态生成 `bestvideo[height<=480]+bestaudio/best` 合并选择器 |
| 临时文件中转 | pipe 方式合并失败（ffmpeg 需文件系统随机访问），改为先下载到临时文件再流式传输 |
| normalizeFormats 改造 | `format_id` 替换为画质标签（`1080p`、`720p` 等），按画质去重保留最大文件 |

### 文件名编码

| 修改 | 说明 |
|------|------|
| ByteString 错误 | 中文文件名超出 ASCII 范围，触发 `Content-Disposition` ByteString 错误 |
| RFC 5987 编码 | 使用 `filename=ASCII` 回退 + `filename*=UTF-8''encoded` 双重编码解决 |

### 流式播放

| 修改 | 说明 |
|------|------|
| Range 请求 | `/api/stream` 支持 HTTP Range 请求，允许浏览器 `<video>` 拖动进度条 |
| 临时文件清理 | 播放用临时文件设置 30 分钟自动清理定时器 |
| 播放器自建 | 使用原生 `<video>` + 自定义控制栏（播放/暂停、进度、倍速、音量、全屏），无第三方依赖 |

### 批量提取

| 修改 | 说明 |
|------|------|
| 粘贴自动分行 | 粘贴多条粘连链接时（如 `...thttps://...`），通过 `split(/(?=https?:\/\/)/)` 自动识别并分行 |
| Enter 键行为 | 批量模式下 Enter 正常换行，改为 `Ctrl+Enter` 触发提取 |

## 实际测试结果

| 测试项 | 结果 |
|--------|------|
| Bilibili 提取 (BV1GJ411x7h7) | 成功 - 标题、封面、时长、上传者、3个格式(480p/360p/Audio) |
| 音频下载 | 5.4MB M4A 文件，格式验证通过 (ISO Media, MP4 Base Media) |
| 封面图代理 | 通过 `/api/thumbnail` 成功加载 Bilibili 封面（600KB） |
| 视频合并下载 (480p) | 15MB 文件，ffprobe 确认包含 av1 视频 + aac 音频 |
| YouTube | 网络超时，当前环境无法访问（非代码问题） |

### 批量提取与在线播放

| 修改 | 说明 |
|------|------|
| 批量模式 | textarea 多行输入，逐个调用 `/api/extract`，单个失败不影响其他 |
| 粘贴自动分行 | 粘连链接（如 `...thttps://...`）通过 `split(/(?=https?:\/\/)/)` 自动识别边界 |
| Enter 键行为 | 批量模式下 Enter 正常换行，`Ctrl+Enter` 触发提取 |
| 在线播放器 | 原生 `<video>` + 自定义控制栏，支持倍速(0.5x-2x)、音量、全屏 |
| `/api/stream` 端点 | POST 准备播放（下载到临时文件），GET Range 流式播放 |
| 临时文件清理 | 播放用临时文件 30 分钟自动清理 |

### 提取历史

| 修改 | 说明 |
|------|------|
| localStorage 持久化 | key `videopass_history`，存储 VideoInfo + sourceUrl + timestamp |
| 最大条数 | 20 条，超出淘汰最早的，同 URL 去重 |
| 历史列表组件 | 紧凑列表：缩略图 + 标题 + 平台 + 相对时间 |
| 交互 | 点击恢复视频卡片、悬浮删除单条、一键清空 |

### 抖音支持

| 修改 | 说明 |
|------|------|
| 抖音 URL 识别 | 新增 `douyin` 平台类型，支持 `/video/`、`/note/`、`modal_id=`、`v.douyin.com` 等 URL 格式 |
| 移动端 API 提取 | yt-dlp 无法直接提取抖音，通过 `iesdouyin.com/share/video/{id}` 移动端页面获取视频数据 |
| 视频播放地址 | 从 `_ROUTER_DATA` JSON 中提取 `play_addr.url_list` |
| URL 标准化 | `normalizeDouyinUrl()` 将 `modal_id` 查询参数转换为标准 `/video/` 路径 |
| 下载 0 字节修复 | 修复文件写入竞态条件：`res.on("end")` 改为 `file.on("finish")` 确保文件完全写入后再读取 |
| JSON 解析修复 | `_ROUTER_DATA` 正则从非贪婪 `\{[\s\S]*?\}` 改为贪婪 `\{[\s\S]+}`，避免嵌套 JSON 截断 |
| HTTP 错误码检查 | 下载时检查响应状态码，避免将 4xx/5xx 错误页面写入文件 |
| 下载路由重构 | 抖音下载改为先写入临时文件再读取返回，避免 Node/Web Stream 转换丢失数据 |
| 短链接支持 | 新增 `resolveDouyinShortUrl()` 解析 `v.douyin.com` 短链接重定向 |
