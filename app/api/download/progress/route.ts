import { getDownloadProgress, onDownloadEvent } from "@/lib/yt-dlp";
import type { DownloadProgress } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const downloadId = searchParams.get("id");

  if (!downloadId) {
    return new Response("Missing download id", { status: 400 });
  }

  const progress = getDownloadProgress(downloadId);
  if (!progress) {
    return new Response("Download not found", { status: 404 });
  }

  // If already complete or error, send single event and close
  if (progress.status === "complete" || progress.status === "error") {
    const eventType = progress.status === "complete" ? "complete" : "error";
    const data =
      progress.status === "complete"
        ? JSON.stringify({ downloadId })
        : JSON.stringify({ error: progress.error });

    return new Response(`event: ${eventType}\ndata: ${data}\n\n`, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // Otherwise, create SSE stream
  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send current progress immediately
      controller.enqueue(
        encoder.encode(`event: progress\ndata: ${JSON.stringify(progress)}\n\n`)
      );

      // Subscribe to progress updates
      cleanup = onDownloadEvent(downloadId, (p: DownloadProgress) => {
        try {
          if (p.status === "complete") {
            controller.enqueue(
              encoder.encode(`event: complete\ndata: ${JSON.stringify({ downloadId })}\n\n`)
            );
            controller.close();
            cleanup?.();
          } else if (p.status === "error") {
            controller.enqueue(
              encoder.encode(`event: error\ndata: ${JSON.stringify({ error: p.error })}\n\n`)
            );
            controller.close();
            cleanup?.();
          } else {
            controller.enqueue(
              encoder.encode(`event: progress\ndata: ${JSON.stringify(p)}\n\n`)
            );
          }
        } catch {
          // Stream closed
          cleanup?.();
        }
      });
    },
    cancel() {
      cleanup?.();
    },
  });

  // Handle client disconnect
  request.signal.addEventListener("abort", () => {
    cleanup?.();
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
