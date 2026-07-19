export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { handleArchiveDelete, handleArchiveGet, handleArchivePost, handleArchivePut } from "@/services/archive.service";

type ArchiveContext = { params: Promise<{ path: string[] }> };

async function runArchiveRequest(
  method: "GET" | "POST" | "PUT" | "DELETE",
  request: NextRequest,
  context: ArchiveContext
) {
  const startedAt = Date.now();
  try {
    const handler = method === "GET" ? handleArchiveGet : method === "POST" ? handleArchivePost : method === "PUT" ? handleArchivePut : handleArchiveDelete;
    const response = await handler(request, context);
    if (method !== "GET") console.info("[archive] completed", { method, path: request.nextUrl.pathname, status: response.status, duration_ms: Date.now() - startedAt });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    console.error("[archive] failed", { method, path: request.nextUrl.pathname, duration_ms: Date.now() - startedAt, error: message });
    return NextResponse.json({ error: `保存失败：${message}` }, { status: 500 });
  }
}

export async function GET(request: NextRequest, context: ArchiveContext) {
  return runArchiveRequest("GET", request, context);
}

export async function POST(request: NextRequest, context: ArchiveContext) {
  return runArchiveRequest("POST", request, context);
}

export async function PUT(request: NextRequest, context: ArchiveContext) {
  return runArchiveRequest("PUT", request, context);
}

export async function DELETE(request: NextRequest, context: ArchiveContext) {
  return runArchiveRequest("DELETE", request, context);
}