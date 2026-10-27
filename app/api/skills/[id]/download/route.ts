export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { getSkillManifest } from "@/lib/blob-library";
import { getR2Object } from "@/lib/r2";

type Context = { params: Promise<{ id: string }> };

function attachmentDisposition(filename: string) {
  const safeName = String(filename || "skill-file").replace(/[\r\n]/g, "");
  const fallback = safeName.replace(/[^A-Za-z0-9._-]/g, "_") || "skill-file";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(safeName)}`;
}

function downloadHeaders(filename: string, contentType: string, contentLength?: number) {
  const headers = new Headers({
    "Content-Type": contentType || "application/octet-stream",
    "Content-Disposition": attachmentDisposition(filename),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff"
  });
  if (contentLength && contentLength > 0) headers.set("Content-Length", String(contentLength));
  return headers;
}

export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const manifest = await getSkillManifest();
    const record = manifest.skills.find((item) => item.id === id && item.storage_state === "verified");
    if (!record) return NextResponse.json({ error: "Skill 文件不存在。" }, { status: 404 });
    if (record.storage_provider === "r2" && record.object_key) {
      const object = await getR2Object(record.object_key);
      const body = object.Body ? Readable.toWeb(object.Body as Readable) as ReadableStream : null;
      if (!body) return NextResponse.json({ error: "Skill 文件内容为空。" }, { status: 404 });
      return new Response(body, {
        headers: downloadHeaders(
          record.original_name,
          object.ContentType || record.content_type || "application/octet-stream",
          Number(object.ContentLength || record.size || 0)
        )
      });
    }
    const target = record.download_url || record.url;
    if (!target) return NextResponse.json({ error: "Skill 下载地址不存在。" }, { status: 404 });
    const upstreamUrl = new URL(target, request.url);
    if (!/^https?:$/.test(upstreamUrl.protocol)) return NextResponse.json({ error: "Skill 下载地址无效。" }, { status: 400 });
    const upstream = await fetch(upstreamUrl, { cache: "no-store" });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: `Skill 文件读取失败 (${upstream.status})` }, { status: 502 });
    }
    return new Response(upstream.body, {
      headers: downloadHeaders(
        record.original_name,
        upstream.headers.get("content-type") || record.content_type || "application/octet-stream",
        Number(upstream.headers.get("content-length") || record.size || 0)
      )
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "下载失败" }, { status: 503 });
  }
}
