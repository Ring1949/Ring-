export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getHomePayload } from "@/services/home.service";

export async function GET() {
  return NextResponse.json(await getHomePayload());
}
