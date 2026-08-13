"use client";

import { useEffect, useRef, useState } from "react";
import { defaultCreativeGraph } from "@/lib/creative-graph";
import type { CreativeGraphData, CreativeGraphNode } from "@/lib/creative-graph";
import styles from "./ContactLanyardOverlay.module.css";

type SimNode = CreativeGraphNode & {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  clusterX: number;
  clusterY: number;
  pinned: boolean;
};

const radiusFor = (level: CreativeGraphNode["level"]) => level === "core" ? 10 : level === "hub" ? 6.5 : 3.5;

function numberFromText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return Math.abs(hash >>> 0);
}

export default function CreativeUniverseGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [graph, setGraph] = useState<CreativeGraphData>(defaultCreativeGraph);
  const [selected, setSelected] = useState<CreativeGraphNode | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/creative-graph", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("图谱读取失败")))
      .then((payload) => { if (active && Array.isArray(payload?.nodes)) setGraph(payload); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let width = 1;
    let height = 1;
    let frame = 0;
    let animationFrame = 0;
    let hovered: SimNode | null = null;
    let pressed: SimNode | null = null;
    let dragging: SimNode | null = null;
    let pressTimer = 0;
    let pointerStart = { x: 0, y: 0 };

    const categories = [...new Set(graph.nodes.map((node) => node.category || "未分类"))];
    const categoryPoints = new Map(categories.map((category, index) => {
      const angle = Math.PI * 2 * index / Math.max(categories.length, 1) - Math.PI / 2;
      return [category, { x: Math.cos(angle), y: Math.sin(angle) }] as const;
    }));
    const nodes: SimNode[] = graph.nodes.map((node) => {
      const seed = numberFromText(node.id);
      const cluster = categoryPoints.get(node.category || "未分类") || { x: 0, y: 0 };
      return {
        ...node,
        x: 0.5 + ((seed % 101) - 50) / 430,
        y: 0.5 + (((seed >>> 7) % 101) - 50) / 430,
        vx: 0,
        vy: 0,
        radius: radiusFor(node.level),
        clusterX: cluster.x,
        clusterY: cluster.y,
        pinned: false,
      };
    });
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const neighbours = new Map<string, Set<string>>();
    for (const link of graph.links) {
      if (!neighbours.has(link.source)) neighbours.set(link.source, new Set());
      if (!neighbours.has(link.target)) neighbours.set(link.target, new Set());
      neighbours.get(link.source)?.add(link.target);
      neighbours.get(link.target)?.add(link.source);
    }

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const density = Math.min(window.devicePixelRatio || 1, 2);
      const previousWidth = width;
      const previousHeight = height;
      width = Math.max(bounds.width, 1);
      height = Math.max(bounds.height, 1);
      canvas.width = Math.round(width * density);
      canvas.height = Math.round(height * density);
      context.setTransform(density, 0, 0, density, 0, 0);
      for (const node of nodes) {
        if (previousWidth === 1 && previousHeight === 1) {
          node.x *= width;
          node.y *= height;
        } else {
          node.x = node.x / previousWidth * width;
          node.y = node.y / previousHeight * height;
        }
      }
    };

    const simulate = () => {
      const centerX = width / 2;
      const centerY = height / 2;
      for (const node of nodes) {
        if (node === dragging || node.pinned) continue;
        const strength = node.level === "core" ? 0.045 : node.level === "hub" ? 0.012 : 0.005;
        const desiredX = node.level === "core" ? centerX : centerX + node.clusterX * width * 0.27;
        const desiredY = node.level === "core" ? centerY : centerY + node.clusterY * height * 0.25;
        node.vx += (desiredX - node.x) * strength;
        node.vy += (desiredY - node.y) * strength;
      }
      for (let left = 0; left < nodes.length; left += 1) {
        for (let right = left + 1; right < nodes.length; right += 1) {
          const a = nodes[left];
          const b = nodes[right];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          const squared = Math.max(dx * dx + dy * dy, 120);
          const distance = Math.sqrt(squared);
          const force = Math.min(950 / squared, 0.55);
          dx /= distance;
          dy /= distance;
          if (a !== dragging && !a.pinned) { a.vx -= dx * force; a.vy -= dy * force; }
          if (b !== dragging && !b.pinned) { b.vx += dx * force; b.vy += dy * force; }
        }
      }
      for (const link of graph.links) {
        const source = nodeMap.get(link.source);
        const target = nodeMap.get(link.target);
        if (!source || !target) continue;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const distance = Math.max(Math.hypot(dx, dy), 1);
        const desired = source.level === "core" || target.level === "core" ? 118 : 84;
        const force = (distance - desired) * 0.0022;
        if (source !== dragging && !source.pinned) { source.vx += dx / distance * force; source.vy += dy / distance * force; }
        if (target !== dragging && !target.pinned) { target.vx -= dx / distance * force; target.vy -= dy / distance * force; }
      }
      for (const node of nodes) {
        if (node === dragging || node.pinned) continue;
        node.vx *= 0.85;
        node.vy *= 0.85;
        node.x = Math.min(width - 28, Math.max(28, node.x + node.vx));
        node.y = Math.min(height - 28, Math.max(28, node.y + node.vy));
      }
    };

    const draw = () => {
      if (frame < 420 || dragging) simulate();
      context.clearRect(0, 0, width, height);
      const focus = (dragging || pressed || hovered)?.id || "";
      const related = focus ? neighbours.get(focus) : null;
      for (const link of graph.links) {
        const source = nodeMap.get(link.source);
        const target = nodeMap.get(link.target);
        if (!source || !target) continue;
        const highlighted = Boolean(focus && (source.id === focus || target.id === focus));
        context.beginPath();
        context.moveTo(source.x, source.y);
        context.lineTo(target.x, target.y);
        context.strokeStyle = highlighted ? "rgba(255,93,54,.65)" : focus ? "rgba(31,35,42,.055)" : "rgba(31,35,42,.11)";
        context.lineWidth = highlighted ? 1.35 : 0.75;
        context.stroke();
      }
      for (const node of nodes) {
        const isFocus = node.id === focus;
        const isRelated = Boolean(related?.has(node.id));
        const muted = Boolean(focus && !isFocus && !isRelated);
        context.beginPath();
        context.arc(node.x, node.y, node.radius + (isFocus ? 2.5 : 0), 0, Math.PI * 2);
        context.fillStyle = isFocus ? "#ff5d36" : node.level === "core" ? "#ff6945" : node.level === "hub" ? "#363a40" : node.status === "planned" ? "#c2c6c2" : "#4a4f55";
        context.globalAlpha = muted ? 0.22 : 1;
        context.fill();
        context.globalAlpha = 1;
        if (node.level !== "node" || isFocus || isRelated) {
          context.font = `${node.level === "core" || isFocus ? 600 : 500} ${isFocus ? 12 : 10}px ui-sans-serif,system-ui,sans-serif`;
          context.textAlign = "center";
          context.textBaseline = "bottom";
          context.fillStyle = muted ? "rgba(35,38,43,.2)" : "rgba(35,38,43,.82)";
          context.fillText(node.name, node.x, node.y - node.radius - 7);
        }
      }
      frame += 1;
      animationFrame = requestAnimationFrame(draw);
    };

    const localPoint = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    };
    const hitNode = (point: { x: number; y: number }) => [...nodes].reverse().find((node) => Math.hypot(node.x - point.x, node.y - point.y) <= Math.max(18, node.radius + 11)) || null;
    const clearPressTimer = () => { if (pressTimer) window.clearTimeout(pressTimer); pressTimer = 0; };
    const onPointerDown = (event: PointerEvent) => {
      const point = localPoint(event);
      const target = hitNode(point);
      if (!target || target.level !== "node") return;
      pointerStart = point;
      pressed = target;
      canvas.setPointerCapture(event.pointerId);
      clearPressTimer();
      pressTimer = window.setTimeout(() => {
        if (!pressed) return;
        dragging = pressed;
        pressed = null;
        canvas.style.cursor = "grabbing";
      }, 360);
    };
    const onPointerMove = (event: PointerEvent) => {
      const point = localPoint(event);
      if (dragging) {
        dragging.x = Math.min(width - 28, Math.max(28, point.x));
        dragging.y = Math.min(height - 28, Math.max(28, point.y));
        dragging.vx = 0;
        dragging.vy = 0;
        frame = 0;
        return;
      }
      if (pressed && Math.hypot(point.x - pointerStart.x, point.y - pointerStart.y) > 9) {
        clearPressTimer();
        pressed = null;
      }
      hovered = hitNode(point);
      canvas.style.cursor = hovered?.level === "node" ? "pointer" : "default";
    };
    const onPointerUp = (event: PointerEvent) => {
      clearPressTimer();
      if (dragging) dragging.pinned = true;
      else if (pressed) setSelected({ ...pressed });
      pressed = null;
      dragging = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      canvas.style.cursor = hovered?.level === "node" ? "pointer" : "default";
    };
    const onPointerCancel = (event: PointerEvent) => {
      clearPressTimer();
      pressed = null;
      dragging = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    const onPointerLeave = () => { if (!pressed && !dragging) hovered = null; };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerCancel);
    canvas.addEventListener("pointerleave", onPointerLeave);
    draw();
    return () => {
      clearPressTimer();
      observer.disconnect();
      cancelAnimationFrame(animationFrame);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [graph]);

  return (
    <div className={styles.graphShell}>
      <canvas ref={canvasRef} className={styles.graphCanvas} aria-label="RING 创作宇宙关系图谱；短按第三级节点查看详情，长按拖动节点" />
      <div className={styles.graphGestureHint}>短按查看详情 · 长按拖动节点</div>
      {selected ? (
        <div className={styles.nodeDetailBackdrop} role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <article className={styles.nodeDetailCard} role="dialog" aria-modal="true" aria-labelledby="graph-node-title">
            <button type="button" className={styles.nodeDetailClose} onClick={() => setSelected(null)} aria-label="关闭详情">×</button>
            {selected.image ? <img src={selected.image} alt={selected.image_alt || selected.name} /> : null}
            <div className={styles.nodeDetailCopy}>
              <p>{selected.category} · 第三级节点</p>
              <h3 id="graph-node-title">{selected.name}</h3>
              {selected.summary ? <strong>{selected.summary}</strong> : null}
              {selected.detail ? <span>{selected.detail}</span> : <span>这个节点的详细内容尚未填写。</span>}
              {selected.link ? <a href={selected.link}>查看相关内容 →</a> : null}
            </div>
          </article>
        </div>
      ) : null}
    </div>
  );
}
