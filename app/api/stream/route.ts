import { NextResponse } from "next/server";
import { prepareStream, getStreamFilePath } from "@/lib/yt-dlp";
import { isValidUrl } from "@/lib/platforms";
import fs from "node:fs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, format_id } = body;

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

    const streamId = await prepareStream(url, format_id);

    return NextResponse.json({ success: true, streamId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `准备播放失败: ${message}` },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const streamId = searchParams.get("id");

  if (!streamId) {
    return NextResponse.json({ error: "Missing stream id" }, { status: 400 });
  }

  const filePath = getStreamFilePath(streamId);
  if (!filePath) {
    return NextResponse.json(
      { error: "Stream not found or expired" },
      { status: 404 }
    );
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = request.headers.get("range");

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    const stream = fs.createReadStream(filePath, { start, end });
    const webStream = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk) => {
          const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
          controller.enqueue(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
        });
        stream.on("end", () => controller.close());
        stream.on("error", (err) => controller.error(err));
      },
    });

    return new NextResponse(webStream, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
        "Content-Type": "video/mp4",
      },
    });
  }

  const stream = fs.createReadStream(filePath);
  const webStream = new ReadableStream({
    start(controller) {
      stream.on("data", (chunk) => {
        const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
        controller.enqueue(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
      });
      stream.on("end", () => controller.close());
      stream.on("error", (err) => controller.error(err));
    },
  });

  return new NextResponse(webStream, {
    headers: {
      "Content-Length": String(fileSize),
      "Content-Type": "video/mp4",
      "Accept-Ranges": "bytes",
    },
  });
}
