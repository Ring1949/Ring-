"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./skill-library.module.css";

type Category = { id: string; name: string; slug: string };
type Skill = {
  id: string;
  name: string;
  category_name: string;
  category_slug: string;
  description: string;
  original_name: string;
  size: number;
  content_type: string;
  version: number;
  download_path: string;
  updated_at: string;
};

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function SkillLibraryClient() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/skills", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Skill 库暂时无法读取");
        setSkills(payload.skills || []);
        setCategories(payload.categories || []);
      })
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("zh-CN");
    return skills.filter((skill) => {
      if (category !== "all" && skill.category_slug !== category) return false;
      if (!needle) return true;
      return [skill.name, skill.description, skill.category_name, skill.original_name]
        .join(" ")
        .toLocaleLowerCase("zh-CN")
        .includes(needle);
    });
  }, [category, query, skills]);

  return (
    <>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>山川行止</Link>
        <nav><Link href="/works.html?category=all">作品库</Link><Link href="/novel-studio">小说工作台</Link></nav>
      </header>
      <section className={styles.hero}>
        <p>EXTENSION · SKILL LIBRARY</p>
        <h1>Skill 库</h1>
        <span>把方法、提示与工作流保存成可以再次调用的文件。</span>
      </section>
      <section className={styles.controls}>
        <label><span>搜索</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="名称、分类或文件名" /></label>
        <div className={styles.filters}>
          <button className={category === "all" ? styles.active : ""} onClick={() => setCategory("all")}>全部</button>
          {categories.map((item) => <button className={category === item.slug ? styles.active : ""} onClick={() => setCategory(item.slug)} key={item.id}>{item.name}</button>)}
        </div>
      </section>
      {loading ? <div className={styles.state}>正在读取 Skill 库…</div> : null}
      {error ? <div className={`${styles.state} ${styles.error}`}>{error}</div> : null}
      {!loading && !error && !visible.length ? <div className={styles.state}>这里还没有符合条件的 Skill。</div> : null}
      <section className={styles.grid} aria-live="polite">
        {visible.map((skill) => (
          <article className={styles.card} key={skill.id}>
            <div className={styles.cardTop}><span>{skill.category_name}</span><b>v{skill.version}</b></div>
            <h2>{skill.name}</h2>
            <p>{skill.description || "这个 Skill 暂时没有说明。"}</p>
            <dl><div><dt>文件</dt><dd>{skill.original_name}</dd></div><div><dt>大小</dt><dd>{fileSize(skill.size)}</dd></div></dl>
            <Link className={styles.download} href={skill.download_path}>下载 Skill</Link>
          </article>
        ))}
      </section>
      <footer className={styles.footer}>文件由持久对象存储保存，不使用 Vercel 临时目录。</footer>
    </>
  );
}
