import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import UnifiedNav from "@/components/unified-nav";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover"
};

export const metadata: Metadata = {
  title: "OMPC 统一平台",
  description: "OMPC 统一内容自动化平台 - 知识库、趋势采集、招生通告、AI写手",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/app-icon.png", type: "image/png", sizes: "1024x1024" }
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }]
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      {/* pb-20 为移动端底部导航条预留空间，桌面端归零 */}
      <body className="pb-20 md:pb-0">
        {/* UnifiedNav 使用 useSearchParams，需 Suspense 边界以避免整页客户端化 */}
        <Suspense
          fallback={<div className="hidden h-16 md:block" aria-hidden="true" />}
        >
          <UnifiedNav />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
