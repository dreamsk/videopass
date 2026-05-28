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
    <div className="flex flex-wrap justify-center gap-5 mt-5">
      {platforms.map(({ name, icon: Icon }) => (
        <div
          key={name}
          className="flex flex-col items-center gap-1.5 text-muted-foreground/60 hover:text-primary transition-all duration-300 group"
        >
          <Icon className="w-5 h-5 group-hover:icon-glow transition-all duration-300" />
          <span className="text-xs font-heading tracking-wider">{name}</span>
        </div>
      ))}
    </div>
  );
}
