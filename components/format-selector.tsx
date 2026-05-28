"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Music } from "lucide-react";
import { cn, formatFileSize } from "@/lib/utils";
import type { VideoFormat } from "@/lib/types";

interface FormatSelectorProps {
  formats: VideoFormat[];
  selected: string | null;
  onSelect: (id: string) => void;
}

export function FormatSelector({
  formats,
  selected,
  onSelect,
}: FormatSelectorProps) {
  if (formats.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">暂无可用格式</p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {formats.map((fmt) => {
        const isSelected = selected === fmt.format_id;
        return (
          <Button
            key={fmt.format_id}
            variant={isSelected ? "default" : "outline"}
            size="sm"
            onClick={() => onSelect(fmt.format_id)}
            className={cn(
              "h-auto py-1.5 px-3 gap-1.5 transition-all duration-300",
              isSelected
                ? "btn-glow font-heading"
                : "glass-card hover:border-primary/40"
            )}
          >
            {fmt.hasVideo ? (
              <span className="font-medium">{fmt.resolution}</span>
            ) : (
              <>
                <Music className="w-3.5 h-3.5" />
                <span className="font-medium">Audio</span>
              </>
            )}
            <Badge
              variant={isSelected ? "secondary" : "outline"}
              className={cn(
                "text-[10px] px-1 py-0",
                isSelected && "border-primary/50"
              )}
            >
              {fmt.ext}
            </Badge>
            {fmt.filesize != null && (
              <span className="text-xs text-muted-foreground">
                {formatFileSize(fmt.filesize)}
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );
}
