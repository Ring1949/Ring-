"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { uploadFile } from "@/lib/storage-client";
import type { CreativeGraphData, CreativeGraphLink, CreativeGraphNode } from "@/lib/creative-graph";
import { defaultCreativeGraph } from "@/lib/creative-graph";
import { AdminGraphCanvas } from "./AdminGraphCanvas";
import styles from "./graph-admin.module.css";
import imageStyles from "./graph-image-fields.module.css";

const emptyNode = (): CreativeGraphNode => ({ id: "", name: "", category: "未分类", summary: "", detail: "", level: "node", status: "active", link: "", image: "", image_alt: "" });
const safeId = (value: string) => value.trim().toLocaleLowerCase("zh-CN").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || `node-${Date.now()}`;
export function GraphAdminClient() {
  const [graph, setGraph] = useState<CreativeGraphData>(defaultCreativeGraph);
  const [draft, setDraft] = useState<CreativeGraphNode>(emptyNode());
  const [editingId, setEditingId] = useState("");
  const [source, setSource] = useState(""); const [target, setTarget] = useState("");
  const [status, setStatus] = useState("正在读取图谱…"); const [error, setError] = useState(false); const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);

  useEffect(() => { Promise.all([fetch("/api/me", { cache: "no-store" }), fetch("/api/creative-graph", { cache: "no-store" })]).then(async ([meResponse, graphResponse]) => { const me = await meResponse.json(); if (!me.authenticated) { location.replace("/"); return; } const data = await graphResponse.json(); if (data?.nodes) setGraph(data); setStatus("修改后点击右上角“保存到网站”。"); }).catch((reason) => { setStatus(reason.message || "图谱读取失败"); setError(true); }); }, []);
  const sortedNodes = useMemo(() => [...graph.nodes].sort((a, b) => a.category.localeCompare(b.category, "zh-CN") || a.name.localeCompare(b.name, "zh-CN")), [graph.nodes]);
  const updateDraft = (key: keyof CreativeGraphNode, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const edit = (item: CreativeGraphNode) => { setEditingId(item.id); setDraft({ ...item }); document.querySelector("#node-editor")?.scrollIntoView({ behavior: "smooth" }); };
  const reset = () => { setEditingId(""); setDraft(emptyNode()); };
  const saveNode = (event: FormEvent) => { event.preventDefault(); const id = editingId || safeId(draft.id || draft.name); if (!draft.name.trim()) return; const next = { ...draft, id, name: draft.name.trim() }; setGraph((current) => ({ ...current, nodes: editingId ? current.nodes.map((item) => item.id === editingId ? next : item) : [...current.nodes, next] })); reset(); setStatus(editingId ? "节点已修改，尚未发布。" : "节点已新增，尚未发布。"); setError(false); };
  const removeNode = (id: string) => { if (!confirm("确定删除这个节点及其所有连接吗？")) return; setGraph((current) => ({ ...current, nodes: current.nodes.filter((item) => item.id !== id), links: current.links.filter((item) => item.source !== id && item.target !== id) })); if (editingId === id) reset(); setStatus("节点已删除，尚未发布。"); };
  const addLink = (event: FormEvent) => { event.preventDefault(); if (!source || !target || source === target) { setStatus("请选择两个不同节点。"); setError(true); return; } const key = [source, target].sort().join("--"); if (graph.links.some((item) => [item.source, item.target].sort().join("--") === key)) { setStatus("这两个节点已经连接。"); setError(true); return; } const link: CreativeGraphLink = { id: key, source, target }; setGraph((current) => ({ ...current, links: [...current.links, link] })); setSource(""); setTarget(""); setStatus("连接已新增，尚未发布。"); setError(false); };
  const saveWebsite = async () => { try { setSaving(true); setError(false); setStatus("正在保存到网站…"); const response = await fetch("/api/creative-graph", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(graph) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "保存失败"); setGraph(payload); setStatus(`已保存到网站 · 版本 ${payload.version}`); } catch (reason) { setError(true); setStatus(reason instanceof Error ? reason.message : "保存失败"); } finally { setSaving(false); } };
  const uploadImage = async (file: File | null) => {
    if (!file) return;
    try {
      setImageUploading(true); setError(false); setStatus(`正在上传节点图片：${file.name}`);
      if (!file.type.startsWith("image/")) throw new Error("节点详情只能上传图片文件。");
      if (file.size > 20 * 1024 * 1024) throw new Error("节点图片不能超过 20 MB。");
      const blob = await uploadFile(file, {
        kind: "graph",
        onProgress: (percentage) => setStatus(`正在上传节点图片 · ${Math.round(percentage)}%`)
      });
      setDraft((current) => ({ ...current, image: blob.url, image_alt: current.image_alt || current.name || file.name.replace(/\.[^.]+$/, "") }));
      setStatus("图片已上传并加入当前节点，请更新节点后再保存到网站。");
    } catch (reason) { setError(true); setStatus(reason instanceof Error ? reason.message : "图片上传失败"); }
    finally { setImageUploading(false); }
  };

  return <>
    <header className={styles.topbar}><Link href="/admin">← 内容后台</Link><div><span className={error ? styles.error : ""}>{status}</span><button onClick={saveWebsite} disabled={saving}>{saving ? "正在保存…" : "保存到网站"}</button></div></header>
    <div className={styles.content}>
      <section className={styles.intro}><p>CREATIVE GRAPH EDITOR</p><h1>关系图谱管理</h1><span>节点会显示在“一起做点什么”的关系图中；点击前台节点可打开磨砂详情卡片。</span></section>
      <div className={styles.columns}>
        <section className={styles.panel} id="node-editor"><h2>{editingId ? "编辑节点" : "新增节点"}</h2><form className={styles.form} onSubmit={saveNode}>
          <label>名称<input value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} required /></label><label>分类<input value={draft.category} onChange={(event) => updateDraft("category", event.target.value)} /></label>
          <label>层级<select value={draft.level} onChange={(event) => updateDraft("level", event.target.value)}><option value="core">核心</option><option value="hub">主节点</option><option value="node">普通节点</option></select></label><label>状态<select value={draft.status} onChange={(event) => updateDraft("status", event.target.value)}><option value="active">正在发展</option><option value="planned">计划中</option></select></label>
          <label className={styles.wide}>一句话简介<input value={draft.summary} onChange={(event) => updateDraft("summary", event.target.value)} maxLength={160} /></label><label className={styles.wide}>详细信息<textarea value={draft.detail} onChange={(event) => updateDraft("detail", event.target.value)} rows={6} maxLength={5000} /></label><label className={styles.wide}>相关页面（可空）<input value={draft.link || ""} onChange={(event) => updateDraft("link", event.target.value)} placeholder="/works.html?category=photo" /></label>
          <label className={styles.wide}>图片地址<input value={draft.image || ""} onChange={(event) => updateDraft("image", event.target.value)} placeholder="可粘贴已有作品图片地址，或在下方上传新图片" /></label>
          <label className={styles.wide}>上传详情卡片图片<input type="file" accept="image/*" disabled={imageUploading} onChange={(event) => { void uploadImage(event.target.files?.[0] || null); event.target.value = ""; }} /><small className={imageStyles.hint}>{imageUploading ? "正在上传…" : "上传后会永久保存，并显示在前台磨砂详情卡顶部。"}</small></label>
          {draft.image ? <div className={`${imageStyles.preview} ${styles.wide}`}><img src={draft.image} alt={draft.image_alt || draft.name} /><button type="button" onClick={() => setDraft((current) => ({ ...current, image: "", image_alt: "" }))}>移除图片</button></div> : null}
          <label className={styles.wide}>图片说明<input value={draft.image_alt || ""} onChange={(event) => updateDraft("image_alt", event.target.value)} maxLength={200} placeholder="用于无障碍阅读，可留空" /></label>
          <div className={styles.actions}>{editingId ? <button type="button" className={styles.secondary} onClick={reset}>取消编辑</button> : null}<button type="submit">{editingId ? "更新节点" : "添加节点"}</button></div>
        </form></section>
        <section className={styles.panel}><h2>新增连接</h2><form className={styles.linkForm} onSubmit={addLink}><select value={source} onChange={(event) => setSource(event.target.value)} required><option value="">第一个节点</option>{sortedNodes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><span>连接</span><select value={target} onChange={(event) => setTarget(event.target.value)} required><option value="">第二个节点</option>{sortedNodes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button>添加连接</button></form><div className={styles.links}>{graph.links.map((item) => <article key={item.id}><span>{graph.nodes.find((node) => node.id === item.source)?.name} ↔ {graph.nodes.find((node) => node.id === item.target)?.name}</span><button onClick={() => setGraph((current) => ({ ...current, links: current.links.filter((link) => link.id !== item.id) }))}>删除</button></article>)}</div></section>
      </div>
      <section className={`${styles.panel} ${styles.graphPanel}`}><div className={styles.listHead}><div><h2>图谱预览</h2><p>所有节点都在这里。点击任意节点，可直接编辑或删除。</p></div><span>{graph.nodes.length} 个节点 · {graph.links.length} 条连接</span></div><AdminGraphCanvas graph={graph} onEdit={edit} onDelete={removeNode} /></section>
    </div>
  </>;
}
