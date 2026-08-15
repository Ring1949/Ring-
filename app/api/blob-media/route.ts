export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_MEDIA_MAX_BYTES,
  getBlobMediaRecords,
  MEDIA_FILE_PREFIX,
  saveBlobMediaRecords,
  storageErrorMessage,
  verifyUploadedObject,
  type BlobMediaRecord
} from "@/lib/blob-library";
import { basePortfolioCategories, basePortfolioProjects } from "@/lib/portfolio-state";
import { requireAdmin } from "@/lib/utils";

function mediaType(contentType: string) {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  return "file";
}

function fileType(name: string) {
  const part = name.split("?")[0].split(".").pop();
  return part && part !== name ? part.toLocaleLowerCase("en-US") : "file";
}

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  return NextResponse.json(await getBlobMediaRecords(), { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const files = Array.isArray(body.files) ? body.files : [];
    if (!files.length) return NextResponse.json({ error: "请选择需要上传的文件。" }, { status: 400 });
    const maximumSize = Number(process.env.MEDIA_FILE_MAX_BYTES) || DEFAULT_MEDIA_MAX_BYTES;
    const categories = basePortfolioCategories();
    const requestedCategory = categories.find((item: any) => String(item.id) === String(body.category_id));
    const category = requestedCategory || categories.find((item: any) => item.slug === "photo") || null;
    const project = basePortfolioProjects().find((item: any) => String(item.id) === String(body.project_id)) || null;
    const verified = await Promise.all(files.map((file: any) => verifyUploadedObject({
      url: String(file.url || ""),
      pathname: String(file.pathname || ""),
      expectedSize: Number(file.size) || 0,
      prefix: MEDIA_FILE_PREFIX,
      maximumSize,
      storageProvider: String(file.storageProvider || file.storage_provider || file.provider || "")
    })));
    const timestamp = new Date().toISOString();
    const existing = await getBlobMediaRecords();
    const created: BlobMediaRecord[] = verified.map((metadata, index) => {
      const source = files[index];
      const originalName = String(source.original_name || metadata.pathname.split("/").pop() || "media-file");
      const title = String(body.title || "").trim() || originalName.replace(/\.[^.]+$/, "");
      return {
        id: `blob-${crypto.randomUUID()}`,
        title: files.length > 1 && body.title ? `${title} ${String(index + 1).padStart(2, "0")}` : title,
        description: String(body.description || "").trim(),
        file_path: metadata.url,
        download_url: metadata.downloadUrl,
        storage_path: metadata.pathname,
        object_key: metadata.pathname,
        storage_provider: metadata.provider,
        thumbnail_url: String(source.thumbnailUrl || source.thumbnail_url || ""),
        width: Number(source.width) || 0,
        height: Number(source.height) || 0,
        original_name: originalName,
        file_type: fileType(originalName),
        mime_type: metadata.contentType || String(source.content_type || "application/octet-stream"),
        size: metadata.size,
        media_type: mediaType(metadata.contentType || String(source.content_type || "")),
        tags: String(body.tags || "").trim(),
        camera: String(body.camera || "").trim(),
        lens: String(body.lens || "").trim(),
        aperture: String(body.aperture || "").trim(),
        shutter_speed: String(body.shutter_speed || "").trim(),
        iso: String(body.iso || "").trim(),
        captured_at: String(body.captured_at || "").trim(),
        category_id: category ? Number(category.id) : null,
        category_name: category?.name || "未分类",
        category_slug: category?.slug || "other",
        project_id: project ? Number(project.id) : null,
        project_title: project?.title || "",
        project_slug: project?.slug || "",
        is_hero: body.is_hero ? 1 : 0,
        is_selected: body.is_selected ? 1 : 0,
        is_cover: body.is_cover ? 1 : 0,
        show_in_database: body.show_in_database === false ? 0 : 1,
        sort_order: Date.now() + index,
        created_at: timestamp,
        updated_at: timestamp
      };
    });
    await saveBlobMediaRecords([...created, ...existing]);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: storageErrorMessage(error, "作品上传记录保存失败") }, { status: 500 });
  }
}
