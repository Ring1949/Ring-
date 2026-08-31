export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSettings, setSettings } from "@/lib/db";
import { normalizeWorkFilters, parseWorkFilters } from "@/lib/work-filters";
import { requireAdmin } from "@/lib/utils";

const SETTINGS_KEY = "works_filter_config";

export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json(parseWorkFilters(settings[SETTINGS_KEY]));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "筛选分类读取失败" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const config = normalizeWorkFilters(await request.json());
    await setSettings({ [SETTINGS_KEY]: JSON.stringify(config) });
    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "筛选分类保存失败" }, { status: 400 });
  }
}
