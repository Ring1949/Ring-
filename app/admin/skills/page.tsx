import type { Metadata } from "next";
import { AdminSkillsClient } from "./AdminSkillsClient";
import styles from "../library-admin.module.css";

export const metadata: Metadata = { title: "Skill 库管理 — 山川行止" };

export default function AdminSkillsPage() {
  return <main className={styles.page}><AdminSkillsClient /></main>;
}
