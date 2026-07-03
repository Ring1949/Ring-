export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getDatabaseMedia } from "@/services/database.service";

export async function GET(request: NextRequest) {
  return NextResponse.json(getDatabaseMedia(request.nextUrl.searchParams.get("category")));
}
