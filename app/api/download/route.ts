import { NextResponse } from "next/server";
import { getVideoStream, downloadDouyinToFile } from "@/lib/yt-dlp";
import { isValidUrl } from "@/lib/platforms";
import { sanitizeFilename } from "@/lib/utils";
import fs from "node:fs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, format_id, filename } = body;

    if (!url || typeof url !== "string" || !isValidUrl(url)) {
      return NextResponse.json(
        { success: false, error: "请提供有效的视频链接", code: "INVALID_URL" },
        { status: 400 }
      );
    }

    if (!format_id || typeof format_id !== "string") {
      return NextResponse.json(
        { success: false, error: "请选择视频格式", code: "INVALID_URL" },
        { status: 400 }
      );
    }

    const safeFilename = filename
      ? sanitizeFilename(filename)
      : "video";
    const asciiFilename = safeFilename.replace(/[^\x20-\x7E]/g, "_").slice(0, 100) || "video";
    const encodedFilename = encodeURIComponent(safeFilename);

    const isDouyin = /douyin\.com|v\.douyin\.com/.test(url);

    if (isDouyin) {
      // Douyin: download to file, then return as buffer
      const { filePath, cleanup } = await downloadDouyinToFile(url);
      try {
        const buffer = fs.readFileSync(filePath);
        return new NextResponse(buffer, {
          headers: {
            "Content-Type": "video/mp4",
            "Content-Disposition": `attachment; filename="${asciiFilename}.mp4"; filename*=UTF-8''${encodedFilename}.mp4`,
            "Content-Length": String(buffer.length),
          },
        });
      } finally {
        cleanup();
      }
    }

    // Other platforms: stream via yt-dlp
    const { stream: nodeStream, cleanup } = getVideoStream(url, format_id);

    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on("data", (chunk: Buffer) => {
          controller.enqueue(new Uint8Array(chunk));
        });
        nodeStream.on("end", () => {
          controller.close();
          cleanup();
        });
        nodeStream.on("error", (err: Error) => {
          controller.error(err);
          cleanup();
        });
      },
      cancel() {
        nodeStream.destroy?.();
        cleanup();
      },
    });

    return new NextResponse(webStream, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${asciiFilename}.mp4"; filename*=UTF-8''${encodedFilename}.mp4`,
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `下载失败: ${message}`, code: "EXTRACTION_FAILED" },
      { status: 500 }
    );
  }
}
