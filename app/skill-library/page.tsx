import type { Metadata } from "next";
import { SkillLibraryClient } from "./SkillLibraryClient";
import styles from "./skill-library.module.css";

export const metadata: Metadata = {
  title: "Skill 库 — 山川行止",
  description: "可检索、分类与下载的个人 Skill 文件库。"
};

export default function SkillLibraryPage() {
  return <main className={styles.page}><SkillLibraryClient /></main>;
}
