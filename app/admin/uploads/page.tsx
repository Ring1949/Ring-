import type { Metadata } from "next";
import { AdminUploadsClient } from "./AdminUploadsClient";
import styles from "../library-admin.module.css";

export const metadata: Metadata = { title: "作品上传 — 山川行止" };

export default function AdminUploadsPage() {
  return <main className={styles.page}><AdminUploadsClient /></main>;
}
