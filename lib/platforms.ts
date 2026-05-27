import type { PlatformType } from "./types";

interface PlatformInfo {
  platform: PlatformType;
  patterns: RegExp[];
  name: string;
  icon: string;
}

const PLATFORMS: PlatformInfo[] = [
  {
    platform: "youtube",
    patterns: [
      /(?:www\.)?youtube\.com\/watch\?v=[\w-]+/,
      /youtu\.be\/[\w-]+/,
      /(?:www\.)?youtube\.com\/shorts\/[\w-]+/,
      /(?:www\.)?youtube\.com\/embed\/[\w-]+/,
      /(?:www\.)?youtube\.com\/v\/[\w-]+/,
    ],
    name: "YouTube",
    icon: "Youtube",
  },
  {
    platform: "bilibili",
    patterns: [
      /(?:www\.)?bilibili\.com\/video\/[\w]+/,
      /b23\.tv\/[\w]+/,
      /(?:www\.)?bilibili\.com\/bangumi\/play\/[\w]+/,
    ],
    name: "Bilibili",
    icon: "Tv",
  },
  {
    platform: "tiktok",
    patterns: [
      /(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/,
      /vm\.tiktok\.com\/[\w]+/,
      /(?:www\.)?tiktok\.com\/t\/[\w]+/,
    ],
    name: "TikTok",
    icon: "Music",
  },
  {
    platform: "douyin",
    patterns: [
      /(?:www\.)?douyin\.com\/video\/\d+/,
      /(?:www\.)?douyin\.com\/note\/\d+/,
      /(?:www\.)?douyin\.com\/\w+\?modal_id=\d+/,
      /v\.douyin\.com\/[\w]+\/?/,
    ],
    name: "抖音",
    icon: "Music",
  },
  {
    platform: "twitter",
    patterns: [
      /(?:www\.)?twitter\.com\/[\w]+\/status\/\d+/,
      /(?:www\.)?x\.com\/[\w]+\/status\/\d+/,
      /(?:mobile\.)?twitter\.com\/[\w]+\/status\/\d+/,
    ],
    name: "Twitter/X",
    icon: "Twitter",
  },
  {
    platform: "instagram",
    patterns: [
      /(?:www\.)?instagram\.com\/p\/[\w-]+/,
      /(?:www\.)?instagram\.com\/reel\/[\w-]+/,
      /(?:www\.)?instagram\.com\/tv\/[\w-]+/,
    ],
    name: "Instagram",
    icon: "Instagram",
  },
  {
    platform: "vimeo",
    patterns: [
      /(?:www\.)?vimeo\.com\/\d+/,
      /player\.vimeo\.com\/video\/\d+/,
    ],
    name: "Vimeo",
    icon: "Video",
  },
  {
    platform: "dailymotion",
    patterns: [
      /(?:www\.)?dailymotion\.com\/video\/[\w]+/,
      /dai\.ly\/[\w]+/,
    ],
    name: "Dailymotion",
    icon: "PlayCircle",
  },
  {
    platform: "twitch",
    patterns: [
      /(?:www\.)?twitch\.tv\/videos\/\d+/,
      /(?:www\.)?twitch\.tv\/[\w]+\/clip\/[\w-]+/,
      /clips\.twitch\.tv\/[\w-]+/,
    ],
    name: "Twitch",
    icon: "Monitor",
  },
];

export function detectPlatform(url: string): PlatformType | null {
  try {
    new URL(url);
  } catch {
    return null;
  }

  for (const p of PLATFORMS) {
    for (const pattern of p.patterns) {
      if (pattern.test(url)) {
        return p.platform;
      }
    }
  }
  return null;
}

export function getPlatformInfo(platform: PlatformType): {
  name: string;
  icon: string;
} {
  const found = PLATFORMS.find((p) => p.platform === platform);
  if (found) return { name: found.name, icon: found.icon };
  return { name: "Other", icon: "Globe" };
}

export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
