export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { handleArchiveDelete, handleArchiveGet, handleArchivePost, handleArchivePut } from "@/services/archive.service";

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handleArchiveGet(request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handleArchivePost(request, context);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handleArchivePut(request, context);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handleArchiveDelete(request, context);
}
