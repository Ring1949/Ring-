import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "山川行止 — 个人视觉档案",
  description: "山川行止个人视觉档案"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try { document.documentElement.dataset.theme = localStorage.getItem('site-theme') || 'light'; } catch (_) {}`
          }}
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
