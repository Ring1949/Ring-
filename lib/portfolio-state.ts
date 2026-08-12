import { getRecoveredCategories, getRecoveredProjects } from "@/lib/recovered-data";
import { importedPhotoLibrary, mergeImportedCategories } from "@/lib/photo-library";

export type PortfolioCoverOverrides = {
  version: number;
  updated_at: string;
  categories: Record<string, string>;
  projects: Record<string, string>;
};

const emptyOverrides = (): PortfolioCoverOverrides => ({
  version: 1,
  updated_at: new Date(0).toISOString(),
  categories: {},
  projects: {}
});

export function basePortfolioCategories() {
  return mergeImportedCategories(getRecoveredCategories())
    .filter((item: any) => item.slug !== "product");
}

export function basePortfolioProjects() {
  const byId = new Map<string, any>();
  for (const project of [...getRecoveredProjects(), ...(importedPhotoLibrary.projects || [])]) {
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
    projects: raw.projects && typeof raw.projects === "object" ? raw.projects : {}
  };
}

export function applyCategoryCoverOverrides(categories: any[], overrides: PortfolioCoverOverrides) {
  return categories.map((item) => ({
    ...item,
    cover_image: overrides.categories[String(item.id)] || item.cover_image || ""
  }));
}

export function applyProjectCoverOverrides(projects: any[], overrides: PortfolioCoverOverrides) {
  return projects.map((item) => {
    const cover = overrides.projects[String(item.id)];
    return cover ? { ...item, cover_image: cover, series_cover: cover } : item;
  });
}
