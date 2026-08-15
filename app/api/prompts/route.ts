export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getPromptManifest, savePromptManifest, verifyPromptImage, type PromptRecord } from "@/lib/prompt-library";
import { requireAdmin } from "@/lib/utils";

function text(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max);
}

function tags(value: unknown) {
  return (Array.isArray(value) ? value : []).map((item) => text(item, 24)).filter(Boolean).slice(0, 8);
}

export async function GET() {
  try {
    return NextResponse.json(await getPromptManifest());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Prompt 库读取失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const title = text(body.title, 80);
    const content = text(body.content, 20000);
    if (!title || !content) return NextResponse.json({ error: "标题和完整提示词不能为空。" }, { status: 400 });
    if (body.image) await verifyPromptImage(body.image);
    const now = new Date().toISOString();
    const record: PromptRecord = {
      id: crypto.randomUUID(), title, content,
      category: text(body.category, 30) || "未分类",
      description: text(body.description, 240), tags: tags(body.tags),
      image_url: text(body.image?.url, 2000), image_pathname: text(body.image?.pathname, 1000), image_name: text(body.image?.name, 240),
      storage_provider: body.image ? "r2" : undefined, object_key: text(body.image?.object_key, 1000) || undefined,
      usage_count: 0, created_at: now, updated_at: now
    };
    const manifest = await getPromptManifest();
    const saved = await savePromptManifest({ ...manifest, prompts: [record, ...manifest.prompts] });
    return NextResponse.json({ prompt: record, version: saved.version }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Prompt 保存失败" }, { status: 400 });
  }
}
