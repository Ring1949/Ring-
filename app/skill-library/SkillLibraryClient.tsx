"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { uploadFile } from "@/lib/storage-client";
import styles from "./skill-library.module.css";

type Category = { id: string; name: string; slug: string };
type Skill = {
  id: string; name: string; category_name: string; category_slug: string; description: string;
  original_name: string; size: number; content_type: string; version: number;
  download_path: string; created_at: string; updated_at: string;
};
type UploadedSkill = {
  url: string; pathname: string; download_url: string; storage_provider: "r2"; object_key: string;
  original_name: string; size: number; content_type: string;
};

const palettes = ["#EAF2FF", "#EEF7EC", "#F1EDFF", "#FFF0F0", "#FFF5E5", "#EDF4F8"];

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function relativeDate(value: string) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
  if (!Number.isFinite(days) || days > 365) return "很久前";
  return days === 0 ? "今天" : `${days} 天前`;
}
function toneFor(id: string) { return palettes[Math.abs(id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)) % palettes.length]; }
function DownloadIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/></svg>; }

export function SkillLibraryClient() {
  const [skills, setSkills] = useState<Skill[]>([]), [categories, setCategories] = useState<Category[]>([]), [query, setQuery] = useState(""), [status, setStatus] = useState("正在读取 Skill 库…");
  const [menu, setMenu] = useState(""), [editing, setEditing] = useState<Skill | null | undefined>(undefined), [detail, setDetail] = useState<Skill | null>(null), [busy, setBusy] = useState(false), [page, setPage] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const load = async () => { const response = await fetch(`/api/skills?fresh=${Date.now()}`, { cache: "no-store" }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Skill 库读取失败"); setSkills(payload.skills || []); setCategories(payload.categories || []); setStatus(""); };
  useEffect(() => { load().catch((reason) => setStatus(reason.message)); }, []);
  useEffect(() => { const shortcut = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); searchRef.current?.focus(); } if (event.key === "Escape") { setMenu(""); setEditing(undefined); setDetail(null); } }; window.addEventListener("keydown", shortcut); return () => window.removeEventListener("keydown", shortcut); }, []);
  const visible = useMemo(() => { const needle = query.trim().toLocaleLowerCase("zh-CN"); return skills.filter((skill) => !needle || [skill.name, skill.description, skill.category_name, skill.original_name].join(" ").toLocaleLowerCase("zh-CN").includes(needle)); }, [query, skills]);
  useEffect(() => setPage(0), [query]);
  const pageCount = Math.max(1, Math.ceil(visible.length / 6)), pageItems = visible.slice(page * 6, page * 6 + 6), detailIndex = detail ? visible.findIndex((item) => item.id === detail.id) : -1;
  const moveDetail = (direction: -1 | 1) => { if (!visible.length) return; const current = detailIndex < 0 ? 0 : detailIndex; setDetail(visible[(current + direction + visible.length) % visible.length]); };
  const remove = async (skill: Skill) => { setMenu(""); if (!confirm(`确定删除 Skill「${skill.name}」和它保存的文件吗？`)) return; const response = await fetch(`/api/skills/${skill.id}`, { method: "DELETE" }); const payload = await response.json(); if (!response.ok) { alert(payload.error || "删除失败"); return; } setDetail((current) => current?.id === skill.id ? null : current); setSkills((all) => all.filter((item) => item.id !== skill.id)); };

  return <main className={styles.page} onClick={() => setMenu("")}>
    <header className={styles.header}><Link href="/" className={styles.brand} aria-label="返回 Ring 首页"/><nav><Link href="/prompt-library">Prompt 库</Link></nav></header>
    <section className={styles.library}>
      <div className={styles.titleRow}><h1>Skill 库</h1><button className={styles.add} type="button" aria-label="添加 Skill" onClick={(event) => { event.stopPropagation(); setEditing(null); }}>＋</button></div>
      <label className={styles.search}><span aria-hidden="true"/><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 Skill..."/><kbd>⌘K</kbd></label>
      {status ? <div className={styles.notice}>{status}</div> : null}
      <section className={styles.grid} aria-live="polite">{pageItems.map((skill) => <article key={skill.id} className={styles.card} style={{ ["--card-tone" as string]: toneFor(skill.id) }}>
        <button type="button" className={styles.cardOpen} aria-label={`打开 Skill「${skill.name}」`} onClick={() => setDetail(skill)}/>
        <div className={styles.cardBody}><div className={styles.cardActions}>
          <a href={skill.download_path} className={styles.downloadButton} aria-label={`下载 ${skill.name}`} title="下载文件" onClick={(event) => event.stopPropagation()}><DownloadIcon/></a>
          <button type="button" aria-label={`编辑 ${skill.name}`} title="更多" onClick={(event) => { event.stopPropagation(); setMenu((current) => current === skill.id ? "" : skill.id); }}>•••</button>
          {menu === skill.id ? <div className={styles.menu} onClick={(event) => event.stopPropagation()}><button onClick={() => { setEditing(skill); setMenu(""); }}>编辑 Skill</button><a href={skill.download_path}>下载文件</a><button className={styles.danger} onClick={() => void remove(skill)}>删除 Skill</button></div> : null}
        </div><h2>{skill.name}</h2><p>{skill.description || "这个 Skill 暂时没有说明。"}</p><div className={styles.cardFooter}><div className={styles.tags}><span>{skill.category_name}</span><span>v{skill.version}</span></div><div className={styles.meta}>{relativeDate(skill.updated_at)} · {fileSize(skill.size)}</div></div></div>
      </article>)}</section>
      {pageCount > 1 ? <nav className={styles.pagination} aria-label="Skill 分页"><button disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>上一页</button><span>{page + 1} / {pageCount}</span><button disabled={page >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}>下一页</button></nav> : null}
      {!status && !visible.length ? <div className={styles.empty}>没有找到符合条件的 Skill。</div> : null}
    </section>
    {detail ? <SkillDetail skill={detail} close={() => setDetail(null)} previous={() => moveDetail(-1)} next={() => moveDetail(1)} canNavigate={visible.length > 1} edit={() => { setDetail(null); setEditing(detail); }}/>: null}
    {editing !== undefined ? <SkillEditor skill={editing} categories={categories} busy={busy} setBusy={setBusy} close={() => setEditing(undefined)} saved={async () => { setEditing(undefined); await load(); }}/>: null}
  </main>;
}

