import { NextResponse } from "next/server";
import { extractVideoInfo } from "@/lib/yt-dlp";
import { isValidUrl } from "@/lib/platforms";
import type { ApiResponse, ErrorCode } from "@/lib/types";

function classifyError(message: string): { error: string; code: ErrorCode } {
  const msg = message.toLowerCase();

  if (msg.includes("unsupported url") || msg.includes("no supported")) {
    return { error: "暂不支持该网站，请尝试其他平台", code: "UNSUPPORTED_PLATFORM" };
  }
  if (msg.includes("private video") || msg.includes("login") || msg.includes("sign in")) {
    return { error: "视频不可用，请检查是否为私有视频", code: "PRIVATE_VIDEO" };
  }
  if (msg.includes("geo") || msg.includes("not available in your country")) {
    return { error: "视频在当前地区不可用", code: "GEO_RESTRICTED" };
  }
  if (msg.includes("429") || msg.includes("rate limit")) {
    return { error: "请求过于频繁，请稍后再试", code: "RATE_LIMITED" };
  }

  return { error: "提取失败，请稍后重试", code: "EXTRACTION_FAILED" };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "请提供视频链接", code: "INVALID_URL" },
        { status: 400 }
      );
    }

    if (!isValidUrl(url)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "请输入有效的视频链接", code: "INVALID_URL" },
        { status: 400 }
      );
    }

    const videoInfo = await extractVideoInfo(url);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: videoInfo,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[extract] Error:", message);
    if (err instanceof Error && err.stack) console.error("[extract] Stack:", err.stack);
    const { error, code } = classifyError(message);

    const statusMap: Record<ErrorCode, number> = {
      INVALID_URL: 400,
      UNSUPPORTED_PLATFORM: 422,
      PRIVATE_VIDEO: 403,
      GEO_RESTRICTED: 403,
      RATE_LIMITED: 429,
      EXTRACTION_FAILED: 500,
      INTERNAL_ERROR: 500,
    };

    return NextResponse.json<ApiResponse>(
      { success: false, error, code },
      { status: statusMap[code] }
    );
  }
}
