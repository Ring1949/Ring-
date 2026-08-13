"use client";

import { useEffect, useState } from "react";
import GlassSurface from "./GlassSurface";
import SpotlightCard from "./SpotlightCard";
import styles from "./portfolio-library.module.css";

type Category = { slug: string; name?: string; description?: string; cover_image?: string };

const categoryOrder = ["photo", "space", "graphic", "ai", "other"];
const defaults: Record<string, { name: string; english: string; description: string; cover: string }> = {
  photo: { name: "摄影", english: "PHOTOGRAPHY", description: "城市、光影、胶片与观察方式。", cover: "/recovered/36-11-00340.jpg" },
  space: { name: "空间", english: "SPACE", description: "尺度、材质、光线与空间秩序。", cover: "/recovered/118-111.png" },
  graphic: { name: "平面", english: "GRAPHIC", description: "字体、版式、品牌与视觉系统。", cover: "/recovered/125-media.png" },
  ai: { name: "AI", english: "GENERATIVE", description: "图像生成、风格尝试与概念实验。", cover: "/recovered/36-11-00340.jpg" },
  other: { name: "其他", english: "OTHER", description: "日常实验、手绘、旅途、手工与不完美的记录。", cover: "/recovered/118-111.png" }
};

export default function PortfolioLibrary() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    let active = true;
    fetch("/api/home").then((response) => response.ok ? response.json() : null).then((payload) => {
      if (active && Array.isArray(payload?.categories)) setCategories(payload.categories);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const cards = categoryOrder.map((slug) => {
    const category = categories.find((item) => item.slug === slug);
    const fallback = defaults[slug];
    return {
      slug,
      name: category?.name || fallback.name,
      english: fallback.english,
      description: category?.description || fallback.description,
      cover: category?.cover_image || fallback.cover
    };
  });

  return (
    <section className={styles.section} aria-labelledby="portfolio-library-title">
      <div className={styles.intro}>
        <p>WORKS LIBRARY</p>
        <h2 id="portfolio-library-title">我的作品库</h2>
        <span>摄影、平面、空间、AI 与其他创作成果的归档。</span>
      </div>
      <div className={styles.cards}>
        {cards.map((card, index) => (
          <a className={`${styles.link} ${index === 0 ? styles.featured : ""}`} href={`/works.html?category=${card.slug}`} key={card.slug}>
            <SpotlightCard className={styles.card} spotlightColor="rgba(0, 229, 255, 0.2)">
              <img src={card.cover} alt={`${card.name}分类封面`} loading={index === 0 ? "eager" : "lazy"} />
              <div className={styles.shade} />
              <GlassSurface
                width="100%"
                height="100%"
                borderRadius={18}
                displace={15}
                distortionScale={-150}
                redOffset={5}
                greenOffset={15}
                blueOffset={25}
                brightness={60}
                opacity={0.8}
                mixBlendMode="screen"
                className={styles.glass}
              >
                <span className={styles.glassFill} aria-hidden="true" />
              </GlassSurface>
              <div className={styles.copy}>
                <div><small>{String(index + 1).padStart(2, "0")}</small><i /></div>
                <h3>{card.name}</h3>
                <b>{card.english}</b>
                <p>{card.description}</p>
              </div>
            </SpotlightCard>
          </a>
        ))}
      </div>
    </section>
  );
}
