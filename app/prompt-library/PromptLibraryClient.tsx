"use client";

import { upload } from "@vercel/blob/client";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import styles from "./prompt-library.module.css";

type Prompt = { id:string; title:string; category:string; description:string; content:string; tags:string[]; image_url:string; image_pathname:string; image_name:string; usage_count:number; created_at:string; updated_at:string };
type ImageUpload = { url:string; pathname:string; name:string; size:number };
const palettes=["#eef5ff","#eefaf5","#f6f0ff","#fff1f0","#fff7e9","#edf4ff","#f4f7ef"];
const icons=["◇","✎","□","▱","≋","</>"];

function paletteFor(id:string){let hash=0;for(const char of id)hash=(hash*31+char.charCodeAt(0))|0;return palettes[Math.abs(hash)%palettes.length]}
function safeFilename(name:string){const ext=name.includes(".")?`.${name.split(".").pop()!.replace(/[^a-z0-9]/gi,"").slice(0,8)}`:".jpg";return `prompt-${Date.now()}-${crypto.randomUUID()}${ext}`}
function relativeDate(value:string){const days=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/86400000));if(!Number.isFinite(days)||days>365)return "很久前";return days===0?"今天":`${days} 天前`}
async function copyText(value:string){try{await navigator.clipboard.writeText(value);return}catch{/* use the compatible path below */}const area=document.createElement("textarea");area.value=value;area.setAttribute("readonly","");area.style.cssText="position:fixed;left:-9999px;top:0";document.body.appendChild(area);area.select();const copied=document.execCommand("copy");area.remove();if(!copied)throw new Error("浏览器未允许复制，请手动选择提示词。")}

