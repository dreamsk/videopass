"use client";

import { Button } from "@/components/ui/button";
import { Trash2, Clock, X } from "lucide-react";
import { getPlatformInfo } from "@/lib/platforms";
import type { HistoryEntry } from "@/lib/history";

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min}分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}小时前`;
  const d = Math.floor(h / 24);
  return `${d}天前`;
}

interface HistoryListProps {
  entries: HistoryEntry[];
  onSelect: (entry: HistoryEntry) => void;
  onRemove: (sourceUrl: string) => void;
  onClear: () => void;
}

export function HistoryList({
  entries,
  onSelect,
  onRemove,
  onClear,
}: HistoryListProps) {
  if (entries.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="w-3.5 h-3.5 text-primary icon-glow" />
          <span className="font-heading tracking-wider">提取历史</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-7 gap-1 text-xs text-muted-foreground hover:text-primary"
        >
          <Trash2 className="w-3 h-3" />
          清空
        </Button>
      </div>

      <div className="rounded-lg divide-y glass-card overflow-hidden">
        {entries.map((entry) => {
          const platformInfo = getPlatformInfo(entry.video.platform);
          return (
            <div
              key={entry.sourceUrl}
              className="flex items-center gap-3 p-2.5 hover:bg-primary/5 cursor-pointer group transition-all duration-300"
              onClick={() => onSelect(entry)}
            >
              <img
                src={`/api/thumbnail?url=${encodeURIComponent(entry.video.thumbnail)}`}
                alt=""
                className="w-16 h-10 object-cover rounded shrink-0 ring-1 ring-border/50"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {entry.video.title}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <span>{platformInfo.name}</span>
                  <span>·</span>
                  <span>{timeAgo(entry.timestamp)}</span>
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(entry.sourceUrl);
                }}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
