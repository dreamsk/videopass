"use client";

import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect, useRef } from "react";
import { Loader2, Download, Clock, User, ImageDown, Play, X, Check } from "lucide-react";
import { FormatSelector } from "./format-selector";
import { VideoPlayer } from "./video-player";
import { formatDuration, sanitizeFilename } from "@/lib/utils";
import { getPlatformInfo } from "@/lib/platforms";
import type { VideoInfo, DownloadProgress } from "@/lib/types";

interface VideoCardProps {
  video: VideoInfo;
  sourceUrl: string;
  selectedFormat: string | null;
  onFormatChange: (id: string) => void;
}

export function VideoCard({
  video,
  sourceUrl,
  selectedFormat,
  onFormatChange,
}: VideoCardProps) {
  const platformInfo = getPlatformInfo(video.platform);
  const [isSavingCover, setIsSavingCover] = useState(false);
  const [streamSrc, setStreamSrc] = useState<string | null>(null);
  const [isPreparingPlay, setIsPreparingPlay] = useState(false);

  // Download progress state
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  const handleDownload = async () => {
    if (!selectedFormat) return;

    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: sourceUrl,
          format_id: selectedFormat,
          filename: video.title,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setDownloadProgress({
          percent: 0,
          speed: "",
          eta: "",
          status: "error",
          error: data.error,
        });
        return;
      }

      const { downloadId } = data;
      setDownloadProgress({
        percent: 0,
        speed: "",
        eta: "",
        status: "downloading",
      });

      // Open SSE connection for progress
      const eventSource = new EventSource(`/api/download/progress?id=${downloadId}`);
      eventSourceRef.current = eventSource;

      eventSource.addEventListener("progress", (event) => {
        const progress = JSON.parse(event.data) as DownloadProgress;
        setDownloadProgress(progress);
      });

      eventSource.addEventListener("complete", () => {
        eventSource.close();
        eventSourceRef.current = null;
        setDownloadProgress({
          percent: 100,
          speed: "",
          eta: "",
          status: "complete",
        });

        // Trigger browser download
        const a = document.createElement("a");
        a.href = `/api/download/file?id=${downloadId}`;
        a.download = `${video.title}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Reset after a brief delay
        setTimeout(() => setDownloadProgress(null), 2000);
      });

      eventSource.addEventListener("error", (event) => {
        eventSource.close();
        eventSourceRef.current = null;
        const data = (event as MessageEvent).data;
        setDownloadProgress({
          percent: 0,
          speed: "",
          eta: "",
          status: "error",
          error: data ? JSON.parse(data).error : "连接中断",
        });
      });

      eventSource.onerror = () => {
        eventSource.close();
        eventSourceRef.current = null;
        if (downloadProgress?.status === "downloading") {
          setDownloadProgress({
            percent: 0,
            speed: "",
            eta: "",
            status: "error",
            error: "连接中断",
          });
        }
      };
    } catch {
      setDownloadProgress({
        percent: 0,
        speed: "",
        eta: "",
        status: "error",
        error: "网络错误",
      });
    }
  };

  const handleCancelDownload = () => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setDownloadProgress(null);
  };

  const handlePlay = async () => {
    if (!selectedFormat) return;
    setIsPreparingPlay(true);
    try {
      const res = await fetch("/api/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sourceUrl, format_id: selectedFormat }),
      });
      const data = await res.json();
      if (data.success && data.streamId) {
        setStreamSrc(`/api/stream?id=${data.streamId}`);
      }
    } catch {
      // silent fail
    } finally {
      setIsPreparingPlay(false);
    }
  };

  const handleSaveCover = async () => {
    setIsSavingCover(true);
    try {
      const res = await fetch(`/api/thumbnail?url=${encodeURIComponent(video.thumbnail)}`);
      if (!res.ok) throw new Error("下载失败");
      const blob = await res.blob();
      const ext = video.thumbnail.match(/\.(jpe?g|png|webp|gif)(?:\?|$)/i)?.[1] || "jpg";
      const filename = `${sanitizeFilename(video.title)}.${ext}`;
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch {
      // silent fail
    } finally {
      setIsSavingCover(false);
    }
  };

  const isDownloading = downloadProgress !== null && downloadProgress.status !== "complete";
  const isError = downloadProgress?.status === "error";
  const isComplete = downloadProgress?.status === "complete";

  return (
    <Card className="overflow-hidden">
      {streamSrc ? (
        <VideoPlayer src={streamSrc} />
      ) : (
        <div className="relative group">
          <img
            src={`/api/thumbnail?url=${encodeURIComponent(video.thumbnail)}`}
            alt={video.title}
            className="w-full aspect-video object-cover"
          />
          <Badge className="absolute top-3 left-3">
            <Clock className="w-3 h-3 mr-1" />
            {formatDuration(video.duration)}
          </Badge>
          <Badge variant="secondary" className="absolute top-3 right-3">
            {platformInfo.name}
          </Badge>
          {/* Play button overlay */}
          <button
            className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            onClick={handlePlay}
            disabled={isPreparingPlay || !selectedFormat}
            title="在线播放"
          >
            {isPreparingPlay ? (
              <Loader2 className="w-14 h-14 text-white animate-spin" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors">
                <Play className="w-8 h-8 text-white ml-1" fill="white" />
              </div>
            )}
          </button>
          {/* Cover download button */}
          <Button
            size="icon"
            variant="secondary"
            className="absolute bottom-3 right-3 h-9 w-9 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 hover:bg-black/80 text-white z-10"
            onClick={(e) => {
              e.stopPropagation();
              handleSaveCover();
            }}
            disabled={isSavingCover}
            title="保存封面图"
          >
            {isSavingCover ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ImageDown className="w-4 h-4" />
            )}
          </Button>
        </div>
      )}

      <CardContent className="p-4 space-y-3">
        <h3 className="font-semibold text-lg line-clamp-2 leading-snug">
          {video.title}
        </h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="w-4 h-4" />
          <span>{video.uploader}</span>
        </div>

        <Separator />

        <div className="space-y-2">
          <p className="text-sm font-medium">选择画质</p>
          <FormatSelector
            formats={video.formats}
            selected={selectedFormat}
            onSelect={onFormatChange}
          />
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0">
        {isDownloading ? (
          <div className="w-full space-y-2">
            {downloadProgress.status === "merging" ? (
              <>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full w-full animate-pulse" />
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>正在合并视频和音频...</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={handleCancelDownload}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${downloadProgress.percent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {downloadProgress.percent.toFixed(1)}%
                  </span>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {downloadProgress.speed && (
                      <span>↓ {downloadProgress.speed}</span>
                    )}
                    {downloadProgress.eta && downloadProgress.eta !== "Unknown" && (
                      <span>ETA {downloadProgress.eta}</span>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={handleCancelDownload}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : isError ? (
          <div className="w-full space-y-2">
            <p className="text-sm text-destructive">{downloadProgress?.error}</p>
            <Button
              onClick={() => setDownloadProgress(null)}
              variant="outline"
              className="w-full h-11"
            >
              重试
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleDownload}
            disabled={!selectedFormat || isComplete}
            className="w-full h-11"
            size="lg"
          >
            {isComplete ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                下载完成
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                下载视频
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
