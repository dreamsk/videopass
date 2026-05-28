import { execFile, spawn } from "node:child_process";
import { Readable } from "node:stream";
import { EventEmitter } from "node:events";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import https from "node:https";
import http from "node:http";
import { detectPlatform } from "./platforms";
import type {
  YtdlpRawFormat,
  YtdlpRawInfo,
  VideoFormat,
  VideoInfo,
  QualityLabel,
  DownloadProgress,
} from "./types";

const YT_DLP_PATH = process.env.YT_DLP_PATH || (
  process.platform === "win32"
    ? path.join(process.cwd(), "node_modules", "youtube-dl-exec", "bin", "yt-dlp.exe")
    : "yt-dlp"
);

// Download progress tracking
interface DownloadEntry {
  progress: DownloadProgress;
  filePath?: string;
  filename?: string;
  timer?: ReturnType<typeof setTimeout>;
}

const downloadStore = new Map<string, DownloadEntry>();
const downloadEvents = new EventEmitter();

function parseProgressLine(line: string, downloadId: string): void {
  const entry = downloadStore.get(downloadId);
  if (!entry) return;

  // [download]  52.3% of   10.23MiB at    3.12MiB/s ETA 00:01
  const progressMatch = line.match(
    /\[download\]\s+([\d.]+)%\s+of\s+~?([\d.]+\w+)\s+at\s+([\d.]+\S+)\s+ETA\s+(\S+)/
  );
  if (progressMatch) {
    entry.progress = {
      percent: parseFloat(progressMatch[1]),
      speed: progressMatch[3],
      eta: progressMatch[4],
      status: "downloading",
    };
    downloadEvents.emit(downloadId, entry.progress);
    return;
  }

  // [Merger] Merging formats into "..."
  if (line.includes("[Merger] Merging formats")) {
    entry.progress = {
      ...entry.progress,
      percent: 100,
      status: "merging",
    };
    downloadEvents.emit(downloadId, entry.progress);
    return;
  }

  // ERROR: ...
  if (line.startsWith("ERROR:") || line.startsWith("ERROR:")) {
    entry.progress = {
      percent: 0,
      speed: "",
      eta: "",
      status: "error",
      error: line.replace(/^ERROR:\s*/, ""),
    };
    downloadEvents.emit(downloadId, entry.progress);
  }
}

