export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSkillManifest } from "@/lib/blob-library";
import { requireAdmin } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const manifest = await getSkillManifest();
  return NextResponse.json(manifest, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="skill-library-${new Date().toISOString().slice(0, 10)}.json"`
    }
  });
}
