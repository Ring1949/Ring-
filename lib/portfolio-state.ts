import { getRecoveredCategories, getRecoveredProjects } from "@/lib/recovered-data";
import { importedPhotoLibrary, mergeImportedCategories } from "@/lib/photo-library";
import { importedPptProjects } from "@/lib/ppt-projects";

const CORE_CATEGORY_SLUGS = new Set(["photo", "graphic", "space", "ai", "other"]);
const LEGACY_CATEGORY_SLUGS = new Set(["product", "interior", "motion", "daily", "database", "food", "three-d", "video"]);

export type PortfolioCoverOverrides = {
  version: number;
  updated_at: string;
  categories: Record<string, string>;
  projects: Record<string, string>;
  deleted_categories: Record<string, string>;
  deleted_projects: Record<string, string>;
};

const emptyOverrides = (): PortfolioCoverOverrides => ({
  version: 1,
  updated_at: new Date(0).toISOString(),
  categories: {},
  projects: {},
  deleted_categories: {},
  deleted_projects: {}
});

export function basePortfolioCategories() {
  return mergeImportedCategories(getRecoveredCategories())
    .filter((item: any) => CORE_CATEGORY_SLUGS.has(String(item.slug || "")))
    .map((item: any) => ({ ...item, project_count: Number(item.project_count || 0) }));
}

export function mergePortfolioCategories(categories: any[], deleted: Record<string, string> = {}) {
  const core = basePortfolioCategories();
  const coreBySlug = new Map(core.map((item: any) => [String(item.slug), item]));
  const merged = new Map<string, any>();

  for (const item of core) merged.set(String(item.slug), item);
  for (const item of categories || []) {
    const slug = String(item?.slug || "");
    if (!slug || LEGACY_CATEGORY_SLUGS.has(slug)) continue;
    const canonical = coreBySlug.get(slug);
    if (canonical) {
      merged.set(slug, {
        ...item,
        name: canonical.name,
        description: canonical.description,
        sort_order: canonical.sort_order,
        is_primary: 1,
        project_count: Number(item.project_count || 0),
        cover_image: item.cover_image || canonical.cover_image || ""
      });
      continue;
    }
    if (!deleted[String(item.id)]) merged.set(slug, { ...item, project_count: Number(item.project_count || 0) });
  }
  return [...merged.values()].sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
}

export function basePortfolioProjects() {
  const byId = new Map<string, any>();
  for (const project of [...getRecoveredProjects(), ...(importedPhotoLibrary.projects || []), ...importedPptProjects]) {
    byId.set(String(project.id), { ...(byId.get(String(project.id)) || {}), ...project });
  }
  return [...byId.values()];
}

export function normalizeCoverOverrides(value: unknown): PortfolioCoverOverrides {
  const raw = value && typeof value === "object" ? value as Partial<PortfolioCoverOverrides> : {};
  return {
    ...emptyOverrides(),
    ...raw,
    categories: raw.categories && typeof raw.categories === "object" ? raw.categories : {},
    projects: raw.projects && typeof raw.projects === "object" ? raw.projects : {},
    deleted_categories: raw.deleted_categories && typeof raw.deleted_categories === "object" ? raw.deleted_categories : {},
    deleted_projects: raw.deleted_projects && typeof raw.deleted_projects === "object" ? raw.deleted_projects : {}
  };
}

export function applyCategoryCoverOverrides(categories: any[], value: unknown) {
  const overrides = normalizeCoverOverrides(value);
  return categories.filter((item) => CORE_CATEGORY_SLUGS.has(String(item.slug || "")) || !overrides.deleted_categories[String(item.id)]).map((item) => ({
    ...item,
    cover_image: overrides.categories[String(item.id)] || item.cover_image || ""
  }));
}

export function applyProjectCoverOverrides(projects: any[], value: unknown) {
  const overrides = normalizeCoverOverrides(value);
  return projects.filter((item) => !overrides.deleted_projects[String(item.id)]).map((item) => {
    const cover = overrides.projects[String(item.id)];
    return cover ? { ...item, cover_image: cover, series_cover: cover } : item;
  });
}

export function isPortfolioProjectDeleted(projectId: unknown, value: unknown) {
  const overrides = normalizeCoverOverrides(value);
  return Boolean(overrides.deleted_projects[String(projectId || "")]);
}

export function isPortfolioCategoryDeleted(categoryId: unknown, value: unknown) {
  const overrides = normalizeCoverOverrides(value);
  return Boolean(overrides.deleted_categories[String(categoryId || "")]);
}
