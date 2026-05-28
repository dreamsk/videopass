"use client";

import { useState, useCallback, type KeyboardEvent, type ClipboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, List, X } from "lucide-react";
import { detectPlatform, getPlatformInfo } from "@/lib/platforms";

// Split glued URLs by detecting https:// boundaries
function extractUrls(text: string): string[] {
  const parts = text.split(/(?=https?:\/\/)/);
  return parts.map((s) => s.trim()).filter((s) => /^https?:\/\//.test(s));
}

interface UrlInputProps {
  onExtract: (url: string) => void;
  onBatchExtract?: (urls: string[]) => void;
  isLoading: boolean;
}

export function UrlInput({ onExtract, onBatchExtract, isLoading }: UrlInputProps) {
  const [url, setUrl] = useState("");
  const [isBatch, setIsBatch] = useState(false);
  const [batchText, setBatchText] = useState("");

  const platform = detectPlatform(url);
  const platformInfo = platform ? getPlatformInfo(platform) : null;

  const handleExtract = () => {
    if (isBatch) {
      const urls = batchText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      if (urls.length > 0 && onBatchExtract) {
        onBatchExtract(urls);
      }
    } else if (url.trim()) {
      onExtract(url.trim());
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !isLoading) {
      if (!isBatch) {
        e.preventDefault();
        handleExtract();
      }
      // batch mode: Enter = newline, Ctrl+Enter = extract
      if (isBatch && e.ctrlKey) {
        e.preventDefault();
        handleExtract();
      }
    }
  };

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLTextAreaElement>) => {
      const pasted = e.clipboardData.getData("text");
      if (!pasted) return;

      const urls = extractUrls(pasted);
      if (urls.length > 1) {
        e.preventDefault();
        setBatchText((prev) => {
          const existing = prev.trim();
          const newLines = urls.join("\n");
          return existing ? existing + "\n" + newLines : newLines;
        });
      }
    },
    []
  );

  const toggleBatch = () => {
    setIsBatch(!isBatch);
    setBatchText("");
    setUrl("");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isBatch && (
            <Badge variant="secondary" className="text-xs border-primary/30">
              批量模式（仅Bilibili）
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleBatch}
          disabled={isLoading}
          className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-primary"
        >
          {isBatch ? (
            <>
              <X className="w-3.5 h-3.5" />
              单个模式
            </>
          ) : (
            <>
              <List className="w-3.5 h-3.5" />
              批量提取
            </>
          )}
        </Button>
      </div>

      {isBatch ? (
        <div className="space-y-2">
          <div className="relative">
            <Textarea
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={"每行一个视频链接（粘贴多条链接自动分行）\nCtrl+Enter 开始提取"}
              className="min-h-[120px] text-base resize-y pr-10 glass-card input-glow transition-all duration-300"
              disabled={isLoading}
            />
            {batchText && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 h-7 w-7"
                onClick={() => setBatchText("")}
                disabled={isLoading}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
          <Button
            onClick={handleExtract}
            disabled={isLoading || !batchText.trim()}
            className="w-full h-11 btn-glow font-heading tracking-wider"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Search className="w-4 h-4 mr-2" />
            )}
            {isLoading ? "提取中..." : "批量提取"}
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="粘贴视频链接..."
              className="h-12 text-base pr-24 glass-card input-glow transition-all duration-300"
              disabled={isLoading}
            />
            {url && !platformInfo && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-3 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setUrl("")}
                disabled={isLoading}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
            {platformInfo && (
              <Badge
                variant="secondary"
                className="absolute right-3 top-1/2 -translate-y-1/2 gap-1 border-primary/30"
              >
                {platformInfo.name}
                <button
                  className="ml-0.5 hover:text-foreground"
                  onClick={() => setUrl("")}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
          </div>
          <Button
            onClick={handleExtract}
            disabled={isLoading || !url.trim()}
            className="h-12 px-6 btn-glow font-heading tracking-wider"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4 mr-2" />
            )}
            {isLoading ? "提取中..." : "提取"}
          </Button>
        </div>
      )}
    </div>
  );
}
