export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSkillManifest, removeBlobFile, saveSkillManifest, slugifyLabel } from "@/lib/blob-library";
import { requireAdmin } from "@/lib/utils";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: Context) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const body = await request.json();
    const manifest = await getSkillManifest();
    const index = manifest.skills.findIndex((item) => item.id === id);
    if (index < 0) return NextResponse.json({ error: "Skill 不存在或已经被删除。" }, { status: 404 });
    const categoryName = String(body.category_name || manifest.skills[index].category_name || "其他").trim() || "其他";
    const categorySlug = slugifyLabel(categoryName, "other");
    let category = manifest.categories.find((item) => item.slug === categorySlug);
    if (!category) {
      category = { id: crypto.randomUUID(), name: categoryName, slug: categorySlug, description: "后台自定义 Skill 分类。", sort_order: manifest.categories.length * 10 + 10 };
      manifest.categories.push(category);
    }
    const current = manifest.skills[index];
    manifest.skills[index] = {
      ...current,
      name: String(body.name || current.name).trim() || current.name,
      category_id: category.id,
      category_name: category.name,
      category_slug: category.slug,
      description: body.description === undefined ? current.description : String(body.description || "").trim(),
      version: Number(current.version || 1) + 1,
      updated_at: new Date().toISOString()
    };
    await saveSkillManifest(manifest);
    return NextResponse.json({ updated: true, skill: manifest.skills[index] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Skill 更新失败" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const manifest = await getSkillManifest();
    const record = manifest.skills.find((item) => item.id === id);
    if (!record) return NextResponse.json({ error: "Skill 不存在或已经被删除。" }, { status: 404 });
    await removeBlobFile(record.url);
    manifest.skills = manifest.skills.filter((item) => item.id !== id);
    await saveSkillManifest(manifest);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Skill 删除失败" }, { status: 500 });
  }
}
