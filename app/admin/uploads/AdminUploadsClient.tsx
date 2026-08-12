"use client";

import { upload } from "@vercel/blob/client";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import styles from "../library-admin.module.css";

type UploadedBlob = { url: string; downloadUrl: string; pathname: string; contentType: string };
type PendingFile = { blob: UploadedBlob; file: File };
type Option = { id: string | number; name?: string; title?: string; slug?: string };
type Media = { id: string; title: string; original_name: string; size: number; category_name: string; file_path: string };
type CoverTarget = { kind: "category" | "project"; id: string; label: string };

function safeName(name: string) {
  return name.normalize("NFKC").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-").replace(/\s+/g, "-").slice(0, 120) || "media-file";
}

function fileSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function readableUploadError(reason: unknown) {
  const message = reason instanceof Error ? reason.message : String(reason || "上传失败");
  return /store has been suspended|BlobStoreSuspended/i.test(message)
    ? "当前 Vercel Blob 文件存储已暂停，恢复前无法上传新封面。现有作品不会丢失，请在 Vercel Storage 恢复后重试。"
    : message;
}

export function AdminUploadsClient() {
  const [categories, setCategories] = useState<Option[]>([]);
  const [projects, setProjects] = useState<Option[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverTarget, setCoverTarget] = useState("");
  const [coverStatus, setCoverStatus] = useState("");
  const [coverError, setCoverError] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverProgress, setCoverProgress] = useState(0);

  const load = async () => {
    const [meResponse, categoryResponse, projectResponse, mediaResponse] = await Promise.all([
      fetch("/api/me", { cache: "no-store" }),
      fetch("/api/categories", { cache: "no-store" }),
      fetch("/api/projects", { cache: "no-store" }),
      fetch("/api/blob-media", { cache: "no-store" })
    ]);
    const me = await meResponse.json();
    if (!me.authenticated) { location.replace("/"); return; }
    const [categoryPayload, projectPayload, mediaPayload] = await Promise.all([categoryResponse.json(), projectResponse.json(), mediaResponse.json()]);
    setCategories((Array.isArray(categoryPayload) ? categoryPayload : []).filter((item: Option) => item.slug !== "product"));
    setProjects(Array.isArray(projectPayload) ? projectPayload : []);
    setMedia(Array.isArray(mediaPayload) ? mediaPayload : []);
    fetch("/api/storage-health", { cache: "no-store" }).then((response) => response.json()).then(setHealth).catch(() => undefined);
  };

  useEffect(() => { load().catch((reason) => { setStatus(reason.message); setError(true); }); }, []);

  const coverTargets: CoverTarget[] = [
    ...categories.map((item) => ({ kind: "category" as const, id: String(item.id), label: `分类：${item.name || item.slug || item.id}` })),
    ...projects.map((item) => ({ kind: "project" as const, id: String(item.id), label: `作品：${item.title || item.id}` }))
  ];

  const saveRecords = async (form: HTMLFormElement, files: PendingFile[]) => {
    const values = Object.fromEntries(new FormData(form).entries());
    delete values.files;
    const response = await fetch("/api/blob-media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, show_in_database: true, files: files.map(({ blob, file }) => ({ ...blob, size: file.size, original_name: file.name, content_type: file.type || blob.contentType })) })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "作品资料保存失败");
    setPending([]); form.reset(); setProgress(100); setStatus(`上传完成：${payload.length} 个文件已校验并加入作品库。`); setError(false); await load();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      setBusy(true); setError(false);
      if (pending.length) { setStatus("文件已经上传，正在重新保存作品资料…"); await saveRecords(form, pending); return; }
      const selected = [...((form.elements.namedItem("files") as HTMLInputElement).files || [])];
      if (!selected.length) throw new Error("请选择需要上传的作品文件。");
      const tooLarge = selected.find((file) => file.size > 250 * 1024 * 1024);
      if (tooLarge) throw new Error(`${tooLarge.name} 超过 250 MB，请压缩或分卷上传。`);
      const uploaded: PendingFile[] = [];
      for (let index = 0; index < selected.length; index += 1) {
        const file = selected[index];
        setStatus(`正在直传 ${index + 1}/${selected.length}：${file.name}`);
        const blob = await upload(`portfolio/admin/${safeName(file.name)}`, file, {
          access: "public", handleUploadUrl: "/api/blob/upload", clientPayload: JSON.stringify({ kind: "media" }),
          multipart: file.size > 100 * 1024 * 1024,
          onUploadProgress: ({ percentage }) => setProgress(Math.round(((index + percentage / 100) / selected.length) * 100))
        });
        uploaded.push({ blob, file }); setPending([...uploaded]);
      }
      setStatus("文件上传完成，正在校验并写入持久清单…");
      await saveRecords(form, uploaded);
    } catch (reason) {
      setError(true); setStatus(`${pending.length ? "已经上传的文件仍保留，" : ""}${readableUploadError(reason)}`);
    } finally { setBusy(false); }
  };

  const saveCover = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      setCoverBusy(true); setCoverError(false); setCoverProgress(1);
      if (!coverFile) throw new Error("请先选择一张封面图片。");
      if (!coverFile.type.startsWith("image/")) throw new Error("封面必须是图片文件。");
      if (coverFile.size > 20 * 1024 * 1024) throw new Error("单张封面不能超过 20 MB，请压缩后重试。");
      if (!coverTarget) throw new Error("请选择这张封面属于哪个作品或分类。");
      const [kind, targetId] = coverTarget.split(":", 2) as ["category" | "project", string];
      setCoverStatus(`正在上传封面：${coverFile.name}`);
      const blob = await upload(`portfolio/admin/covers/${safeName(coverFile.name)}`, coverFile, {
        access: "public", handleUploadUrl: "/api/blob/upload", clientPayload: JSON.stringify({ kind: "media" }),
        multipart: coverFile.size > 100 * 1024 * 1024,
        onUploadProgress: ({ percentage }) => setCoverProgress(Math.max(1, Math.round(percentage * 0.85)))
      });
      setCoverStatus("图片上传完成，正在保存封面关系…"); setCoverProgress(90);
      const response = await fetch("/api/portfolio-covers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, target_id: targetId, url: blob.url, pathname: blob.pathname, size: coverFile.size, content_type: coverFile.type || blob.contentType })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "封面关系保存失败。");
      setCoverProgress(100); setCoverStatus("封面已保存，刷新网站后会使用新封面。"); setCoverError(false); setCoverFile(null);
      (form.elements.namedItem("cover_file") as HTMLInputElement).value = "";
      await load();
    } catch (reason) {
      setCoverError(true); setCoverStatus(readableUploadError(reason));
    } finally { setCoverBusy(false); }
  };

  const remove = async (item: Media) => {
    if (!confirm(`确定删除「${item.title}」及其持久文件吗？`)) return;
    const response = await fetch(`/api/blob-media/${item.id}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) { setStatus(payload.error || "删除失败"); setError(true); return; }
    setStatus("作品文件已删除。"); setError(false); await load();
  };

  return <>
    <header className={styles.topbar}><Link className={styles.back} href="/admin">← 内容后台</Link><nav><Link href="/admin/skills">Skill 库</Link><Link href="/works.html?category=all" target="_blank">查看作品库 ↗</Link></nav></header>
    <div className={styles.content}>
      <section className={styles.intro}><div><p>DURABLE MEDIA UPLOAD</p><h1>上传作品</h1></div><div className={styles.health}><b>{health?.ok ? "持久存储正常" : health?.error ? "持久存储暂不可写" : "正在检查持久存储"}</b>{health?.storage ? `${health.storage.object_count} 个文件 · ${health.storage.size_mb} MB` : health?.error || "不会写入 Vercel 临时目录"}</div></section>
      <section className={styles.panel}><h2>选择文件与作品信息</h2><form className={styles.form} onSubmit={submit}>
        <label className={`${styles.filePicker} ${styles.fieldWide}`}><input name="files" type="file" accept="image/*,video/*,.pdf,.zip,.doc,.docx,.txt" multiple required={!pending.length} /><span>{pending.length ? `${pending.length} 个文件已上传，可重试保存资料` : "点击选择图片、视频或文档；大文件会自动分片直传"}</span></label>
        <div className={styles.field}><label>作品分类</label><select name="category_id" required><option value="">请选择</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        <div className={styles.field}><label>归属作品（可空）</label><select name="project_id"><option value="">不归属具体作品</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div>
        <div className={styles.fieldWide}><label>标题（多文件会自动编号）</label><input name="title" placeholder="留空时使用文件名" /></div>
        <div className={styles.fieldWide}><label>描述</label><textarea name="description" rows={3} /></div>
        <div className={styles.fieldWide}><label>标签</label><input name="tags" placeholder="逗号分隔" /></div>
        <div className={styles.field}><label>相机</label><input name="camera" /></div><div className={styles.field}><label>镜头</label><input name="lens" /></div>
        <div className={styles.field}><label>光圈</label><input name="aperture" /></div><div className={styles.field}><label>快门</label><input name="shutter_speed" /></div>
        <div className={styles.field}><label>ISO</label><input name="iso" /></div><div className={styles.field}><label>拍摄时间</label><input name="captured_at" /></div>
        <div className={`${styles.progress} ${styles.fieldWide}`}><span style={{ width: `${progress}%` }} /></div>
        <div className={`${styles.status} ${error ? styles.statusError : ""}`}>{status}</div>
        <button className={`${styles.button} ${styles.fieldWide}`} disabled={busy}>{busy ? "正在上传与校验…" : pending.length ? "重试保存资料" : "上传并永久保存"}</button>
      </form><p className={styles.note}>文件直接进入持久对象存储，上传后再校验大小与路径；站点部署、重启或闲置不会清空文件。</p></section>
      <section className={styles.panel} id="cover-manager"><h2>设置作品库封面</h2><form className={styles.form} onSubmit={saveCover}>
        <label className={`${styles.filePicker} ${styles.fieldWide}`}><input name="cover_file" type="file" accept="image/*" onChange={(event) => setCoverFile(event.target.files?.[0] || null)} /><span>{coverFile ? `${coverFile.name} · ${fileSize(coverFile.size)}` : "点击选择一张封面图片"}</span></label>
        <div className={styles.fieldWide}><label>封面用途</label><select value={coverTarget} onChange={(event) => setCoverTarget(event.target.value)} required><option value="">请选择作品或分类</option>{coverTargets.map((item) => <option key={`${item.kind}:${item.id}`} value={`${item.kind}:${item.id}`}>{item.label}</option>)}</select></div>
        <div className={`${styles.progress} ${styles.fieldWide}`}><span style={{ width: `${coverProgress}%` }} /></div>
        <div className={`${styles.status} ${coverError ? styles.statusError : ""}`}>{coverStatus}</div>
        <button className={`${styles.button} ${styles.fieldWide}`} disabled={coverBusy}>{coverBusy ? "正在上传并保存…" : "上传并保存封面"}</button>
      </form><p className={styles.note}>封面会先直传持久文件存储，再单独保存与作品的对应关系；不会再经过已失效的旧数据库。</p></section>
      <section className={styles.panel}><div className={styles.listHead}><h2>后台新上传文件</h2><span>{media.length} 项</span></div><div className={styles.list}>{media.length ? media.map((item) => <article className={styles.row} key={item.id}><div><h3>{item.title} · {item.category_name}</h3><p>{item.original_name} · {fileSize(item.size)}</p></div><div className={styles.rowActions}><a href={item.file_path} target="_blank">打开</a><button className={styles.danger} onClick={() => remove(item)}>删除</button></div></article>) : <div className={styles.empty}>还没有通过新版持久上传保存的作品。</div>}</div></section>
    </div>
  </>;
}
