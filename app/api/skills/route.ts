export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_SKILL_MAX_BYTES,
  getSkillManifest,
  saveSkillManifest,
  slugifyLabel,
  SKILL_FILE_PREFIX,
  storageErrorMessage,
  verifyUploadedObject
} from "@/lib/blob-library";
import { requireAdmin } from "@/lib/utils";

function publicSkill(item: any) {
  const { url: _url, download_url: _downloadUrl, pathname: _pathname, ...safe } = item;
  return { ...safe, download_path: `/api/skills/${item.id}/download` };
}

export async function GET() {
  try {
    const manifest = await getSkillManifest();
    return NextResponse.json({
      version: manifest.version,
      updated_at: manifest.updated_at,
      categories: manifest.categories,
      skills: manifest.skills.map(publicSkill)
    }, { headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "CDN-Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store"
    } });
  } catch (error) {
    return NextResponse.json({ error: storageErrorMessage(error, "Skill 库读取失败") }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const categoryName = String(body.category_name || "其他").trim() || "其他";
    if (!name) return NextResponse.json({ error: "请填写 Skill 名称。" }, { status: 400 });
    const size = Number(body.size) || 0;
    const maximumSize = Number(process.env.SKILL_FILE_MAX_BYTES) || DEFAULT_SKILL_MAX_BYTES;
    const metadata = await verifyUploadedObject({
      url: String(body.url || ""),
      pathname: String(body.pathname || ""),
      expectedSize: size,
      prefix: SKILL_FILE_PREFIX,
      maximumSize,
      storageProvider: String(body.storage_provider || body.storageProvider || body.provider || "")
    });
    const manifest = await getSkillManifest();
    const categorySlug = slugifyLabel(categoryName, "other");
    let category = manifest.categories.find((item) => item.slug === categorySlug);
    if (!category) {
      category = {
        id: crypto.randomUUID(),
        name: categoryName,
        slug: categorySlug,
        description: "后台自定义 Skill 分类。",
        sort_order: manifest.categories.length * 10 + 10
      };
      manifest.categories.push(category);
    }
    const timestamp = new Date().toISOString();
    const id = crypto.randomUUID();
    const record = {
      id,
      name,
      slug: `${slugifyLabel(name, "skill")}-${id.slice(0, 8)}`,
      category_id: category.id,
      category_name: category.name,
      category_slug: category.slug,
      description: String(body.description || "").trim(),
      original_name: String(body.original_name || metadata.pathname.split("/").pop() || "skill-file"),
      pathname: metadata.pathname,
      url: metadata.url,
      download_url: metadata.downloadUrl,
      size: metadata.size,
      content_type: metadata.contentType || String(body.content_type || "application/octet-stream"),
      version: 1,
      storage_state: "verified" as const,
      created_at: timestamp,
      updated_at: timestamp,
      last_verified_at: timestamp,
      storage_provider: metadata.provider,
      object_key: metadata.pathname
    };
    manifest.skills.unshift(record);
    const saved = await saveSkillManifest(manifest);
    return NextResponse.json({ ...publicSkill(record), manifest_version: saved.version }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: storageErrorMessage(error, "Skill 保存失败") }, { status: 500 });
  }
}
