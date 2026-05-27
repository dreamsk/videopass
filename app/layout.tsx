import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VideoPass - 视频提取工具",
  description: "支持 YouTube、Bilibili、TikTok 等多平台视频链接解析与下载",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh"
      className="dark h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
