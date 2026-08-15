export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getBlobMediaRecords, removeStoredFile, saveBlobMediaRecords } from "@/lib/blob-library";
import { requireAdmin } from "@/lib/utils";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, context: Context) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const records = await getBlobMediaRecords();
    const record = records.find((item) => item.id === id);
    if (!record) return NextResponse.json({ error: "作品文件不存在或已经被删除。" }, { status: 404 });
    await removeStoredFile({ url: record.file_path, pathname: record.storage_path, storageProvider: record.storage_provider });
    await saveBlobMediaRecords(records.filter((item) => item.id !== id));
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "作品文件删除失败" }, { status: 500 });
  }
}
