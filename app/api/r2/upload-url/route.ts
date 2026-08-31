export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createR2PresignedUpload, r2Configured, type R2UploadKind } from "@/lib/r2";
import { requireAdmin } from "@/lib/utils";

const kinds = new Set<R2UploadKind>(["media", "cover", "graph", "skill", "prompt", "knowledge", "poetry", "thumbnail", "legacy-media"]);

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  if (!r2Configured()) {
    return NextResponse.json({ error: "Cloudflare R2 is not configured. New uploads require R2.", code: "R2_NOT_CONFIGURED" }, { status: 503 });
  }
  try {
    const body = await request.json();
    const kind = String(body.kind || "") as R2UploadKind;
    if (!kinds.has(kind)) return NextResponse.json({ error: "Invalid upload kind" }, { status: 400 });
    return NextResponse.json(await createR2PresignedUpload({
      kind,
      filename: String(body.filename || ""),
      contentType: String(body.contentType || "application/octet-stream"),
      size: Number(body.size) || 0,
      parentKey: String(body.parentKey || ""),
      origin: request.nextUrl.origin
    }), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "R2 upload authorization failed" }, { status: 400 });
  }
}
