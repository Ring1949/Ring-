"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./prompt-library.module.css";

const prompts = [
  { id: "novel-plan", category: "写作", title: "长篇小说策划", description: "从一个灵感生成可执行的小说生产方案。", content: "你是一名资深小说策划。请根据我提供的灵感，依次输出：核心命题、世界观边界、主要人物目标与缺陷、三幕冲突链、关键转折、结局方向，以及前十章的章节目标。信息不足时先提出不超过 5 个关键问题，不要擅自补全决定性设定。" },
  { id: "style-rewrite", category: "写作", title: "文风改写与保真", description: "调整语言风格，同时保留事实与原意。", content: "请改写下面的文字。保持事实、人物关系、时间顺序和核心含义不变；减少空泛形容词和重复表达；加强节奏与画面感。输出改写稿，并用 3 条简短说明列出主要调整。原文：{{粘贴内容}}" },
  { id: "photo-review", category: "视觉", title: "摄影作品分析", description: "从构图、光线和叙事三个层面阅读照片。", content: "请以摄影编辑的视角分析这张照片。分别讨论主体关系、构图秩序、光线与色彩、空间层次、情绪和叙事线索；指出最有效的部分与一个优先改进点。不要猜测无法从画面确认的拍摄背景。" },
  { id: "design-critique", category: "视觉", title: "视觉设计评审", description: "形成清晰、可执行的界面修改建议。", content: "请评审这个界面，按信息层级、版式、间距、字体、颜色、交互反馈和可访问性逐项检查。每个问题说明：现象、用户影响、修改建议、优先级。最后给出一份只包含高优先级事项的修改清单。" },
  { id: "research-map", category: "研究", title: "资料脉络整理", description: "把零散资料整理成可追溯的知识结构。", content: "请整理我提供的资料，不要补写资料中不存在的事实。输出：主题摘要、关键概念、时间线、人物或组织关系、已确认结论、相互矛盾的信息、待核实问题和下一步检索关键词。每条结论标注对应资料来源。" },
  { id: "workflow", category: "自动化", title: "流程自动化拆解", description: "把重复工作转成稳定、可检查的流程。", content: "请把下面的重复任务拆成自动化流程。标出输入、处理步骤、判断条件、输出、失败重试、人工确认点和日志记录；区分必须人工处理与可以自动执行的部分；最后给出最小可用版本和后续增强版本。任务：{{描述任务}}" }
] as const;

const categories = ["全部", ...Array.from(new Set(prompts.map((item) => item.category)))] as const;

export function PromptLibraryClient() {
  const [category, setCategory] = useState("全部");
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState("");
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("zh-CN");
    return prompts.filter((item) => (category === "全部" || item.category === category) && (!needle || `${item.title} ${item.description} ${item.content}`.toLocaleLowerCase("zh-CN").includes(needle)));
  }, [category, query]);

  const copyPrompt = async (id: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopied(id);
    window.setTimeout(() => setCopied((current) => current === id ? "" : current), 1500);
  };

  return <>
    <header className={styles.header}><Link href="/" className={styles.brand}>山川行止</Link><nav><Link href="/#extensions">扩展</Link><Link href="/skill-library">Skill 库</Link></nav></header>
    <section className={styles.hero}><p>EXTENSION · PROMPT LIBRARY</p><h1>Prompt 库</h1><span>把有效的指令沉淀下来，在下一次对话中直接调用。</span></section>
    <section className={styles.controls}>
      <label><span>搜索提示词</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="名称、用途或正文" /></label>
      <div>{categories.map((item) => <button key={item} className={category === item ? styles.active : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>
    </section>
    <section className={styles.grid} aria-live="polite">
      {visible.map((item, index) => <article className={styles.card} key={item.id}>
        <div className={styles.number}>{String(index + 1).padStart(2, "0")}<span>{item.category}</span></div>
        <h2>{item.title}</h2><p>{item.description}</p><pre>{item.content}</pre>
        <button className={styles.copy} onClick={() => void copyPrompt(item.id, item.content)}>{copied === item.id ? "已复制" : "复制 Prompt"}</button>
      </article>)}
    </section>
    {!visible.length ? <div className={styles.empty}>没有找到符合条件的 Prompt。</div> : null}
  </>;
}
