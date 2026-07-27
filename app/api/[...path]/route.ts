export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { handleArchiveDelete, handleArchiveGet, handleArchivePost, handleArchivePut } from "@/services/archive.service";
import {
  getRecoveredCategories,
  getRecoveredHomePayload,
  getRecoveredInspirationConfig,
  getRecoveredMedia,
  getRecoveredProjects,
  getRecoveredSettings,
  getRecoveredTags
} from "@/lib/recovered-data";

type ArchiveContext = { params: Promise<{ path: string[] }> };

function flag(value: unknown) {
  return value === true || value === 1 ? 1 : 0;
}

async function recoveredGet(request: NextRequest, context: ArchiveContext) {
  const { path } = await context.params;
  const route = path.join("/");
  const search = request.nextUrl.searchParams;

  if (route === "me") return NextResponse.json({ authenticated: false });
  if (route === "settings") return NextResponse.json(getRecoveredSettings());
  if (route === "inspiration-config") return NextResponse.json(getRecoveredInspirationConfig());
  if (route === "categories") return NextResponse.json(getRecoveredCategories());
  if (route === "tags") return NextResponse.json(getRecoveredTags());
  if (route === "projects") {
    let projects = getRecoveredProjects();
    if (search.get("series") === "true") projects = projects.filter((item: any) => flag(item.is_series));
    if (search.get("recommended") === "true") projects = projects.filter((item: any) => flag(item.is_recommended));
    return NextResponse.json(projects);
  }
  if (route.startsWith("projects/")) {
    const id = Number(path[1]);
    const project = getRecoveredProjects().find((item: any) => Number(item.id) === id || item.slug === path[1]);
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      ...project,
      media: getRecoveredMedia().filter((item: any) => Number(item.project_id) === Number(project.id)),
      tags: []
    });
  }
  if (route === "media") {
    let media = getRecoveredMedia();
    const projectId = search.get("project_id");
    const categoryId = search.get("category_id");
    if (projectId) media = media.filter((item: any) => Number(item.project_id) === Number(projectId));
    if (categoryId) media = media.filter((item: any) => Number(item.category_id) === Number(categoryId));
    return NextResponse.json(media);
  }
  if (route === "home") return NextResponse.json(getRecoveredHomePayload());
  return NextResponse.json({ error: "Recovered fallback route not found" }, { status: 404 });
}

async function runArchiveRequest(
  method: "GET" | "POST" | "PUT" | "DELETE",
  request: NextRequest,
  context: ArchiveContext
) {
  const startedAt = Date.now();
  try {
    const handler = method === "GET" ? handleArchiveGet : method === "POST" ? handleArchivePost : method === "PUT" ? handleArchivePut : handleArchiveDelete;
    const response = await handler(request, context);
    if (method === "GET") {
      const { path } = await context.params;
      const route = path.join("/");
      if (["projects", "media", "categories", "tags"].includes(route)) {
        const body = await response.clone().text();
        if (body.trim() === "[]" || body.trim() === "{}" || body.trim() === "") return recoveredGet(request, context);
      }
    }
    if (method !== "GET") console.info("[archive] completed", { method, path: request.nextUrl.pathname, status: response.status, duration_ms: Date.now() - startedAt });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    console.error("[archive] failed", { method, path: request.nextUrl.pathname, duration_ms: Date.now() - startedAt, error: message });
    if (method === "GET") return recoveredGet(request, context);
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

