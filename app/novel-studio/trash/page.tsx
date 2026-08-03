"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
type Project = { project_id: string; title: string; deleted_at?: string; size_bytes: number };
async function api<T>(path: string, init?: RequestInit): Promise<T> { const response = await fetch(`/api/novel/${path}`, { ...init, headers: { "content-type": "application/json" } }); const data = await response.json(); if (!response.ok) throw new Error(data.message ?? "请求失败"); return data; }
export default function TrashPage() {
  const [items, setItems] = useState<Project[]>([]); const [note, setNote] = useState("加载中…");
  async function load() { try { setItems(await api<Project[]>("projects?status=trash")); setNote("回收站中的项目仍可恢复。永久删除会清理整个项目目录。"); } catch (error) { setNote(error instanceof Error ? error.message : "加载失败"); } }
  useEffect(() => { void load(); }, []);
  async function restore(id: string) { await api(`projects/${id}/restore`, { method: "POST", body: "{}" }); await load(); }
  async function remove(item: Project) { if (!confirm(`永久删除“${item.title}”？`)) return; if (!confirm("第二次确认：此操作不可恢复。")) return; await api(`projects/${item.project_id}/permanent`, { method: "DELETE", body: JSON.stringify({ confirmed: true, confirmation: "PERMANENT_DELETE" }) }); await load(); }
  return <main><header><div><p className="eyebrow">RECYCLE BIN</p><h1>回收站</h1></div><Link href="/novel-studio">返回控制中心</Link></header><p className="notice">{note}</p><section className="panel">{items.map(item => <div className="item" key={item.project_id}><b>{item.title}</b><small>{item.project_id} · 删除于 {item.deleted_at ?? "未知"} · {item.size_bytes} B</small><p><button onClick={() => void restore(item.project_id)}>恢复</button><button className="danger compact" onClick={() => void remove(item)}>永久删除</button></p></div>)}{!items.length && <p className="muted">回收站为空。</p>}</section></main>;
}
