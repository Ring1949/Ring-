export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { checkBlobWritable, getBlobMediaRecords, getBlobStorageSnapshot, getSkillManifest, storageErrorMessage } from "@/lib/blob-library";
import { isAdmin } from "@/lib/utils";

function isCron(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAdmin(request) && !isCron(request)) {
    return NextResponse.json({ error: "请先登录后台。" }, { status: 401 });
  }
  try {
    const [storage, skills, media] = await Promise.all([
      getBlobStorageSnapshot(),
      getSkillManifest(),
      getBlobMediaRecords()
    ]);
    let writeCheck: { writable: boolean; checked_at: string; error?: string };
    try {
      writeCheck = await checkBlobWritable();
    } catch (error) {
      writeCheck = { writable: false, checked_at: new Date().toISOString(), error: storageErrorMessage(error) };
    }
    return NextResponse.json({
      ok: writeCheck.writable,
      storage,
      write_check: writeCheck,
      error: writeCheck.error,
      skill_count: skills.skills.length,
      skill_manifest_version: skills.version,
      admin_media_count: media.length,
      checked_at: new Date().toISOString()
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[storage-health] persistent storage check failed", error);
    return NextResponse.json({
      ok: false,
      error: storageErrorMessage(error, "持久存储检查失败"),
      checked_at: new Date().toISOString()
    }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
