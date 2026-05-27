"use client";

import { useState, useEffect, useCallback } from "react";
import { UrlInput } from "@/components/url-input";
import { VideoCard } from "@/components/video-card";
import { SkeletonCard } from "@/components/skeleton-card";
import { PlatformLogos } from "@/components/platform-logos";
import { HistoryList } from "@/components/history-list";
import {
  getHistory,
  addHistory,
  removeHistory,
  clearHistory,
  type HistoryEntry,
} from "@/lib/history";
import { AlertCircle, Video } from "lucide-react";
import type { VideoInfo, ApiResponse } from "@/lib/types";

interface VideoEntry {
  video: VideoInfo;
  sourceUrl: string;
  selectedFormat: string | null;
  isDownloading: boolean;
}

interface ErrorEntry {
  error: string;
  url: string;
}

type Status = "idle" | "loading" | "result" | "error";

export default function Home() {
  const [status, setStatus] = useState<Status>("idle");
  const [videos, setVideos] = useState<(VideoEntry | ErrorEntry)[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(getHistory());
  }, []);

  const handleSelectHistory = useCallback((entry: HistoryEntry) => {
    const videoEntry: VideoEntry = {
      video: entry.video,
      sourceUrl: entry.sourceUrl,
      selectedFormat:
        entry.video.formats.length > 0
          ? entry.video.formats[0].format_id
          : null,
      isDownloading: false,
    };
    setVideos([videoEntry]);
    setStatus("result");
    setError(null);
  }, []);

  const handleRemoveHistory = useCallback((sourceUrl: string) => {
    setHistory(removeHistory(sourceUrl));
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
  }, []);

  const handleExtract = async (url: string) => {
    setStatus("loading");
    setError(null);
    setVideos([]);
    setExtracting(null);

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data: ApiResponse = await res.json();

      if (data.success) {
        const entry: VideoEntry = {
          video: data.data,
          sourceUrl: url,
          selectedFormat:
            data.data.formats.length > 0
              ? data.data.formats[0].format_id
              : null,
          isDownloading: false,
        };
        setVideos([entry]);
        setStatus("result");
        addHistory(data.data, url);
        setHistory(getHistory());
      } else {
        setError(data.error);
        setStatus("error");
      }
    } catch {
      setError("网络错误，请检查连接后重试");
      setStatus("error");
    }
  };

  const handleBatchExtract = async (urls: string[]) => {
    setStatus("loading");
    setError(null);
    setVideos([]);
    setExtracting({ current: 0, total: urls.length });

    const results: (VideoEntry | ErrorEntry)[] = [];

    for (let i = 0; i < urls.length; i++) {
      setExtracting({ current: i + 1, total: urls.length });

      try {
        const res = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: urls[i] }),
        });

        const data: ApiResponse = await res.json();

        if (data.success) {
          results.push({
            video: data.data,
            sourceUrl: urls[i],
            selectedFormat:
              data.data.formats.length > 0
                ? data.data.formats[0].format_id
                : null,
            isDownloading: false,
          });
          addHistory(data.data, urls[i]);
        } else {
          results.push({ error: data.error, url: urls[i] });
        }
      } catch {
        results.push({ error: "网络错误", url: urls[i] });
      }

      // Update UI progressively
      setVideos([...results]);
    }

    setExtracting(null);
    setStatus("result");
    setHistory(getHistory());
  };

  const handleFormatChange = (index: number, formatId: string) => {
    setVideos((prev) =>
      prev.map((entry, i) => {
        if (i !== index || !("video" in entry)) return entry;
        return { ...entry, selectedFormat: formatId };
      })
    );
  };

  const handleDownload = async (index: number) => {
    const entry = videos[index];
    if (!("video" in entry) || !entry.selectedFormat) return;

    setVideos((prev) =>
      prev.map((e, i) =>
        i === index && "video" in e ? { ...e, isDownloading: true } : e
      )
    );

    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: entry.sourceUrl,
          format_id: entry.selectedFormat,
          filename: entry.video.title,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "下载失败");
        return;
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${entry.video.title}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError("下载失败，请稍后重试");
    } finally {
      setVideos((prev) =>
        prev.map((e, i) =>
          i === index && "video" in e ? { ...e, isDownloading: false } : e
        )
      );
    }
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-start px-4 py-12 md:py-20">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Video className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">VideoPass</h1>
          </div>
          <p className="text-muted-foreground">
            粘贴视频链接，提取封面与视频文件
          </p>
          <PlatformLogos />
        </div>

        {/* URL Input */}
        <UrlInput
          onExtract={handleExtract}
          onBatchExtract={handleBatchExtract}
          isLoading={status === "loading"}
        />

        {/* Loading State */}
        {status === "loading" && (
          <div className="space-y-4">
            <SkeletonCard />
            {extracting && extracting.total > 1 && (
              <p className="text-center text-sm text-muted-foreground">
                正在提取 {extracting.current}/{extracting.total}...
              </p>
            )}
          </div>
        )}

        {/* Result State */}
        {status === "result" && videos.length > 0 && (
          <div className="space-y-6">
            {videos.map((entry, index) =>
              "video" in entry ? (
                <VideoCard
                  key={entry.video.id + index}
                  video={entry.video}
                  sourceUrl={entry.sourceUrl}
                  selectedFormat={entry.selectedFormat}
                  onFormatChange={(id) => handleFormatChange(index, id)}
                  onDownload={() => handleDownload(index)}
                  isDownloading={entry.isDownloading}
                />
              ) : (
                <div
                  key={entry.url + index}
                  className="flex items-start gap-3 p-4 rounded-lg border border-destructive/50 bg-destructive/10"
                >
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-medium text-destructive">提取失败</p>
                    <p className="text-sm text-muted-foreground mt-1 truncate">
                      {entry.url}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {entry.error}
                    </p>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {/* Error State (single mode) */}
        {status === "error" && error && (
          <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/50 bg-destructive/10">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-destructive">提取失败</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && status !== "loading" && (
          <HistoryList
            entries={history}
            onSelect={handleSelectHistory}
            onRemove={handleRemoveHistory}
            onClear={handleClearHistory}
          />
        )}
      </div>

      {/* Footer */}
      <footer className="mt-auto pt-12 pb-6 text-center text-xs text-muted-foreground">
        <p>
          Powered by yt-dlp · 支持 YouTube、Bilibili、TikTok 等 1700+ 平台
        </p>
      </footer>
    </main>
  );
}
