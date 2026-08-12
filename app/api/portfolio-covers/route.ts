export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_MEDIA_MAX_BYTES,
  getPortfolioCoverOverrides,
  MEDIA_FILE_PREFIX,
  savePortfolioCoverOverrides,
  storageErrorMessage,
  verifyUploadedBlob
} from "@/lib/blob-library";
import { basePortfolioCategories, basePortfolioProjects } from "@/lib/portfolio-state";
import { requireAdmin } from "@/lib/utils";

const MAX_COVER_BYTES = 20 * 1024 * 1024;

function findTarget(kind: string, id: string) {
  const items = kind === "category" ? basePortfolioCategories() : kind === "project" ? basePortfolioProjects() : [];
  return items.find((item: any) => String(item.id) === id) || null;
}

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const kind = body.kind === "category" ? "category" : body.kind === "project" ? "project" : "";
    const targetId = String(body.target_id || "").trim();
    if (!kind || !targetId || !findTarget(kind, targetId)) {
      return NextResponse.json({ error: "没有找到要设置封面的作品或分类。" }, { status: 404 });
    }
    const maximumSize = Math.min(Number(process.env.MEDIA_FILE_MAX_BYTES) || DEFAULT_MEDIA_MAX_BYTES, MAX_COVER_BYTES);
    const metadata = await verifyUploadedBlob({
      url: String(body.url || ""),
      pathname: String(body.pathname || ""),
      expectedSize: Number(body.size) || 0,
      prefix: MEDIA_FILE_PREFIX,
      maximumSize
    });
    if (!metadata.contentType?.startsWith("image/")) {
      return NextResponse.json({ error: "封面必须是图片文件。" }, { status: 400 });
    }
    const current = await getPortfolioCoverOverrides();
    const bucket = kind === "category" ? "categories" : "projects";
    const saved = await savePortfolioCoverOverrides({
      ...current,
      [bucket]: { ...current[bucket], [targetId]: metadata.url }
    });
    return NextResponse.json({
      saved: true,
      kind,
      target_id: targetId,
      cover_image: metadata.url,
      version: saved.version,
      updated_at: saved.updated_at
    });
  } catch (error) {
    return NextResponse.json({ error: storageErrorMessage(error, "封面保存失败，请稍后重试。") }, { status: 500 });
  }
}
