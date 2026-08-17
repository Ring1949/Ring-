"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function PoetryLibraryError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const message = `${error.name} ${error.message}`.toLowerCase();
    if (!message.includes("chunk") && !message.includes("loading")) return;
    const key = "poetry-library-recovery";
    if (sessionStorage.getItem(key) === "1") return;
    sessionStorage.setItem(key, "1");
    window.location.reload();
  }, [error]);

  return (
    <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24,background:"#fafaf8",color:"#171918",fontFamily:'ui-sans-serif,system-ui,"Microsoft YaHei",sans-serif'}}>
      <section style={{width:"min(440px,100%)",padding:"34px 32px",border:"1px solid rgba(20,20,20,.08)",borderRadius:24,background:"rgba(255,255,255,.82)",boxShadow:"0 18px 60px rgba(20,20,20,.07)",textAlign:"center"}}>
        <h1 style={{margin:"0 0 12px",fontSize:26}}>诗词页面暂时没有载入</h1>
        <p style={{margin:"0 0 24px",fontSize:14,lineHeight:1.8,color:"rgba(20,20,20,.58)"}}>可能是网站刚刚更新，浏览器仍在使用旧文件。重新载入即可恢复，你已经保存的诗词卡片不会丢失。</p>
        <div style={{display:"flex",justifyContent:"center",gap:10}}>
          <button onClick={()=>{sessionStorage.removeItem("poetry-library-recovery");reset()}} style={{border:0,borderRadius:999,padding:"11px 20px",background:"#1d211e",color:"white",cursor:"pointer"}}>重新载入</button>
          <Link href="/" style={{border:"1px solid rgba(20,20,20,.12)",borderRadius:999,padding:"10px 20px",color:"#1d211e",textDecoration:"none"}}>返回首页</Link>
        </div>
      </section>
    </main>
  );
}
