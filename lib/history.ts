"use client";

import type { VideoInfo } from "./types";

const STORAGE_KEY = "videopass_history";
const MAX_ITEMS = 20;

export interface HistoryEntry {
  video: VideoInfo;
  sourceUrl: string;
  timestamp: number;
}

export function getHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addHistory(video: VideoInfo, sourceUrl: string): void {
  const history = getHistory();
  // Remove duplicate URL if exists
  const filtered = history.filter((h) => h.sourceUrl !== sourceUrl);
  const entry: HistoryEntry = { video, sourceUrl, timestamp: Date.now() };
  const updated = [entry, ...filtered].slice(0, MAX_ITEMS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function removeHistory(sourceUrl: string): HistoryEntry[] {
  const history = getHistory().filter((h) => h.sourceUrl !== sourceUrl);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  return history;
}

export function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}
