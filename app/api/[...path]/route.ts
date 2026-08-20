export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { handleArchiveDelete, handleArchiveGet, handleArchivePost, handleArchivePut } from "@/services/archive.service";
import {
  getRecoveredHomePayload,
  getRecoveredMedia,
  getRecoveredSettings,
  getRecoveredTags
} from "@/lib/recovered-data";
import { getBlobMediaRecords, getPortfolioCoverOverrides, savePortfolioCoverOverrides } from "@/lib/blob-library";
import {
  applyCategoryCoverOverrides,
  applyProjectCoverOverrides,
  basePortfolioCategories,
  basePortfolioProjects
} from "@/lib/portfolio-state";
import { requireAdmin } from "@/lib/utils";

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
  if (route === "categories") {
    const overrides = await getPortfolioCoverOverrides().catch(() => ({ version: 1, updated_at: "", categories: {}, projects: {} }));
    return NextResponse.json(applyCategoryCoverOverrides(basePortfolioCategories(), overrides));
  }
  if (route === "tags") return NextResponse.json(getRecoveredTags());
  if (route === "projects") {
    const overrides = await getPortfolioCoverOverrides().catch(() => ({ version: 1, updated_at: "", categories: {}, projects: {} }));
    let projects = applyProjectCoverOverrides(basePortfolioProjects(), overrides);
    if (search.get("series") === "true") projects = projects.filter((item: any) => flag(item.is_series));
    if (search.get("recommended") === "true") projects = projects.filter((item: any) => flag(item.is_recommended));
    return NextResponse.json(projects);
  }
  if (route === "series") {
    const overrides = await getPortfolioCoverOverrides().catch(() => ({ version: 1, updated_at: "", categories: {}, projects: {} }));
    return NextResponse.json(
      applyProjectCoverOverrides(basePortfolioProjects(), overrides)
        .filter((item: any) => flag(item.is_series))
    );
  }
  if (route.startsWith("projects/")) {
    const id = Number(path[1]);
    const overrides = await getPortfolioCoverOverrides().catch(() => ({ version: 1, updated_at: "", categories: {}, projects: {} }));
    const project = applyProjectCoverOverrides(basePortfolioProjects(), overrides).find((item: any) => Number(item.id) === id || item.slug === path[1]);
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      ...project,
      media: getRecoveredMedia().filter((item: any) => Number(item.project_id) === Number(project.id)),
      tags: []
    });
  }
  if (route === "media") {
    let media = [...await getBlobMediaRecords(), ...getRecoveredMedia()];
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
  const { path } = await context.params;
  const route = path.join("/");
  if (route === "inspiration" || route === "inspiration-config" || route.startsWith("inspiration/")) {
    return NextResponse.json({ error: "该频道已经删除。" }, { status: 404 });
  }
  if (method === "DELETE" && path[0] === "projects" && path[1]) {
    const denied = requireAdmin(request);
    if (denied) return denied;
    const target = basePortfolioProjects().find((item: any) => String(item.id) === String(path[1]) || item.slug === path[1]);
    if (target) {
      try {
        const current = await getPortfolioCoverOverrides();
        const projectId = String(target.id);
        const projectCovers = { ...current.projects };
        delete projectCovers[projectId];
        const saved = await savePortfolioCoverOverrides({
          ...current,
          projects: projectCovers,
          deleted_projects: {
            ...current.deleted_projects,
            [projectId]: new Date().toISOString()
          }
        });
        // The persistent deletion manifest is authoritative for imported projects.
        // Database and object cleanup remains best effort for records that also exist there.
        await handleArchiveDelete(request, context).catch(() => undefined);
        return NextResponse.json({ deleted: true, project_id: projectId, version: saved.version }, {
          headers: { "Cache-Control": "private, no-store, max-age=0" }
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "系列删除失败";
        return NextResponse.json({ error: `系列删除失败：${message}` }, { status: 500 });
      }
    }
  }
  try {
    const handler = method === "GET" ? handleArchiveGet : method === "POST" ? handleArchivePost : method === "PUT" ? handleArchivePut : handleArchiveDelete;
    const response = await handler(request, context);
    if (method === "GET") {
      if (["projects", "media", "categories", "tags", "series"].includes(route)) {
        const body = await response.clone().text();
        if (body.trim() === "[]" || body.trim() === "{}" || body.trim() === "") return recoveredGet(request, context);
        if ((route === "categories" || route === "projects" || route === "series") && response.ok) {
          const items = JSON.parse(body);
          if (Array.isArray(items)) {
            const overrides = await getPortfolioCoverOverrides().catch(() => ({ version: 1, updated_at: "", categories: {}, projects: {} }));
            const overlaid = route === "categories"
              ? applyCategoryCoverOverrides(items, overrides)
              : applyProjectCoverOverrides(items, overrides);
            return NextResponse.json(overlaid, { status: response.status, headers: { "Cache-Control": "private, no-store" } });
          }
        }
      }
      if (route.startsWith("projects/") && response.ok) {
        const project = await response.clone().json();
        const overrides = await getPortfolioCoverOverrides().catch(() => ({ version: 1, updated_at: "", categories: {}, projects: {} }));
        return NextResponse.json(applyProjectCoverOverrides([project], overrides)[0], { status: response.status, headers: { "Cache-Control": "private, no-store" } });
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

