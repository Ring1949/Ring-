"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { uploadFile } from "@/lib/storage-client";
import styles from "../library-admin.module.css";

type Skill = { id: string; name: string; category_name: string; description: string; original_name: string; size: number; download_path: string };
type Category = { id: string; name: string; slug: string };
type UploadedBlob = Awaited<ReturnType<typeof uploadFile>>;
type Pending = { blob: UploadedBlob; file: File };

function fileSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function readableUploadError(reason: unknown) {
  const message = reason instanceof Error ? reason.message : String(reason || "上传失败");
  return /store has been suspended|BlobStoreSuspended/i.test(message)
    ? "现有 Vercel Blob 存储已被平台暂停。文件没有丢失，但恢复前不能上传；请在 Vercel Storage 恢复后点击重试。"
    : message;
}

export function AdminSkillsClient() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pending, setPending] = useState<Pending | null>(null);

  const load = async () => {
    const [meResponse, skillsResponse] = await Promise.all([fetch("/api/me", { cache: "no-store" }), fetch("/api/skills", { cache: "no-store" })]);
    const me = await meResponse.json();
    if (!me.authenticated) { location.replace("/"); return; }
    const payload = await skillsResponse.json();
    if (!skillsResponse.ok) throw new Error(payload.error || "Skill 库读取失败");
    setSkills(payload.skills || []);
    setCategories(payload.categories || []);
    fetch("/api/storage-health", { cache: "no-store" }).then((response) => response.json()).then(setHealth).catch(() => undefined);
  };

  useEffect(() => { load().catch((reason) => { setStatus(reason.message); setError(true); }); }, []);

  const saveRecord = async (form: HTMLFormElement, uploaded: Pending) => {
    const values = new FormData(form);
    const response = await fetch("/api/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: values.get("name"), category_name: values.get("category_name"), description: values.get("description"),
        original_name: uploaded.file.name, size: uploaded.file.size, content_type: uploaded.file.type || uploaded.blob.contentType,
        url: uploaded.blob.url, pathname: uploaded.blob.pathname, download_url: uploaded.blob.downloadUrl,
        storage_provider: uploaded.blob.storageProvider, object_key: uploaded.blob.objectKey
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Skill 记录保存失败");
    setPending(null); form.reset(); setProgress(100); setStatus("Skill 文件与资料已完成双重校验并永久保存。"); setError(false); await load();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      setBusy(true); setError(false);
      if (pending) { setStatus("文件已经上传，正在重新保存 Skill 资料…"); await saveRecord(form, pending); return; }
      const file = (form.elements.namedItem("file") as HTMLInputElement).files?.[0];
      if (!file) throw new Error("请选择 Skill 文件。");
      if (file.size > 100 * 1024 * 1024) throw new Error("单个 Skill 文件上限为 100 MB；删除照片无法改变单文件上限。需要更大文件时请使用分卷 ZIP。");
      setStatus(`正在直传 ${file.name}，文件本体不会经过 Vercel Server Function…`); setProgress(1);
      const blob = await uploadFile(file, {
        kind: "skill",
        onProgress: (percentage) => setProgress(Math.max(1, Math.round(percentage)))
      });
      const uploaded = { blob, file }; setPending(uploaded); setStatus("文件上传完成，正在校验大小并保存 Skill 资料…");
      await saveRecord(form, uploaded);
    } catch (reason) {
      setError(true); setStatus(`${pending ? "文件仍在，" : ""}${readableUploadError(reason)}`);
    } finally { setBusy(false); }
  };

  const remove = async (skill: Skill) => {
    if (!confirm(`确定删除 Skill「${skill.name}」和它的文件吗？`)) return;
    const response = await fetch(`/api/skills/${skill.id}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) { setStatus(payload.error || "删除失败"); setError(true); return; }
    setStatus("Skill 已删除。"); setError(false); await load();
  };

  return <>
    <header className={styles.topbar}><Link className={styles.back} href="/admin">← 内容后台</Link><nav><Link href="/admin/uploads">上传作品</Link><Link href="/skill-library" target="_blank">查看 Skill 库 ↗</Link></nav></header>
    <div className={styles.content}>
      <section className={styles.intro}><div><p>EXTENSION CONTROL</p><h1>Skill 库管理</h1></div><div className={styles.health}><b>{health?.ok ? "现有持久存储正常" : health?.error ? "现有存储暂不可写" : "正在检查现有存储"}</b>{health?.storage ? `${health.storage.object_count} 个文件 · ${health.storage.size_mb} MB` : health?.error || "文件不会保存到临时目录"}</div></section>
      <section className={styles.panel}><h2>上传一个 Skill</h2><form className={styles.form} onSubmit={submit}>
        <div className={styles.field}><label>Skill 名称</label><input name="name" required placeholder="例如：长篇小说章节质检" /></div>
        <div className={styles.field}><label>分类（可直接新建）</label><input name="category_name" list="skill-categories" required placeholder="写作 / 视觉 / 研究" /><datalist id="skill-categories">{categories.map((item) => <option key={item.id} value={item.name} />)}</datalist></div>
        <div className={styles.fieldWide}><label>说明</label><textarea name="description" rows={3} placeholder="说明这个 Skill 解决什么问题、如何使用。" /></div>
        <label className={`${styles.filePicker} ${styles.fieldWide}`}><input name="file" type="file" required={!pending} /><span>{pending ? `已上传：${pending.file.name}，可以重试保存资料` : "点击选择 Skill 文件（最大 100 MB，支持 ZIP、Markdown、JSON、文档等）"}</span></label>
        <div className={`${styles.progress} ${styles.fieldWide}`}><span style={{ width: `${progress}%` }} /></div>
        <div className={`${styles.status} ${error ? styles.statusError : ""}`}>{status}</div>
        <button className={`${styles.button} ${styles.fieldWide}`} disabled={busy}>{busy ? "正在处理…" : pending ? "重试保存资料" : "上传并永久保存"}</button>
      </form><p className={styles.note}>新文件优先由浏览器直传 Cloudflare R2；未配置 R2 时保留现有 Vercel Blob 兼容路径。上传后会校验路径和文件大小。</p></section>
      <section className={styles.panel}><div className={styles.listHead}><h2>已保存 Skill</h2><Link className={`${styles.button} ${styles.secondary}`} href="/api/skills/export">导出清单</Link></div><div className={styles.list}>{skills.length ? skills.map((skill) => <article className={styles.row} key={skill.id}><div><h3>{skill.name} · {skill.category_name}</h3><p>{skill.original_name} · {fileSize(skill.size)}{skill.description ? ` · ${skill.description}` : ""}</p></div><div className={styles.rowActions}><Link href={skill.download_path}>下载</Link><button className={styles.danger} onClick={() => remove(skill)}>删除</button></div></article>) : <div className={styles.empty}>还没有 Skill。上传后会立即出现在扩展页面。</div>}</div></section>
    </div>
  </>;
}
