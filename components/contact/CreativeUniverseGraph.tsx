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
  vx: number;
  vy: number;
  radius: number;
  snappedEdge: SnapEdge | null;
};

type SnapEdge = "top" | "right" | "bottom" | "left";

const EDGE_SNAP_DISTANCE = 58;
const CARD_LEFT_RATIO = 0.06;
const CARD_RIGHT_RATIO = 0.94;
const CARD_TOP_RATIO = 0.08;
const CARD_BOTTOM_RATIO = 0.91;
const CARD_CORNER_RADIUS = 32;

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
    let snapEdge: SnapEdge | null = null;
    let animationFrame = 0;
    let lastFrameTime = performance.now();
    let pointerStart = { x: 0, y: 0 };
    let latestPoint = { x: 0, y: 0 };
    let previousDragPoint = { x: 0, y: 0 };
    const positions = stablePositions(graph);
    const nodes: PositionedNode[] = graph.nodes.map((node) => {
      const position = positions.get(node.id) || { nx: 0.5, ny: 0.5 };
      return { ...node, ...position, x: 0, y: 0, vx: 0, vy: 0, radius: radiusFor(node.level), snappedEdge: null };
    });
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const linkRestLengths = new Map<string, number>();
    const neighbours = new Map<string, Set<string>>();
    for (const link of graph.links) {
      if (!neighbours.has(link.source)) neighbours.set(link.source, new Set());
      if (!neighbours.has(link.target)) neighbours.set(link.target, new Set());
      neighbours.get(link.source)?.add(link.target);
      neighbours.get(link.target)?.add(link.source);
    }

    const cardBounds = () => ({
      left: width * CARD_LEFT_RATIO,
      right: width * CARD_RIGHT_RATIO,
      top: height * CARD_TOP_RATIO,
      bottom: height * CARD_BOTTOM_RATIO,
    });

    const draw = () => {
      context.clearRect(0, 0, width, height);
      const focus = (dragging || pressed || hovered)?.id || "";
      const related = focus ? neighbours.get(focus) : null;
      if (dragging?.level === "node" && snapEdge) {
        const bounds = cardBounds();
        context.save();
        context.beginPath();
        if (snapEdge === "top" || snapEdge === "bottom") {
          const y = snapEdge === "top" ? bounds.top : bounds.bottom;
          context.moveTo(bounds.left + CARD_CORNER_RADIUS, y);
          context.lineTo(bounds.right - CARD_CORNER_RADIUS, y);
        } else {
          const x = snapEdge === "left" ? bounds.left : bounds.right;
          context.moveTo(x, bounds.top + CARD_CORNER_RADIUS);
          context.lineTo(x, bounds.bottom - CARD_CORNER_RADIUS);
        }
        context.strokeStyle = "rgba(255,93,54,.48)";
        context.lineWidth = 2;
        context.setLineDash([5, 7]);
        context.stroke();
        context.restore();
      }
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

    const animate = (time: number) => {
      const delta = Math.min(2, Math.max(0.45, (time - lastFrameTime) / 16.667));
      lastFrameTime = time;

      for (const link of graph.links) {
        const source = nodeMap.get(link.source);
        const target = nodeMap.get(link.target);
        if (!source || !target) continue;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const distance = Math.max(Math.hypot(dx, dy), 1);
        const restLength = linkRestLengths.get(link.id) || distance;
        const spring = (distance - restLength) * 0.0026 * delta;
        if (source !== dragging) {
          source.vx += dx / distance * spring;
          source.vy += dy / distance * spring;
        }
        if (target !== dragging) {
          target.vx -= dx / distance * spring;
          target.vy -= dy / distance * spring;
        }
      }

      for (const node of nodes) {
        if (node === dragging) continue;
        const anchorX = node.nx * width;
        const anchorY = node.ny * height;
        const anchorStrength = node.level === "core" ? 0.032 : node.level === "hub" ? 0.024 : 0.018;
        node.vx += (anchorX - node.x) * anchorStrength * delta;
        node.vy += (anchorY - node.y) * anchorStrength * delta;
        const damping = Math.pow(0.84, delta);
        node.vx *= damping;
        node.vy *= damping;
        node.x = Math.min(width - 28, Math.max(28, node.x + node.vx * delta));
        node.y = Math.min(height - 28, Math.max(28, node.y + node.vy * delta));
        if (node.snappedEdge) {
          const bounds = cardBounds();
          if (node.snappedEdge === "top" || node.snappedEdge === "bottom") {
            node.y = node.snappedEdge === "top" ? bounds.top : bounds.bottom;
            node.x = Math.min(bounds.right - CARD_CORNER_RADIUS, Math.max(bounds.left + CARD_CORNER_RADIUS, node.x));
            node.vy = 0;
          } else {
            node.x = node.snappedEdge === "left" ? bounds.left : bounds.right;
            node.y = Math.min(bounds.bottom - CARD_CORNER_RADIUS, Math.max(bounds.top + CARD_CORNER_RADIUS, node.y));
            node.vx = 0;
          }
        }
      }

      draw();
      animationFrame = requestAnimationFrame(animate);
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
        node.vx = 0;
        node.vy = 0;
      }
      for (const link of graph.links) {
        const source = nodeMap.get(link.source);
        const target = nodeMap.get(link.target);
        if (source && target) linkRestLengths.set(link.id, Math.hypot(target.x - source.x, target.y - source.y));
      }
      draw();
    };
    const localPoint = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    };
    const hitNode = (point: { x: number; y: number }) => [...nodes].reverse().find((node) => Math.hypot(node.x - point.x, node.y - point.y) <= Math.max(20, node.radius + 12)) || null;
    const nearestEdge = (point: { x: number; y: number }): SnapEdge | null => {
      const bounds = cardBounds();
      const distances: Array<[SnapEdge, number]> = [
        ["top", Math.abs(point.y - bounds.top)],
        ["right", Math.abs(point.x - bounds.right)],
        ["bottom", Math.abs(point.y - bounds.bottom)],
        ["left", Math.abs(point.x - bounds.left)],
      ];
      distances.sort((a, b) => a[1] - b[1]);
      return distances[0][1] <= EDGE_SNAP_DISTANCE ? distances[0][0] : null;
    };
    const onPointerDown = (event: PointerEvent) => {
      const point = localPoint(event);
      const target = hitNode(point);
      if (!target || target.level === "core") return;
      event.preventDefault();
      pointerStart = point;
      latestPoint = point;
      previousDragPoint = point;
      pressed = target;
      target.snappedEdge = null;
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = "grab";
      draw();
    };
    const onPointerMove = (event: PointerEvent) => {
      latestPoint = localPoint(event);
      if (pressed && Math.hypot(latestPoint.x - pointerStart.x, latestPoint.y - pointerStart.y) >= 3) {
        dragging = pressed;
        pressed = null;
        previousDragPoint = pointerStart;
        canvas.style.cursor = "grabbing";
      }
      if (dragging) {
        const bounds = cardBounds();
        dragging.vx = (latestPoint.x - previousDragPoint.x) * 0.72;
        dragging.vy = (latestPoint.y - previousDragPoint.y) * 0.72;
        snapEdge = dragging.level === "node" ? nearestEdge(latestPoint) : null;
        dragging.x = Math.min(bounds.right, Math.max(bounds.left, latestPoint.x));
        dragging.y = Math.min(bounds.bottom, Math.max(bounds.top, latestPoint.y));
        if (snapEdge === "top" || snapEdge === "bottom") {
          dragging.y = snapEdge === "top" ? bounds.top : bounds.bottom;
          dragging.x = Math.min(bounds.right - CARD_CORNER_RADIUS, Math.max(bounds.left + CARD_CORNER_RADIUS, dragging.x));
        }
        if (snapEdge === "left" || snapEdge === "right") {
          dragging.x = snapEdge === "left" ? bounds.left : bounds.right;
          dragging.y = Math.min(bounds.bottom - CARD_CORNER_RADIUS, Math.max(bounds.top + CARD_CORNER_RADIUS, dragging.y));
        }
        previousDragPoint = latestPoint;
        draw();
        return;
      }
      hovered = hitNode(latestPoint);
      canvas.style.cursor = hovered && hovered.level !== "core" ? "grab" : "default";
      draw();
    };
    const finishPointer = (event: PointerEvent, cancelled = false) => {
      if (!cancelled && pressed?.level === "node") setSelected({ ...pressed });
      if (!cancelled && dragging) {
        if (dragging.level === "hub") {
          dragging.nx = dragging.x / width;
          dragging.ny = dragging.y / height;
        } else if (snapEdge) {
          dragging.nx = dragging.x / width;
          dragging.ny = dragging.y / height;
          dragging.snappedEdge = snapEdge;
          dragging.vx = 0;
          dragging.vy = 0;
        }
      }
      pressed = null;
      dragging = null;
      snapEdge = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      canvas.style.cursor = hovered && hovered.level !== "core" ? "grab" : "default";
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
    animationFrame = requestAnimationFrame(animate);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(animationFrame);
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
      <canvas ref={canvasRef} className={styles.graphCanvas} aria-label="RING 创作宇宙关系图谱；二三级节点可拖动，第三级节点可吸附边缘" />
      <div className={styles.graphGestureHint}>二三级可拖动 · 三级靠边自动吸附</div>
      {detail}
    </div>
  );
}
