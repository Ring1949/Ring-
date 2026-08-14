import type { Metadata } from "next";
import { PoetryLibraryClient } from "./PoetryLibraryClient";
import styles from "./poetry-library.module.css";

export const metadata: Metadata = {
  title: "诗词鉴赏 — 山川行止",
  description: "按朝代、作者与主题阅读经典诗词。"
};

export default function PoetryLibraryPage() {
  return <main className={styles.page}><PoetryLibraryClient /></main>;
}
