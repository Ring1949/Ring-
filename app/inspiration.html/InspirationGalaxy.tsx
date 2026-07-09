"use client";

import { AnimatePresence, motion, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { Media } from "@/lib/types";
import styles from "./InspirationGalaxy.module.css";

const PRIMARY = { slug: "photo", title: "Photography" };

const SECONDARY = [
  { slug: "humanity", title: "Humanity", keywords: ["humanity", "人文", "人物", "street", "people"] },
  { slug: "news", title: "News", keywords: ["news", "新闻", "纪实", "event"] },
  { slug: "landscape", title: "Landscape", keywords: ["landscape", "风景", "自然", "城市"] },
  { slug: "commercial", title: "Commercial", keywords: ["commercial", "商业", "product", "brand"] },
  { slug: "portrait", title: "Portrait", keywords: ["portrait", "肖像", "人像"] },
  { slug: "campus", title: "Campus", keywords: ["campus", "校园", "school"] },
  { slug: "documentary", title: "Documentary", keywords: ["documentary", "记录", "纪实"] },
  { slug: "travel", title: "Travel", keywords: ["travel", "旅行", "旅拍"] }
];

function splitTags(value = "") {
  return value.split(/[,，、\s]+/).map((item) => item.trim()).filter(Boolean);
}

function textBlob(item: Media) {
  return `${item.title || ""} ${item.description || ""} ${item.tags || ""} ${item.project_title || ""}`.toLowerCase();
}

function secondaryFor(item: Media) {
  const text = textBlob(item);
  return SECONDARY.find((entry) => entry.keywords.some((keyword) => text.includes(keyword.toLowerCase())))?.slug || "humanity";
}

function mediaKind(item: Media) {
  const type = (item.media_type || item.mime_type || item.file_type || "image").toLowerCase();
  if (type.includes("video")) return "video";
  if (type.includes("pdf") || type.includes("file") || type.includes("zip")) return "file";
  return "image";
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString().slice(0, 10);
}

function ResourceMedia({ item }: { item: Media }) {
  const kind = mediaKind(item);
  if (kind === "video") return <video src={item.file_path} muted loop playsInline preload="metadata" />;
  if (kind === "file") return <div className={styles.filePreview}>FILE</div>;
  return <img src={item.file_path} alt={item.title || "resource"} loading="lazy" />;
}

function polar(index: number, total: number, radius: number, squeeze = 0.76) {
  const angle = (index / Math.max(total, 1)) * Math.PI * 2 - Math.PI / 2;
  return { x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius * squeeze };
}

export default function InspirationGalaxy() {
  const [items, setItems] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<"primary" | "secondary">("primary");
  const [selectedSecondary, setSelectedSecondary] = useState<string | null>(null);
  const [hoveredResource, setHoveredResource] = useState<number | null>(null);
  const [selectedResource, setSelectedResource] = useState<{ item: Media; x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(0.72);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const fogX = useSpring(mouseX, { stiffness: 34, damping: 26 });
  const fogY = useSpring(mouseY, { stiffness: 34, damping: 26 });

  useEffect(() => {
    let alive = true;
    fetch("/api/inspiration")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("inspiration api failed")))
      .then((data: Media[]) => { if (alive) setItems(Array.isArray(data) ? data : []); })
      .catch(() => { if (alive) setItems([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const photoItems = useMemo(() => items.filter((item) => (item.category_slug || "photo") === "photo"), [items]);
  const currentSecondary = SECONDARY.find((entry) => entry.slug === selectedSecondary) || null;
  const resources = useMemo(() => {
    if (!selectedSecondary) return [];
    return photoItems.filter((item) => secondaryFor(item) === selectedSecondary);
  }, [photoItems, selectedSecondary]);

  const radius = 13 + zoom * 24;
  const resourceRadius = 9 + zoom * 30;

  return (
    <main
      className={styles.universe}
      onWheel={(event) => setZoom((value) => Math.max(0, Math.min(1, value - event.deltaY * 0.0009)))}
      onPointerMove={(event) => {
        mouseX.set((event.clientX / window.innerWidth - 0.5) * 28);
        mouseY.set((event.clientY / window.innerHeight - 0.5) * 28);
      }}
    >
      <motion.div className={styles.fog} style={{ x: fogX, y: fogY }} />
      <div className={styles.stars} />
      <div className={styles.particles} />

      <motion.a href="/" className={styles.exit} initial={{ y: -24, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>Exit</motion.a>

      <motion.section className={styles.canvas} animate={{ scale: stage === "secondary" ? 1.08 : 1, y: stage === "secondary" ? -10 : 0 }} transition={{ duration: 0.8, ease: "easeOut" }}>
        <AnimatePresence mode="wait">
          {stage === "primary" ? (
            <motion.div key="primary" className={styles.system} initial={{ opacity: 0, scale: 0.86 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.12 }} transition={{ duration: 0.72, ease: "easeOut" }}>
              <CenterNode title={PRIMARY.title} subtitle="" />
              <svg className={styles.orbits} viewBox="0 0 100 100" preserveAspectRatio="none">
                {SECONDARY.map((entry, index) => {
                  const p = polar(index, SECONDARY.length, radius);
                  return <line key={entry.slug} x1="50" y1="50" x2={p.x} y2={p.y} />;
                })}
              </svg>
              {SECONDARY.map((entry, index) => {
                const p = polar(index, SECONDARY.length, radius);
                const count = photoItems.filter((item) => secondaryFor(item) === entry.slug).length;
                return (
                  <motion.button
                    key={entry.slug}
                    className={styles.secondaryNode}
                    style={{ left: `${p.x}%`, top: `${p.y}%` }}
                    type="button"
                    initial={{ opacity: 0, scale: 0.1 }}
                    animate={{ opacity: 1, scale: 1, y: [0, -7, 0] }}
                    transition={{ opacity: { delay: index * 0.05 }, scale: { delay: index * 0.05 }, y: { repeat: Infinity, duration: 4.8 + index * 0.2, ease: "easeInOut" } }}
                    onClick={() => { setSelectedSecondary(entry.slug); setStage("secondary"); }}
                  >
                    <i />
                    <span>{entry.title}</span>
                    <em>{count} resources</em>
                  </motion.button>
                );
              })}
            </motion.div>
          ) : (
            <motion.div key="secondary" className={styles.system} initial={{ opacity: 0, scale: 1.16 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.86 }} transition={{ duration: 0.72, ease: "easeOut" }}>
              <button className={styles.backNode} type="button" onClick={() => { setStage("primary"); setSelectedResource(null); }}>Photography</button>
              <CenterNode title={currentSecondary?.title || "Humanity"} subtitle="" />
              <svg className={styles.orbits} viewBox="0 0 100 100" preserveAspectRatio="none">
                {resources.map((item, index) => {
                  const p = polar(index, Math.max(resources.length, 8), resourceRadius, 0.7);
                  return <line key={item.id} x1="50" y1="50" x2={p.x} y2={p.y} />;
                })}
              </svg>
              {resources.map((item, index) => {
                const p = polar(index, Math.max(resources.length, 8), resourceRadius, 0.7);
                return (
                  <motion.button
                    key={item.id}
                    className={styles.resourceNode}
                    style={{ left: `${p.x}%`, top: `${p.y}%` }}
                    type="button"
                    initial={{ opacity: 0, scale: 0.1 }}
                    animate={{ opacity: 1, scale: 1, y: [0, -5, 0] }}
                    transition={{ opacity: { delay: index * 0.03 }, scale: { delay: index * 0.03 }, y: { repeat: Infinity, duration: 4 + (index % 5) * 0.3, ease: "easeInOut" } }}
                    onMouseEnter={() => setHoveredResource(item.id)}
                    onMouseLeave={() => setHoveredResource(null)}
                    onClick={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect();
                      setSelectedResource({ item, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
                    }}
                  >
                    <i />
                    {hoveredResource === item.id ? <ResourceTooltip item={item} /> : null}
                  </motion.button>
                );
              })}
              {!loading && !resources.length ? <div className={styles.emptyHint}>No resource nodes yet</div> : null}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      <AnimatePresence>
        {selectedResource ? <ResourcePanel selected={selectedResource} onClose={() => setSelectedResource(null)} /> : null}
      </AnimatePresence>
    </main>
  );
}

function CenterNode({ title }: { title: string; subtitle: string }) {
  return (
    <motion.div className={styles.centerNode} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.8, type: "spring" }}>
      <i /><b>{title}</b>
    </motion.div>
  );
}

function ResourceTooltip({ item }: { item: Media }) {
  return (
    <motion.div className={styles.tooltip} initial={{ opacity: 0, y: 10, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }}>
      <div><ResourceMedia item={item} /></div>
      <b>{item.title || "Untitled"}</b>
      <dl>
        <dt>Date</dt><dd>{formatDate(item.captured_at || item.created_at)}</dd>
        <dt>Camera</dt><dd>{item.camera || "—"}</dd>
        <dt>Lens</dt><dd>{item.lens || "—"}</dd>
        <dt>Tags</dt><dd>{splitTags(item.tags).slice(0, 3).join(" · ") || "—"}</dd>
      </dl>
    </motion.div>
  );
}

function ResourcePanel({ selected, onClose }: { selected: { item: Media; x: number; y: number }; onClose: () => void }) {
  const item = selected.item;
  return (
    <motion.section
      className={styles.galleryPanel}
      style={{ transformOrigin: `${selected.x}px ${selected.y}px` } as CSSProperties}
      initial={{ opacity: 0, clipPath: `circle(0px at ${selected.x}px ${selected.y}px)` }}
      animate={{ opacity: 1, clipPath: `circle(150% at ${selected.x}px ${selected.y}px)` }}
      exit={{ opacity: 0, clipPath: `circle(0px at ${selected.x}px ${selected.y}px)` }}
      transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
    >
      <button type="button" onClick={onClose}>×</button>
      <div className={styles.galleryMedia}><ResourceMedia item={item} /></div>
      <aside className={styles.galleryInfo}>
        <p>PHOTOGRAPHY NODE</p>
        <h2>{item.title || "Untitled"}</h2>
        <dl>
          <dt>Camera</dt><dd>{item.camera || "—"}</dd>
          <dt>Lens</dt><dd>{item.lens || "—"}</dd>
          <dt>Aperture</dt><dd>{item.aperture || "—"}</dd>
          <dt>ISO</dt><dd>{item.iso || "—"}</dd>
          <dt>Shutter</dt><dd>{item.shutter_speed || "—"}</dd>
          <dt>Date</dt><dd>{formatDate(item.captured_at || item.created_at)}</dd>
          <dt>Location</dt><dd>{item.project_location || "—"}</dd>
          <dt>Tags</dt><dd>{splitTags(item.tags).join(" · ") || "—"}</dd>
        </dl>
        <span>{item.description || "No description."}</span>
      </aside>
    </motion.section>
  );
}
