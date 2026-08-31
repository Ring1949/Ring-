export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getKnowledgeManifest, saveKnowledgeManifest, verifyKnowledgeImage, type KnowledgeRecord } from "@/lib/knowledge-library";
import { requireAdmin } from "@/lib/utils";

const text = (value: unknown, max: number) => String(value || "").trim().slice(0, max);
const tags = (value: unknown) => [...new Set((Array.isArray(value) ? value : []).map((item) => text(item, 24)).filter(Boolean))].slice(0, 16);

export async function GET() {
  try { return NextResponse.json(await getKnowledgeManifest()); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "知识库读取失败" }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const title = text(body.title, 100);
    const content = text(body.content, 30000);
    if (!title || !content) return NextResponse.json({ error: "标题和知识正文不能为空。" }, { status: 400 });
    if (body.image) await verifyKnowledgeImage(body.image);
    const now = new Date().toISOString();
    const record: KnowledgeRecord = {
      id: crypto.randomUUID(), title, content,
      summary: text(body.summary, 300), source_url: text(body.source_url, 2000), tags: tags(body.tags),
      image_url: text(body.image?.url, 2000), image_pathname: text(body.image?.pathname, 1000), image_name: text(body.image?.name, 240),
      storage_provider: body.image ? "r2" : undefined, object_key: text(body.image?.object_key, 1000) || undefined,
      created_at: now, updated_at: now
    };
    const manifest = await getKnowledgeManifest();
    const saved = await saveKnowledgeManifest({ ...manifest, cards: [record, ...manifest.cards] });
    return NextResponse.json({ card: record, version: saved.version }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "知识卡片保存失败" }, { status: 400 });
  }
}
