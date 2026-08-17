"use client";

import Link from "next/link";
import { FormEvent,useEffect,useMemo,useRef,useState } from "react";
import { CoverflowCarousel,type CoverflowSlide } from "@/components/ui/coverflow-carousel";
import { uploadFile } from "@/lib/storage-client";
import styles from "./poetry-library.module.css";
import overlay from "./poetry-overlays.module.css";

type Poem={id:string;dynasty:string;author:string;title:string;lines:string[];theme:string;appreciation:string;image?:string};
type SavedCard={id:string;title:string;author:string;content?:string;position_x?:number;position_y?:number;image_url:string;image_pathname:string;image_name:string};
type CardView={id:string;title:string;author:string;src:string;lines:string[];position:string};
const poems:Poem[]=[
  {id:"jing-ye-si",dynasty:"唐",author:"李白",title:"静夜思",lines:["床前明月光，疑是地上霜。","举头望明月，低头思故乡。"],theme:"思乡 · 明月",appreciation:"诗从眼前月光写起，把清冷的视觉感受转成思乡之情。"},
  {id:"shan-ju-qiu-ming",dynasty:"唐",author:"王维",title:"山居秋暝",lines:["空山新雨后，天气晚来秋。","明月松间照，清泉石上流。"],theme:"山水 · 秋夜",appreciation:"雨后空山、松间月光和石上清泉组成澄澈而有声息的画面。"},
  {id:"chun-wang",dynasty:"唐",author:"杜甫",title:"春望",lines:["国破山河在，城春草木深。","感时花溅泪，恨别鸟惊心。"],theme:"家国 · 春日",appreciation:"个人悲愁和时代创伤紧密交织。"},
  {id:"qian-tang-hu",dynasty:"唐",author:"白居易",title:"钱塘湖春行",lines:["几处早莺争暖树，谁家新燕啄春泥。","乱花渐欲迷人眼，浅草才能没马蹄。"],theme:"春景 · 西湖",appreciation:"细小而准确的物候变化，写出初春逐渐苏醒的活力。"},
  {id:"shui-diao-ge-tou",dynasty:"宋",author:"苏轼",title:"水调歌头",lines:["人有悲欢离合，月有阴晴圆缺。","但愿人长久，千里共婵娟。"],theme:"明月 · 旷达",appreciation:"以共同仰望的明月建立跨越空间的联系。"},
  {id:"ru-meng-ling",dynasty:"宋",author:"李清照",title:"如梦令",lines:["常记溪亭日暮，沉醉不知归路。","争渡，争渡，惊起一滩鸥鹭。"],theme:"游赏 · 青春",appreciation:"日暮、醉归与鸥鹭惊飞构成鲜明镜头。"},
  {id:"qing-yu-an",dynasty:"宋",author:"辛弃疾",title:"青玉案·元夕",lines:["众里寻他千百度。","蓦然回首，那人却在，灯火阑珊处。"],theme:"元夕 · 寻觅",appreciation:"长久寻觅后的突然发现，使结尾充满戏剧性。"},
  {id:"tian-jing-sha",dynasty:"元",author:"马致远",title:"天净沙·秋思",lines:["枯藤老树昏鸦，小桥流水人家，古道西风瘦马。","夕阳西下，断肠人在天涯。"],theme:"羁旅 · 秋暮",appreciation:"一连串意象凝缩出深沉的羁旅愁绪。"}
];
const tones=["#e7efd7","#f5e8dc","#dce9e6","#efe7d5","#e4e7f2","#f2e1e0","#e1ecdf","#ebe5d8"];
function cover(poem:Poem,index:number){const bg=tones[index%tones.length],title=poem.title.replace(/[&<>]/g,""),line=poem.lines[0].replace(/[&<>]/g,"");const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" rx="50" fill="${bg}"/><circle cx="640" cy="130" r="170" fill="#fff" opacity=".34"/><path d="M80 610 Q220 390 360 610 T720 610 V800 H80Z" fill="#667d5d" opacity=".2"/><text x="70" y="90" fill="#52604d" font-family="serif" font-size="23" letter-spacing="5">${poem.dynasty} · ${poem.author}</text><text x="70" y="230" fill="#1e2b1e" font-family="serif" font-weight="700" font-size="68">${title}</text><text x="70" y="320" fill="#536051" font-family="serif" font-size="27">${line.slice(0,18)}</text><text x="70" y="690" fill="#536051" font-family="serif" font-size="21">${poem.theme}</text></svg>`;return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}

export function PoetryLibraryClient(){
  const [saved,setSaved]=useState<SavedCard[]>([]),[selected,setSelected]=useState<CardView|null>(null),[editing,setEditing]=useState(false),[notice,setNotice]=useState("");const fileRef=useRef<HTMLInputElement>(null);
  const load=async()=>{const response=await fetch("/api/poetry-cards",{cache:"no-store"}),payload=await response.json();if(!response.ok)throw new Error(payload.error||"卡片读取失败");setSaved(payload.cards||[])};
  useEffect(()=>{load().catch((error)=>setNotice(error.message))},[]);
  const cards=useMemo<CardView[]>(()=>[...poems.map((poem,index)=>({id:poem.id,title:poem.title,author:`${poem.dynasty} · ${poem.author}`,src:poem.image||cover(poem,index),lines:poem.lines,position:"50% 50%"})),...saved.map((card)=>({id:card.id,title:card.title,author:card.author,src:card.image_url,lines:String(card.content||"").split(/\r?\n/).map((line)=>line.trim()).filter(Boolean),position:`${card.position_x??50}% ${card.position_y??50}%`}))],[saved]);
  const slides=useMemo<CoverflowSlide[]>(()=>cards.map((card)=>({src:card.src,alt:`${card.title}封面`,title:card.title,subtitle:card.author,objectPosition:card.position})),[cards]);
  return <main className={styles.page} style={{position:"fixed",inset:0}}>
    <Link className={styles.homeLogo} href="/" aria-label="返回 Ring 网站首页" title="返回首页"/>
    <section className={styles.carousel} style={{maxWidth:"none",paddingLeft:0,paddingRight:0}}><button className={styles.add} aria-label="添加诗词卡片" title="添加诗词卡片" onClick={()=>setEditing(true)}/>{notice?<div className={styles.notice}>{notice}</div>:null}<CoverflowCarousel slides={slides} cardWidth="clamp(210px, 28vw, 360px)" showNavigation={false} showPagination={false} showCardLabel={false} wheelNavigation onSelect={(index)=>setSelected(cards[index])}/></section>
    {selected?<div className={overlay.lightbox} role="dialog" aria-modal="true" onClick={()=>setSelected(null)}><button aria-label="关闭完整诗句">×</button><article onClick={(event)=>event.stopPropagation()}><img src={selected.src} alt={`${selected.title}完整封面`}/><section><span>{selected.author}</span><h2>{selected.title}</h2><div className={overlay.verses}>{selected.lines.length?selected.lines.map((line,index)=><p key={`${line}-${index}`}>{line}</p>):<p>这张旧卡片尚未录入完整诗句。</p>}</div></section></article></div>:null}
    {editing?<CardEditor close={()=>setEditing(false)} saved={async()=>{setEditing(false);setNotice("");await load()}} fileRef={fileRef}/>:null}
  </main>
}

function CardEditor({close,saved,fileRef}:{close:()=>void;saved:()=>Promise<void>;fileRef:React.RefObject<HTMLInputElement|null>}){
  const [file,setFile]=useState<File|null>(null),[preview,setPreview]=useState(""),[position,setPosition]=useState({x:50,y:50}),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const dragRef=useRef<{x:number;y:number;startX:number;startY:number}|null>(null);
  const choose=(value:File|null)=>{if(!value)return;if(!value.type.startsWith("image/")){setMessage("请选择图片文件。");return}if(value.size>20*1024*1024){setMessage("封面图片最大为 20 MB。");return}setFile(value);setPreview(URL.createObjectURL(value));setPosition({x:50,y:50});setMessage("")};
  const pointerDown=(event:React.PointerEvent<HTMLDivElement>)=>{if(!preview)return;event.currentTarget.setPointerCapture(event.pointerId);dragRef.current={x:event.clientX,y:event.clientY,startX:position.x,startY:position.y}};
  const pointerMove=(event:React.PointerEvent<HTMLDivElement>)=>{const drag=dragRef.current;if(!drag)return;const rect=event.currentTarget.getBoundingClientRect();setPosition({x:Math.max(0,Math.min(100,drag.startX-(event.clientX-drag.x)/rect.width*100)),y:Math.max(0,Math.min(100,drag.startY-(event.clientY-drag.y)/rect.height*100))})};
  const pointerEnd=()=>{dragRef.current=null};
  const submit=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const form=event.currentTarget;if(!file){setMessage("请选择封面图片。");return}try{setBusy(true);setMessage("正在上传封面…");const uploaded=await uploadFile(file,{kind:"poetry"});const values=new FormData(form),response=await fetch("/api/poetry-cards",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:values.get("title"),author:values.get("author"),content:values.get("content"),position_x:position.x,position_y:position.y,image:{url:uploaded.url,pathname:uploaded.pathname,name:file.name,size:file.size,storage_provider:"r2",object_key:uploaded.objectKey}})}),payload=await response.json();if(!response.ok)throw new Error(payload.error||"保存失败");await saved()}catch(error){setMessage(error instanceof Error?error.message:"保存失败")}finally{setBusy(false)}};
  return <div className={overlay.editorBackdrop} onMouseDown={(event)=>{if(event.currentTarget===event.target)close()}}><section className={overlay.editor} role="dialog" aria-modal="true"><header><div><small>NEW CARD</small><h2>添加诗词卡片</h2></div><button onClick={close} aria-label="关闭">×</button></header><form onSubmit={submit}><div className={overlay.coverColumn}><div className={overlay.coverPicker} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd}>{preview?<><img src={preview} alt="封面预览" draggable={false} style={{objectPosition:`${position.x}% ${position.y}%`}}/><span className={overlay.dragHint}>拖动图片调整封面位置</span><button type="button" className={overlay.changeCover} onPointerDown={(event)=>event.stopPropagation()} onClick={()=>fileRef.current?.click()}>更换图片</button></>:<button type="button" className={overlay.pickCover} onClick={()=>fileRef.current?.click()}><b>＋</b><small>选择封面图片</small></button>}</div>{preview?<div className={overlay.positionControls}><label><span>左右</span><input aria-label="调整封面左右位置" type="range" min="0" max="100" value={position.x} onInput={(event)=>setPosition((current)=>({...current,x:Number(event.currentTarget.value)}))}/></label><label><span>上下</span><input aria-label="调整封面上下位置" type="range" min="0" max="100" value={position.y} onInput={(event)=>setPosition((current)=>({...current,y:Number(event.currentTarget.value)}))}/></label></div>:null}</div><input ref={fileRef} type="file" accept="image/*" hidden onChange={(event)=>choose(event.target.files?.[0]||null)}/><label><span>底部文字</span><input name="title" required maxLength={80} placeholder="例如：春江花月夜"/></label><label><span>作者</span><input name="author" required maxLength={80} placeholder="例如：唐 · 张若虚"/></label><label><span>完整诗句</span><textarea name="content" required maxLength={4000} rows={7} placeholder={'每行输入一句，例如：\n春江潮水连海平，\n海上明月共潮生。'}/></label>{message?<p>{message}</p>:null}<div className={overlay.editorActions}><button type="button" onClick={close}>取消</button><button disabled={busy}>{busy?"正在保存…":"保存卡片"}</button></div></form></section></div>
}
