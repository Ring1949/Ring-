import { get, list } from "@vercel/blob";
import { r2Configured, readLatestR2Json, verifyR2Object, writeR2Json } from "@/lib/r2";

export const POETRY_IMAGE_PREFIX = "poetry-library/images/";
const POETRY_MANIFEST_PREFIX = "site-state/v1/poetry-library/";
export const POETRY_IMAGE_MAX_BYTES = 20 * 1024 * 1024;

export type PoetryCardRecord = { id:string; title:string; author:string; image_url:string; image_pathname:string; image_name:string; storage_provider?:"r2"|"vercel-blob"; object_key?:string; created_at:string; updated_at:string };
type PoetryManifest = { version:number; updated_at:string; cards:PoetryCardRecord[] };
const empty=():PoetryManifest=>({version:1,updated_at:new Date(0).toISOString(),cards:[]});
function token(){const value=process.env.BLOB_READ_WRITE_TOKEN;if(!value)throw new Error("网站尚未连接 Vercel Blob 持久存储。");return value}

export async function getPoetryManifest():Promise<PoetryManifest>{
  if(r2Configured()){const current=await readLatestR2Json<PoetryManifest>(POETRY_MANIFEST_PREFIX).catch(()=>null);if(current)return current;}
  if(!process.env.BLOB_READ_WRITE_TOKEN)return empty();
  try{const result=await list({prefix:POETRY_MANIFEST_PREFIX,limit:1000,token:token()});const latest=result.blobs.filter((item)=>item.pathname.endsWith(".json")).sort((a,b)=>+new Date(b.uploadedAt)-+new Date(a.uploadedAt))[0];if(!latest)return empty();const response=await get(latest.url,{access:"public",token:token()});if(!response||response.statusCode!==200||!response.stream)return empty();const payload=JSON.parse(await new Response(response.stream).text()) as Partial<PoetryManifest>;return {version:Number(payload.version)||1,updated_at:String(payload.updated_at||new Date(0).toISOString()),cards:Array.isArray(payload.cards)?payload.cards:[]};}catch{return empty();}
}

export async function savePoetryManifest(manifest:PoetryManifest){
  const next={...manifest,version:manifest.version+1,updated_at:new Date().toISOString()};
  if(!r2Configured())throw new Error("Cloudflare R2 未配置，新内容无法保存。");
  await writeR2Json(POETRY_MANIFEST_PREFIX,next);
  return next;
}

export async function verifyPoetryImage(image:{url:string;pathname:string;object_key?:string;storage_provider?:string;size:number}){
  const objectKey=image.object_key||image.pathname;
  if(image.storage_provider!=="r2"||!objectKey.startsWith(POETRY_IMAGE_PREFIX))throw new Error("新图片必须上传到 Cloudflare R2。");
  if(image.size<=0||image.size>POETRY_IMAGE_MAX_BYTES)throw new Error("封面图片最大为 20 MB。");
  const metadata=await verifyR2Object(objectKey,image.size);
  if(!String(metadata.contentType||"").startsWith("image/"))throw new Error("只能上传图片文件。");
}
