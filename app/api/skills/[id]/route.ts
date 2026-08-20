export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_SKILL_MAX_BYTES,
  getSkillManifest,
  removeStoredFile,
  saveSkillManifest,
  slugifyLabel,
  SKILL_FILE_PREFIX,
  storageErrorMessage,
  verifyUploadedObject
} from "@/lib/blob-library";
import { requireAdmin } from "@/lib/utils";

type Context = { params: Promise<{ id: string }> };
const SKILL_PREVIEW_MAX_BYTES = 20 * 1024 * 1024;

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
    const hasReplacement = Boolean(body.url || body.pathname);
    const replacement = hasReplacement ? await verifyUploadedObject({
      url: String(body.url || ""),
      pathname: String(body.pathname || ""),
      expectedSize: Number(body.size) || 0,
      prefix: SKILL_FILE_PREFIX,
      maximumSize: Number(process.env.SKILL_FILE_MAX_BYTES) || DEFAULT_SKILL_MAX_BYTES,
      storageProvider: String(body.storage_provider || body.storageProvider || body.provider || "")
    }) : null;
    const preview = body.preview && typeof body.preview === "object" ? await verifyUploadedObject({
      url: String(body.preview.url || ""),
      pathname: String(body.preview.pathname || ""),
      expectedSize: Number(body.preview.size) || 0,
      prefix: SKILL_FILE_PREFIX,
      maximumSize: SKILL_PREVIEW_MAX_BYTES,
      storageProvider: String(body.preview.storage_provider || body.preview.storageProvider || body.preview.provider || "")
    }) : null;
    if (preview && !String(preview.contentType || "").startsWith("image/")) {
      return NextResponse.json({ error: "Skill 效果图必须是图片文件。" }, { status: 400 });
    }
    const removePreview = body.preview === null;
    manifest.skills[index] = {
      ...current,
      name: String(body.name || current.name).trim() || current.name,
      invocation: body.invocation === undefined ? (current.invocation || `@${current.name}`) : (String(body.invocation || "").trim().slice(0, 240) || `@${String(body.name || current.name).trim() || current.name}`),
      category_id: category.id,
      category_name: category.name,
      category_slug: category.slug,
      description: body.description === undefined ? current.description : String(body.description || "").trim(),
      ...(replacement ? {
        original_name: String(body.original_name || replacement.pathname.split("/").pop() || "skill-file"),
        pathname: replacement.pathname,
        url: replacement.url,
        download_url: replacement.downloadUrl,
        size: replacement.size,
        content_type: replacement.contentType || String(body.content_type || "application/octet-stream"),
        storage_state: "verified" as const,
        last_verified_at: new Date().toISOString(),
        storage_provider: replacement.provider,
        object_key: replacement.pathname
      } : {}),
      ...(preview ? {
        preview_url: preview.url,
        preview_pathname: preview.pathname,
        preview_name: String(body.preview?.name || preview.pathname.split("/").pop() || "skill-preview"),
        preview_content_type: preview.contentType || "image/*",
        preview_storage_provider: preview.provider,
        preview_object_key: preview.pathname
      } : removePreview ? {
        preview_url: "",
        preview_pathname: "",
        preview_name: "",
        preview_content_type: "",
        preview_storage_provider: undefined,
        preview_object_key: ""
      } : {}),
      version: Number(current.version || 1) + 1,
      updated_at: new Date().toISOString()
    };
    await saveSkillManifest(manifest);
    if (replacement && replacement.pathname !== current.pathname) {
      await removeStoredFile({ url: current.url, pathname: current.pathname, storageProvider: current.storage_provider }).catch(() => undefined);
    }
    if ((preview || removePreview) && current.preview_pathname && current.preview_pathname !== preview?.pathname) {
      await removeStoredFile({ url: current.preview_url, pathname: current.preview_pathname, storageProvider: current.preview_storage_provider }).catch(() => undefined);
    }
    return NextResponse.json({ updated: true, skill: manifest.skills[index] });
  } catch (error) {
    return NextResponse.json({ error: storageErrorMessage(error, "Skill 更新失败") }, { status: 500 });
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
    await removeStoredFile({ url: record.url, pathname: record.pathname, storageProvider: record.storage_provider });
    if (record.preview_pathname) await removeStoredFile({ url: record.preview_url, pathname: record.preview_pathname, storageProvider: record.preview_storage_provider }).catch(() => undefined);
    manifest.skills = manifest.skills.filter((item) => item.id !== id);
    await saveSkillManifest(manifest);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Skill 删除失败" }, { status: 500 });
  }
}
