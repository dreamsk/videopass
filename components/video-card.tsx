"use client";

import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { Loader2, Download, Clock, User, ImageDown, Play } from "lucide-react";
import { FormatSelector } from "./format-selector";
import { VideoPlayer } from "./video-player";
import { formatDuration, sanitizeFilename } from "@/lib/utils";
import { getPlatformInfo } from "@/lib/platforms";
import type { VideoInfo } from "@/lib/types";

interface VideoCardProps {
  video: VideoInfo;
  sourceUrl: string;
  selectedFormat: string | null;
  onFormatChange: (id: string) => void;
  onDownload: () => void;
  isDownloading: boolean;
}

export function VideoCard({
  video,
  sourceUrl,
  selectedFormat,
  onFormatChange,
  onDownload,
  isDownloading,
}: VideoCardProps) {
  const platformInfo = getPlatformInfo(video.platform);
  const [isSavingCover, setIsSavingCover] = useState(false);
  const [streamSrc, setStreamSrc] = useState<string | null>(null);
  const [isPreparingPlay, setIsPreparingPlay] = useState(false);

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
        <Button
          onClick={onDownload}
          disabled={!selectedFormat || isDownloading}
          className="w-full h-11"
          size="lg"
        >
          {isDownloading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              下载中...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              下载视频
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
