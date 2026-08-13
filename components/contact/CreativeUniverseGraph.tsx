"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { defaultCreativeGraph } from "@/lib/creative-graph";
import type { CreativeGraphData, CreativeGraphNode } from "@/lib/creative-graph";
import styles from "./ContactLanyardOverlay.module.css";

type PositionedNode = CreativeGraphNode & {
  x: number;
  y: number;
  nx: number;
  ny: number;
  radius: number;
  pinned: boolean;
};

const radiusFor = (level: CreativeGraphNode["level"]) => level === "core" ? 10 : level === "hub" ? 6.5 : 3.5;

function stablePositions(graph: CreativeGraphData) {
  const core = graph.nodes.filter((node) => node.level === "core");
  const hubs = graph.nodes.filter((node) => node.level === "hub");
  const leaves = graph.nodes.filter((node) => node.level === "node");
  const hubOrder = new Map(hubs.map((node, index) => [node.id, index]));
  const leafParent = new Map<string, string>();
  for (const leaf of leaves) {
    const connectedHubs = graph.links
      .map((link) => link.source === leaf.id ? link.target : link.target === leaf.id ? link.source : "")
      .filter((id) => hubOrder.has(id));
    connectedHubs.sort((a, b) => (hubOrder.get(a) || 0) - (hubOrder.get(b) || 0));
    if (connectedHubs[0]) leafParent.set(leaf.id, connectedHubs[0]);
  }
  const orderedLeaves = [...leaves].sort((a, b) => {
    const aHub = leafParent.get(a.id);
    const bHub = leafParent.get(b.id);
    const hubDifference = (aHub ? hubOrder.get(aHub) ?? hubs.length : hubs.length) - (bHub ? hubOrder.get(bHub) ?? hubs.length : hubs.length);
    return hubDifference || a.name.localeCompare(b.name, "zh-CN");
  });
  const positions = new Map<string, { nx: number; ny: number }>();
  core.forEach((node, index) => positions.set(node.id, { nx: 0.5 + index * 0.025, ny: 0.5 + index * 0.025 }));
  hubs.forEach((node, index) => {
    const angle = Math.PI * 2 * index / Math.max(hubs.length, 1) - Math.PI / 2;
    positions.set(node.id, { nx: 0.5 + Math.cos(angle) * 0.265, ny: 0.5 + Math.sin(angle) * 0.265 });
  });
  orderedLeaves.forEach((node, index) => {
    const angle = Math.PI * 2 * index / Math.max(orderedLeaves.length, 1) - Math.PI / 2;
    const alternatingRadius = index % 2 === 0 ? 0.405 : 0.45;
    positions.set(node.id, {
      nx: 0.5 + Math.cos(angle) * alternatingRadius,
      ny: 0.5 + Math.sin(angle) * alternatingRadius,
    });
  });
  return positions;
}

