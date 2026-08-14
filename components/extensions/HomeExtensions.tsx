"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CardSwap, { Card } from "./CardSwap";
import { extensionProjects } from "@/lib/extension-projects";
import styles from "./home-extensions.module.css";

const sizingFor = (viewport: number) => {
  if (viewport <= 560) return { width: Math.max(284, Math.min(viewport * .82, 360)), height: 255, cardDistance: 14, verticalDistance: 17, skewAmount: 1.4 };
  if (viewport <= 900) return { width: Math.min(viewport * .54, 450), height: 300, cardDistance: 24, verticalDistance: 27, skewAmount: 2.2 };
  return { width: 540, height: 350, cardDistance: 40, verticalDistance: 38, skewAmount: 3 };
};

export default function HomeExtensions() {
  const router = useRouter();
  const [sizing, setSizing] = useState(() => sizingFor(1280));
  const navigate = (index: number) => {
    const project = extensionProjects[index];
    if (!project) return;
    if (project.id === "creative-graph") {
      window.location.assign(project.href);
      return;
    }
    router.push(project.href);
  };
  useEffect(() => {
    const update = () => setSizing(sizingFor(window.innerWidth));
    update();
    window.addEventListener("resize", update, { passive: true });
    return () => window.removeEventListener("resize", update);
  }, []);
  return <div className={styles.module}>
    <div className={styles.copy}>
      <p>EXTENSIONS</p>
      <h2>扩展</h2>
      <h3>不止于作品。</h3>
      <span>一些持续发生的实验、工具、数字项目、研究与未完成想法。</span>
      <small>CURRENT<br /><strong>{String(extensionProjects.length).padStart(2, "0")} PROJECTS</strong></small>
    </div>
    <div className={styles.stage} aria-label="扩展项目动态封面">
      <CardSwap {...sizing} delay={5200} pauseOnHover wheelToSwap easing="elastic" onCardClick={navigate}>
        {extensionProjects.map((project, index) => <Card key={project.id} className={styles.card} role="link" tabIndex={0} aria-label={`进入${project.title}`} onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") { event.preventDefault(); navigate(index); }
        }}>
          <Image src={project.cover} alt={`${project.title}扩展项目封面`} fill sizes="(max-width:560px) 82vw, (max-width:900px) 54vw, 540px" />
          <i />
          <span><small>{project.index} / {project.category}</small><strong>{project.title}</strong><em>{project.description}</em></span>
          <b aria-hidden="true">↗</b>
        </Card>)}
      </CardSwap>
    </div>
  </div>;
}
