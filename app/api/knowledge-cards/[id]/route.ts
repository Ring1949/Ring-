export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getKnowledgeManifest, removeKnowledgeImage, saveKnowledgeManifest, verifyKnowledgeImage } from "@/lib/knowledge-library";
import { requireAdmin } from "@/lib/utils";

const text = (value: unknown, max: number) => String(value || "").trim().slice(0, max);
const tags = (value: unknown) => [...new Set((Array.isArray(value) ? value : []).map((item) => text(item, 24)).filter(Boolean))].slice(0, 16);

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const body = await request.json();
    const manifest = await getKnowledgeManifest();
    const previous = manifest.cards.find((card) => card.id === id);
    if (!previous) return NextResponse.json({ error: "知识卡片不存在。" }, { status: 404 });
    const title = text(body.title, 100), content = text(body.content, 30000);
    if (!title || !content) return NextResponse.json({ error: "标题和知识正文不能为空。" }, { status: 400 });
    if (body.image && body.image.pathname !== previous.image_pathname) await verifyKnowledgeImage(body.image);
    const image = body.image === undefined ? { url: previous.image_url, pathname: previous.image_pathname, name: previous.image_name, storage_provider: previous.storage_provider, object_key: previous.object_key }
      : body.image || { url: "", pathname: "", name: "", storage_provider: undefined, object_key: undefined };
    const updated = {
      ...previous, title, content,
      summary: text(body.summary, 300), source_url: text(body.source_url, 2000), tags: tags(body.tags),
      image_url: text(image.url, 2000), image_pathname: text(image.pathname, 1000), image_name: text(image.name, 240),
      storage_provider: image.storage_provider === "r2" ? "r2" as const : undefined,
      object_key: text(image.object_key, 1000) || undefined,
      updated_at: new Date().toISOString()
    };
    await saveKnowledgeManifest({ ...manifest, cards: manifest.cards.map((card) => card.id === id ? updated : card) });
    if (previous.image_url && previous.image_url !== updated.image_url) await removeKnowledgeImage(previous).catch(() => undefined);
    return NextResponse.json({ card: updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "知识卡片修改失败" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const manifest = await getKnowledgeManifest();
    const previous = manifest.cards.find((card) => card.id === id);
    if (!previous) return NextResponse.json({ error: "知识卡片不存在。" }, { status: 404 });
    await saveKnowledgeManifest({ ...manifest, cards: manifest.cards.filter((card) => card.id !== id) });
    if (previous.image_url) await removeKnowledgeImage(previous).catch(() => undefined);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "知识卡片删除失败" }, { status: 400 });
  }
}