export async function downloadWithProgress(
  url: string,
  formatId: string,
  filename?: string
): Promise<string> {
  const normalizedUrl = normalizeDouyinUrl(url);
  const downloadId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "videopass-dl-"));
  const outputPath = path.join(tmpDir, "video.mp4");

  // Initialize download entry
  downloadStore.set(downloadId, {
    progress: { percent: 0, speed: "", eta: "", status: "downloading" },
    filename,
  });

  // Douyin: use direct HTTP download (no yt-dlp progress)
  if (isDouyinUrl(normalizedUrl)) {
    const entry = downloadStore.get(downloadId)!;
    entry.progress = { percent: 0, speed: "", eta: "", status: "downloading" };
    downloadEvents.emit(downloadId, entry.progress);

    try {
      const { filePath, cleanup } = await downloadDouyinToFile(url);
      entry.filePath = filePath;
      entry.progress = { percent: 100, speed: "", eta: "", status: "complete" };
      downloadEvents.emit(downloadId, entry.progress);

      // Schedule cleanup after 5 minutes
      entry.timer = setTimeout(() => {
        fs.rmSync(filePath, { force: true });
        downloadStore.delete(downloadId);
      }, 5 * 60 * 1000);
    } catch (err) {
      entry.progress = {
        percent: 0,
        speed: "",
        eta: "",
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      };
      downloadEvents.emit(downloadId, entry.progress);
    }
    return downloadId;
  }

  // Other platforms: use yt-dlp with progress tracking
  const formatSelector = qualityToFormatSelector(formatId as QualityLabel);
  const baseArgs = [
    "-f", formatSelector,
    "--merge-output-format", "mp4",
    "-o", outputPath,
    "--no-check-certificates",
    "--no-warnings",
    normalizedUrl,
  ];
  const args = await buildYtdlpArgs(baseArgs, normalizedUrl);

  const proc = spawn(YT_DLP_PATH, args);
  let stderrBuffer = "";

  proc.stderr!.on("data", (chunk: Buffer) => {
    stderrBuffer += chunk.toString();
    // yt-dlp uses \r to update progress on the same line
    const lines = stderrBuffer.split(/\r\n|\r|\n/);
    stderrBuffer = lines.pop()!;
    for (const line of lines) {
      if (line.trim()) {
        parseProgressLine(line, downloadId);
      }
    }
    // Also try to parse the buffer in case it has complete progress info
    if (stderrBuffer.trim()) {
      parseProgressLine(stderrBuffer, downloadId);
    }
  });

  proc.on("close", (code) => {
    const entry = downloadStore.get(downloadId);
    if (!entry) return;

    if (code !== 0) {
      entry.progress = {
        percent: 0,
        speed: "",
        eta: "",
        status: "error",
        error: `yt-dlp exited with code ${code}`,
      };
      downloadEvents.emit(downloadId, entry.progress);
      fs.rmSync(tmpDir, { recursive: true, force: true });
      return;
    }

    entry.filePath = outputPath;
    entry.progress = { percent: 100, speed: "", eta: "", status: "complete" };
    downloadEvents.emit(downloadId, entry.progress);

    // Schedule cleanup after 5 minutes
    entry.timer = setTimeout(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      downloadStore.delete(downloadId);
    }, 5 * 60 * 1000);
  });

  proc.on("error", (err) => {
    const entry = downloadStore.get(downloadId);
    if (!entry) return;

    entry.progress = {
      percent: 0,
      speed: "",
      eta: "",
      status: "error",
      error: err.message,
    };
    downloadEvents.emit(downloadId, entry.progress);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  return downloadId;
}

export function getDownloadProgress(downloadId: string): DownloadProgress | null {
  return downloadStore.get(downloadId)?.progress ?? null;
}

export function getDownloadFilePath(downloadId: string): string | null {
  const entry = downloadStore.get(downloadId);
  if (!entry?.filePath || !fs.existsSync(entry.filePath)) return null;
  return entry.filePath;
}

export function getDownloadFilename(downloadId: string): string | null {
  return downloadStore.get(downloadId)?.filename ?? null;
}

export function onDownloadEvent(
  downloadId: string,
  listener: (progress: DownloadProgress) => void
): () => void {
  downloadEvents.on(downloadId, listener);
  return () => downloadEvents.off(downloadId, listener);
}

function runYtdlp(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(YT_DLP_PATH, args, { timeout: 60000 }, (error, stdout, stderr) => {
      if (error) {
        const msg = stderr?.trim() || error.message;
        reject(new Error(msg));
        return;
      }
      resolve(stdout);
    });
  });
}

// Normalize Douyin URLs: convert modal_id format to standard video URL
function normalizeDouyinUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("douyin.com")) {
      const modalId = parsed.searchParams.get("modal_id");
      if (modalId) {
        return `https://www.douyin.com/video/${modalId}`;
      }
    }
  } catch {
    // ignore
  }
  return url;
}

// Fetch fresh Douyin cookies by visiting the page
async function getDouyinCookies(): Promise<string | null> {
  const cookiePath = path.join(os.tmpdir(), "videopass-douyin-cookies.txt");

  return new Promise((resolve) => {
    const req = https.get(
      "https://www.douyin.com/",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      },
      (res) => {
        const cookies: string[] = [];
        const setCookies = res.headers["set-cookie"];
        if (setCookies) {
          for (const c of setCookies) {
            const nameValue = c.split(";")[0];
            cookies.push(
              `.douyin.com\tTRUE\t/\tFALSE\t0\t${nameValue.replace("=", "\t")}`
            );
          }
        }

        if (cookies.length > 0) {
          const content =
            "# Netscape HTTP Cookie File\n" + cookies.join("\n") + "\n";
          fs.writeFileSync(cookiePath, content, "utf-8");
          resolve(cookiePath);
        } else {
          resolve(null);
        }

        // Consume response
        res.resume();
      }
    );

    req.on("error", () => resolve(null));
    req.setTimeout(10000, () => {
      req.destroy();
      resolve(null);
    });
  });
}

function isDouyinUrl(url: string): boolean {
  return /douyin\.com|v\.douyin\.com/.test(url);
}

// Extract video ID from various Douyin URL formats
function extractDouyinVideoId(url: string): string | null {
  // Standard: /video/123456
  let m = url.match(/douyin\.com\/video\/(\d+)/);
  if (m) return m[1];
  // modal_id: /jingxuan?modal_id=123456
  m = url.match(/modal_id=(\d+)/);
  if (m) return m[1];
  // note: /note/123456
  m = url.match(/douyin\.com\/note\/(\d+)/);
  if (m) return m[1];
  return null;
}

