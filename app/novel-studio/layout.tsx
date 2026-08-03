import type { Metadata } from "next";
import "./studio.css";

export const metadata: Metadata = {
  title: "AI 小说工作台 | 山川行止",
  description: "山川行止站内扩展：AI 小说工作台"
};

export default function NovelStudioLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
