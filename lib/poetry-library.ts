import { get, head, list, put } from "@vercel/blob";

export const POETRY_IMAGE_PREFIX = "poetry-library/images/";
const POETRY_MANIFEST_PREFIX = "site-state/v1/poetry-library/";
export const POETRY_IMAGE_MAX_BYTES = 20 * 1024 * 1024;

export type PoetryCardRecord = { id:string; title:string; author:string; image_url:string; image_pathname:string; image_name:string; created_at:string; updated_at:string };
type PoetryManifest = { version:number; updated_at:string; cards:PoetryCardRecord[] };
const empty=():PoetryManifest=>({version:1,updated_at:new Date(0).toISOString(),cards:[]});
function token(){const value=process.env.BLOB_READ_WRITE_TOKEN;if(!value)throw new Error("网站尚未连接 Vercel Blob 持久存储。");return value}

export async function getPoetryManifest():Promise<PoetryManifest>{
  if(!process.env.BLOB_READ_WRITE_TOKEN)return empty();
  const result=await list({prefix:POETRY_MANIFEST_PREFIX,limit:1000,token:token()});
  const latest=result.blobs.filter((item)=>item.pathname.endsWith(".json")).sort((a,b)=>+new Date(b.uploadedAt)-+new Date(a.uploadedAt))[0];
  if(!latest)return empty();
  const response=await get(latest.url,{access:"public",token:token()});
  if(!response||response.statusCode!==200||!response.stream)return empty();
  const payload=JSON.parse(await new Response(response.stream).text()) as Partial<PoetryManifest>;
  return {version:Number(payload.version)||1,updated_at:String(payload.updated_at||new Date(0).toISOString()),cards:Array.isArray(payload.cards)?payload.cards:[]};
}

export async function savePoetryManifest(manifest:PoetryManifest){
  const next={...manifest,version:manifest.version+1,updated_at:new Date().toISOString()};
  await put(`${POETRY_MANIFEST_PREFIX}${Date.now()}-${crypto.randomUUID()}.json`,JSON.stringify(next,null,2),{access:"public",addRandomSuffix:false,contentType:"application/json; charset=utf-8",cacheControlMaxAge:60,token:token()});
  return next;
}

export async function verifyPoetryImage(image:{url:string;pathname:string;size:number}){
  if(!image.pathname.startsWith(POETRY_IMAGE_PREFIX))throw new Error("图片路径不属于诗词卡片库。");
  if(image.size<=0||image.size>POETRY_IMAGE_MAX_BYTES)throw new Error("封面图片最大为 20 MB。");
  const metadata=await head(image.url,{token:token()});
  if(metadata.pathname!==image.pathname||Number(metadata.size)!==Number(image.size))throw new Error("封面上传校验失败，请重新选择图片。");
  if(!String(metadata.contentType||"").startsWith("image/"))throw new Error("只能上传图片文件。");
}