// Resolve v.douyin.com short URLs to full URLs
function resolveDouyinShortUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const get = url.startsWith("https") ? https.get : http.get;
    const req = get(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          resolve(res.headers.location);
        } else {
          resolve(url);
        }
        res.resume();
      }
    );
    req.on("error", () => resolve(url));
    req.setTimeout(10000, () => { req.destroy(); resolve(url); });
  });
}

// Fallback: extract Douyin video info via mobile share page
async function extractDouyinInfo(url: string): Promise<VideoInfo> {
  let resolvedUrl = url;
  if (/v\.douyin\.com/.test(url)) {
    resolvedUrl = await resolveDouyinShortUrl(url);
  }
  const videoId = extractDouyinVideoId(resolvedUrl);
  if (!videoId) throw new Error("无法解析抖音视频链接");

  const shareUrl = `https://www.iesdouyin.com/share/video/${videoId}`;

  const html: string = await new Promise((resolve, reject) => {
    const req = https.get(
      shareUrl,
      {
        headers: {
          "User-Agent":
            "com.ss.android.ugc.aweme/110101 (Linux; U; Android 12; zh_CN; Pixel 6; Build/SP1A.210812.016)",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      }
    );
    req.on("error", reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error("请求超时"));
    });
  });

  const routerMatch = html.match(
    /window\._ROUTER_DATA\s*=\s*(\{[\s\S]+)\s*<\/script/
  );
  if (!routerMatch) throw new Error("无法解析抖音页面数据");

  const routerData = JSON.parse(routerMatch[1]);
  const item =
    routerData.loaderData?.["video_(id)/page"]?.videoInfoRes?.item_list?.[0];
  if (!item) throw new Error("无法获取抖音视频信息");

  const video = item.video || {};
  const playUrl = video.play_addr?.url_list?.[0] || "";
  const cover =
    video.cover?.url_list?.[0] ||
    video.origin_cover?.url_list?.[0] ||
    "";
  const duration = (video.duration || item.duration || 0) / 1000;

  // Build formats from bit_rate if available
  const formats: VideoFormat[] = [];
  if (video.bit_rate && Array.isArray(video.bit_rate)) {
    for (const br of video.bit_rate) {
      const h = br.play_addr?.height || null;
      const w = br.play_addr?.width || null;
      const hasVideo = true;
      formats.push({
        format_id: `douyin-${h}p`,
        ext: "mp4",
        resolution: h ? `${h}p` : "Unknown",
        width: w,
        height: h,
        fps: null,
        filesize: null,
        hasVideo,
        hasAudio: true,
        quality: getQualityLabel(h, hasVideo),
      });
    }
  }

  // If no bit_rate formats, add a default one
  if (formats.length === 0) {
    formats.push({
      format_id: "douyin-best",
      ext: "mp4",
      resolution: "720p",
      width: null,
      height: 720,
      fps: null,
      filesize: null,
      hasVideo: true,
      hasAudio: true,
      quality: "720p",
    });
  }

  return {
    id: videoId,
    title: item.desc || "抖音视频",
    thumbnail: cover,
    duration,
    uploader: item.author?.nickname || "Unknown",
    platform: "douyin",
    url: `https://www.douyin.com/video/${videoId}`,
    formats,
  };
}

// Get Douyin video play URL via mobile API
async function getDouyinPlayUrl(url: string): Promise<string> {
  let resolvedUrl = normalizeDouyinUrl(url);
  if (/v\.douyin\.com/.test(url)) {
    resolvedUrl = await resolveDouyinShortUrl(url);
  }
  const videoId = extractDouyinVideoId(resolvedUrl);
  if (!videoId) throw new Error("无法解析抖音视频链接");

  const shareUrl = `https://www.iesdouyin.com/share/video/${videoId}`;

  const html: string = await new Promise((resolve, reject) => {
    const req = https.get(
      shareUrl,
      {
        headers: {
          "User-Agent":
            "com.ss.android.ugc.aweme/110101 (Linux; U; Android 12; zh_CN; Pixel 6; Build/SP1A.210812.016)",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      }
    );
    req.on("error", reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error("请求超时"));
    });
  });

  const routerMatch = html.match(
    /window\._ROUTER_DATA\s*=\s*(\{[\s\S]+)\s*<\/script/
  );
  if (!routerMatch) throw new Error("无法解析抖音页面数据");

  const routerData = JSON.parse(routerMatch[1]);
  const item =
    routerData.loaderData?.["video_(id)/page"]?.videoInfoRes?.item_list?.[0];
  if (!item?.video?.play_addr?.url_list?.[0]) {
    throw new Error("无法获取抖音视频播放地址");
  }

  return item.video.play_addr.url_list[0];
}

