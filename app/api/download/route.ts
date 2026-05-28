import { NextResponse } from "next/server";
import { downloadWithProgress } from "@/lib/yt-dlp";
import { isValidUrl } from "@/lib/platforms";
import type { DownloadStartResponse } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, format_id, filename } = body;

    if (!url || typeof url !== "string" || !isValidUrl(url)) {
      return NextResponse.json(
        { success: false, error: "请提供有效的视频链接" },
        { status: 400 }
      );
    }

    if (!format_id || typeof format_id !== "string") {
      return NextResponse.json(
        { success: false, error: "请选择视频格式" },
        { status: 400 }
      );
    }

    const downloadId = await downloadWithProgress(url, format_id, filename);

    return NextResponse.json<DownloadStartResponse>({
      success: true,
      downloadId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `下载失败: ${message}` },
      { status: 500 }
    );
  }
}
