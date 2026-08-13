"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CardSwap, { Card } from "./CardSwap";
import { extensionProjects } from "@/lib/extension-projects";
import styles from "./extensions.module.css";

const sizingFor = (viewport: number) => {
  if (viewport <= 560) return { width: Math.max(288, Math.min(viewport * 0.84, 370)), height: 272, cardDistance: 15, verticalDistance: 18, skewAmount: 1.6 };
  if (viewport <= 900) return { width: Math.min(viewport * 0.52, 455), height: 310, cardDistance: 25, verticalDistance: 28, skewAmount: 2.4 };
  return { width: 560, height: 370, cardDistance: 42, verticalDistance: 40, skewAmount: 3.2 };
};

export default function ExtensionsClient() {
  const router = useRouter();
  const [sizing, setSizing] = useState(() => sizingFor(1280));
  useEffect(() => {
    const update = () => setSizing(sizingFor(window.innerWidth));
    update();
    window.addEventListener("resize", update, { passive: true });
    return () => window.removeEventListener("resize", update);
  }, []);

  const navigate = (index: number) => {
    const project = extensionProjects[index];
    if (project) router.push(project.href);
  };

  return <main className={styles.page}>
    <section className={styles.hero} aria-labelledby="extensions-title">
      <div className={styles.copy}>
        <p className={styles.kicker}>EXTENSIONS</p>
        <h1 id="extensions-title">扩展</h1>
        <h2>不止于作品。</h2>
        <p className={styles.description}>这里收录一些持续发生的实验、数字项目、工具、研究，以及暂时无法被归类的东西。</p>
        <Link className={styles.allLink} href="#project-index">查看全部扩展 <span aria-hidden="true">↗</span></Link>
        <div className={styles.meta}><span>CURRENT</span><strong>{String(extensionProjects.length).padStart(2, "0")} PROJECTS</strong></div>
      </div>
      <div className={styles.swapStage} aria-label="扩展项目动态封面">
        <CardSwap {...sizing} delay={5200} pauseOnHover easing="elastic" onCardClick={navigate}>
          {extensionProjects.map((project) => <Card
            key={project.id}
            className={styles.projectCard}
            role="link"
            tabIndex={0}
            aria-label={`进入${project.title}`}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); router.push(project.href); } }}
          >
            <Image src={project.cover} alt={`${project.title}扩展项目封面`} fill sizes="(max-width: 560px) 84vw, (max-width: 900px) 52vw, 560px" priority={project.index === "01"} />
            <span className={styles.cardShade} />
            <span className={styles.cardCopy}>
              <small>{project.index} / {project.category}</small>
              <strong>{project.title}</strong>
              <span>{project.description}</span>
            </span>
            <span className={styles.cardArrow} aria-hidden="true">↗</span>
          </Card>)}
        </CardSwap>
      </div>
    </section>
    <section id="project-index" className={styles.index} aria-labelledby="project-index-title">
      <header><p>PROJECT INDEX</p><h2 id="project-index-title">全部扩展</h2></header>
      <div>{extensionProjects.map((project) => <Link href={project.href} key={project.id}>
        <span>{project.index}</span><strong>{project.title}</strong><small>{project.category} · {project.status}</small><b aria-hidden="true">↗</b>
      </Link>)}</div>
    </section>
  </main>;
}
