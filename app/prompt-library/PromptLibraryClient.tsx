"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { uploadFile } from "@/lib/storage-client";
import styles from "./prompt-library.module.css";

type Prompt = { id:string; title:string; category:string; description:string; content:string; tags:string[]; image_url:string; image_pathname:string; image_name:string; usage_count:number; created_at:string; updated_at:string };
type ImageUpload = { url:string; pathname:string; name:string; size:number; storage_provider:"r2"; object_key:string };
const palettes=["#EAF2FF","#EEF7EC","#F1EDFF","#FFF0F0","#FFF5E5","#EDF4F8"];

function relativeDate(value:string){const days=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/86400000));if(!Number.isFinite(days)||days>365)return "很久前";return days===0?"今天":`${days} 天前`}
async function copyText(value:string){try{await navigator.clipboard.writeText(value);return}catch{/* use the compatible path below */}const area=document.createElement("textarea");area.value=value;area.setAttribute("readonly","");area.style.cssText="position:fixed;left:-9999px;top:0";document.body.appendChild(area);area.select();const copied=document.execCommand("copy");area.remove();if(!copied)throw new Error("浏览器未允许复制，请手动选择提示词。")}

export function PromptLibraryClient(){
  const [prompts,setPrompts]=useState<Prompt[]>([]),[query,setQuery]=useState(""),[copied,setCopied]=useState(""),[menu,setMenu]=useState(""),[status,setStatus]=useState("正在读取提示词…");
  const [editing,setEditing]=useState<Prompt|null|undefined>(undefined),[detail,setDetail]=useState<Prompt|null>(null),[busy,setBusy]=useState(false),[page,setPage]=useState(0),[colors,setColors]=useState<Record<string,number>>({});const searchRef=useRef<HTMLInputElement>(null);
  const load=async()=>{const response=await fetch("/api/prompts",{cache:"no-store"});const payload=await response.json();if(!response.ok)throw new Error(payload.error||"Prompt 库读取失败");setPrompts(payload.prompts||[]);setStatus("")};
  useEffect(()=>{load().catch((reason)=>setStatus(reason.message))},[]);
  useEffect(()=>{try{setColors(JSON.parse(localStorage.getItem("prompt-card-colors")||"{}"))}catch{/* retain default colors */}},[]);
  useEffect(()=>{const shortcut=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k"){event.preventDefault();searchRef.current?.focus()}if(event.key==="Escape"){setMenu("");setEditing(undefined);setDetail(null)}};window.addEventListener("keydown",shortcut);return()=>window.removeEventListener("keydown",shortcut)},[]);
  const visible=useMemo(()=>{const needle=query.trim().toLocaleLowerCase("zh-CN");return prompts.filter((item)=>!needle||`${item.title} ${item.category} ${item.description} ${item.tags.join(" ")} ${item.content}`.toLocaleLowerCase("zh-CN").includes(needle))},[prompts,query]);
  useEffect(()=>setPage(0),[query]);
  const pageCount=Math.max(1,Math.ceil(visible.length/6)),pageItems=visible.slice(page*6,page*6+6);
  const copyPrompt=async(item:Prompt)=>{try{await copyText(item.content);setPrompts((all)=>all.map((entry)=>entry.id===item.id?{...entry,usage_count:entry.usage_count+1}:entry));setCopied(item.id);setTimeout(()=>setCopied((current)=>current===item.id?"":current),1600)}catch(error){alert(error instanceof Error?error.message:"复制失败")}};
  const remove=async(item:Prompt)=>{setMenu("");if(!confirm(`确定删除提示词「${item.title}」${item.image_url?"及其预览图片":""}吗？`))return;const response=await fetch(`/api/prompts/${item.id}`,{method:"DELETE"});const payload=await response.json();if(!response.ok){alert(payload.error||"删除失败");return}setPrompts((all)=>all.filter((entry)=>entry.id!==item.id))};
  const cycleColor=(item:Prompt)=>{setMenu("");setColors((current)=>{const next={...current,[item.id]:((current[item.id]??Math.abs(item.id.split("").reduce((sum,char)=>sum+char.charCodeAt(0),0)))+1)%palettes.length};localStorage.setItem("prompt-card-colors",JSON.stringify(next));return next})};
  const duplicate=async(item:Prompt)=>{setMenu("");const response=await fetch("/api/prompts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:`${item.title} 副本`,category:item.category,description:item.description,content:item.content,tags:item.tags})});const payload=await response.json();if(!response.ok){alert(payload.error||"复制副本失败");return}await load()};
  return <main className={styles.page} onClick={()=>setMenu("")}>
    <header className={styles.header}><Link href="/" className={styles.brand}>Ring</Link><nav><Link href="/#extensions">扩展</Link><Link href="/skill-library">Skill 库</Link><Link href="/admin">内容后台</Link></nav></header>
    <section className={styles.library}>
      <div className={styles.titleRow}><h1>提示词库</h1><button className={styles.add} type="button" aria-label="新建提示词" onClick={(e)=>{e.stopPropagation();setEditing(null)}}>＋</button></div>
      <label className={styles.search}><span aria-hidden="true"/><input ref={searchRef} value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="搜索 Prompt..."/><kbd>⌘K</kbd></label>
      {status?<div className={styles.notice}>{status}</div>:null}
      <section className={styles.grid} aria-live="polite">{pageItems.map((item)=><article key={item.id} className={styles.card} style={{background:palettes[colors[item.id]??Math.abs(item.id.split("").reduce((sum,char)=>sum+char.charCodeAt(0),0))%palettes.length]}} onClick={()=>setDetail(item)} tabIndex={0} onKeyDown={(event)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();setDetail(item)}}}>
        <div className={styles.cardBody}><div className={styles.cardActions}>
          <button type="button" aria-label={`复制 ${item.title}`} title="一键复制完整提示词" onClick={(event)=>{event.stopPropagation();void copyPrompt(item)}}>{copied===item.id?"✓":"▣"}</button>
          <button type="button" aria-label={`编辑 ${item.title}`} title="更多" onClick={(e)=>{e.stopPropagation();setMenu((current)=>current===item.id?"":item.id)}}>•••</button>
          {menu===item.id?<div className={styles.menu} onClick={(e)=>e.stopPropagation()}><button onClick={()=>{setEditing(item);setMenu("")}}>编辑</button><button onClick={()=>{setEditing(item);setMenu("")}}>添加效果</button><button onClick={()=>cycleColor(item)}>更改颜色</button><button onClick={()=>void duplicate(item)}>复制副本</button><button className={styles.danger} onClick={()=>void remove(item)}>删除</button></div>:null}
        </div><h2>{item.title}</h2><p>{item.description}</p><div className={styles.cardFooter}><div className={styles.tags}>{item.tags.slice(0,2).map((tag)=><span key={tag}>{tag}</span>)}</div><div className={styles.meta}>{relativeDate(item.updated_at)} · 使用 {item.usage_count} 次</div></div></div>
      </article>)}</section>
      {pageCount>1?<nav className={styles.pagination} aria-label="提示词分页"><button disabled={page===0} onClick={()=>setPage((value)=>Math.max(0,value-1))}>上一页</button><span>{page+1} / {pageCount}</span><button disabled={page>=pageCount-1} onClick={()=>setPage((value)=>Math.min(pageCount-1,value+1))}>下一页</button></nav>:null}
      {!status&&!visible.length?<div className={styles.empty}>没有找到符合条件的提示词。</div>:null}
    </section>
    {detail?<PromptDetail prompt={detail} copied={copied===detail.id} close={()=>setDetail(null)} copy={()=>void copyPrompt(detail)}/>:null}
    {editing!==undefined?<PromptEditor prompt={editing} busy={busy} setBusy={setBusy} close={()=>setEditing(undefined)} saved={async()=>{setEditing(undefined);await load()}}/>:null}
  </main>
}

function PromptDetail({prompt,copied,close,copy}:{prompt:Prompt;copied:boolean;close:()=>void;copy:()=>void}){
  return <div className={styles.backdrop} onMouseDown={(event)=>{if(event.currentTarget===event.target)close()}}><article className={styles.detail} role="dialog" aria-modal="true"><button className={styles.detailClose} onClick={close} aria-label="关闭">×</button>{prompt.image_url?<img src={prompt.image_url} alt={`${prompt.title} 效果预览`}/>:null}<small>{prompt.category}</small><h2>{prompt.title}</h2><p>{prompt.description}</p><pre>{prompt.content}</pre><footer><div className={styles.tags}>{prompt.tags.slice(0,2).map((tag)=><span key={tag}>{tag}</span>)}</div><button onClick={copy}>{copied?"已复制":"复制完整 Prompt"}</button></footer></article></div>
}

function PromptEditor({prompt,busy,setBusy,close,saved}:{prompt:Prompt|null;busy:boolean;setBusy:(value:boolean)=>void;close:()=>void;saved:()=>Promise<void>}){
  const [preview,setPreview]=useState(prompt?.image_url||""),[removeImage,setRemoveImage]=useState(false),[file,setFile]=useState<File|null>(null),[message,setMessage]=useState("");
  const chooseImage=(selected:File|null)=>{if(!selected)return;if(!selected.type.startsWith("image/")){setMessage("请选择图片文件。");return}if(selected.size>20*1024*1024){setMessage("预览图片最大为 20 MB。");return}setFile(selected);setRemoveImage(false);setPreview(URL.createObjectURL(selected));setMessage("")};
  const submit=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const form=event.currentTarget;try{setBusy(true);setMessage(file?"正在上传效果预览图…":"正在保存卡片…");let image:ImageUpload|null|undefined=removeImage?null:undefined;if(file){const uploaded=await uploadFile(file,{kind:"prompt"});image={url:uploaded.url,pathname:uploaded.pathname,name:file.name,size:file.size,storage_provider:"r2",object_key:uploaded.objectKey}}const values=new FormData(form);const payload:Record<string,unknown>={title:values.get("title"),category:values.get("category"),description:values.get("description"),content:values.get("content"),tags:String(values.get("tags")||"").split(/[,，]/).map((item)=>item.trim()).filter(Boolean)};if(image!==undefined)payload.image=image;const response=await fetch(prompt?`/api/prompts/${prompt.id}`:"/api/prompts",{method:prompt?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const result=await response.json();if(!response.ok)throw new Error(result.error||"保存失败");await saved()}catch(error){setMessage(error instanceof Error?error.message:"保存失败")}finally{setBusy(false)}};
  return <div className={styles.backdrop} onMouseDown={(e)=>{if(e.currentTarget===e.target)close()}}><section className={styles.editor} role="dialog" aria-modal="true"><div className={styles.editorHead}><div><p>{prompt?"EDIT PROMPT":"NEW PROMPT"}</p><h2>{prompt?"编辑提示词卡片":"新建提示词卡片"}</h2></div><button onClick={close} aria-label="关闭">×</button></div>
    <form onSubmit={submit}><label><span>标题</span><input name="title" defaultValue={prompt?.title} required maxLength={80}/></label><label><span>分类</span><input name="category" defaultValue={prompt?.category} placeholder="写作 / 视觉 / 研究" maxLength={30}/></label><label className={styles.wide}><span>卡片简介</span><textarea name="description" defaultValue={prompt?.description} rows={2} maxLength={240}/></label><label className={styles.wide}><span>标签（逗号分隔）</span><input name="tags" defaultValue={prompt?.tags.join("，")} placeholder="写作，创意"/></label><label className={styles.wide}><span>完整提示词</span><textarea name="content" defaultValue={prompt?.content} rows={8} required maxLength={20000}/></label>
      <div className={`${styles.imageEditor} ${styles.wide}`}><div>{preview&&!removeImage?<img src={preview} alt="效果图预览"/>:<span>尚未插入效果预览图<br/>无图卡片会自动使用稳定的随机淡色</span>}</div><div className={styles.imageButtons}><label><input type="file" accept="image/*" onChange={(e)=>chooseImage(e.target.files?.[0]||null)}/><span>{preview&&!removeImage?"替换图片":"插入图片"}</span></label>{preview&&!removeImage?<button type="button" onClick={()=>{setRemoveImage(true);setFile(null);setPreview("")}}>删除图片</button>:null}</div></div>
      {message?<div className={`${styles.formMessage} ${styles.wide}`}>{message}</div>:null}<div className={`${styles.formActions} ${styles.wide}`}><button type="button" onClick={close}>取消</button><button className={styles.primary} disabled={busy}>{busy?"正在保存…":"保存卡片"}</button></div>
    </form></section></div>
}
