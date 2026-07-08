"use client";

import Link from "next/link";
import { AnimatePresence, motion, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import type { Media } from "@/lib/types";
import styles from "./InspirationGalaxy.module.css";

const GALAXIES = [
  { slug: "photo", title: "摄影", label: "PHOTOGRAPHY", description: "光线、城市、观看方式与影像参考。", tone: "cyan", x: 18, y: 42 },
  { slug: "graphic", title: "平面", label: "GRAPHIC", description: "字体、版式、品牌与视觉系统。", tone: "amber", x: 39, y: 30 },
  { slug: "space", title: "空间", label: "SPACE", description: "材料、尺度、光线与空间秩序。", tone: "blue", x: 62, y: 48 },
  { slug: "ai", title: "AI", label: "GENERATIVE", description: "生成实验、提示词与模型测试。", tone: "green", x: 78, y: 28 },
  { slug: "other", title: "其他", label: "OTHER", description: "生活观察、草图、厨艺与未完成想法。", tone: "rose", x: 48, y: 68 }
];

const NODE_COLORS = ["#9ee7ff", "#d9f99d", "#ffd7a1", "#c4b5fd", "#fda4af", "#bae6fd"];

function splitTags(value = "") {
  return value.split(/[,，、\s]+/).map((item) => item.trim()).filter(Boolean);
}

function mediaUrl(item: Media) {
  return item.file_path || "";
}

function mediaKind(item: Media) {
  const type = (item.media_type || item.mime_type || item.file_type || "image").toLowerCase();
  if (type.includes("video")) return "video";
  if (type.includes("pdf") || type.includes("file") || type.includes("zip")) return "file";
  return "image";
}

function constellationKey(item: Media) {
  const tags = splitTags(item.tags);
  return tags[0] || item.project_title || item.media_type || "未命名星群";
}

function formatDate(value?: string) {
  if (!value) return "未记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未记录";
  return date.toISOString().slice(0, 10);
}

function MediaPreview({ item }: { item: Media }) {
  const kind = mediaKind(item);
  if (kind === "video") return <video src={mediaUrl(item)} muted loop playsInline preload="metadata" />;
  if (kind === "file") return <div className={styles.filePreview}>FILE</div>;
  return <img src={mediaUrl(item)} alt={item.title || "inspiration"} loading="lazy" />;
}

export default function InspirationGalaxy() {
  const [items, setItems] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGalaxy, setSelectedGalaxy] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);
  const [selectedNode, setSelectedNode] = useState<Media | null>(null);
  const [error, setError] = useState("");
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const fogX = useSpring(mouseX, { stiffness: 45, damping: 28 });
  const fogY = useSpring(mouseY, { stiffness: 45, damping: 28 });

  useEffect(() => {
    let alive = true;
    fetch("/api/inspiration")
      .then((response) => {
        if (!response.ok) throw new Error("灵感数据加载失败");
        return response.json();
      })
      .then((data: Media[]) => { if (alive) setItems(Array.isArray(data) ? data : []); })
      .catch((err) => { if (alive) setError(err.message || "灵感数据加载失败"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, Media[]>();
    for (const galaxy of GALAXIES) map.set(galaxy.slug, []);
    for (const item of items) {
      const slug = item.category_slug || "other";
      const key = map.has(slug) ? slug : "other";
      map.get(key)?.push(item);
    }
    return map;
  }, [items]);

  const activeGalaxy = GALAXIES.find((galaxy) => galaxy.slug === selectedGalaxy) || null;
  const activeItems = useMemo(() => selectedGalaxy ? grouped.get(selectedGalaxy) || [] : [], [grouped, selectedGalaxy]);

  const constellation = useMemo(() => {
    const groupMap = new Map<string, Media[]>();
    for (const item of activeItems) {
      const key = constellationKey(item);
      groupMap.set(key, [...(groupMap.get(key) || []), item]);
    }
    const groups = [...groupMap.entries()];
    const nodeCount = Math.max(activeItems.length, 1);
    return activeItems.map((item, index) => {
      const groupIndex = Math.max(groups.findIndex(([, groupItems]) => groupItems.some((node) => node.id === item.id)), 0);
      const angle = (index / nodeCount) * Math.PI * 2 + groupIndex * 0.42;
      const radius = 18 + (index % 4) * 7 + groupIndex * 4;
      return {
        item,
        group: constellationKey(item),
        color: NODE_COLORS[groupIndex % NODE_COLORS.length],
        x: 50 + Math.cos(angle) * radius,
        y: 50 + Math.sin(angle) * radius * 0.72
      };
    });
  }, [activeItems]);

  const latest = (slug: string) => formatDate(grouped.get(slug)?.[0]?.updated_at || grouped.get(slug)?.[0]?.created_at);

  return (
    <main
      className={styles.universe}
      onPointerMove={(event) => {
        mouseX.set((event.clientX / window.innerWidth - 0.5) * 28);
        mouseY.set((event.clientY / window.innerHeight - 0.5) * 28);
      }}
    >
      <header className="nav nav-scrolled">
        <Link className="logo" href="/" aria-label="返回首页" />
        <nav className="nav-links">
          <Link href="/">首页</Link><Link href="/#series">系列作品</Link><Link href="/#works-library">作品库</Link><Link className="active" href="/inspiration.html">灵感库</Link><Link href="/#about">关于</Link>
        </nav>
        <div className="nav-actions"><button className="avatar admin-login-trigger" type="button" aria-label="进入后台" /><button className="menu-button" aria-label="菜单"><i /><i /></button></div>
      </header>

      <motion.div className={styles.fog} style={{ x: fogX, y: fogY }} />
      <div className={styles.starfield} />
      <div className={styles.particles} />

      <section className={styles.hero}>
        <p>KNOWLEDGE UNIVERSE</p>
        <h1>{activeGalaxy ? activeGalaxy.title : "灵感宇宙"}</h1>
        <span>{activeGalaxy ? activeGalaxy.description : "摄影、平面、空间、AI 与其他灵感以星系方式组织，进入一个星系后继续探索它的星群与知识节点。"}</span>
      </section>

      {error ? <div className={styles.state}>{error}</div> : null}
      {loading ? <div className={styles.state}>正在唤醒星系…</div> : null}

      <AnimatePresence mode="wait">
        {!selectedGalaxy ? (
          <motion.section key="galaxies" className={styles.galaxyView} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
            {GALAXIES.map((galaxy, index) => {
              const count = grouped.get(galaxy.slug)?.length || 0;
              return (
                <motion.button
                  key={galaxy.slug}
                  type="button"
                  className={`${styles.galaxy} ${styles[galaxy.tone]}`}
                  style={{ left: `${galaxy.x}%`, top: `${galaxy.y}%` }}
                  initial={{ opacity: 0, scale: 0.78, y: 18 }}
                  animate={{ opacity: 1, scale: 1, y: [0, -8, 0] }}
                  transition={{ opacity: { delay: index * 0.08 }, scale: { delay: index * 0.08 }, y: { repeat: Infinity, duration: 5 + index * 0.35, ease: "easeInOut" } }}
                  whileHover={{ scale: 1.08 }}
                  onClick={() => setSelectedGalaxy(galaxy.slug)}
                >
                  <i />
                  <strong>{galaxy.title}</strong>
                  <small>{galaxy.label}</small>
                  <span>{galaxy.description}</span>
                  <em>{count} resources · latest {latest(galaxy.slug)}</em>
                </motion.button>
              );
            })}
          </motion.section>
        ) : (
          <motion.section key="constellation" className={styles.constellationView} initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.65, ease: "easeOut" }}>
            <button className={styles.back} type="button" onClick={() => { setSelectedGalaxy(null); setSelectedNode(null); }}>← 返回宇宙</button>
            <svg className={styles.lines} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {constellation.map((node, index) => constellation.slice(index + 1).filter((next) => next.group === node.group).map((next) => (
                <motion.line key={`${node.item.id}-${next.item.id}`} x1={node.x} y1={node.y} x2={next.x} y2={next.y} initial={{ opacity: 0 }} animate={{ opacity: hoveredNode && hoveredNode !== node.item.id && hoveredNode !== next.item.id ? 0.08 : 0.38 }} />
              )))}
            </svg>
            {constellation.length ? constellation.map((node, index) => (
              <motion.button
                key={node.item.id}
                type="button"
                className={styles.node}
                style={{ left: `${node.x}%`, top: `${node.y}%`, "--node-color": node.color } as React.CSSProperties}
                initial={{ opacity: 0, scale: 0.2 }}
                animate={{ opacity: hoveredNode && hoveredNode !== node.item.id ? 0.35 : 1, scale: 1 }}
                transition={{ delay: index * 0.035, type: "spring", stiffness: 130, damping: 16 }}
                onMouseEnter={() => setHoveredNode(node.item.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => setSelectedNode(node.item)}
              >
                <i />
                <span>{node.item.title || "未命名节点"}</span>
                <b>{node.group}</b>
                {hoveredNode === node.item.id ? <motion.div className={styles.preview} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><MediaPreview item={node.item} /><strong>{node.item.title || "未命名节点"}</strong><small>{splitTags(node.item.tags).slice(0, 3).join(" · ") || node.item.media_type || "resource"}</small></motion.div> : null}
              </motion.button>
            )) : <div className={styles.state}>这个星系还没有灵感节点。在后台上传作品时勾选“加入灵感库”后会出现在这里。</div>}
          </motion.section>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedNode ? (
          <motion.aside className={styles.contentCard} initial={{ opacity: 0, scale: 0.7, y: 80 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.72, y: 60 }} transition={{ duration: 0.7, type: "spring", stiffness: 110, damping: 18 }}>
            <button type="button" onClick={() => setSelectedNode(null)}>×</button>
            <div className={styles.contentMedia}><MediaPreview item={selectedNode} /></div>
            <p>KNOWLEDGE NODE / {selectedNode.category_name || activeGalaxy?.title || "INSPIRATION"}</p>
            <h2>{selectedNode.title || "未命名灵感"}</h2>
            <span>{selectedNode.description || "暂无描述。"}</span>
            <dl>
              <dt>TYPE</dt><dd>{selectedNode.media_type || selectedNode.file_type || "image"}</dd>
              <dt>TAGS</dt><dd>{splitTags(selectedNode.tags).join(" · ") || "未添加"}</dd>
              <dt>PROJECT</dt><dd>{selectedNode.project_title || "独立素材"}</dd>
              <dt>UPDATED</dt><dd>{formatDate(selectedNode.updated_at || selectedNode.created_at)}</dd>
            </dl>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
