import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ExtensionDetail from "@/components/extensions/ExtensionDetail";
import SiteHeader from "@/components/extensions/SiteHeader";
import { extensionProjects, getExtensionProject } from "@/lib/extension-projects";

export function generateStaticParams() { return extensionProjects.map(({ id }) => ({ id })); }

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const project = getExtensionProject((await params).id);
  return project ? { title: `${project.title} — Ring 扩展`, description: project.description } : {};
}

export default async function ExtensionProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const project = getExtensionProject((await params).id);
  if (!project) notFound();
  return <>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700&family=Noto+Sans+SC:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/styles.css?v=20260813-extensions-1" />
    <link rel="stylesheet" href="/site-nav.css?v=20260813-extensions-1" />
    <SiteHeader active="extensions" />
    <ExtensionDetail project={project} />
  </>;
}
