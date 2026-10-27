export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createR2PresignedRead, publicR2Url } from "@/lib/r2";

type Context = { params: Promise<{ key: string[] }> };

export async function GET(_request: Request, context: Context) {
  const key = (await context.params).key.join("/");
  const publicUrl = publicR2Url(key);
  if (/^https?:\/\//.test(publicUrl)) return NextResponse.redirect(publicUrl, 307);
  try {
    // Never proxy large media through a Vercel function. A fresh signed R2 URL
    // supports range requests and avoids the serverless response-size ceiling.
    return NextResponse.redirect(await createR2PresignedRead(key), 307);
  } catch (error: any) {
    return NextResponse.json({ error: error?.name === "NoSuchKey" ? "Not found" : "R2 read failed" }, { status: error?.name === "NoSuchKey" ? 404 : 502 });
  }
}
