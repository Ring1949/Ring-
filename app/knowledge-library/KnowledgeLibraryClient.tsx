"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { uploadFile } from "@/lib/storage-client";
import base from "../prompt-library/prompt-library.module.css";
import styles from "./knowledge-library.module.css";

type KnowledgeCard = {
  id: string; title: string; summary: string; content: string; source_url: string; tags: string[];
  image_url: string; image_pathname: string; image_name: string; created_at: string; updated_at: string;
};
type ImageUpload = { url: string; pathname: string; name: string; size: number; storage_provider: "r2"; object_key: string };
const palettes = ["#edf0e8", "#e9eef3", "#f3ece5", "#eeeaf4", "#f1efe7", "#e8f0ee"];
const DEFAULT_KNOWLEDGE_TAGS = ["电影", "美术", "摄影", "建模", "乐理", "服装", "人", "材质", "空间"];

function relativeDate(value: string) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
  if (!Number.isFinite(days) || days > 365) return "很久前";
  return days === 0 ? "今天" : `${days} 天前`;
}

export function KnowledgeLibraryClient() {
  const [cards, setCards] = useState<KnowledgeCard[]>([]);
  const [query, setQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("全部");
  const [status, setStatus] = useState("正在读取知识卡片…");
  const [menu, setMenu] = useState("");
  const [detail, setDetail] = useState<KnowledgeCard | null>(null);
  const [editing, setEditing] = useState<KnowledgeCard | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const response = await fetch("/api/knowledge-cards", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "知识库读取失败");
    setCards(payload.cards || []);
    setStatus("");
  };

  useEffect(() => { void load().catch((error) => setStatus(error.message)); }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); searchRef.current?.focus(); }
      if (event.key === "Escape") { setMenu(""); setDetail(null); setEditing(undefined); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  const allTags = useMemo(() => ["全部", ...new Set([...DEFAULT_KNOWLEDGE_TAGS, ...cards.flatMap((card) => card.tags)])], [cards]);
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("zh-CN");
    return cards.filter((card) => {
      const matchesTag = selectedTag === "全部" || card.tags.includes(selectedTag);
      const haystack = `${card.title} ${card.summary} ${card.content} ${card.tags.join(" ")}`.toLocaleLowerCase("zh-CN");
      return matchesTag && (!needle || haystack.includes(needle));
    });
  }, [cards, query, selectedTag]);

  const remove = async (card: KnowledgeCard) => {
    setMenu("");
    if (!confirm(`确定删除知识卡片「${card.title}」吗？`)) return;
    const response = await fetch(`/api/knowledge-cards/${card.id}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) { alert(payload.error || "删除失败"); return; }
    setCards((current) => current.filter((item) => item.id !== card.id));
    if (detail?.id === card.id) setDetail(null);
  };

  return <main className={base.page} onClick={() => setMenu("")}>
    <header className={base.header}>
      <Link href="/" className={base.brand} aria-label="返回 Ring 首页" />
      <nav><Link href="/prompt-library">Prompt 库</Link></nav>
    </header>
    <section className={base.library}>
      <div className={base.titleRow}>
        <div><p className={styles.eyebrow}>PERSONAL ARCHIVE</p><h1>知识库</h1></div>
        <button className={base.add} type="button" aria-label="新建知识卡片" onClick={(event) => { event.stopPropagation(); setEditing(null); }}>＋</button>
      </div>
      <label className={base.search}><span aria-hidden="true" /><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、正文或标签…" /><kbd>⌘K</kbd></label>
      <div className={styles.tagRail} aria-label="知识标签筛选">
        {allTags.map((tag) => <button key={tag} type="button" className={selectedTag === tag ? styles.activeTag : ""} onClick={() => setSelectedTag(tag)}>{tag}</button>)}
      </div>
      {status ? <div className={base.notice}>{status}</div> : null}
      <section className={base.grid} aria-live="polite">
        {visible.map((card, index) => {
          const hasImage = Boolean(card.image_url);
          return <article key={card.id} className={`${base.card} ${hasImage ? base.cardWithImage : base.cardPlain}`} style={{ ["--card-tone" as string]: palettes[index % palettes.length] }}>
            {hasImage ? <div className={base.cardMedia} aria-hidden="true"><img src={card.image_url} alt="" /><span /></div> : <div className={styles.cardMark} aria-hidden="true">{String(index + 1).padStart(2, "0")}</div>}
            <button type="button" className={base.cardOpen} aria-label={`打开知识卡片「${card.title}」`} onClick={() => setDetail(card)} />
            <div className={base.cardBody}>
              <div className={base.cardActions}>
                <button type="button" aria-label={`编辑 ${card.title}`} title="更多" onClick={(event) => { event.stopPropagation(); setMenu((current) => current === card.id ? "" : card.id); }}>•••</button>
                {menu === card.id ? <div className={base.menu} onClick={(event) => event.stopPropagation()}><button onClick={() => { setEditing(card); setMenu(""); }}>编辑卡片</button><button className={base.danger} onClick={() => void remove(card)}>删除卡片</button></div> : null}
              </div>
              <h2>{card.title}</h2><p>{card.summary || card.content}</p>
              <div className={base.cardFooter}><div className={base.tags}>{card.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div><div className={base.meta}>{relativeDate(card.updated_at)} · {card.tags.length} 个标签</div></div>
            </div>
          </article>;
        })}
      </section>
      {!status && !visible.length ? <div className={base.empty}>{cards.length ? "没有找到符合条件的知识卡片。" : "还没有知识卡片，点击右上角＋开始建立你的知识库。"}</div> : null}
    </section>
    {detail ? <KnowledgeDetail card={detail} close={() => setDetail(null)} edit={() => { setEditing(detail); setDetail(null); }} /> : null}
    {editing !== undefined ? <KnowledgeEditor card={editing} allTags={allTags.filter((tag) => tag !== "全部")} busy={busy} setBusy={setBusy} close={() => setEditing(undefined)} saved={async () => { setEditing(undefined); await load(); }} /> : null}
  </main>;
}

function KnowledgeDetail({ card, close, edit }: { card: KnowledgeCard; close: () => void; edit: () => void }) {
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; };
  }, []);
  return <div className={base.backdrop} onMouseDown={(event) => { if (event.currentTarget === event.target) close(); }}>
    <article className={`${base.detail} ${styles.detail}`} role="dialog" aria-modal="true" aria-label={`${card.title} 详情`}>
      <button className={base.detailClose} onClick={close} aria-label="关闭">×</button>
      {card.image_url ? <img src={card.image_url} alt={card.title} /> : null}
      <small>KNOWLEDGE CARD</small><h2>{card.title}</h2><p>{card.summary}</p>
      <div className={styles.detailContent}>{card.content}</div>
      <footer><div className={base.tags}>{card.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><div className={base.detailActions}>{card.source_url ? <a href={card.source_url} target="_blank" rel="noreferrer">查看来源</a> : null}<button type="button" onClick={edit}>编辑卡片</button></div></footer>
    </article>
  </div>;
}

function KnowledgeEditor({ card, allTags, busy, setBusy, close, saved }: { card: KnowledgeCard | null; allTags: string[]; busy: boolean; setBusy: (value: boolean) => void; close: () => void; saved: () => Promise<void> }) {
  const [selectedTags, setSelectedTags] = useState<string[]>(card?.tags || []);
  const [customTag, setCustomTag] = useState("");
  const [preview, setPreview] = useState(card?.image_url || "");
  const [removeImage, setRemoveImage] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const toggleTag = (tag: string) => setSelectedTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag].slice(0, 16));
  const addTag = () => {
    const tag = customTag.trim().slice(0, 24);
    if (tag && !selectedTags.includes(tag)) setSelectedTags((current) => [...current, tag].slice(0, 16));
    setCustomTag("");
  };
  const chooseImage = (selected: File | null) => {
    if (!selected) return;
    if (!selected.type.startsWith("image/")) { setMessage("请选择图片文件。"); return; }
    if (selected.size > 20 * 1024 * 1024) { setMessage("图片最大为 20 MB。"); return; }
    setFile(selected); setRemoveImage(false); setPreview(URL.createObjectURL(selected)); setMessage("");
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      setBusy(true); setMessage(file ? "正在上传知识卡片图片…" : "正在保存知识卡片…");
      let image: ImageUpload | null | undefined = removeImage ? null : undefined;
      if (file) { const uploaded = await uploadFile(file, { kind: "knowledge" }); image = { url: uploaded.url, pathname: uploaded.pathname, name: file.name, size: file.size, storage_provider: "r2", object_key: uploaded.objectKey }; }
      const values = new FormData(form);
      const payload: Record<string, unknown> = { title: values.get("title"), summary: values.get("summary"), content: values.get("content"), source_url: values.get("source_url"), tags: selectedTags };
      if (image !== undefined) payload.image = image;
      const response = await fetch(card ? `/api/knowledge-cards/${card.id}` : "/api/knowledge-cards", { method: card ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "保存失败");
      await saved();
    } catch (error) { setMessage(error instanceof Error ? error.message : "保存失败"); }
    finally { setBusy(false); }
  };
  return <div className={base.backdrop} onMouseDown={(event) => { if (event.currentTarget === event.target) close(); }}>
    <section className={base.editor} role="dialog" aria-modal="true">
      <div className={base.editorHead}><div><p>{card ? "EDIT KNOWLEDGE" : "NEW KNOWLEDGE"}</p><h2>{card ? "编辑知识卡片" : "新建知识卡片"}</h2></div><button onClick={close} aria-label="关闭">×</button></div>
      <form onSubmit={submit}>
        <label><span>标题</span><input name="title" defaultValue={card?.title} required maxLength={100} /></label>
        <label><span>来源链接（可选）</span><input name="source_url" type="url" defaultValue={card?.source_url} placeholder="https://…" maxLength={2000} /></label>
        <label className={base.wide}><span>卡片摘要</span><textarea name="summary" defaultValue={card?.summary} rows={2} maxLength={300} /></label>
        <div className={`${styles.tagEditor} ${base.wide}`}><span>标签</span><div className={styles.tagChoices}>{[...new Set([...allTags, ...selectedTags])].map((tag) => <button key={tag} type="button" className={selectedTags.includes(tag) ? styles.selectedChoice : ""} onClick={() => toggleTag(tag)}>{tag}</button>)}</div><div className={styles.newTag}><input value={customTag} onChange={(event) => setCustomTag(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTag(); } }} placeholder="输入新标签" maxLength={24} /><button type="button" onClick={addTag}>加入标签</button></div></div>
        <label className={base.wide}><span>知识正文</span><textarea name="content" defaultValue={card?.content} rows={10} required maxLength={30000} /></label>
        <div className={`${base.imageEditor} ${base.wide}`}><div>{preview && !removeImage ? <img src={preview} alt="知识卡片图片预览" /> : <span>可插入参考图片<br />无图卡片会使用柔和档案色</span>}</div><div className={base.imageButtons}><label><input type="file" accept="image/*" onChange={(event) => chooseImage(event.target.files?.[0] || null)} /><span>{preview && !removeImage ? "替换图片" : "插入图片"}</span></label>{preview && !removeImage ? <button type="button" onClick={() => { setRemoveImage(true); setFile(null); setPreview(""); }}>删除图片</button> : null}</div></div>
        {message ? <div className={`${base.formMessage} ${base.wide}`}>{message}</div> : null}
        <div className={`${base.formActions} ${base.wide}`}><button type="button" onClick={close}>取消</button><button className={base.primary} disabled={busy}>{busy ? "正在保存…" : "保存卡片"}</button></div>
      </form>
    </section>
  </div>;
}
