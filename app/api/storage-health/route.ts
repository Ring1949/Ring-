export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { checkR2Writable, r2Configured } from "@/lib/r2";
import { isAdmin } from "@/lib/utils";

function isCron(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAdmin(request) && !isCron(request)) {
    return NextResponse.json({ error: "请先登录后台。" }, { status: 401 });
  }
  if (!r2Configured()) {
    return NextResponse.json({
      ok: false,
      configured: false,
      primary_provider: "cloudflare-r2",
      error: "Cloudflare R2 新上传配置不完整。",
      checked_at: new Date().toISOString()
    }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
  try {
    const writeCheck = await checkR2Writable();
    return NextResponse.json({
      ok: writeCheck.writable,
      configured: true,
      primary_provider: "cloudflare-r2",
      write_check: writeCheck,
      checked_at: new Date().toISOString()
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      configured: true,
      primary_provider: "cloudflare-r2",
      error: error instanceof Error ? error.message : "Cloudflare R2 写入检查失败。",
      checked_at: new Date().toISOString()
    }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
