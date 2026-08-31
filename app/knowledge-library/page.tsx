import type { Metadata } from "next";
import { KnowledgeLibraryClient } from "./KnowledgeLibraryClient";
import baseStyles from "../prompt-library/prompt-library.module.css";

export const metadata: Metadata = {
  title: "知识库 — 山川行止",
  description: "可检索、可标记的个人知识卡片库。"
};

export default function KnowledgeLibraryPage() {
  return <main className={baseStyles.page}><KnowledgeLibraryClient /></main>;
}
