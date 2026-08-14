import type { Metadata } from "next";
import { PromptLibraryClient } from "./PromptLibraryClient";
import styles from "./prompt-library.module.css";

export const metadata: Metadata = {
  title: "Prompt 库 — 山川行止",
  description: "可搜索、分类与一键复制的个人提示词库。"
};

export default function PromptLibraryPage() {
  return <main className={styles.page}><PromptLibraryClient /></main>;
}
