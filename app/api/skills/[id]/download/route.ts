export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSkillManifest } from "@/lib/blob-library";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const manifest = await getSkillManifest();
    const record = manifest.skills.find((item) => item.id === id && item.storage_state === "verified");
    if (!record) return NextResponse.json({ error: "Skill 文件不存在。" }, { status: 404 });
    return NextResponse.redirect(record.download_url || record.url, {
      status: 307,
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "下载失败" }, { status: 503 });
  }
}
