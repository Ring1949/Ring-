"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject, type PointerEvent as ReactPointerEvent, type WheelEvent } from "react";
import * as THREE from "three";
import type { Media } from "@/lib/types";
import { defaultInspirationTree, type InspirationTree, type InspirationResourceMap } from "@/lib/inspiration";
import HumanityArchive from "@/components/inspiration/HumanityArchive";
import styles from "./InspirationCloudOverlay.module.css";

type ChannelSlug = string;
type ChannelMeta = { title: string; english: string; whisper?: string };
type CloudControls = { targetX: number; targetY: number; targetZ: number; isDragging: boolean; lastX: number; lastY: number };
type Chapter = { id: string; title: string; english: string; left: string; top: string; keywords: string[] };
const CHAPTER_POSITIONS = [["30%", "62%"], ["68%", "30%"], ["76%", "57%"], ["55%", "78%"], ["22%", "35%"], ["48%", "22%"], ["86%", "73%"]] as const;
const CHANNEL_MEDIA_SLUGS: Record<string, string[]> = { photo: ["photo", "photography"], graphic: ["graphic", "design"], space: ["space", "3d", "three-d"], ai: ["ai"], other: ["other", "video", "daily"] };
function channelMeta(tree: InspirationTree, slug: string): ChannelMeta { const item = tree.channels.find((channel) => channel.id === slug) || tree.channels[0] || defaultInspirationTree.channels[0]; return { title: item.title, english: item.english, whisper: slug === "photo" ? "\u4eba\u6587" : undefined }; }
function chapterItems(tree: InspirationTree, slug: string): Chapter[] { const channel = tree.channels.find((item) => item.id === slug) || tree.channels[0] || defaultInspirationTree.channels[0]; return channel.chapters.map((item, index) => { const position = CHAPTER_POSITIONS[index % CHAPTER_POSITIONS.length]; return { ...item, keywords: item.keywords || [], left: position[0], top: position[1] }; }); }


