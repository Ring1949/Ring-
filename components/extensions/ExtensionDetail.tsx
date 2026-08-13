import Image from "next/image";
import Link from "next/link";
import type { ExtensionProject } from "@/lib/extension-projects";
import styles from "./extension-detail.module.css";

export default function ExtensionDetail({ project }: { project: ExtensionProject }) {
  const destination = project.id === "novel-studio" ? "/novel-studio"
    : project.id === "skill-library" ? "/skill-library"
    : project.id === "creative-graph" ? "/#about"
    : "/works.html?category=all";
  const action = project.id === "creative-graph" ? "打开关系图谱" : project.id === "visual-archive" ? "进入作品档案" : `进入${project.title}`;
  return <main className={styles.page}>
    <div className={styles.shell}>
      <Link className={styles.back} href="/extensions">← Extensions</Link>
      <section className={styles.intro}>
        <div><p>{project.index} / {project.category}</p><h1>{project.title}</h1></div>
        <div><span>项目介绍</span><p>{project.introduction}</p><Link href={destination}>{action} ↗</Link></div>
      </section>
      <figure className={styles.cover}>
        <Image src={project.cover} alt={`${project.title}项目封面`} fill sizes="(max-width: 900px) 92vw, 1280px" priority />
        <figcaption>{project.category} · {project.status}</figcaption>
      </figure>
    </div>
  </main>;
}
