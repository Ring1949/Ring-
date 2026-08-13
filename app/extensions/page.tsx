import type { Metadata } from "next";
import ExtensionsClient from "@/components/extensions/ExtensionsClient";
import SiteHeader from "@/components/extensions/SiteHeader";

export const metadata: Metadata = { title: "扩展 — Ring", description: "Ring 的数字实验、工具与个人项目。" };

export default function ExtensionsPage() {
  return <>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700&family=Noto+Sans+SC:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/styles.css?v=20260813-extensions-1" />
    <link rel="stylesheet" href="/site-nav.css?v=20260813-extensions-1" />
    <SiteHeader active="extensions" />
    <ExtensionsClient />
  </>;
}
