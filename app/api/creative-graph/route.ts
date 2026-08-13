export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { defaultCreativeGraph, upgradeCreativeGraph, validateCreativeGraph } from "@/lib/creative-graph";
import { setSettings } from "@/lib/db";
import { getSupabaseServer } from "@/lib/supabase";
import { requireAdmin } from "@/lib/utils";

const SETTINGS_KEY = "creative_graph_json";

export async function GET() {
  try {
    const { data, error } = await getSupabaseServer().from("settings").select("value").eq("key", SETTINGS_KEY).maybeSingle();
    if (error) throw error;
    const saved = data?.value;
    const graph = saved ? upgradeCreativeGraph(JSON.parse(saved)) : defaultCreativeGraph;
    return NextResponse.json(graph, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch {
    return NextResponse.json(defaultCreativeGraph, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  }
}

export async function PUT(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const graph = validateCreativeGraph(await request.json());
    const next = { ...graph, version: graph.version + 1, updated_at: new Date().toISOString() };
    await setSettings({ [SETTINGS_KEY]: JSON.stringify(next) });
    return NextResponse.json(next, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "图谱保存失败。";
    return NextResponse.json({ error: `图谱保存失败：${message}` }, { status: 500 });
  }
}
