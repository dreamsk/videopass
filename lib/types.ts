// Platform types
export type PlatformType =
  | "youtube"
  | "bilibili"
  | "tiktok"
  | "douyin"
  | "twitter"
  | "instagram"
  | "vimeo"
  | "dailymotion"
  | "twitch"
  | "other";

// Quality labels for format selection
export type QualityLabel =
  | "best"
  | "2160p"
  | "1080p"
  | "720p"
  | "480p"
  | "360p"
  | "audio";

// Raw yt-dlp format entry
export interface YtdlpRawFormat {
  format_id: string;
  ext: string;
  resolution: string;
  width: number | null;
  height: number | null;
  fps: number | null;
  vcodec: string;
  acodec: string;
  filesize: number | null;
  filesize_approx: number | null;
  format_note: string;
  tbr: number | null;
  abr: number | null;
  vbr: number | null;
}

// Raw yt-dlp info response
export interface YtdlpRawInfo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: number;
  uploader: string;
  channel: string;
  upload_date: string;
  view_count: number;
  webpage_url: string;
  extractor: string;
  formats: YtdlpRawFormat[];
}

// Cleaned video format for frontend
export interface VideoFormat {
  format_id: string;
  ext: string;
  resolution: string;
  width: number | null;
  height: number | null;
  fps: number | null;
  filesize: number | null;
  hasVideo: boolean;
  hasAudio: boolean;
  quality: QualityLabel;
}

// Cleaned video info for frontend
export interface VideoInfo {
  id: string;
  title: string;
  thumbnail: string;
  duration: number;
  uploader: string;
  platform: PlatformType;
  url: string;
  formats: VideoFormat[];
}

// API request types
export interface ExtractRequest {
  url: string;
}

export interface DownloadRequest {
  url: string;
  format_id: string;
  filename?: string;
}

// API response types
export interface ExtractResponse {
  success: true;
  data: VideoInfo;
}

export interface ApiError {
  success: false;
  error: string;
  code: ErrorCode;
}

export type ErrorCode =
  | "INVALID_URL"
  | "UNSUPPORTED_PLATFORM"
  | "EXTRACTION_FAILED"
  | "GEO_RESTRICTED"
  | "PRIVATE_VIDEO"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export type ApiResponse = ExtractResponse | ApiError;

// Download progress types
export interface DownloadProgress {
  percent: number;
  speed: string;
  eta: string;
  status: "downloading" | "merging" | "complete" | "error";
  error?: string;
}

export interface DownloadStartResponse {
  success: true;
  downloadId: string;
}
