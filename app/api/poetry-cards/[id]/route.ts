export const runtime="nodejs";
export const dynamic="force-dynamic";

import { NextRequest,NextResponse } from "next/server";
import { getPoetryManifest,removePoetryImage,savePoetryManifest } from "@/lib/poetry-library";
import { requireAdmin } from "@/lib/utils";

export async function DELETE(request:NextRequest,context:{params:Promise<{id:string}>}){
  const denied=requireAdmin(request);
  if(denied)return denied;
  try{
    const {id}=await context.params,manifest=await getPoetryManifest();
    const previous=manifest.cards.find((card)=>card.id===id);
    if(!previous)return NextResponse.json({error:"诗词卡片不存在。"},{status:404});
    await savePoetryManifest({...manifest,cards:manifest.cards.filter((card)=>card.id!==id)});
    await removePoetryImage(previous).catch(()=>undefined);
    return NextResponse.json({ok:true});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"诗词卡片删除失败"},{status:400});
  }
}
