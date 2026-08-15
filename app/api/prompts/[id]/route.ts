export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getPromptManifest, removePromptImage, savePromptManifest, verifyPromptImage } from "@/lib/prompt-library";
import { requireAdmin } from "@/lib/utils";

function text(value: unknown, max: number) { return String(value || "").trim().slice(0, max); }
function tags(value: unknown) { return (Array.isArray(value) ? value : []).map((item) => text(item, 24)).filter(Boolean).slice(0, 8); }

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const body = await request.json();
    const manifest = await getPromptManifest();
    const previous = manifest.prompts.find((item) => item.id === id);
    if (!previous) return NextResponse.json({ error: "提示词卡片不存在。" }, { status: 404 });
    const title = text(body.title, 80);
    const content = text(body.content, 20000);
    if (!title || !content) return NextResponse.json({ error: "标题和完整提示词不能为空。" }, { status: 400 });
    if (body.image && body.image.pathname !== previous.image_pathname) await verifyPromptImage(body.image);
    const image = body.image === undefined ? { url: previous.image_url, pathname: previous.image_pathname, name: previous.image_name, storage_provider: previous.storage_provider, object_key: previous.object_key }
      : body.image || { url: "", pathname: "", name: "", storage_provider: undefined, object_key: undefined };
    const updated = {
      ...previous, title, content,
      category: text(body.category, 30) || "未分类",
      description: text(body.description, 240), tags: tags(body.tags),
      image_url: text(image.url, 2000), image_pathname: text(image.pathname, 1000), image_name: text(image.name, 240),
      storage_provider: image.storage_provider === "r2" ? "r2" as const : previous.storage_provider,
      object_key: text(image.object_key, 1000) || undefined,
      updated_at: new Date().toISOString()
    };
    await savePromptManifest({ ...manifest, prompts: manifest.prompts.map((item) => item.id === id ? updated : item) });
    if (previous.image_url && previous.image_url !== updated.image_url) await removePromptImage(previous).catch(() => undefined);
    return NextResponse.json({ prompt: updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Prompt 修改失败" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const manifest = await getPromptManifest();
    const previous = manifest.prompts.find((item) => item.id === id);
    if (!previous) return NextResponse.json({ error: "提示词卡片不存在。" }, { status: 404 });
    await savePromptManifest({ ...manifest, prompts: manifest.prompts.filter((item) => item.id !== id) });
    if (previous.image_url) await removePromptImage(previous).catch(() => undefined);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Prompt 删除失败" }, { status: 400 });
  }
}
