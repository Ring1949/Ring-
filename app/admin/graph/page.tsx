import type { Metadata } from "next";
import { GraphAdminClient } from "./GraphAdminClient";
import styles from "./graph-admin.module.css";

export const metadata: Metadata = { title: "关系图谱管理 · Ring" };

export default function Page() { return <main className={styles.page}><GraphAdminClient /></main>; }
