"use client";

import { useMemo, useRef, useState } from "react";
import { CoverflowCarousel, type CoverflowSlide } from "@/components/ui/coverflow-carousel";
import styles from "./poetry-library.module.css";

type Poem={id:string;dynasty:string;author:string;title:string;lines:string[];theme:string;appreciation:string;image?:string};
const poems:Poem[]=[
  {id:"jing-ye-si",dynasty:"唐",author:"李白",title:"静夜思",lines:["床前明月光，疑是地上霜。","举头望明月，低头思故乡。"],theme:"思乡 · 明月",appreciation:"诗从眼前月光写起，把清冷的视觉感受转成思乡之情。举头与低头两个动作极轻，却完成了从望月到怀乡的情绪转折。"},
  {id:"shan-ju-qiu-ming",dynasty:"唐",author:"王维",title:"山居秋暝",lines:["空山新雨后，天气晚来秋。","明月松间照，清泉石上流。"],theme:"山水 · 秋夜",appreciation:"雨后空山、松间月光和石上清泉组成澄澈而有声息的画面。静与动彼此映照，体现王维诗中常见的清幽禅意。"},
  {id:"chun-wang",dynasty:"唐",author:"杜甫",title:"春望",lines:["国破山河在，城春草木深。","感时花溅泪，恨别鸟惊心。"],theme:"家国 · 春日",appreciation:"春景本应明丽，却因战乱与离别带上沉痛色彩。花与鸟被赋予人的情感，个人悲愁和时代创伤紧密交织。"},
  {id:"qian-tang-hu",dynasty:"唐",author:"白居易",title:"钱塘湖春行",lines:["几处早莺争暖树，谁家新燕啄春泥。","乱花渐欲迷人眼，浅草才能没马蹄。"],theme:"春景 · 西湖",appreciation:"早莺、新燕、乱花和浅草按季节进程展开，诗人用细小而准确的物候变化，写出初春逐渐苏醒的活力。"},
  {id:"shui-diao-ge-tou",dynasty:"宋",author:"苏轼",title:"水调歌头",lines:["人有悲欢离合，月有阴晴圆缺，此事古难全。","但愿人长久，千里共婵娟。"],theme:"明月 · 旷达",appreciation:"词从人生缺憾推向开阔祝愿，不回避离别，却以共同仰望的明月建立跨越空间的联系，因此哀而不伤。"},
  {id:"ru-meng-ling",dynasty:"宋",author:"李清照",title:"如梦令",lines:["常记溪亭日暮，沉醉不知归路。","争渡，争渡，惊起一滩鸥鹭。"],theme:"游赏 · 青春",appreciation:"短短数句具有鲜明的镜头感：日暮、醉归、误入藕花深处，再到鸥鹭惊飞。重复的“争渡”让节奏骤然活泼。"},
  {id:"qing-yu-an",dynasty:"宋",author:"辛弃疾",title:"青玉案·元夕",lines:["众里寻他千百度。","蓦然回首，那人却在，灯火阑珊处。"],theme:"元夕 · 寻觅",appreciation:"极盛的灯火与偏静的“阑珊处”形成反差。长久寻觅后的突然发现，使结尾既有戏剧性，也留下关于孤高与知音的多重解释。"},
  {id:"tian-jing-sha",dynasty:"元",author:"马致远",title:"天净沙·秋思",lines:["枯藤老树昏鸦，小桥流水人家，古道西风瘦马。","夕阳西下，断肠人在天涯。"],theme:"羁旅 · 秋暮",appreciation:"一连串名词意象像剪辑镜头般排列，从枯藤昏鸦到古道瘦马，最终落在天涯游子身上，凝缩出深沉的羁旅愁绪。"}
];
const tones=["#e7efd7","#f5e8dc","#dce9e6","#efe7d5","#e4e7f2","#f2e1e0","#e1ecdf","#ebe5d8"];
function cover(poem:Poem,index:number){const bg=tones[index%tones.length],title=poem.title.replace(/[&<>]/g,""),line=poem.lines[0].replace(/[&<>]/g,"");const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" rx="50" fill="${bg}"/><circle cx="640" cy="130" r="170" fill="#fff" opacity=".34"/><path d="M80 610 Q220 390 360 610 T720 610 V800 H80Z" fill="#667d5d" opacity=".2"/><text x="70" y="90" fill="#52604d" font-family="serif" font-size="23" letter-spacing="5">${poem.dynasty} · ${poem.author}</text><text x="70" y="230" fill="#1e2b1e" font-family="serif" font-weight="700" font-size="68">${title}</text><text x="70" y="320" fill="#536051" font-family="serif" font-size="27">${line.slice(0,18)}</text><text x="70" y="690" fill="#536051" font-family="serif" font-size="21">${poem.theme}</text></svg>`;return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}

export function PoetryLibraryClient(){
  const [selected,setSelected]=useState<Poem|null>(null),[uploads,setUploads]=useState<CoverflowSlide[]>([]),[notice,setNotice]=useState("");const fileRef=useRef<HTMLInputElement>(null);
  const slides=useMemo<CoverflowSlide[]>(()=>[...poems.map((poem,index)=>({src:poem.image||cover(poem,index),alt:`${poem.title}诗词封面`,title:poem.title,subtitle:`${poem.dynasty} · ${poem.author}`,meta:[{label:"主题",value:poem.theme},{label:"作者",value:`${poem.dynasty} · ${poem.author}`}]})),...uploads],[uploads]);
  const addPreview=(file:File|null)=>{if(!file)return;if(!file.type.startsWith("image/")){setNotice("请选择图片文件。");return}const url=URL.createObjectURL(file);setUploads((current)=>[...current,{src:url,alt:file.name,title:"新诗词卡片",subtitle:"图片已载入，等待补充诗词资料",meta:[{label:"图片",value:file.name}]}]);setNotice("图片已加入轮播预览")};
  return <main className={styles.page}>
    <section className={styles.carousel}><button className={styles.add} aria-label="添加诗词卡片" title="添加诗词卡片" onClick={()=>fileRef.current?.click()}><span/></button><input ref={fileRef} type="file" accept="image/*" hidden onChange={(event)=>addPreview(event.target.files?.[0]||null)}/>{notice?<div className={styles.notice}>{notice}</div>:null}<CoverflowCarousel slides={slides} cardWidth="clamp(210px, 28vw, 360px)" showNavigation={false} showPagination={false} wheelNavigation onSelect={(index)=>{if(index<poems.length)setSelected(poems[index])}}/></section>
    {selected?<div className={styles.modal} role="dialog" aria-modal="true" onClick={()=>setSelected(null)}><article onClick={(event)=>event.stopPropagation()}><button className={styles.close} onClick={()=>setSelected(null)} aria-label="关闭">×</button><span>{selected.dynasty} · {selected.author}</span><h2>{selected.title}</h2><div className={styles.verse}>{selected.lines.map((line)=><p key={line}>{line}</p>)}</div><hr/><h3>作品鉴赏</h3><p className={styles.appreciation}>{selected.appreciation}</p><small>{selected.theme}</small></article></div>:null}
  </main>
}