export default function CreativeUniverseGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [graph, setGraph] = useState<CreativeGraphData>(defaultCreativeGraph);
  const [selected, setSelected] = useState<CreativeGraphNode | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
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
    let hovered: PositionedNode | null = null;
    let pressed: PositionedNode | null = null;
    let dragging: PositionedNode | null = null;
    let pressTimer = 0;
    let latestPoint = { x: 0, y: 0 };
    const positions = stablePositions(graph);
    const nodes: PositionedNode[] = graph.nodes.map((node) => {
      const position = positions.get(node.id) || { nx: 0.5, ny: 0.5 };
      return { ...node, ...position, x: 0, y: 0, radius: radiusFor(node.level), pinned: false };
    });
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const neighbours = new Map<string, Set<string>>();
    for (const link of graph.links) {
      if (!neighbours.has(link.source)) neighbours.set(link.source, new Set());
      if (!neighbours.has(link.target)) neighbours.set(link.target, new Set());
      neighbours.get(link.source)?.add(link.target);
      neighbours.get(link.target)?.add(link.source);
    }

    const draw = () => {
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
        context.strokeStyle = highlighted ? "rgba(255,93,54,.68)" : focus ? "rgba(31,35,42,.045)" : "rgba(31,35,42,.105)";
        context.lineWidth = highlighted ? 1.4 : 0.75;
        context.stroke();
      }
      for (const node of nodes) {
        const isFocus = node.id === focus;
        const isRelated = Boolean(related?.has(node.id));
        const muted = Boolean(focus && !isFocus && !isRelated);
        context.beginPath();
        context.arc(node.x, node.y, node.radius + (isFocus ? 2.5 : 0), 0, Math.PI * 2);
        context.fillStyle = isFocus ? "#ff5d36" : node.level === "core" ? "#ff6945" : node.level === "hub" ? "#363a40" : node.status === "planned" ? "#c2c6c2" : "#4a4f55";
        context.globalAlpha = muted ? 0.2 : 1;
        context.fill();
        context.globalAlpha = 1;
        if (node.level !== "node" || isFocus || isRelated) {
          context.font = `${node.level === "core" || isFocus ? 600 : 500} ${isFocus ? 12 : 10}px ui-sans-serif,system-ui,sans-serif`;
          context.textAlign = "center";
          context.textBaseline = "bottom";
          context.fillStyle = muted ? "rgba(35,38,43,.19)" : "rgba(35,38,43,.82)";
          context.fillText(node.name, node.x, node.y - node.radius - 7);
        }
      }
    };

    const layout = () => {
      const bounds = canvas.getBoundingClientRect();
      const density = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(bounds.width, 1);
      height = Math.max(bounds.height, 1);
      canvas.width = Math.round(width * density);
      canvas.height = Math.round(height * density);
      context.setTransform(density, 0, 0, density, 0, 0);
      for (const node of nodes) {
        node.x = Math.min(width - 28, Math.max(28, node.nx * width));
        node.y = Math.min(height - 28, Math.max(28, node.ny * height));
      }
      draw();
    };
    const localPoint = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    };
    const hitNode = (point: { x: number; y: number }) => [...nodes].reverse().find((node) => Math.hypot(node.x - point.x, node.y - point.y) <= Math.max(20, node.radius + 12)) || null;
    const clearTimer = () => { if (pressTimer) window.clearTimeout(pressTimer); pressTimer = 0; };
    const onPointerDown = (event: PointerEvent) => {
      const target = hitNode(localPoint(event));
      if (!target || target.level !== "node") return;
      event.preventDefault();
      latestPoint = localPoint(event);
      pressed = target;
      canvas.setPointerCapture(event.pointerId);
      clearTimer();
      pressTimer = window.setTimeout(() => {
        if (!pressed) return;
        dragging = pressed;
        pressed = null;
        dragging.x = latestPoint.x;
        dragging.y = latestPoint.y;
        dragging.nx = dragging.x / width;
        dragging.ny = dragging.y / height;
        canvas.style.cursor = "grabbing";
        draw();
      }, 300);
      draw();
    };
    const onPointerMove = (event: PointerEvent) => {
      latestPoint = localPoint(event);
      if (dragging) {
        dragging.x = Math.min(width - 28, Math.max(28, latestPoint.x));
        dragging.y = Math.min(height - 28, Math.max(28, latestPoint.y));
        dragging.nx = dragging.x / width;
        dragging.ny = dragging.y / height;
        dragging.pinned = true;
        draw();
        return;
      }
      hovered = hitNode(latestPoint);
      canvas.style.cursor = hovered?.level === "node" ? "pointer" : "default";
      draw();
    };
    const finishPointer = (event: PointerEvent, cancelled = false) => {
      clearTimer();
      if (!cancelled && pressed) setSelected({ ...pressed });
      pressed = null;
      dragging = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      canvas.style.cursor = hovered?.level === "node" ? "pointer" : "default";
      draw();
    };
    const onPointerUp = (event: PointerEvent) => finishPointer(event);
    const onPointerCancel = (event: PointerEvent) => finishPointer(event, true);
    const onPointerLeave = () => { if (!pressed && !dragging) { hovered = null; draw(); } };

    const observer = new ResizeObserver(layout);
    observer.observe(canvas);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerCancel);
    canvas.addEventListener("pointerleave", onPointerLeave);
    layout();
    return () => {
      clearTimer();
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [graph]);

  const detail = selected && mounted ? createPortal(
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
    </div>,
    document.body
  ) : null;

  return (
    <div className={styles.graphShell}>
      <canvas ref={canvasRef} className={styles.graphCanvas} aria-label="RING 创作宇宙关系图谱；短按第三级节点查看详情，长按拖动节点" />
      <div className={styles.graphGestureHint}>短按查看详情 · 长按拖动节点</div>
      {detail}
    </div>
  );
}
