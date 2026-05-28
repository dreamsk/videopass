import { NextResponse } from "next/server";
import { getDownloadFilePath, getDownloadFilename } from "@/lib/yt-dlp";
import fs from "node:fs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const downloadId = searchParams.get("id");

  if (!downloadId) {
    return NextResponse.json({ error: "Missing download id" }, { status: 400 });
  }

  const filePath = getDownloadFilePath(downloadId);
  if (!filePath) {
    return NextResponse.json(
      { error: "Download not found or expired" },
      { status: 404 }
    );
  }

  const filename = getDownloadFilename(downloadId) || "video";
  const safeFilename = filename.replace(/[^\x20-\x7E]/g, "_").slice(0, 100) || "video";
  const encodedFilename = encodeURIComponent(filename);

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
        "Content-Disposition": `attachment; filename="${safeFilename}.mp4"; filename*=UTF-8''${encodedFilename}.mp4`,
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
      "Content-Disposition": `attachment; filename="${safeFilename}.mp4"; filename*=UTF-8''${encodedFilename}.mp4`,
    },
  });
}