function randomNormal(random: () => number) { const u = Math.max(random(), 0.000001), v = Math.max(random(), 0.000001); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function seededRandom(seed = 93271) { let value = seed >>> 0; return () => { value += 0x6d2b79f5; let next = value; next = Math.imul(next ^ (next >>> 15), next | 1); next ^= next + Math.imul(next ^ (next >>> 7), next | 61); return ((next ^ (next >>> 14)) >>> 0) / 4294967296; }; }
function makeCloud(count: number) {
  const random = seededRandom(count * 47 + 11), positions = new Float32Array(count * 3), colors = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const density = random(), n1 = randomNormal(random), n2 = randomNormal(random), n3 = randomNormal(random), cloudScale = density < 0.7 ? 1 : 1.85;
    const angle = Math.atan2(n2, n1) + Math.sin(index * 0.0018) * 0.18, radius = Math.abs(n1) * cloudScale + random() * 0.25, offset = index * 3;
    positions[offset] = Math.cos(angle) * radius * 2.5 + n3 * 0.42; positions[offset + 1] = Math.sin(angle) * radius * 1.62 + n2 * 0.22; positions[offset + 2] = n3 * 1.15 + (random() - 0.5) * 1.7;
    const brightness = 0.28 + Math.min(0.66, Math.abs(n3) * 0.12 + (1 - Math.min(radius / 5, 1)) * 0.44 + random() * 0.16);
    colors[offset] = brightness; colors[offset + 1] = brightness; colors[offset + 2] = brightness;
  }
  const linkCount = 220, links = new Float32Array(linkCount * 6);
  for (let index = 0; index < linkCount; index += 1) {
    const angle = random() * Math.PI * 2, radius = Math.pow(random(), 1.9) * 2.65, x = Math.cos(angle) * radius, y = Math.sin(angle) * radius * 0.64, z = (random() - 0.5) * 1.4, length = 0.06 + random() * 0.26, offset = index * 6;
    links[offset] = x; links[offset + 1] = y; links[offset + 2] = z; links[offset + 3] = x + Math.cos(angle + (random() - 0.5) * 1.2) * length; links[offset + 4] = y + Math.sin(angle + (random() - 0.5) * 1.2) * length; links[offset + 5] = z + (random() - 0.5) * 0.12;
  }
  return { positions, colors, links };
}
function PointCloud({ controls, reducedMotion, deep }: { controls: MutableRefObject<CloudControls>; reducedMotion: boolean; deep: boolean }) {
  const group = useRef<THREE.Group>(null), points = useRef<THREE.Points>(null); const { camera } = useThree();
  const pointCount = typeof window !== "undefined" && window.innerWidth < 720 ? 12000 : 36000; const cloud = useMemo(() => makeCloud(pointCount), [pointCount]);
  useEffect(() => { camera.position.set(0, 0, 8.5); }, [camera]);
  useFrame((state) => { const control = controls.current; if (!group.current) return; group.current.rotation.y += (control.targetX - group.current.rotation.y) * 0.045; group.current.rotation.x += (control.targetY - group.current.rotation.x) * 0.045; group.current.scale.lerp(new THREE.Vector3(deep ? 1.48 : 1, deep ? 1.48 : 1, deep ? 1.48 : 1), 0.035); group.current.position.y = reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 0.18) * 0.055; camera.position.z += (control.targetZ - camera.position.z) * 0.07; if (points.current && !reducedMotion) points.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.06) * 0.025; });
  return <group ref={group}><points ref={points}><bufferGeometry><bufferAttribute attach="attributes-position" args={[cloud.positions, 3]} /><bufferAttribute attach="attributes-color" args={[cloud.colors, 3]} /></bufferGeometry><pointsMaterial size={0.016} sizeAttenuation vertexColors transparent opacity={0.89} depthWrite={false} /></points><lineSegments><bufferGeometry><bufferAttribute attach="attributes-position" args={[cloud.links, 3]} /></bufferGeometry><lineBasicMaterial color="#dfe3e5" transparent opacity={0.12} depthWrite={false} /></lineSegments></group>;
}
function CloudCanvas({ reducedMotion, deep, archiveActive, onZoomIn, onZoomOut, archiveItems = [], onArchiveSelect }: { reducedMotion: boolean; deep: boolean; archiveActive: boolean; onZoomIn: () => void; onZoomOut: () => void; archiveItems?: Media[]; onArchiveSelect?: (item: Media) => void }) {
  const controls = useRef<CloudControls>({ targetX: 0, targetY: 0, targetZ: 8.5, isDragging: false, lastX: 0, lastY: 0 });
  const archiveEnabled = archiveActive;
  useEffect(() => { controls.current.targetZ = 8.5; }, [archiveActive]);
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => { controls.current.isDragging = true; controls.current.lastX = event.clientX; controls.current.lastY = event.clientY; event.currentTarget.setPointerCapture(event.pointerId); };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => { if (!controls.current.isDragging) return; const dx = event.clientX - controls.current.lastX, dy = event.clientY - controls.current.lastY; controls.current.targetX += dx * 0.0042; controls.current.targetY = THREE.MathUtils.clamp(controls.current.targetY + dy * 0.003, -0.46, 0.46); controls.current.lastX = event.clientX; controls.current.lastY = event.clientY; };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => { controls.current.isDragging = false; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); };
  const onWheel = (event: WheelEvent<HTMLDivElement>) => { event.preventDefault(); const nextZ = THREE.MathUtils.clamp(controls.current.targetZ + event.deltaY * (archiveEnabled ? 0.018 : 0.008), archiveEnabled ? -64 : 4.4, 13.5); controls.current.targetZ = nextZ; if (!archiveEnabled && nextZ <= 5.8) onZoomIn(); if (!archiveEnabled && nextZ >= 9.8) onZoomOut(); if (archiveEnabled && event.deltaY > 0 && nextZ >= 12.8) onZoomOut(); };
  return <div className={styles.canvas} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel}><Canvas dpr={[1, 1.5]} gl={{ antialias: false, alpha: false, powerPreference: "high-performance" }} camera={{ fov: 50, position: [0, 0, 8.5] }}><color attach="background" args={["#121314"]} /><fog attach="fog" args={["#121314", 7.5, archiveEnabled ? 92 : 16]} /><PointCloud controls={controls} reducedMotion={reducedMotion} deep={deep} />{archiveEnabled && archiveItems.length > 0 && onArchiveSelect ? <HumanityArchive items={archiveItems} controls={controls} onSelect={onArchiveSelect} reducedMotion={reducedMotion} /> : null}</Canvas></div>;
}
function itemKind(item: Media) { const type = (item.media_type || item.mime_type || item.file_type || "image").toLowerCase(); if (type.includes("video")) return "video"; if (type.includes("pdf") || type.includes("file") || type.includes("zip")) return "file"; return "image"; }
function textBlob(item: Media) { return [item.title, item.description, item.tags, item.project_title].filter(Boolean).join(" ").toLowerCase(); }
function chapterFor(item: Media, chapters: Chapter[]) { const blob = textBlob(item); return chapters.find((chapter) => chapter.keywords.some((word) => blob.includes(word.toLowerCase())))?.english || chapters[0].english; }
function resourcePosition(index: number, total: number) { const angle = index * 2.399963229728653 + 0.35; const ring = 17 + (index % 5) * 4.6 + Math.floor(index / 5) * 1.15; return { left: Math.max(8, Math.min(92, 50 + Math.cos(angle) * ring)), top: Math.max(12, Math.min(88, 50 + Math.sin(angle) * ring * 0.66)) }; }
function MediaVisual({ item, thumbnail = false }: { item: Media; thumbnail?: boolean }) { const kind = itemKind(item); if (kind === "video") return <video src={item.file_path} muted loop playsInline autoPlay={thumbnail} preload="metadata" />; if (kind === "file") return <span className={styles.fileNode}>FILE</span>; return <img src={item.file_path} alt={item.title || "Photography resource"} loading="lazy" />; }

