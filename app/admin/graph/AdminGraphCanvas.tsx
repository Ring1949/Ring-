"use client";

import { useEffect, useRef, useState } from "react";
import type { CreativeGraphData, CreativeGraphNode } from "@/lib/creative-graph";
import styles from "./graph-admin.module.css";

type PositionedNode = CreativeGraphNode & {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  clusterX: number;
  clusterY: number;
};

type Props = {
  graph: CreativeGraphData;
  onEdit: (node: CreativeGraphNode) => void;
  onDelete: (id: string) => void;
};

const nodeRadius = (level: CreativeGraphNode["level"]) => level === "core" ? 13 : level === "hub" ? 8 : 4.5;

const textForLevel = (level: CreativeGraphNode["level"]) => {
  if (level === "core") return "核心节点";
  if (level === "hub") return "主节点";
  return "普通节点";
};

function numberFromText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

export function AdminGraphCanvas({ graph, onEdit, onDelete }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selectedRef = useRef("");
  const [selectedId, setSelectedId] = useState("");
  const selectedNode = graph.nodes.find((node) => node.id === selectedId) || null;

  const selectNode = (id: string) => {
    selectedRef.current = id;
    setSelectedId(id);
  };

  useEffect(() => {
    if (selectedId && !graph.nodes.some((node) => node.id === selectedId)) selectNode("");
  }, [graph.nodes, selectedId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let width = 1;
    let height = 1;
    let frame = 0;
    let animationFrame = 0;
    let hoveredId = "";
    let dragNode: PositionedNode | null = null;
    let pointerStart = { x: 0, y: 0 };
    let pointerMoved = false;

    const categories = [...new Set(graph.nodes.map((node) => node.category || "未分类"))];
    const categoryPoint = new Map(categories.map((category, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(categories.length, 1) - Math.PI / 2;
      return [category, { x: Math.cos(angle), y: Math.sin(angle) }] as const;
    }));

    const nodes: PositionedNode[] = graph.nodes.map((node) => {
      const seed = numberFromText(node.id);
      const point = categoryPoint.get(node.category || "未分类") || { x: 0, y: 0 };
      return {
        ...node,
        x: 0.5 + ((seed % 101) - 50) / 500,
        y: 0.5 + (((seed >>> 7) % 101) - 50) / 500,
        vx: 0,
        vy: 0,
        radius: nodeRadius(node.level),
        clusterX: point.x,
        clusterY: point.y,
      };
    });
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const neighbors = new Map<string, Set<string>>();
    for (const link of graph.links) {
      if (!neighbors.has(link.source)) neighbors.set(link.source, new Set());
      if (!neighbors.has(link.target)) neighbors.set(link.target, new Set());
      neighbors.get(link.source)?.add(link.target);
      neighbors.get(link.target)?.add(link.source);
    }

    const resize = () => {
      const box = canvas.getBoundingClientRect();
      const density = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(box.width, 1);
      height = Math.max(box.height, 1);
      canvas.width = Math.round(width * density);
      canvas.height = Math.round(height * density);
      context.setTransform(density, 0, 0, density, 0, 0);
      for (const node of nodes) {
        if (node.x <= 1 && node.y <= 1) {
          node.x *= width;
          node.y *= height;
        }
      }
      draw();
    };

    const simulate = () => {
      const centerX = width / 2;
      const centerY = height / 2;
      for (const node of nodes) {
        if (node === dragNode) continue;
        const clusterStrength = node.level === "core" ? 0.045 : 0.01;
        const desiredX = node.level === "core" ? centerX : centerX + node.clusterX * width * 0.28;
        const desiredY = node.level === "core" ? centerY : centerY + node.clusterY * height * 0.25;
        node.vx += (desiredX - node.x) * clusterStrength;
        node.vy += (desiredY - node.y) * clusterStrength;
      }
      for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
          const left = nodes[leftIndex];
          const right = nodes[rightIndex];
          let dx = right.x - left.x;
          let dy = right.y - left.y;
          const distanceSquared = Math.max(dx * dx + dy * dy, 100);
          const distance = Math.sqrt(distanceSquared);
          const force = Math.min(900 / distanceSquared, 0.6);
          dx /= distance;
          dy /= distance;
          if (left !== dragNode) { left.vx -= dx * force; left.vy -= dy * force; }
          if (right !== dragNode) { right.vx += dx * force; right.vy += dy * force; }
        }
      }
      for (const link of graph.links) {
        const source = nodeMap.get(link.source);
        const target = nodeMap.get(link.target);
        if (!source || !target) continue;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const distance = Math.max(Math.hypot(dx, dy), 1);
        const desired = source.level === "core" || target.level === "core" ? 128 : 92;
        const force = (distance - desired) * 0.0024;
        if (source !== dragNode) { source.vx += dx / distance * force; source.vy += dy / distance * force; }
        if (target !== dragNode) { target.vx -= dx / distance * force; target.vy -= dy / distance * force; }
      }
      for (const node of nodes) {
        if (node === dragNode) continue;
        node.vx *= 0.84;
        node.vy *= 0.84;
        node.x = Math.min(width - 34, Math.max(34, node.x + node.vx));
        node.y = Math.min(height - 34, Math.max(34, node.y + node.vy));
      }
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      const focusId = selectedRef.current || hoveredId;
      const focusNeighbors = focusId ? neighbors.get(focusId) : null;

      for (const link of graph.links) {
        const source = nodeMap.get(link.source);
        const target = nodeMap.get(link.target);
        if (!source || !target) continue;
        const highlighted = Boolean(focusId && (source.id === focusId || target.id === focusId));
        const muted = Boolean(focusId && !highlighted);
        context.beginPath();
        context.moveTo(source.x, source.y);
        context.lineTo(target.x, target.y);
        context.strokeStyle = highlighted ? "rgba(255,105,69,.88)" : muted ? "rgba(57,63,58,.055)" : "rgba(57,63,58,.14)";
        context.lineWidth = highlighted ? 1.8 : 1;
        context.stroke();
      }

      for (const node of nodes) {
        const isFocus = node.id === focusId;
        const isNeighbor = Boolean(focusNeighbors?.has(node.id));
        const muted = Boolean(focusId && !isFocus && !isNeighbor);
        context.beginPath();
        context.arc(node.x, node.y, node.radius + (isFocus ? 3 : 0), 0, Math.PI * 2);
        context.fillStyle = node.level === "core" ? "#ff6945" : muted ? "rgba(47,53,49,.16)" : node.status === "planned" ? "#b8bdb7" : "#353b37";
        context.fill();
        if (isFocus) {
          context.strokeStyle = "rgba(255,105,69,.28)";
          context.lineWidth = 8;
          context.stroke();
        }
        context.font = `${node.level === "core" ? 600 : 500} 11px Inter, \"Noto Sans SC\", sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "bottom";
        context.fillStyle = muted ? "rgba(45,50,46,.2)" : "rgba(35,40,36,.84)";
        context.fillText(node.name, node.x, node.y - node.radius - 7);
      }
    };

    const tick = () => {
      if (frame < 360 || dragNode) simulate();
      draw();
      frame += 1;
      animationFrame = requestAnimationFrame(tick);
    };

    const localPoint = (event: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      return { x: event.clientX - box.left, y: event.clientY - box.top };
    };
    const hitNode = (x: number, y: number) => [...nodes].reverse().find((node) => Math.hypot(node.x - x, node.y - y) <= Math.max(node.radius + 10, 17)) || null;
    const onPointerMove = (event: PointerEvent) => {
      const point = localPoint(event);
      if (dragNode) {
        if (Math.hypot(point.x - pointerStart.x, point.y - pointerStart.y) > 4) pointerMoved = true;
        dragNode.x = point.x;
        dragNode.y = point.y;
        dragNode.vx = 0;
        dragNode.vy = 0;
        frame = 0;
      } else {
        hoveredId = hitNode(point.x, point.y)?.id || "";
        canvas.style.cursor = hoveredId ? "pointer" : "grab";
      }
      draw();
    };
    const onPointerDown = (event: PointerEvent) => {
      const point = localPoint(event);
      pointerStart = point;
      pointerMoved = false;
      dragNode = hitNode(point.x, point.y);
      if (dragNode) canvas.setPointerCapture(event.pointerId);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (dragNode && !pointerMoved) selectNode(dragNode.id);
      dragNode = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      canvas.style.cursor = hoveredId ? "pointer" : "grab";
      draw();
    };
    const onPointerLeave = () => { if (!dragNode) { hoveredId = ""; draw(); } };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);
    resize();
    tick();

    return () => {
      observer.disconnect();
      cancelAnimationFrame(animationFrame);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [graph]);

  return <div className={styles.graphStage}>
    <canvas ref={canvasRef} className={styles.graphCanvas} aria-label="可编辑的关系图谱预览" />
    <div className={styles.graphHint}>拖动查看 · 点击节点进行编辑或删除</div>
    {selectedNode ? <div className={styles.graphNodeBackdrop} onPointerDown={(event) => { if (event.target === event.currentTarget) selectNode(""); }}>
      <article className={styles.graphNodeCard} role="dialog" aria-modal="true" aria-label={`${selectedNode.name} 节点操作`}>
        <button className={styles.graphClose} type="button" onClick={() => selectNode("")} aria-label="关闭">×</button>
        <p>{selectedNode.category} · {textForLevel(selectedNode.level)}</p>
        <h3>{selectedNode.name}</h3>
        <span>{selectedNode.summary || "尚未填写简介"}</span>
        <div>
          <button type="button" onClick={() => { selectNode(""); onEdit(selectedNode); }}>编辑详情</button>
          <button type="button" className={styles.danger} onClick={() => onDelete(selectedNode.id)}>删除节点</button>
        </div>
      </article>
    </div> : null}
  </div>;
}