export function PromptLibraryClient(){
  const [prompts,setPrompts]=useState<Prompt[]>([]),[query,setQuery]=useState(""),[copied,setCopied]=useState(""),[menu,setMenu]=useState(""),[status,setStatus]=useState("正在读取提示词…");
  const [editing,setEditing]=useState<Prompt|null|undefined>(undefined),[busy,setBusy]=useState(false);const searchRef=useRef<HTMLInputElement>(null);
  const load=async()=>{const response=await fetch("/api/prompts",{cache:"no-store"});const payload=await response.json();if(!response.ok)throw new Error(payload.error||"Prompt 库读取失败");setPrompts(payload.prompts||[]);setStatus("")};
  useEffect(()=>{load().catch((reason)=>setStatus(reason.message))},[]);
  useEffect(()=>{const shortcut=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k"){event.preventDefault();searchRef.current?.focus()}if(event.key==="Escape"){setMenu("");setEditing(undefined)}};window.addEventListener("keydown",shortcut);return()=>window.removeEventListener("keydown",shortcut)},[]);
  const visible=useMemo(()=>{const needle=query.trim().toLocaleLowerCase("zh-CN");return prompts.filter((item)=>!needle||`${item.title} ${item.category} ${item.description} ${item.tags.join(" ")} ${item.content}`.toLocaleLowerCase("zh-CN").includes(needle))},[prompts,query]);
  const copyPrompt=async(item:Prompt)=>{try{await copyText(item.content);setPrompts((all)=>all.map((entry)=>entry.id===item.id?{...entry,usage_count:entry.usage_count+1}:entry));setCopied(item.id);setTimeout(()=>setCopied((current)=>current===item.id?"":current),1600)}catch(error){alert(error instanceof Error?error.message:"复制失败")}};
  const remove=async(item:Prompt)=>{setMenu("");if(!confirm(`确定删除提示词「${item.title}」${item.image_url?"及其预览图片":""}吗？`))return;const response=await fetch(`/api/prompts/${item.id}`,{method:"DELETE"});const payload=await response.json();if(!response.ok){alert(payload.error||"删除失败");return}setPrompts((all)=>all.filter((entry)=>entry.id!==item.id))};
  return <main className={styles.page} onClick={()=>setMenu("")}>
    <header className={styles.header}><Link href="/" className={styles.brand}>Ring</Link><nav><Link href="/#extensions">扩展</Link><Link href="/skill-library">Skill 库</Link><Link href="/admin">内容后台</Link></nav></header>
    <section className={styles.library}>
      <div className={styles.titleRow}><div><p>PROMPT LIBRARY</p><h1>提示词库</h1></div><button className={styles.add} type="button" aria-label="新建提示词" onClick={(e)=>{e.stopPropagation();setEditing(null)}}>＋</button></div>
      <label className={styles.search}><span>⌕</span><input ref={searchRef} value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="搜索 Prompt…"/><kbd>⌘K</kbd></label>
      {status?<div className={styles.notice}>{status}</div>:null}
      <section className={styles.grid} aria-live="polite">{visible.map((item,index)=><article key={item.id} className={`${styles.card} ${item.image_url?styles.imageCard:""}`} style={item.image_url?undefined:{background:paletteFor(item.id)}}>
        {item.image_url?<div className={styles.preview}><img src={item.image_url} alt={`${item.title} 效果预览`}/><span>效果预览</span></div>:null}
        <div className={styles.cardBody}><div className={styles.cardTop}><span className={styles.icon}>{icons[index%icons.length]}</span><div className={styles.cardActions}>
          <button type="button" aria-label={`复制 ${item.title}`} title="一键复制完整提示词" onClick={()=>void copyPrompt(item)}>{copied===item.id?"✓":"▣"}</button>
          <button type="button" aria-label={`编辑 ${item.title}`} title="更多" onClick={(e)=>{e.stopPropagation();setMenu((current)=>current===item.id?"":item.id)}}>•••</button>
          {menu===item.id?<div className={styles.menu} onClick={(e)=>e.stopPropagation()}><button onClick={()=>{setEditing(item);setMenu("")}}>编辑卡片</button><button className={styles.danger} onClick={()=>void remove(item)}>删除卡片</button></div>:null}
        </div></div><h2>{item.title}</h2><p>{item.description}</p><div className={styles.tags}>{item.tags.map((tag)=><span key={tag}>{tag}</span>)}</div><div className={styles.meta}><span>{relativeDate(item.updated_at)} · 使用 {item.usage_count} 次</span><button onClick={()=>void copyPrompt(item)}>{copied===item.id?"提示词已复制":"复制提示词"}</button></div></div>
      </article>)}</section>
      {!status&&!visible.length?<div className={styles.empty}>没有找到符合条件的提示词。</div>:null}
    </section>
    {editing!==undefined?<PromptEditor prompt={editing} busy={busy} setBusy={setBusy} close={()=>setEditing(undefined)} saved={async()=>{setEditing(undefined);await load()}}/>:null}
  </main>
}

function PromptEditor({prompt,busy,setBusy,close,saved}:{prompt:Prompt|null;busy:boolean;setBusy:(value:boolean)=>void;close:()=>void;saved:()=>Promise<void>}){
  const [preview,setPreview]=useState(prompt?.image_url||""),[removeImage,setRemoveImage]=useState(false),[file,setFile]=useState<File|null>(null),[message,setMessage]=useState("");
  const chooseImage=(selected:File|null)=>{if(!selected)return;if(!selected.type.startsWith("image/")){setMessage("请选择图片文件。");return}if(selected.size>20*1024*1024){setMessage("预览图片最大为 20 MB。");return}setFile(selected);setRemoveImage(false);setPreview(URL.createObjectURL(selected));setMessage("")};
  const submit=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const form=event.currentTarget;try{setBusy(true);setMessage(file?"正在上传效果预览图…":"正在保存卡片…");let image:ImageUpload|null|undefined=removeImage?null:undefined;if(file){const blob=await upload(`prompt-library/images/${safeFilename(file.name)}`,file,{access:"public",handleUploadUrl:"/api/blob/upload",clientPayload:JSON.stringify({kind:"prompt"})});image={url:blob.url,pathname:blob.pathname,name:file.name,size:file.size}}const values=new FormData(form);const payload:Record<string,unknown>={title:values.get("title"),category:values.get("category"),description:values.get("description"),content:values.get("content"),tags:String(values.get("tags")||"").split(/[,，]/).map((item)=>item.trim()).filter(Boolean)};if(image!==undefined)payload.image=image;const response=await fetch(prompt?`/api/prompts/${prompt.id}`:"/api/prompts",{method:prompt?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const result=await response.json();if(!response.ok)throw new Error(result.error||"保存失败");await saved()}catch(error){setMessage(error instanceof Error?error.message:"保存失败")}finally{setBusy(false)}};
  return <div className={styles.backdrop} onMouseDown={(e)=>{if(e.currentTarget===e.target)close()}}><section className={styles.editor} role="dialog" aria-modal="true"><div className={styles.editorHead}><div><p>{prompt?"EDIT PROMPT":"NEW PROMPT"}</p><h2>{prompt?"编辑提示词卡片":"新建提示词卡片"}</h2></div><button onClick={close} aria-label="关闭">×</button></div>
    <form onSubmit={submit}><label><span>标题</span><input name="title" defaultValue={prompt?.title} required maxLength={80}/></label><label><span>分类</span><input name="category" defaultValue={prompt?.category} placeholder="写作 / 视觉 / 研究" maxLength={30}/></label><label className={styles.wide}><span>卡片简介</span><textarea name="description" defaultValue={prompt?.description} rows={2} maxLength={240}/></label><label className={styles.wide}><span>标签（逗号分隔）</span><input name="tags" defaultValue={prompt?.tags.join("，")} placeholder="写作，创意"/></label><label className={styles.wide}><span>完整提示词</span><textarea name="content" defaultValue={prompt?.content} rows={8} required maxLength={20000}/></label>
      <div className={`${styles.imageEditor} ${styles.wide}`}><div>{preview&&!removeImage?<img src={preview} alt="效果图预览"/>:<span>尚未插入效果预览图<br/>无图卡片会自动使用稳定的随机淡色</span>}</div><div className={styles.imageButtons}><label><input type="file" accept="image/*" onChange={(e)=>chooseImage(e.target.files?.[0]||null)}/><span>{preview&&!removeImage?"替换图片":"插入图片"}</span></label>{preview&&!removeImage?<button type="button" onClick={()=>{setRemoveImage(true);setFile(null);setPreview("")}}>删除图片</button>:null}</div></div>
      {message?<div className={`${styles.formMessage} ${styles.wide}`}>{message}</div>:null}<div className={`${styles.formActions} ${styles.wide}`}><button type="button" onClick={close}>取消</button><button className={styles.primary} disabled={busy}>{busy?"正在保存…":"保存卡片"}</button></div>
    </form></section></div>
}
