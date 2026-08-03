import type { Metadata } from "next";
import "./studio.css";

export const metadata: Metadata = {
  title: "AI小说公司 · 创作工作台 | 山川行止",
  description: "与AI小说创作团队协作完成故事策划、写作、编辑和质检。"
};

export default function NovelStudioLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
