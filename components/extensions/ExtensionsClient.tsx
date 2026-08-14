"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CardSwap, { Card } from "./CardSwap";
import { extensionProjects } from "@/lib/extension-projects";
import styles from "./extensions.module.css";

const sizingFor = (viewport: number) => {
  if (viewport <= 560) { const width = Math.max(288, Math.min(viewport * 0.84, 370)); return { width, height: Math.round(width / 1.78), cardDistance: 15, verticalDistance: 18, skewAmount: 1.6 }; }
  if (viewport <= 900) { const width = Math.min(viewport * 0.52, 455); return { width, height: Math.round(width / 1.78), cardDistance: 25, verticalDistance: 28, skewAmount: 2.4 }; }
  return { width: 560, height: 315, cardDistance: 42, verticalDistance: 40, skewAmount: 3.2 };
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
    if (!project) return;
    router.push(project.href);
  };

  return <main className={styles.page}>
    <section className={styles.hero} aria-labelledby="extensions-title">
      <div className={styles.copy}>
        <p className={styles.kicker}>EXTENSIONS</p>
        <h1 id="extensions-title">扩展</h1>
        <h2>不止于作品。</h2>
        <p className={styles.description}>这里收录一些持续发生的实验、数字项目、工具、研究，以及暂时无法被归类的东西。</p>
        <div className={styles.meta}><span>CURRENT</span><strong>{String(extensionProjects.length).padStart(2, "0")} PROJECTS</strong></div>
      </div>
      <div className={styles.swapStage} aria-label="扩展项目动态封面">
        <CardSwap {...sizing} delay={5200} pauseOnHover wheelToSwap easing="elastic" onCardClick={navigate}>
          {extensionProjects.map((project, index) => <Card
            key={project.id}
            className={styles.projectCard}
            role="link"
            tabIndex={0}
            aria-label={`进入${project.title}`}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); navigate(index); } }}
          >
            <Image src={project.cover} alt={`${project.title}扩展项目封面`} fill sizes="(max-width: 560px) 84vw, (max-width: 900px) 52vw, 560px" priority={project.index === "01"} />
          </Card>)}
        </CardSwap>
      </div>
    </section>
  </main>;
}
