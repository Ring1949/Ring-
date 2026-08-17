export const runtime="nodejs";
export const dynamic="force-dynamic";

import { NextRequest,NextResponse } from "next/server";
import { getPoetryManifest,savePoetryManifest,verifyPoetryImage,type PoetryCardRecord } from "@/lib/poetry-library";
import { requireAdmin } from "@/lib/utils";
const text=(value:unknown,max:number)=>String(value||"").trim().slice(0,max);
const coordinate=(value:unknown)=>{const number=Number(value);return Number.isFinite(number)?Math.max(0,Math.min(100,number)):50};

export async function GET(){try{return NextResponse.json(await getPoetryManifest())}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"诗词卡片读取失败"},{status:500})}}
export async function POST(request:NextRequest){
  const denied=requireAdmin(request);if(denied)return denied;
  try{const body=await request.json(),title=text(body.title,80),author=text(body.author,80);if(!title||!author)return NextResponse.json({error:"标题和作者不能为空。"},{status:400});if(!body.image)return NextResponse.json({error:"请选择诗词图片。"},{status:400});await verifyPoetryImage(body.image);const now=new Date().toISOString(),position_x=coordinate(body.position_x),position_y=coordinate(body.position_y);const card:PoetryCardRecord={id:crypto.randomUUID(),title,author,content:"",position_x,position_y,image_url:text(body.image.url,2000),image_pathname:text(body.image.pathname,1000),image_name:text(body.image.name,240),storage_provider:"r2",object_key:text(body.image.object_key,1000),created_at:now,updated_at:now};const manifest=await getPoetryManifest();await savePoetryManifest({...manifest,cards:[...manifest.cards,card]});return NextResponse.json({card},{status:201})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"诗词卡片保存失败"},{status:400})}
}
