"use client";

import {
  Play,
  Tv,
  Music,
  MessageCircle,
  Camera,
  Video,
  PlayCircle,
  Monitor,
} from "lucide-react";

const platforms = [
  { name: "YouTube", icon: Play },
  { name: "Bilibili", icon: Tv },
  { name: "TikTok", icon: Music },
  { name: "抖音", icon: Music },
  { name: "Twitter/X", icon: MessageCircle },
  { name: "Instagram", icon: Camera },
  { name: "Vimeo", icon: Video },
  { name: "Dailymotion", icon: PlayCircle },
  { name: "Twitch", icon: Monitor },
];

export function PlatformLogos() {
  return (
    <div className="flex flex-wrap justify-center gap-4 mt-4">
      {platforms.map(({ name, icon: Icon }) => (
        <div
          key={name}
          className="flex flex-col items-center gap-1 text-muted-foreground"
        >
          <Icon className="w-5 h-5" />
          <span className="text-xs">{name}</span>
        </div>
      ))}
    </div>
  );
}