export default function InspirationCloudOverlay() {
  const [channel, setChannel] = useState<ChannelSlug>("photo"), [open, setOpen] = useState(false), [reducedMotion, setReducedMotion] = useState(false), [depth, setDepth] = useState<"root" | "sub" | "resources">("root"), [activeChapter, setActiveChapter] = useState("HUMANITY"), [items, setItems] = useState<Media[]>([]), [selectedResource, setSelectedResource] = useState<Media | null>(null);
  const [tree, setTree] = useState<InspirationTree>(defaultInspirationTree);
  const [assignments, setAssignments] = useState<InspirationResourceMap>({});
  const meta = channelMeta(tree, channel);
  const channelChapters = chapterItems(tree, channel);
  const activeMeta = channelChapters.find((item) => item.english === activeChapter) || channelChapters[0];
  const channelItems = useMemo(() => items.filter((item) => assignments[String(item.id)]?.channel ? assignments[String(item.id)].channel === channel : (CHANNEL_MEDIA_SLUGS[channel] || []).includes(String(item.category_slug || "").toLowerCase())), [items, channel, assignments]);
  const resources = useMemo(() => channelItems.map((item) => ({ ...item, ...assignments[String(item.id)], inspiration_channel: assignments[String(item.id)]?.channel, inspiration_chapter: assignments[String(item.id)]?.chapter })).filter((item) => (item.inspiration_chapter ? item.inspiration_chapter === activeMeta?.id : chapterFor(item, channelChapters) === activeMeta?.english)), [channelItems, channelChapters, activeMeta?.english, activeMeta?.id, assignments]);
  const close = () => { setOpen(false); setSelectedResource(null); document.querySelector(".nav")?.classList.remove("nav-hidden-explore"); document.body.classList.remove("inspiration-cloud-active"); };
  const enterResources = (chapter: Chapter) => { setActiveChapter(chapter.english); setDepth("resources"); };
  useEffect(() => { const media = window.matchMedia("(prefers-reduced-motion: reduce)"); const update = () => setReducedMotion(media.matches); update(); media.addEventListener("change", update); return () => media.removeEventListener("change", update); }, []);
  useEffect(() => { if (!open) return; let live = true; const load = async () => { const [curatedResponse, configResponse] = await Promise.all([fetch("/api/inspiration"), fetch("/api/inspiration-config")]); const curated = curatedResponse.ok ? await curatedResponse.json() : []; const config = configResponse.ok ? await configResponse.json() : null; if (live && config?.tree) { setTree(config.tree); setAssignments(config.assignments || {}); } if (Array.isArray(curated) && curated.length) return curated; const mediaResponse = await fetch("/api/media"); const allMedia = mediaResponse.ok ? await mediaResponse.json() : []; return Array.isArray(allMedia) ? allMedia : []; }; load().then((data) => { if (live) setItems(data); }).catch(() => { if (live) setItems([]); }); return () => { live = false; }; }, [open, channel]);
  useEffect(() => { const openCloud = (event: Event) => { const requested = (event as CustomEvent<{ category?: string }>).detail?.category; const next = requested && tree.channels.some((item) => item.id === requested) ? requested : (tree.channels[0]?.id || "photo"); const nextChapters = chapterItems(tree, next); setChannel(next); setDepth("root"); setActiveChapter(nextChapters[0]?.english || ""); setSelectedResource(null); setOpen(true); document.querySelector(".nav")?.classList.add("nav-hidden-explore"); document.body.classList.add("inspiration-cloud-active"); }; const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") { if (selectedResource) setSelectedResource(null); else if (depth === "resources") setDepth("sub"); else if (depth === "sub") setDepth("root"); else close(); } }; window.addEventListener("shanchuan:open-inspiration-cloud", openCloud); window.addEventListener("keydown", onKeyDown); return () => { window.removeEventListener("shanchuan:open-inspiration-cloud", openCloud); window.removeEventListener("keydown", onKeyDown); document.body.classList.remove("inspiration-cloud-active"); }; }, [depth, selectedResource, tree]);
  if (!open) return null;
  const showChapters = depth === "sub";
  const showResources = depth === "resources";
  const archiveMode = showResources;
  const archiveImages = archiveMode ? resources.filter((item) => itemKind(item) === "image" && Boolean(item.file_path)) : [];
  const labelTitle = meta.title;
  const labelEnglish = meta.english;
  if (!activeMeta) return null;
  return <section className={styles.overlay} aria-label={labelTitle + " inspiration space"}>
    <CloudCanvas reducedMotion={reducedMotion} deep={showResources} archiveActive={archiveMode} archiveItems={archiveImages} onArchiveSelect={setSelectedResource} onZoomIn={() => setDepth((value) => value === "root" ? "sub" : value)} onZoomOut={() => { if (depth === "resources") setDepth("root"); }} />
    <div className={styles.vignette} aria-hidden="true" />
    <button className={styles.backButton} type="button" onClick={() => { if (depth === "resources") { setSelectedResource(null); setDepth("root"); } else close(); }} aria-label={depth === "resources" ? "Back to channel" : "Return to homepage"}><i aria-hidden="true" />{depth === "resources" ? "BACK" : "HOME"}</button>
    {showResources ? <div key={activeMeta.english} className={archiveMode ? styles.chapterCenterArchive : styles.chapterCenter} aria-label={activeMeta.title + " " + activeMeta.english}><span>{activeMeta.title}</span><small>{activeMeta.english}</small></div> : <div className={styles.label}><button className={styles.focusLabel} type="button" onClick={() => { if (depth === "root") setDepth("sub"); }} aria-label={labelTitle + " " + labelEnglish}><span>{labelTitle}</span><small>{labelEnglish}</small></button></div>}
    {showChapters ? <div className={styles.subcategoryLayer} aria-label={meta.english + " chapters"}>{channelChapters.map((item) => <button key={item.english} type="button" className={styles.subcategory} style={{ left: item.left, top: item.top }} onClick={() => enterResources(item)}><i aria-hidden="true" /><span>{item.title}</span><small>{item.english}</small></button>)}</div> : null}
    {showResources && !archiveMode ? <div className={styles.resourceLayer} aria-label={activeMeta.title + " resources"}>{resources.map((item, index) => { const point = resourcePosition(index, resources.length); return <button key={item.id} type="button" className={styles.resourceCard} style={{ left: point.left + "%", top: point.top + "%", animationDelay: (index % 7) * -0.45 + "s" }} onClick={() => setSelectedResource(item)}><MediaVisual item={item} thumbnail /><i aria-hidden="true" /></button>; })}{!resources.length ? <span className={styles.emptyResources}>NO MATERIALS YET</span> : null}</div> : null}
    {showResources && archiveMode && !archiveImages.length ? <span className={styles.emptyResources}>NO MATERIALS YET</span> : null}
    {!showResources && !showChapters && meta.whisper ? <span className={styles.whisper} aria-hidden="true">{meta.whisper}</span> : null}
    {selectedResource ? <ResourcePanel item={selectedResource} category={meta.english} onClose={() => setSelectedResource(null)} /> : null}
  </section>;
}
function ResourcePanel({ item, category, onClose }: { item: Media; category: string; onClose: () => void }) {
  return <section className={styles.resourcePanel} role="dialog" aria-modal="true" aria-label={item.title || "Resource preview"}><button type="button" className={styles.resourceClose} onClick={onClose} aria-label="Close preview">&#215;</button><div className={styles.resourcePreview}><MediaVisual item={item} /></div><aside className={styles.resourceInfo}><p>{category + " MATERIAL"}</p><h2>{item.title || "UNTITLED"}</h2><dl><dt>CAMERA</dt><dd>{item.camera || "\u2014"}</dd><dt>LENS</dt><dd>{item.lens || "\u2014"}</dd><dt>DATE</dt><dd>{item.captured_at || item.created_at || "\u2014"}</dd><dt>TAGS</dt><dd>{item.tags || "\u2014"}</dd></dl>{item.description ? <span>{item.description}</span> : null}<div className={styles.resourceActions}><a href={item.source_url || item.file_path} target="_blank" rel="noreferrer">OPEN LINK</a><a href={item.file_path} download={item.original_name || true}>DOWNLOAD ORIGINAL</a></div></aside></section>;
}
