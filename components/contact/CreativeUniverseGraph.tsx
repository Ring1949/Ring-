"use client";

import { useEffect, useRef } from "react";
import styles from "./ContactLanyardOverlay.module.css";

const RESOLVED_NODES = new Set([
  "00-总控台", "AI", "CS2", "GTA5", "INSIDE", "PUBG", "三角洲行动", "个人作品集", "个人网站",
  "光遇 Sky", "双人成行", "周复盘", "地狱边境 Limbo", "城市：天际线 Cities - Skylines",
  "小小梦魇 Little Nightmares", "我的世界 Minecraft", "战地1", "摄影", "文明6 Civilization VI",
  "旅行青蛙", "无畏契约 Valorant", "星露谷物语 Stardew Valley", "极限竞速：地平线4",
  "极限竞速：地平线系列", "森林 The Forest", "森林之子 Sons of the Forest", "求生之路 Left 4 Dead",
  "求职", "洛克王国", "游戏与数字世界", "猛兽派对", "王者荣耀", "球球大作战", "知识与资料库",
  "纪念碑谷 Monument Valley", "网站发布规则", "胡闹搬家 Moving Out", "贪吃蛇大作战", "进度收件箱",
  "霍格沃茨之遗 Hogwarts Legacy", "鹅鸭杀", "项目模板",
]);

const GRAPH_LINKS: Array<[string, string]> = [
  ["00-总控台", "AI"], ["00-总控台", "AI与技术"], ["00-总控台", "个人网站"], ["00-总控台", "个人作品集"],
  ["00-总控台", "进度收件箱"], ["00-总控台", "求职"], ["00-总控台", "摄影"], ["00-总控台", "摄影与影视"],
  ["00-总控台", "生活美学与手作"], ["00-总控台", "视觉设计与空间"], ["00-总控台", "网站发布规则"],
  ["00-总控台", "写作与世界构建"], ["00-总控台", "游戏与数字世界"], ["00-总控台", "语言与音乐"],
  ["00-总控台", "运动旅行与自然"], ["00-总控台", "知识与素材系统"], ["00-总控台", "知识与资料库"],
  ["00-总控台", "职业与商业"], ["00-总控台", "周复盘"], ["AI", "AI Agent"], ["AI", "AI工作流与自动化"],
  ["AI", "AI应用开发"], ["AI", "AI与技术"], ["AI", "Prompt素材库"], ["AI", "Skill素材库"], ["AI", "个人网站"],
  ["AI", "个人作品集"], ["AI", "求职"], ["AI", "知识与资料库"], ["AI", "周复盘"], ["CS2", "游戏与数字世界"],
  ["DaVinci调色", "摄影"], ["GTA5", "游戏与数字世界"], ["INSIDE", "游戏与数字世界"],
  ["Prompt素材库", "知识与资料库"], ["PUBG", "游戏与数字世界"], ["Skill素材库", "知识与资料库"],
  ["参加摄影比赛", "摄影"], ["产品摄影", "摄影"], ["城市：天际线 Cities - Skylines", "游戏与数字世界"],
  ["地理", "摄影"], ["地狱边境 Limbo", "游戏与数字世界"], ["电影库", "知识与资料库"], ["个人网站", "求职"],
  ["个人网站", "摄影"], ["个人网站", "网站开发"], ["个人网站", "周复盘"], ["个人知识库", "知识与资料库"],
  ["个人作品集", "个人网站"], ["个人作品集", "进度收件箱"], ["个人作品集", "求职"], ["个人作品集", "摄影"],
  ["个人作品集", "网站发布规则"], ["个人作品集", "周复盘"], ["个人作品集", "作品集设计"],
  ["光遇 Sky", "游戏与数字世界"], ["极限竞速：地平线4", "游戏与数字世界"],
  ["极限竞速：地平线系列", "游戏与数字世界"], ["建筑摄影", "摄影"], ["灵感库", "知识与资料库"],
  ["洛克王国", "游戏与数字世界"], ["旅行青蛙", "游戏与数字世界"], ["求生之路 Left 4 Dead", "游戏与数字世界"],
  ["求职", "职业与商业"], ["人像摄影", "摄影"], ["三角洲行动", "游戏与数字世界"],
  ["森林 The Forest", "游戏与数字世界"], ["森林之子 Sons of the Forest", "游戏与数字世界"],
  ["摄影", "风光摄影"], ["摄影", "纪录片拍摄"], ["摄影", "旅行"], ["摄影", "旅行记录"],
  ["摄影", "签约视觉中国"], ["摄影", "求职"], ["摄影", "星空延时"], ["书籍库", "知识与资料库"],
  ["双人成行", "游戏与数字世界"], ["天文摄影", "摄影"], ["图片素材库", "知识与资料库"],
  ["网站发布规则", "进度收件箱"], ["文明6 Civilization VI", "游戏与数字世界"],
  ["我的世界 Minecraft", "游戏与数字世界"], ["无畏契约 Valorant", "游戏与数字世界"],
  ["小小梦魇 Little Nightmares", "游戏与数字世界"], ["星露谷物语 Stardew Valley", "游戏与数字世界"],
  ["影视和书籍总清单维护", "知识与资料库"], ["游戏与数字世界", "鹅鸭杀"],
  ["游戏与数字世界", "胡闹搬家 Moving Out"], ["游戏与数字世界", "霍格沃茨之遗 Hogwarts Legacy"],
  ["游戏与数字世界", "纪念碑谷 Monument Valley"], ["游戏与数字世界", "猛兽派对"],
  ["游戏与数字世界", "球球大作战"], ["游戏与数字世界", "生活美学与手作"],
  ["游戏与数字世界", "贪吃蛇大作战"], ["游戏与数字世界", "王者荣耀"], ["游戏与数字世界", "语言与音乐"],
  ["战地1", "游戏与数字世界"], ["周复盘", "进度收件箱"], ["周复盘", "求职"], ["周复盘", "摄影"],
  ["周复盘", "网站发布规则"], ["周复盘", "知识与资料库"],
];

