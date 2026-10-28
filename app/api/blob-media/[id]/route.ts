export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getBlobMediaRecords, removeStoredFile, saveBlobMediaRecords } from "@/lib/blob-library";
import { basePortfolioCategories, basePortfolioProjects } from "@/lib/portfolio-state";
import { requireAdmin } from "@/lib/utils";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: Context) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const body = await request.json();
    const records = await getBlobMediaRecords();
    const index = records.findIndex((item) => item.id === id);
    if (index < 0) return NextResponse.json({ error: "作品文件不存在或已经被删除。" }, { status: 404 });
    const category = basePortfolioCategories().find((item: any) => String(item.id) === String(body.category_id)) || null;
    const project = basePortfolioProjects().find((item: any) => String(item.id) === String(body.project_id)) || null;
    const current = records[index];
    const updated = {
      ...current,
      title: String(body.title ?? current.title).trim() || current.title,
      description: String(body.description ?? current.description ?? "").trim(),
      tags: String(body.tags ?? current.tags ?? "").trim(),
      camera: String(body.camera ?? current.camera ?? "").trim(),
      lens: String(body.lens ?? current.lens ?? "").trim(),
      aperture: String(body.aperture ?? current.aperture ?? "").trim(),
      shutter_speed: String(body.shutter_speed ?? current.shutter_speed ?? "").trim(),
      iso: String(body.iso ?? current.iso ?? "").trim(),
      captured_at: String(body.captured_at ?? current.captured_at ?? "").trim(),
      category_id: category ? Number(category.id) : null,
      category_name: category?.name || "未分类",
      category_slug: category?.slug || "other",
      project_id: project ? Number(project.id) : null,
      project_title: project?.title || "",
      project_slug: project?.slug || "",
      is_selected: body.is_selected ? 1 : 0,
      show_in_database: body.show_in_database === false ? 0 : 1,
      updated_at: new Date().toISOString()
    };
    records[index] = updated;
    await saveBlobMediaRecords(records);
    return NextResponse.json(updated, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "作品资料保存失败" }, { status: 500 });
  }
}

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
