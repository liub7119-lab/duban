import type { Metadata, Viewport } from "next";
import { Noto_Serif_SC } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Providers } from "@/components/Providers";

const notoSerifSC = Noto_Serif_SC({
  variable: "--font-noto-serif-sc",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "读伴 · 与 AI 共读",
  description: "导入书籍,与 AI 边读边聊,智能总结,记录阅读时光。",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "读伴",
  },
};

// 手机适配:viewport meta + safe-area + 禁止用户缩放干扰
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover", // iOS notch/safe-area
  themeColor: "#f5f0e6", // 宣纸色,与水墨主题统一
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className={cn(notoSerifSC.variable, "h-full antialiased")}>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}