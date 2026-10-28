"use client";

import { DragEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { uploadFile } from "@/lib/storage-client";
import styles from "../library-admin.module.css";

type UploadedBlob = Awaited<ReturnType<typeof uploadFile>>;
type PendingFile = { blob: UploadedBlob; file: File };
type Option = { id: string | number; name?: string; title?: string; slug?: string; cover_image?: string; category_id?: string | number };
type Media = {
  id: string | number; title: string; description?: string; original_name?: string; size: number;
  category_id?: string | number | null; category_name?: string; project_id?: string | number | null; project_title?: string;
  file_path: string; thumbnail_url?: string; media_type?: string; mime_type?: string; tags?: string;
  camera?: string; lens?: string; aperture?: string; shutter_speed?: string; iso?: string; captured_at?: string;
  is_selected?: number | boolean; show_in_database?: number | boolean; source?: "managed" | "archive";
};
type CoverTarget = { kind: "category" | "project"; id: string; label: string; cover: string };
type WorkspaceTab = "upload" | "library" | "covers";

function fileSize(bytes = 0) {
  if (!bytes) return "—";
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function readableUploadError(reason: unknown) {
  const message = reason instanceof Error ? reason.message : String(reason || "上传失败");
  if (/fetch failed|network|failed to fetch/i.test(message)) return "网络或数据服务暂时没有响应，文件不会被假装保存。请稍后点击重试。";
  return /store has been suspended|BlobStoreSuspended/i.test(message) ? "持久文件存储暂时不可写，请恢复存储后重试。" : message;
}

function mediaPreview(item: Media, className: string) {
  const src = item.thumbnail_url || item.file_path;
  if (item.media_type === "video" || item.mime_type?.startsWith("video/")) return <video className={className} src={src} muted preload="metadata" />;
  if (item.media_type === "image" || item.mime_type?.startsWith("image/") || /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(src)) return <img className={className} src={src} alt="" />;
  return <div className={className}>FILE</div>;
}

export function AdminUploadsClient() {
  const [tab, setTab] = useState<WorkspaceTab>("upload");
  const [categories, setCategories] = useState<Option[]>([]);
  const [projects, setProjects] = useState<Option[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<{ file: File; url: string }[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [search, setSearch] = useState("");
  const [libraryCategory, setLibraryCategory] = useState("");
  const [editing, setEditing] = useState<Media | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverTarget, setCoverTarget] = useState("");
  const [coverStatus, setCoverStatus] = useState("");
  const [coverError, setCoverError] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverProgress, setCoverProgress] = useState(0);

  const load = async () => {
    const [meResponse, categoryResponse, projectResponse, managedResponse, archiveResponse] = await Promise.all([
      fetch("/api/me", { cache: "no-store" }), fetch("/api/categories", { cache: "no-store" }),
      fetch("/api/projects", { cache: "no-store" }), fetch("/api/blob-media", { cache: "no-store" }),
      fetch("/api/media", { cache: "no-store" })
    ]);
    const me = await meResponse.json();
    if (!me.authenticated) { location.replace("/"); return; }
    const [categoryPayload, projectPayload, managedPayload, archivePayload] = await Promise.all([
      categoryResponse.json(), projectResponse.json(), managedResponse.json(), archiveResponse.json()
    ]);
    const nextCategories = (Array.isArray(categoryPayload) ? categoryPayload : []).filter((item: Option) => item.slug !== "product");
    const nextProjects = Array.isArray(projectPayload) ? projectPayload : [];
    const managed = (Array.isArray(managedPayload) ? managedPayload : []).map((item: Media) => ({ ...item, source: "managed" as const }));
    const seen = new Set(managed.map((item: Media) => item.file_path));
    const archive = (Array.isArray(archivePayload) ? archivePayload : []).filter((item: Media) => !seen.has(item.file_path)).map((item: Media) => ({ ...item, source: "archive" as const }));
    setCategories(nextCategories); setProjects(nextProjects); setMedia([...managed, ...archive]);
    fetch("/api/storage-health", { cache: "no-store" }).then((response) => response.json()).then(setHealth).catch(() => undefined);
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedTab = params.get("tab");
    if (requestedTab === "covers" || requestedTab === "library") setTab(requestedTab);
    if (params.get("target")) setCoverTarget(String(params.get("target")));
    load().catch((reason) => { setStatus(reason.message); setError(true); });
  }, []);

  useEffect(() => {
    const next = selectedFiles.map((file) => ({ file, url: URL.createObjectURL(file) }));
    setFilePreviews(next);
    return () => next.forEach((item) => URL.revokeObjectURL(item.url));
  }, [selectedFiles]);

  const filteredProjects = useMemo(() => projects.filter((item) => !categoryId || String(item.category_id) === categoryId), [projects, categoryId]);
  const filteredMedia = useMemo(() => media.filter((item) => {
    const matchesCategory = !libraryCategory || String(item.category_id || "") === libraryCategory;
    const haystack = `${item.title} ${item.original_name || ""} ${item.tags || ""} ${item.project_title || ""}`.toLowerCase();
    return matchesCategory && (!search || haystack.includes(search.toLowerCase()));
  }), [media, libraryCategory, search]);

  const coverTargets: CoverTarget[] = [
    ...categories.map((item) => ({ kind: "category" as const, id: String(item.id), label: `分类 · ${item.name || item.slug || item.id}`, cover: item.cover_image || "" })),
    ...projects.map((item) => ({ kind: "project" as const, id: String(item.id), label: `系列 · ${item.title || item.id}`, cover: item.cover_image || "" }))
  ];
  const selectedCoverTarget = coverTargets.find((item) => `${item.kind}:${item.id}` === coverTarget);
  const coverAssets = media.filter((item) => item.media_type === "image" || item.mime_type?.startsWith("image/") || /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(item.file_path));

  const receiveDroppedFiles = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    const files = [...event.dataTransfer.files];
    if (files.length) setSelectedFiles(files);
  };

  const saveRecords = async (form: HTMLFormElement, files: PendingFile[]) => {
    const formData = new FormData(form); const values = Object.fromEntries(formData.entries()) as Record<string, unknown>;
    delete values.files; values.show_in_database = formData.has("show_in_database"); values.is_selected = formData.has("is_selected");
    const response = await fetch("/api/blob-media", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, files: files.map(({ blob, file }) => ({ ...blob, size: file.size, original_name: file.name, content_type: file.type || blob.contentType })) }) });
    const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "作品资料保存失败");
    setPending([]); setSelectedFiles([]); form.reset(); setCategoryId(""); setProgress(100); setStatus(`已保存 ${payload.length} 个文件。现在可以在素材库中逐张调整。`); setError(false); await load(); setTab("library");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = event.currentTarget;
    try {
      setBusy(true); setError(false);
      if (pending.length) { setStatus("文件已在云端，正在重新保存资料…"); await saveRecords(form, pending); return; }
      if (!selectedFiles.length) throw new Error("请先选择图片、视频或文件。");
      const tooLarge = selectedFiles.find((file) => file.size > 250 * 1024 * 1024); if (tooLarge) throw new Error(`${tooLarge.name} 超过 250 MB。`);
      const uploaded: PendingFile[] = [];
      for (let index = 0; index < selectedFiles.length; index += 1) {
        const file = selectedFiles[index]; setStatus(`正在上传 ${index + 1}/${selectedFiles.length} · ${file.name}`);
        const blob = await uploadFile(file, { kind: "media", onProgress: (percentage) => setProgress(Math.round(((index + percentage / 100) / selectedFiles.length) * 100)) });
        uploaded.push({ blob, file }); setPending([...uploaded]);
      }
      setStatus("文件上传完成，正在校验并保存作品资料…"); await saveRecords(form, uploaded);
    } catch (reason) { setError(true); setStatus(`${pending.length ? "文件已经上传，可直接重试保存。" : ""}${readableUploadError(reason)}`); }
    finally { setBusy(false); }
  };

  const saveCoverRelation = async (payload: Record<string, unknown>) => {
    if (!coverTarget) throw new Error("请先选择要更换封面的分类或系列。");
    const [kind, targetId] = coverTarget.split(":", 2);
    const response = await fetch("/api/portfolio-covers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, kind, target_id: targetId }) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || "封面关系保存失败。"); await load();
  };

  const saveCover = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setCoverBusy(true); setCoverError(false); setCoverProgress(1);
      if (!coverFile) throw new Error("请选择一张新封面图片。"); if (!coverFile.type.startsWith("image/")) throw new Error("封面必须是图片文件。"); if (coverFile.size > 20 * 1024 * 1024) throw new Error("封面不能超过 20 MB。");
      setCoverStatus(`正在上传 · ${coverFile.name}`); const blob = await uploadFile(coverFile, { kind: "cover", onProgress: (percentage) => setCoverProgress(Math.max(1, Math.round(percentage * .85))) });
      setCoverProgress(90); setCoverStatus("正在更新封面…"); await saveCoverRelation({ url: blob.url, pathname: blob.pathname, size: coverFile.size, content_type: coverFile.type || blob.contentType, storage_provider: blob.storageProvider, width: blob.width, height: blob.height });
      setCoverProgress(100); setCoverStatus("封面已更新。"); setCoverFile(null); (event.currentTarget.elements.namedItem("cover_file") as HTMLInputElement).value = "";
    } catch (reason) { setCoverError(true); setCoverStatus(readableUploadError(reason)); } finally { setCoverBusy(false); }
  };

  const selectExistingCover = async (item: Media) => {
    try { setCoverBusy(true); setCoverError(false); setCoverStatus(`正在使用「${item.title}」作为封面…`); await saveCoverRelation({ existing_url: item.file_path }); setCoverProgress(100); setCoverStatus("封面已更新。"); }
    catch (reason) { setCoverError(true); setCoverStatus(readableUploadError(reason)); } finally { setCoverBusy(false); }
  };

  const saveMedia = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!editing) return;
    try {
      setBusy(true); const formData = new FormData(event.currentTarget); const values = Object.fromEntries(formData.entries()) as Record<string, unknown>;
      values.show_in_database = formData.has("show_in_database"); values.is_selected = formData.has("is_selected");
      const endpoint = editing.source === "managed" ? `/api/blob-media/${editing.id}` : `/api/media/${editing.id}`;
      const response = await fetch(endpoint, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "作品资料保存失败");
      setEditing(null); setStatus("作品资料已保存。"); setError(false); await load();
    } catch (reason) { setStatus(readableUploadError(reason)); setError(true); } finally { setBusy(false); }
  };

  const remove = async (item: Media) => {
    if (item.source !== "managed") { setStatus("历史素材请先迁移到统一素材库后再删除。"); setError(true); return; }
    if (!confirm(`确定删除「${item.title}」及其文件吗？`)) return;
    const response = await fetch(`/api/blob-media/${item.id}`, { method: "DELETE" }); const payload = await response.json(); if (!response.ok) { setStatus(payload.error || "删除失败"); setError(true); return; }
    setStatus("作品文件已删除。"); setError(false); await load();
  };

  return <>
    <header className={styles.workspaceTopbar}><Link className={styles.workspaceBrand} href="/admin">RING <span>内容后台</span></Link><div className={styles.workspaceContext}>独立作品工作台</div><div className={styles.workspaceActions}><Link href="/admin">返回内容后台</Link><Link className={styles.viewSite} href="/" target="_blank">查看网站 ↗</Link></div></header>
    <div className={styles.workspace}>
      <section className={styles.workspaceIntro}><div><p>WORKS DESK</p><h1>作品工作台</h1><span>上传、整理与更换封面都在这里完成。</span></div><div className={styles.health}><i className={health?.ok ? styles.healthGood : ""} /><b>{health?.ok ? "存储正常" : health?.error ? "存储异常" : "正在检查"}</b><small>{health?.storage ? `${health.storage.object_count} 个云端文件` : health?.error || ""}</small></div></section>
      <div className={styles.workspaceTabs} role="tablist">{([['upload','上传作品'],['library','素材库'],['covers','封面管理']] as [WorkspaceTab,string][]).map(([value,label]) => <button key={value} className={tab === value ? styles.tabActive : ""} onClick={() => setTab(value)}>{label}<span>{value === "library" ? media.length : ""}</span></button>)}</div>

      {tab === "upload" && <section className={styles.workspacePanel}><div className={styles.panelHeading}><span>01</span><div><h2>添加新作品</h2><p>先选择文件，再确定归属和展示位置。</p></div></div><form className={styles.uploadFlow} onSubmit={submit}>
        <label className={styles.heroPicker} onDragOver={(event) => event.preventDefault()} onDrop={receiveDroppedFiles}><input name="files" type="file" accept="image/*,video/*,.pdf,.zip,.doc,.docx,.txt" multiple required={!pending.length && !selectedFiles.length} onChange={(event) => setSelectedFiles([...(event.target.files || [])])} /><strong>＋ 选择或拖入文件</strong><span>图片、视频和文档 · 单个最大 250 MB</span></label>
        {!!filePreviews.length && <div className={styles.pendingGrid}>{filePreviews.map(({ file, url }) => <article key={`${file.name}-${file.lastModified}`}><div>{file.type.startsWith("image/") ? <img src={url} alt="" /> : file.type.startsWith("video/") ? <video src={url} muted /> : <b>FILE</b>}</div><span>{file.name}</span><small>{fileSize(file.size)}</small></article>)}</div>}
        <div className={styles.stepHeading}><span>02</span><div><h3>作品归属</h3><p>只保留最常用的必填信息。</p></div></div><div className={styles.formGrid}>
          <div className={styles.field}><label>分类</label><select name="category_id" required value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">选择分类</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          <div className={styles.field}><label>系列（可选）</label><select name="project_id"><option value="">不归属系列</option>{filteredProjects.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div>
          <div className={styles.fieldWide}><label>标题</label><input name="title" placeholder="留空时使用文件名；多文件自动编号" /></div><div className={styles.fieldWide}><label>描述（可选）</label><textarea name="description" rows={3} /></div><div className={styles.fieldWide}><label>标签（可选）</label><input name="tags" placeholder="例如：人物，纪实，武汉" /></div>
        </div>
        <details className={styles.advanced}><summary>拍摄与创作信息</summary><div className={styles.formGrid}><div className={styles.field}><label>相机</label><input name="camera" /></div><div className={styles.field}><label>镜头</label><input name="lens" /></div><div className={styles.field}><label>光圈</label><input name="aperture" /></div><div className={styles.field}><label>快门</label><input name="shutter_speed" /></div><div className={styles.field}><label>ISO</label><input name="iso" /></div><div className={styles.field}><label>拍摄时间</label><input name="captured_at" /></div></div></details>
        <div className={styles.displayChoices}><label><input name="show_in_database" type="checkbox" defaultChecked /><span><b>发布到作品库</b><small>访客可以看到</small></span></label><label><input name="is_selected" type="checkbox" /><span><b>标记为精选</b><small>用于重点展示</small></span></label></div>
        <div className={styles.uploadFooter}><div><div className={styles.progress}><span style={{ width: `${progress}%` }} /></div><p className={`${styles.status} ${error ? styles.statusError : ""}`}>{status || "上传期间请保持页面打开。"}</p></div><button className={styles.primaryAction} disabled={busy}>{busy ? `正在处理 ${progress}%` : pending.length ? "重试保存资料" : "上传并保存"}</button></div>
      </form></section>}

      {tab === "library" && <section className={styles.workspacePanel}><div className={styles.panelHeading}><span>02</span><div><h2>统一素材库</h2><p>点击卡片编辑；设置封面不需要重新上传。</p></div></div><div className={styles.libraryTools}><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索标题、文件名、标签或系列" /><select value={libraryCategory} onChange={(event) => setLibraryCategory(event.target.value)}><option value="">全部分类</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button onClick={() => setTab("upload")}>＋ 上传</button></div>
        <div className={styles.mediaGrid}>{filteredMedia.map((item) => <article className={styles.mediaCard} key={`${item.source}-${item.id}`}><button className={styles.mediaVisual} onClick={() => setEditing(item)}>{mediaPreview(item, styles.mediaImage)}<span>{item.source === "managed" ? "云端" : "历史"}</span></button><div><small>{item.category_name || "未分类"}{item.project_title ? ` · ${item.project_title}` : ""}</small><h3>{item.title || item.original_name}</h3><p>{item.original_name || ""} {item.size ? `· ${fileSize(item.size)}` : ""}</p><footer><button onClick={() => setEditing(item)}>编辑</button><button onClick={() => { setCoverTarget(item.project_id ? `project:${item.project_id}` : item.category_id ? `category:${item.category_id}` : ""); setTab("covers"); }}>设为封面</button><button className={styles.textDanger} onClick={() => remove(item)}>删除</button></footer></div></article>)}</div>{!filteredMedia.length && <div className={styles.emptyState}>没有符合条件的素材。</div>}
      </section>}

      {tab === "covers" && <section className={styles.workspacePanel} id="cover-manager"><div className={styles.panelHeading}><span>03</span><div><h2>封面管理</h2><p>先选择目标，再从素材库选择或上传新图。</p></div></div><div className={styles.coverLayout}><aside><label>要修改的封面</label><select value={coverTarget} onChange={(event) => setCoverTarget(event.target.value)}><option value="">选择分类或系列</option>{coverTargets.map((item) => <option key={`${item.kind}:${item.id}`} value={`${item.kind}:${item.id}`}>{item.label}</option>)}</select><div className={styles.currentCover}>{selectedCoverTarget?.cover ? <img src={selectedCoverTarget.cover} alt="当前封面" /> : <span>选择目标后显示当前封面</span>}</div><b>{selectedCoverTarget?.label || "尚未选择"}</b><small>保存后立即同步到首页与作品库。</small></aside><div><h3>从素材库选择</h3><div className={styles.coverAssetGrid}>{coverAssets.slice(0, 60).map((item) => <button key={`${item.source}-${item.id}`} disabled={!coverTarget || coverBusy} onClick={() => selectExistingCover(item)}>{mediaPreview(item, styles.coverAssetImage)}<span>{item.title}</span></button>)}</div><div className={styles.coverDivider}><span>或者上传新图</span></div><form className={styles.coverUpload} onSubmit={saveCover}><label className={styles.filePicker}><input name="cover_file" type="file" accept="image/*" onChange={(event) => setCoverFile(event.target.files?.[0] || null)} /><span>{coverFile ? `${coverFile.name} · ${fileSize(coverFile.size)}` : "选择一张新封面图片"}</span></label><button className={styles.primaryAction} disabled={coverBusy || !coverTarget}>{coverBusy ? "正在保存…" : "上传并设为封面"}</button></form><div className={styles.progress}><span style={{ width: `${coverProgress}%` }} /></div><p className={`${styles.status} ${coverError ? styles.statusError : ""}`}>{coverStatus}</p></div></div></section>}
    </div>

    {editing && <div className={styles.editorBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}><section className={styles.editorSheet}><header><div><small>EDIT WORK</small><h2>编辑作品资料</h2></div><button onClick={() => setEditing(null)}>×</button></header><div className={styles.editorPreview}>{mediaPreview(editing, styles.editorMedia)}</div><form className={styles.formGrid} onSubmit={saveMedia}><div className={styles.fieldWide}><label>标题</label><input name="title" defaultValue={editing.title} /></div><div className={styles.field}><label>分类</label><select name="category_id" defaultValue={String(editing.category_id || "")}><option value="">未分类</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div className={styles.field}><label>系列</label><select name="project_id" defaultValue={String(editing.project_id || "")}><option value="">不归属系列</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div><div className={styles.fieldWide}><label>描述</label><textarea name="description" rows={4} defaultValue={editing.description || ""} /></div><div className={styles.fieldWide}><label>标签</label><input name="tags" defaultValue={editing.tags || ""} /></div><div className={styles.displayChoices}><label><input name="show_in_database" type="checkbox" defaultChecked={editing.show_in_database !== 0 && editing.show_in_database !== false} /><span><b>发布到作品库</b></span></label><label><input name="is_selected" type="checkbox" defaultChecked={!!editing.is_selected} /><span><b>标记为精选</b></span></label></div><button className={`${styles.primaryAction} ${styles.fieldWide}`} disabled={busy}>保存修改</button></form></section></div>}
  </>;
}
