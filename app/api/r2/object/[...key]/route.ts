export const runtime = "nodejs";

import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getR2Object, publicR2Url } from "@/lib/r2";

type Context = { params: Promise<{ key: string[] }> };

export async function GET(_request: Request, context: Context) {
  const key = (await context.params).key.join("/");
  const publicUrl = publicR2Url(key);
  if (/^https?:\/\//.test(publicUrl)) return NextResponse.redirect(publicUrl, 307);
  try {
    const object = await getR2Object(key);
    const body = object.Body ? Readable.toWeb(object.Body as Readable) as ReadableStream : null;
    return new Response(body, {
      headers: {
        "Content-Type": object.ContentType || "application/octet-stream",
        "Content-Length": String(object.ContentLength || 0),
        "Cache-Control": object.CacheControl || "public, max-age=31536000, immutable",
        ...(object.ETag ? { ETag: object.ETag } : {})
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.name === "NoSuchKey" ? "Not found" : "R2 read failed" }, { status: error?.name === "NoSuchKey" ? 404 : 502 });
  }
}