const HUBS = new Set(["00-总控台", "AI", "摄影", "游戏与数字世界", "个人作品集", "知识与资料库"]);
const GRAPH_NAMES = Array.from(new Set(["项目模板", ...GRAPH_LINKS.flat()]));

type SimNode = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  resolved: boolean;
  hub: boolean;
};

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  return (result >>> 0) / 4294967295;
}

function clusterFor(name: string) {
  if (name === "00-总控台") return [0.5, 0.5];
  if (/AI|Prompt|Skill|网站|作品集|求职|职业/.test(name)) return [0.32, 0.35];
  if (/摄影|旅行|地理|纪录片|DaVinci|视觉/.test(name)) return [0.28, 0.7];
  if (/游戏|CS2|GTA|PUBG|Minecraft|战地|王者|森林|INSIDE|Limbo|Sky|Valorant|文明|星露谷|地平线|霍格沃茨/.test(name)) return [0.73, 0.35];
  if (/知识|素材|书籍|电影|灵感/.test(name)) return [0.68, 0.73];
  return [0.52, 0.66];
}

export default function CreativeUniverseGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeNodeRef = useRef("00-总控台");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const nodes: SimNode[] = GRAPH_NAMES.map((id) => {
      const [clusterX, clusterY] = clusterFor(id);
      return {
        id,
        x: clusterX + (hash(id) - 0.5) * 0.16,
        y: clusterY + (hash(`${id}-y`) - 0.5) * 0.16,
        vx: 0,
        vy: 0,
        radius: id === "00-总控台" ? 8.5 : HUBS.has(id) ? 6.4 : RESOLVED_NODES.has(id) ? 4.1 : 2.7,
        resolved: RESOLVED_NODES.has(id),
        hub: HUBS.has(id),
      };
    });
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const links = GRAPH_LINKS.map(([source, target]) => ({ source: byId.get(source)!, target: byId.get(target)! }));
    const neighbours = new Map<string, Set<string>>();
    for (const link of links) {
      if (!neighbours.has(link.source.id)) neighbours.set(link.source.id, new Set());
      if (!neighbours.has(link.target.id)) neighbours.set(link.target.id, new Set());
      neighbours.get(link.source.id)!.add(link.target.id);
      neighbours.get(link.target.id)!.add(link.source.id);
    }

    let width = 1;
    let height = 1;
    let hovered: SimNode | null = null;
    let dragging: SimNode | null = null;
    let frame = 0;
    let animationFrame = 0;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const point = (node: SimNode) => ({ x: node.x * width, y: node.y * height });
    const hitTest = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      let winner: SimNode | null = null;
      let best = 18;
      for (const node of nodes) {
        const current = point(node);
        const distance = Math.hypot(current.x - x, current.y - y);
        if (distance < best) {
          best = distance;
          winner = node;
        }
      }
      return winner;
    };

    const simulate = () => {
      if (frame > 480) return;
      for (let left = 0; left < nodes.length; left += 1) {
        for (let right = left + 1; right < nodes.length; right += 1) {
          const a = nodes[left];
          const b = nodes[right];
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          const distanceSquared = Math.max(dx * dx + dy * dy, 0.00015);
          const strength = 0.0000028 / distanceSquared;
          dx /= Math.sqrt(distanceSquared);
          dy /= Math.sqrt(distanceSquared);
          a.vx += dx * strength;
          a.vy += dy * strength;
          b.vx -= dx * strength;
          b.vy -= dy * strength;
        }
      }
      for (const link of links) {
        const dx = link.target.x - link.source.x;
        const dy = link.target.y - link.source.y;
        const distance = Math.max(Math.hypot(dx, dy), 0.001);
        const desired = link.source.hub || link.target.hub ? 0.105 : 0.075;
        const spring = (distance - desired) * 0.0016;
        link.source.vx += (dx / distance) * spring;
        link.source.vy += (dy / distance) * spring;
        link.target.vx -= (dx / distance) * spring;
        link.target.vy -= (dy / distance) * spring;
      }
      for (const node of nodes) {
        const [targetX, targetY] = clusterFor(node.id);
        node.vx += (targetX - node.x) * (node.hub ? 0.0015 : 0.00045);
        node.vy += (targetY - node.y) * (node.hub ? 0.0015 : 0.00045);
        if (node.id === "00-总控台") {
          node.x = 0.5;
          node.y = 0.5;
          node.vx = 0;
          node.vy = 0;
        } else if (node !== dragging) {
          node.vx *= 0.9;
          node.vy *= 0.9;
          node.x = Math.min(0.9, Math.max(0.1, node.x + node.vx));
          node.y = Math.min(0.9, Math.max(0.1, node.y + node.vy));
        }
      }
      frame += 1;
    };

    const draw = () => {
      simulate();
      context.clearRect(0, 0, width, height);
      const focus = hovered?.id || activeNodeRef.current;
      const related = neighbours.get(focus) || new Set<string>();

      for (const link of links) {
        const a = point(link.source);
        const b = point(link.target);
        const highlighted = link.source.id === focus || link.target.id === focus;
        context.beginPath();
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
        context.strokeStyle = highlighted ? "rgba(255, 93, 54, 0.6)" : "rgba(31, 35, 42, 0.11)";
        context.lineWidth = highlighted ? 1.25 : 0.7;
        context.stroke();
      }

      for (const node of nodes) {
        const current = point(node);
        const isFocus = node.id === focus;
        const isRelated = related.has(node.id);
        const dimmed = focus && !isFocus && !isRelated;
        context.beginPath();
        context.arc(current.x, current.y, node.radius + (isFocus ? 3 : 0), 0, Math.PI * 2);
        context.fillStyle = isFocus
          ? "#ff5d36"
          : node.id === "00-总控台"
            ? "#17191c"
            : node.hub
              ? "#363a40"
              : node.resolved
                ? "rgba(63, 68, 76, 0.78)"
                : "rgba(174, 179, 185, 0.68)";
        context.globalAlpha = dimmed ? 0.3 : 1;
        context.fill();
        context.globalAlpha = 1;

        if (node.hub || isFocus || isRelated) {
          context.font = `${isFocus || node.id === "00-总控台" ? 600 : 500} ${isFocus ? 12 : 10}px ui-sans-serif, system-ui, sans-serif`;
          context.fillStyle = dimmed ? "rgba(35, 38, 43, 0.32)" : "rgba(35, 38, 43, 0.84)";
          context.textAlign = "center";
          context.fillText(node.id, current.x, current.y - node.radius - 7);
        }
      }
      animationFrame = window.requestAnimationFrame(draw);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (dragging) {
        const bounds = canvas.getBoundingClientRect();
        dragging.x = Math.min(0.9, Math.max(0.1, (event.clientX - bounds.left) / width));
        dragging.y = Math.min(0.9, Math.max(0.1, (event.clientY - bounds.top) / height));
        dragging.vx = 0;
        dragging.vy = 0;
        frame = Math.min(frame, 360);
        return;
      }
      hovered = hitTest(event);
      canvas.style.cursor = hovered ? "grab" : "default";
      if (hovered) {
        activeNodeRef.current = hovered.id;
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      dragging = hitTest(event);
      if (dragging) {
        canvas.setPointerCapture(event.pointerId);
        canvas.style.cursor = "grabbing";
        activeNodeRef.current = dragging.id;
      }
    };
    const onPointerUp = (event: PointerEvent) => {
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      dragging = null;
      canvas.style.cursor = hovered ? "grab" : "default";
    };
    const onPointerLeave = () => {
      if (!dragging) hovered = null;
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);
    draw();

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(animationFrame);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  return (
    <div className={styles.graphShell}>
      <canvas ref={canvasRef} className={styles.graphCanvas} aria-label="RING 创作宇宙关系图谱" />
    </div>
  );
}
