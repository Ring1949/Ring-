import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "山川止行 — 个人视觉档案",
  description: "山川止行个人视觉档案"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
