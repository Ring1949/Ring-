export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getDatabaseGalleryPage, getDatabaseMedia, getDatabaseMediaDetail } from "@/services/database.service";

const galleryCache = "public, s-maxage=300, stale-while-revalidate=3600";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const view = search.get("view");

  if (view === "detail") {
    const item = await getDatabaseMediaDetail(search.get("id") || "");
    return NextResponse.json(item || { error: "作品不存在或已被移除。" }, {
      status: item ? 200 : 404,
      headers: { "Cache-Control": galleryCache }
    });
  }

  if (view === "gallery") {
    const payload = await getDatabaseGalleryPage({
      category: search.get("category"),
      cursor: search.get("cursor"),
      limit: Number(search.get("limit") || 24),
      filter: search.get("filter"),
      query: search.get("q")
    });
    return NextResponse.json(payload, { headers: { "Cache-Control": galleryCache } });
  }

  // Preserve the original array response for existing admin and legacy clients.
  return NextResponse.json(await getDatabaseMedia(
    search.get("category"),
    Number(search.get("page") || 0),
    Number(search.get("limit") || 500)
  ));
}
