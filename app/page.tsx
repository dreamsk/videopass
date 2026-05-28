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

  return (
    <>
      {/* Background glow effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
        <div
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-glow-cyan opacity-30"
          style={{ animation: 'pulse-glow 8s ease-in-out infinite, float-1 20s ease-in-out infinite' }}
        />
        <div
          className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-glow-purple opacity-25"
          style={{ animation: 'pulse-glow 10s ease-in-out infinite 2s, float-2 25s ease-in-out infinite' }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-15"
          style={{
            background: 'radial-gradient(circle, rgba(var(--glow-cyan-rgb), 0.2) 0%, rgba(var(--glow-purple-rgb), 0.1) 50%, transparent 70%)',
            animation: 'pulse-glow 12s ease-in-out infinite 4s',
          }}
        />
      </div>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-start px-4 py-12 md:py-20">
        <div className="w-full max-w-2xl space-y-8">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center gap-3">
              <Video className="w-9 h-9 text-primary icon-glow" />
              <h1 className="text-4xl font-bold font-heading text-gradient">VideoPass</h1>
            </div>
            <p className="text-muted-foreground text-sm tracking-wide">
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
                  />
                ) : (
                  <div
                    key={entry.url + index}
                    className="flex items-start gap-3 p-4 rounded-lg border border-destructive/50 bg-destructive/10 glass-card"
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
            <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/50 bg-destructive/10 glass-card">
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
        <footer className="mt-auto pt-12 pb-6 text-center text-xs text-muted-foreground/60">
          <p className="tracking-wider">
            Powered by yt-dlp · 支持 YouTube、Bilibili、TikTok 等 1700+ 平台
          </p>
        </footer>
      </main>
    </>
  );
}
