export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getActiveWorkTagFilters } from "@/services/database.service";
import { requireAdmin } from "@/lib/utils";

export async function GET() {
  try {
    return NextResponse.json(await getActiveWorkTagFilters(), {
      headers: { "Cache-Control": "private, no-store, max-age=0" }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "筛选分类读取失败" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  void request;
  return NextResponse.json({ error: "作品库小分类现在由作品标签自动生成，请在“分类与标签”中管理标签。" }, { status: 409 });
}