function SkillDetail({ skill, close, previous, next, canNavigate, edit }: { skill: Skill; close: () => void; previous: () => void; next: () => void; canNavigate: boolean; edit: () => void }) {
  const wheelAt = useRef(0);
  useEffect(() => { const overflow = document.body.style.overflow; document.body.style.overflow = "hidden"; const key = (event: KeyboardEvent) => { if (event.key === "Escape") close(); else if (canNavigate && event.key === "ArrowLeft") { event.preventDefault(); previous(); } else if (canNavigate && event.key === "ArrowRight") { event.preventDefault(); next(); } }; const wheel = (event: WheelEvent) => { if (!canNavigate) return; const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX; if (Math.abs(delta) < 8) return; event.preventDefault(); const now = performance.now(); if (now - wheelAt.current < 480) return; wheelAt.current = now; delta > 0 ? next() : previous(); }; window.addEventListener("keydown", key); window.addEventListener("wheel", wheel, { passive: false }); return () => { document.body.style.overflow = overflow; window.removeEventListener("keydown", key); window.removeEventListener("wheel", wheel); }; }, [canNavigate, close, next, previous]);
  return <div className={styles.backdrop} onMouseDown={(event) => { if (event.currentTarget === event.target) close(); }}>{canNavigate ? <div className={styles.detailNav}><button type="button" aria-label="上一个 Skill" onClick={previous}>←</button><button type="button" aria-label="下一个 Skill" onClick={next}>→</button></div> : null}<article className={styles.detail} role="dialog" aria-modal="true" aria-label={`${skill.name} 详情`}><button className={styles.detailClose} onClick={close} aria-label="关闭">×</button><small>{skill.category_name} · v{skill.version}</small><h2>{skill.name}</h2><p>{skill.description || "这个 Skill 暂时没有说明。"}</p><dl><div><dt>文件</dt><dd>{skill.original_name}</dd></div><div><dt>大小</dt><dd>{fileSize(skill.size)}</dd></div><div><dt>类型</dt><dd>{skill.content_type || "未知"}</dd></div><div><dt>更新</dt><dd>{relativeDate(skill.updated_at)}</dd></div></dl><footer><button type="button" onClick={edit}>编辑资料</button><a href={skill.download_path}>下载 Skill</a></footer></article></div>;
}

