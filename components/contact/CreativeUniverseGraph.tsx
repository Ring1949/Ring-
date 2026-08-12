"use client";

import { useEffect, useRef, useState } from "react";
import type { CreativeGraphData, CreativeGraphNode } from "@/lib/creative-graph";
import { defaultCreativeGraph } from "@/lib/creative-graph";
import styles from "./ContactLanyardOverlay.module.css";

type SimNode = CreativeGraphNode & { x: number; y: number; vx: number; vy: number; radius: number };

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  return (result >>> 0) / 4294967295;
}

function clusterFor(category: string, id: string) {
  if (id === "control") return [0.5, 0.5];
  const angle = hash(category) * Math.PI * 2;
  return [0.5 + Math.cos(angle) * 0.26, 0.5 + Math.sin(angle) * 0.25];
}

export default function CreativeUniverseGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [graph, setGraph] = useState<CreativeGraphData>(defaultCreativeGraph);
  const [selected, setSelected] = useState<CreativeGraphNode | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/creative-graph", { cache: "no-store" }).then((response) => response.ok ? response.json() : defaultCreativeGraph).then((data) => { if (active && data?.nodes) setGraph(data); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const nodes: SimNode[] = graph.nodes.map((item) => {
      const [cx, cy] = clusterFor(item.category, item.id);
      return { ...item, x: cx + (hash(item.id) - 0.5) * 0.13, y: cy + (hash(`${item.id}-y`) - 0.5) * 0.13, vx: 0, vy: 0, radius: item.level === "core" ? 9 : item.level === "hub" ? 6.5 : 3.5 };
    });
    const byId = new Map(nodes.map((item) => [item.id, item]));
    const links = graph.links.map((item) => ({ source: byId.get(item.source), target: byId.get(item.target) })).filter((item) => item.source && item.target) as Array<{ source: SimNode; target: SimNode }>;
    const neighbours = new Map<string, Set<string>>();
    links.forEach(({ source, target }) => { if (!neighbours.has(source.id)) neighbours.set(source.id, new Set()); if (!neighbours.has(target.id)) neighbours.set(target.id, new Set()); neighbours.get(source.id)!.add(target.id); neighbours.get(target.id)!.add(source.id); });
    let width = 1; let height = 1; let hovered: SimNode | null = null; let dragging: SimNode | null = null; let moved = false; let frame = 0; let animation = 0;
    const resize = () => { const bounds = canvas.getBoundingClientRect(); const ratio = Math.min(window.devicePixelRatio || 1, 2); width = Math.max(1, bounds.width); height = Math.max(1, bounds.height); canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio); context.setTransform(ratio, 0, 0, ratio, 0, 0); };
    const point = (item: SimNode) => ({ x: item.x * width, y: item.y * height });
    const hit = (event: PointerEvent) => { const bounds = canvas.getBoundingClientRect(); const x = event.clientX - bounds.left; const y = event.clientY - bounds.top; let winner: SimNode | null = null; let best = 20; nodes.forEach((item) => { const p = point(item); const distance = Math.hypot(p.x - x, p.y - y); if (distance < best) { best = distance; winner = item; } }); return winner; };
    const simulate = () => {
      if (frame > 420) return;
      for (let a = 0; a < nodes.length; a += 1) for (let b = a + 1; b < nodes.length; b += 1) { const left = nodes[a]; const right = nodes[b]; let dx = left.x - right.x; let dy = left.y - right.y; const d2 = Math.max(dx * dx + dy * dy, 0.0002); const force = 0.0000025 / d2; const d = Math.sqrt(d2); dx /= d; dy /= d; left.vx += dx * force; left.vy += dy * force; right.vx -= dx * force; right.vy -= dy * force; }
      links.forEach(({ source, target }) => { const dx = target.x - source.x; const dy = target.y - source.y; const d = Math.max(Math.hypot(dx, dy), 0.001); const spring = (d - (source.level !== "node" || target.level !== "node" ? 0.13 : 0.09)) * 0.0015; source.vx += dx / d * spring; source.vy += dy / d * spring; target.vx -= dx / d * spring; target.vy -= dy / d * spring; });
      nodes.forEach((item) => { const [tx, ty] = clusterFor(item.category, item.id); item.vx += (tx - item.x) * (item.level === "core" ? 0.002 : 0.0005); item.vy += (ty - item.y) * (item.level === "core" ? 0.002 : 0.0005); if (item !== dragging) { item.vx *= 0.9; item.vy *= 0.9; item.x = Math.min(0.92, Math.max(0.08, item.x + item.vx)); item.y = Math.min(0.92, Math.max(0.08, item.y + item.vy)); } }); frame += 1;
    };
    const draw = () => {
      simulate(); context.clearRect(0, 0, width, height); const focus = hovered?.id || "control"; const related = neighbours.get(focus) || new Set<string>();
      links.forEach(({ source, target }) => { const a = point(source); const b = point(target); const active = source.id === focus || target.id === focus; context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.strokeStyle = active ? "rgba(255,93,54,.65)" : "rgba(31,35,42,.11)"; context.lineWidth = active ? 1.35 : 0.7; context.stroke(); });
      nodes.forEach((item) => { const p = point(item); const focusNode = item.id === focus; const relatedNode = related.has(item.id); const dim = focus && !focusNode && !relatedNode; context.globalAlpha = dim ? 0.28 : 1; context.beginPath(); context.arc(p.x, p.y, item.radius + (focusNode ? 3 : 0), 0, Math.PI * 2); context.fillStyle = focusNode ? "#ff5d36" : item.level === "core" ? "#17191c" : item.level === "hub" ? "#383c42" : item.status === "active" ? "rgba(75,80,87,.76)" : "rgba(178,182,187,.68)"; context.fill(); if (item.level !== "node" || focusNode || relatedNode) { context.font = `${focusNode ? 600 : 500} ${focusNode ? 12 : 10}px ui-sans-serif,system-ui,sans-serif`; context.fillStyle = "rgba(35,38,43,.86)"; context.textAlign = "center"; context.fillText(item.name, p.x, p.y - item.radius - 7); } context.globalAlpha = 1; });
      animation = requestAnimationFrame(draw);
    };
    const move = (event: PointerEvent) => { if (dragging) { const bounds = canvas.getBoundingClientRect(); dragging.x = Math.min(.92, Math.max(.08, (event.clientX - bounds.left) / width)); dragging.y = Math.min(.92, Math.max(.08, (event.clientY - bounds.top) / height)); dragging.vx = 0; dragging.vy = 0; moved = true; return; } hovered = hit(event); canvas.style.cursor = hovered ? "pointer" : "default"; };
    const down = (event: PointerEvent) => { dragging = hit(event); moved = false; if (dragging) canvas.setPointerCapture(event.pointerId); };
    const up = (event: PointerEvent) => { if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); if (dragging && !moved) setSelected(graph.nodes.find((item) => item.id === dragging?.id) || null); dragging = null; };
    const observer = new ResizeObserver(resize); observer.observe(canvas); resize(); canvas.addEventListener("pointermove", move); canvas.addEventListener("pointerdown", down); canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up); draw();
    return () => { observer.disconnect(); cancelAnimationFrame(animation); canvas.removeEventListener("pointermove", move); canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointerup", up); canvas.removeEventListener("pointercancel", up); };
  }, [graph]);

  useEffect(() => { if (!selected) return; const close = (event: KeyboardEvent) => { if (event.key === "Escape") setSelected(null); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [selected]);

  return <div className={styles.graphShell}>
    <canvas ref={canvasRef} className={styles.graphCanvas} aria-label="RING 创作宇宙关系图谱" />
    {selected ? <div className={styles.nodeBackdrop} onClick={() => setSelected(null)}><article className={styles.nodeCard} role="dialog" aria-modal="true" aria-labelledby="node-card-title" onClick={(event) => event.stopPropagation()}><button type="button" onClick={() => setSelected(null)} aria-label="关闭节点详情">×</button><p>{selected.category} · {selected.status === "active" ? "正在发展" : "计划中"}</p><h3 id="node-card-title">{selected.name}</h3><strong>{selected.summary}</strong><span>{selected.detail}</span>{selected.link ? <a href={selected.link}>打开相关页面 →</a> : null}</article></div> : null}
  </div>;
}