// Build yt-dlp args, adding cookies for Douyin and Bilibili
async function buildYtdlpArgs(
  baseArgs: string[],
  url: string
): Promise<string[]> {
  // Douyin cookies
  if (isDouyinUrl(url)) {
    const cookiePath = await getDouyinCookies();
    if (cookiePath) {
      return [...baseArgs, "--cookies", cookiePath];
    }
  }

  // Bilibili cookies (from environment variable or default path)
  if (/bilibili\.com|b23\.tv/.test(url)) {
    const bilibiliCookiePath = process.env.BILIBILI_COOKIES_PATH || "/app/cookies.txt";
    if (fs.existsSync(bilibiliCookiePath)) {
      return [...baseArgs, "--cookies", bilibiliCookiePath];
    }
  }

  return baseArgs;
}

function getQualityLabel(
  height: number | null,
  hasVideo: boolean
): QualityLabel {
  if (!hasVideo) return "audio";
  if (!height) return "360p";
  if (height >= 2160) return "best";
  if (height >= 1080) return "1080p";
  if (height >= 720) return "720p";
  if (height >= 480) return "480p";
  return "360p";
}

function normalizeFormats(rawFormats: YtdlpRawFormat[]): VideoFormat[] {
  const filtered = rawFormats.filter((f) => {
    const id = f.format_id.toLowerCase();
    return !id.includes("source") && !id.includes("storyboard");
  });

  const mapped: VideoFormat[] = filtered.map((f) => {
    const hasVideo = f.vcodec !== "none" && f.vcodec != null;
    const hasAudio = f.acodec !== "none" && f.acodec != null;
    const quality = getQualityLabel(f.height, hasVideo);

    return {
      format_id: f.format_id,
      ext: f.ext,
      resolution: f.height ? `${f.height}p` : hasVideo ? "Unknown" : "Audio",
      width: f.width,
      height: f.height,
      fps: f.fps,
      filesize: f.filesize ?? f.filesize_approx,
      hasVideo,
      hasAudio,
      quality,
    };
  });

  mapped.sort((a, b) => {
    if (a.hasVideo && !b.hasVideo) return -1;
    if (!a.hasVideo && b.hasVideo) return 1;
    return (b.height ?? 0) - (a.height ?? 0);
  });

  const seen = new Map<string, VideoFormat>();
  for (const fmt of mapped) {
    const key = fmt.quality;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, { ...fmt, format_id: key });
    } else {
      const existingSize = existing.filesize ?? 0;
      const currentSize = fmt.filesize ?? 0;
      if (currentSize > existingSize) {
        seen.set(key, { ...fmt, format_id: key });
      }
    }
  }

  return Array.from(seen.values());
}

export async function extractVideoInfo(url: string): Promise<VideoInfo> {
  const normalizedUrl = normalizeDouyinUrl(url);

  // Douyin: try yt-dlp first, fall back to mobile API
  if (isDouyinUrl(normalizedUrl)) {
    try {
      const baseArgs = [
        "--dump-single-json",
        "--no-check-certificates",
        "--no-warnings",
        "--prefer-free-formats",
        normalizedUrl,
      ];
      const args = await buildYtdlpArgs(baseArgs, normalizedUrl);
      const stdout = await runYtdlp(args);
      const result: YtdlpRawInfo = JSON.parse(stdout);
      const formats = normalizeFormats(result.formats ?? []);
      const thumbnail = result.thumbnail?.startsWith("http://")
        ? result.thumbnail.replace("http://", "https://")
        : result.thumbnail;
      return {
        id: result.id,
        title: result.title,
        thumbnail,
        duration: result.duration,
        uploader: result.uploader ?? result.channel ?? "Unknown",
        platform: "douyin",
        url: result.webpage_url ?? url,
        formats,
      };
    } catch {
      return extractDouyinInfo(url);
    }
  }

  const baseArgs = [
    "--dump-single-json",
    "--no-check-certificates",
    "--no-warnings",
    "--prefer-free-formats",
    normalizedUrl,
  ];
  const args = await buildYtdlpArgs(baseArgs, normalizedUrl);
  const stdout = await runYtdlp(args);

  const result: YtdlpRawInfo = JSON.parse(stdout);
  const platform = detectPlatform(url) ?? detectPlatform(normalizedUrl) ?? "other";
  const formats = normalizeFormats(result.formats ?? []);

  // Upgrade HTTP thumbnail URLs to HTTPS to avoid mixed content blocking
  const thumbnail = result.thumbnail?.startsWith("http://")
    ? result.thumbnail.replace("http://", "https://")
    : result.thumbnail;

  return {
    id: result.id,
    title: result.title,
    thumbnail,
    duration: result.duration,
    uploader: result.uploader ?? result.channel ?? "Unknown",
    platform,
    url: result.webpage_url ?? url,
    formats,
  };
}

