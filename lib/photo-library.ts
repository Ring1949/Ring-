import generated from "@/public/generated/photo-library.json";

type GeneratedLibrary = {
  version: number;
  generated_at: string;
  categories: any[];
  projects: any[];
  media: any[];
};

function canonicalProject(item: any) {
  const product = item.category_slug === "product" || item.collection_slug === "product" || String(item.project_slug || "").startsWith("product-");
  return {
    ...item,
    ...(product ? { collection_slug: "product" } : {}),
    category_id: item.category_slug === "product" ? 1 : item.category_id,
    category_name: item.category_slug === "product" ? "摄影" : item.category_name,
    category_slug: item.category_slug === "product" ? "photo" : item.category_slug
  };
}

function canonicalMedia(item: any) {
  const { show_in_inspiration: _removedChannelFlag, ...media } = item;
  const product = media.category_slug === "product" || media.collection_slug === "product" || String(media.project_slug || "").startsWith("product-");
  return {
    ...media,
    ...(product ? { collection_slug: "product" } : {}),
    category_id: media.category_slug === "product" ? 1 : media.category_id,
    category_name: media.category_slug === "product" ? "摄影" : media.category_name,
    category_slug: media.category_slug === "product" ? "photo" : media.category_slug
  };
}

const canonicalProjects = (generated.projects || []).map(canonicalProject);
const canonicalMediaItems = (generated.media || []).map(canonicalMedia);
const generatedPhoto = (generated.categories || []).find((item) => item.slug === "photo");
const generatedProduct = (generated.categories || []).find((item) => item.slug === "product");
const photoCategory = {
  ...(generatedPhoto || {}),
  id: generatedPhoto?.id || 1,
  name: "摄影",
  slug: "photo",
  description: "人物、现场、城市、产品与观看方式。",
  cover_image: generatedPhoto?.cover_image || generatedProduct?.cover_image || "",
  sort_order: 1,
  is_primary: 1,
  project_count: canonicalProjects.filter((item) => item.category_slug === "photo").length
};

export const importedPhotoLibrary = {
  ...(generated as GeneratedLibrary),
  version: Math.max(2, Number(generated.version) || 1),
  categories: [photoCategory],
  projects: canonicalProjects,
  media: canonicalMediaItems
} as GeneratedLibrary;

export function isProductPhotography(item: any) {
  return item?.collection_slug === "product"
    || String(item?.project_slug || "").startsWith("product-")
    || /(^|[,，\s])产品摄影([,，\s]|$)/.test(String(item?.tags || ""));
}

export function mergeImportedCategories(base: any[]) {
  const bySlug = new Map(base.filter((item) => item.slug !== "product").map((item) => [item.slug, { ...item }]));
  for (const category of importedPhotoLibrary.categories || []) {
    const existing = bySlug.get(category.slug) || {};
    bySlug.set(category.slug, {
      ...existing,
      ...category,
      cover_image: category.cover_image || existing.cover_image || ""
    });
  }
  return [...bySlug.values()].sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
}

export function importedDatabaseMedia(category: string | null) {
  const slug = category === "3d" ? "three-d" : category;
  return (importedPhotoLibrary.media || [])
    .filter((item) => item.show_in_database && item.file_path)
    .filter((item) => {
      if (!slug || slug === "all") return true;
      if (slug === "product") return isProductPhotography(item);
      return item.category_slug === slug;
    });
}