function SkillEditor({ skill, categories, busy, setBusy, close, saved }: { skill: Skill | null; categories: Category[]; busy: boolean; setBusy: (value: boolean) => void; close: () => void; saved: () => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null), [progress, setProgress] = useState(0), [message, setMessage] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = event.currentTarget; try { setBusy(true); setMessage(""); if (!skill && !file) throw new Error("请选择要保存的 Skill 文件。"); if (file && file.size > 100 * 1024 * 1024) throw new Error("单个 Skill 文件最大为 100 MB。"); let uploaded: UploadedSkill | undefined; if (file) { setMessage(`正在上传 ${file.name}…`); setProgress(1); const blob = await uploadFile(file, { kind: "skill", onProgress: (value) => setProgress(Math.max(1, Math.round(value))) }); uploaded = { url: blob.url, pathname: blob.pathname, download_url: blob.downloadUrl, storage_provider: "r2", object_key: blob.objectKey, original_name: file.name, size: file.size, content_type: file.type || blob.contentType }; } setMessage("正在永久保存 Skill…"); const values = new FormData(form); const body: Record<string, unknown> = { name: values.get("name"), category_name: values.get("category_name"), description: values.get("description") }; if (uploaded) Object.assign(body, uploaded); const response = await fetch(skill ? `/api/skills/${skill.id}` : "/api/skills", { method: skill ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Skill 保存失败"); setProgress(100); await saved(); } catch (error) { setMessage(error instanceof Error ? error.message : "Skill 保存失败"); } finally { setBusy(false); } };
  return <div className={styles.backdrop} onMouseDown={(event) => { if (event.currentTarget === event.target) close(); }}><section className={styles.editor} role="dialog" aria-modal="true"><div className={styles.editorHead}><div><p>{skill ? "EDIT SKILL" : "NEW SKILL"}</p><h2>{skill ? "编辑 Skill" : "添加 Skill"}</h2></div><button type="button" onClick={close} aria-label="关闭">×</button></div><form onSubmit={submit}><label><span>Skill 名称</span><input name="name" defaultValue={skill?.name} required maxLength={80}/></label><label><span>分类（可直接新建）</span><input name="category_name" defaultValue={skill?.category_name} list="skill-categories" required maxLength={40}/><datalist id="skill-categories">{categories.map((category) => <option key={category.id} value={category.name}/>)}</datalist></label><label className={styles.wide}><span>说明</span><textarea name="description" defaultValue={skill?.description} rows={4} maxLength={400} placeholder="说明这个 Skill 解决什么问题、如何使用。"/></label><label className={`${styles.filePicker} ${styles.wide}`}><input type="file" onChange={(event) => { const selected = event.target.files?.[0] || null; setFile(selected); setProgress(0); setMessage(""); }}/><span>{file ? `已选择：${file.name} · ${fileSize(file.size)}` : skill ? `当前文件：${skill.original_name} · 点击可替换` : "点击选择 Skill 文件（最大 100 MB）"}</span></label>{progress > 0 ? <div className={`${styles.progress} ${styles.wide}`}><span style={{ width: `${progress}%` }}/></div> : null}{message ? <div className={`${styles.formMessage} ${styles.wide}`}>{message}</div> : null}<div className={`${styles.formActions} ${styles.wide}`}><button type="button" onClick={close}>取消</button><button className={styles.primary} disabled={busy}>{busy ? "正在保存…" : skill ? "保存修改" : "上传并保存"}</button></div></form></section></div>;
}