function qualityToFormatSelector(quality: QualityLabel): string {
  const heightMap: Record<string, number> = {
    best: 2160,
    "1080p": 1080,
    "720p": 720,
    "480p": 480,
    "360p": 360,
  };
  const h = heightMap[quality] ?? 720;
  return `bestvideo[height<=${h}]+bestaudio/bestvideo+bestaudio/best`;
}

const STREAM_DIR = path.join(os.tmpdir(), "videopass-streams");

// Ensure stream directory exists
if (!fs.existsSync(STREAM_DIR)) {
  fs.mkdirSync(STREAM_DIR, { recursive: true });
}

// Track stream files for cleanup
const streamFiles = new Map<string, { path: string; timer: ReturnType<typeof setTimeout> }>();

export async function prepareStream(
  url: string,
  formatId: string
): Promise<string> {
  const normalizedUrl = normalizeDouyinUrl(url);
  const streamId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const outputPath = path.join(STREAM_DIR, `${streamId}.mp4`);

  // Douyin: download via mobile API
  if (isDouyinUrl(normalizedUrl)) {
    const playUrl = await getDouyinPlayUrl(url);
    await new Promise<void>((resolve, reject) => {
      const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: "https://www.douyin.com/",
      };
      const handleResponse = (r: http.IncomingMessage) => {
        if (!r.statusCode || r.statusCode < 200 || r.statusCode >= 300) {
          reject(new Error(`下载失败: HTTP ${r.statusCode}`));
          return;
        }
        const file = fs.createWriteStream(outputPath);
        r.pipe(file);
        file.on("finish", () => { file.close(); resolve(); });
        file.on("error", reject);
        r.on("error", reject);
      };
      const get = playUrl.startsWith("https") ? https.get : http.get;
      const req = get(playUrl, { headers }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirGet = res.headers.location.startsWith("https") ? https.get : http.get;
          redirGet(res.headers.location, { headers }, handleResponse).on("error", reject);
          return;
        }
        handleResponse(res);
      });
      req.on("error", reject);
      req.setTimeout(60000, () => { req.destroy(); reject(new Error("下载超时")); });
    });

    const timer = setTimeout(() => {
      fs.rmSync(outputPath, { force: true });
      streamFiles.delete(streamId);
    }, 30 * 60 * 1000);
    streamFiles.set(streamId, { path: outputPath, timer });
    return streamId;
  }

  const formatSelector = qualityToFormatSelector(formatId as QualityLabel);
  const baseArgs = [
    "-f", formatSelector,
    "--merge-output-format", "mp4",
    "-o", outputPath,
    "--no-check-certificates",
    "--no-warnings",
    normalizedUrl,
  ];
  const args = await buildYtdlpArgs(baseArgs, normalizedUrl);

  return new Promise((resolve, reject) => {
    const proc = spawn(YT_DLP_PATH, args);

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp exited with code ${code}`));
        return;
      }

      // Schedule cleanup after 30 minutes
      const timer = setTimeout(() => {
        fs.rmSync(outputPath, { force: true });
        streamFiles.delete(streamId);
      }, 30 * 60 * 1000);

      streamFiles.set(streamId, { path: outputPath, timer });
      resolve(streamId);
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}

export function getStreamFilePath(streamId: string): string | null {
  const entry = streamFiles.get(streamId);
  if (!entry || !fs.existsSync(entry.path)) return null;
  return entry.path;
}

// Download Douyin video via mobile API play URL
function getDouyinVideoStream(
  url: string
): { stream: Readable; cleanup: () => void } {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "videopass-dy-"));
  const outputPath = path.join(tmpDir, "video.mp4");

  const stream = new Readable({ read() {} });
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  };

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    Referer: "https://www.douyin.com/",
  };

  // Write response body to file, then stream file to output
  const writeToStream = (res: http.IncomingMessage) => {
    if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
      stream.destroy(new Error(`下载失败: HTTP ${res.statusCode}`));
      cleanup();
      return;
    }
    const file = fs.createWriteStream(outputPath);
    res.pipe(file);
    file.on("finish", () => {
      file.close();
      const rs = fs.createReadStream(outputPath);
      rs.on("data", (chunk) => stream.push(chunk));
      rs.on("end", () => {
        stream.push(null);
        cleanup();
      });
      rs.on("error", (err) => {
        stream.destroy(err);
        cleanup();
      });
    });
    file.on("error", (err) => {
      stream.destroy(err);
      cleanup();
    });
  };

  getDouyinPlayUrl(url)
    .then((playUrl) => {
      const get = playUrl.startsWith("https") ? https.get : http.get;
      const req = get(playUrl, { headers }, (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          const redirGet = res.headers.location.startsWith("https")
            ? https.get
            : http.get;
          const redirReq = redirGet(
            res.headers.location,
            { headers },
            writeToStream
          );
          redirReq.on("error", (err) => {
            stream.destroy(err);
            cleanup();
          });
          return;
        }
        writeToStream(res);
      });
      req.on("error", (err) => {
        stream.destroy(err);
        cleanup();
      });
      req.setTimeout(60000, () => {
        req.destroy();
        stream.destroy(new Error("下载超时"));
        cleanup();
      });
    })
    .catch((err) => {
      stream.destroy(err);
      cleanup();
    });

  return { stream, cleanup };
}

// Download Douyin video to a temp file and return the path
export async function downloadDouyinToFile(url: string): Promise<{ filePath: string; cleanup: () => void }> {
  const resolvedUrl = /v\.douyin\.com/.test(url) ? await resolveDouyinShortUrl(url) : url;
  const videoId = extractDouyinVideoId(normalizeDouyinUrl(resolvedUrl));
  if (!videoId) throw new Error("无法解析抖音视频链接");

  const playUrl = await getDouyinPlayUrl(resolvedUrl);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "videopass-dy-"));
  const outputPath = path.join(tmpDir, "video.mp4");

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  };

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    Referer: "https://www.douyin.com/",
  };

  await new Promise<void>((resolve, reject) => {
    const handleResponse = (res: http.IncomingMessage) => {
      if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`下载失败: HTTP ${res.statusCode}`));
        return;
      }
      const file = fs.createWriteStream(outputPath);
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
      file.on("error", reject);
      res.on("error", reject);
    };

    const get = playUrl.startsWith("https") ? https.get : http.get;
    const req = get(playUrl, { headers }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirGet = res.headers.location.startsWith("https") ? https.get : http.get;
        redirGet(res.headers.location, { headers }, handleResponse).on("error", reject);
        return;
      }
      handleResponse(res);
    });
    req.on("error", reject);
    req.setTimeout(120000, () => { req.destroy(); reject(new Error("下载超时")); });
  });

  return { filePath: outputPath, cleanup };
}

export async function getVideoStream(
  url: string,
  formatId: string
): Promise<{ stream: Readable; cleanup: () => void }> {
  const normalizedUrl = normalizeDouyinUrl(url);

  // Douyin: download via mobile API
  if (isDouyinUrl(normalizedUrl)) {
    return getDouyinVideoStream(url);
  }

  const formatSelector = qualityToFormatSelector(formatId as QualityLabel);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "videopass-"));
  const outputPath = path.join(tmpDir, "video.mp4");

  const baseArgs = [
    "-f", formatSelector,
    "--merge-output-format", "mp4",
    "-o", outputPath,
    "--no-check-certificates",
    "--no-warnings",
    normalizedUrl,
  ];
  const args = await buildYtdlpArgs(baseArgs, normalizedUrl);

  const proc = spawn(YT_DLP_PATH, args);

  let fileStream: fs.ReadStream | null = null;

  const stream = new Readable({
    read() {
      // no-op, data pushed via events
    },
  });

  proc.on("close", (code) => {
    if (code !== 0) {
      stream.destroy(new Error(`yt-dlp exited with code ${code}`));
      fs.rmSync(tmpDir, { recursive: true, force: true });
      return;
    }

    fileStream = fs.createReadStream(outputPath);
    fileStream.on("data", (chunk) => stream.push(chunk));
    fileStream.on("end", () => {
      stream.push(null);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
    fileStream.on("error", (err) => {
      stream.destroy(err);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  proc.on("error", (err) => {
    stream.destroy(err);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  return {
    stream,
    cleanup: () => {
      proc.kill();
      fileStream?.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    },
  };
}
