type PptProjectDefinition = {
  id: number;
  title: string;
  subtitle: string;
  slug: string;
  description: string;
  folder: string;
  slideNumbers: number[];
  tags: string;
  style: string;
};

const definitions: PptProjectDefinition[] = [
  {
    id: 70,
    title: "武汉麓客岛·动物农场环境调研",
    subtitle: "多感官维度下的野趣与舒适平衡设计",
    slug: "luke-island-animal-farm-research",
    description: "从视觉、嗅觉、听觉与触觉四个维度，分析动物农场的动线、植物、材料、声景和人本化细节。",
    folder: "animal-farm-research",
    slideNumbers: Array.from({ length: 23 }, (_, index) => index + 1),
    tags: "环境调研,景观空间,多感官设计",
    style: "nature-research"
  },
  {
    id: 71,
    title: "适老化安全与居家环境优化",
    subtitle: "安全、动线与居住体验的系统设计",
    slug: "age-friendly-home-series",
    description: "围绕老龄化居住需求，从前期调研、风险识别、功能分区、立面设计到最终效果图形成完整空间方案。",
    folder: "aging-home-safety",
    slideNumbers: [...Array.from({ length: 15 }, (_, index) => index + 1), 21, 26],
    tags: "适老化,住宅设计,室内空间",
    style: "warm-interior"
  }
];

function slidePath(folder: string, slide: number) {
  return `/assets/projects/${folder}/slide-${String(slide).padStart(2, "0")}.png`;
}

export const importedPptProjects = definitions.map((item, index) => ({
  id: item.id,
  title: item.title,
  subtitle: item.subtitle,
  slug: item.slug,
  category_id: 95,
  description: item.description,
  cover_image: slidePath(item.folder, item.slideNumbers[0]),
  year: "2026",
  location: "武汉",
  is_featured: 0,
  is_recommended: 1,
  status: "published",
  sort_order: index + 1,
  tags: item.tags,
  is_series: 1,
  series_style: item.style,
  category_name: "空间",
  category_slug: "space",
  series_cover: slidePath(item.folder, item.slideNumbers[0]),
  series_media_type: "image"
}));

export const importedPptMedia = definitions.flatMap((item) =>
  item.slideNumbers.map((slide, index) => ({
    id: `ppt-${item.id}-${slide}`,
    project_id: item.id,
    category_id: 95,
    title: `${item.title} · ${String(index + 1).padStart(2, "0")}`,
    description: item.description,
    file_path: slidePath(item.folder, slide),
    file_type: "png",
    tags: item.tags,
    is_hero: 0,
    is_selected: 0,
    is_cover: index === 0 ? 1 : 0,
    sort_order: index + 1,
    show_in_database: 0,
    original_name: `slide-${String(slide).padStart(2, "0")}.png`,
    mime_type: "image/png",
    media_type: "image",
    show_in_inspiration: 0,
    storage_path: slidePath(item.folder, slide),
    category_name: "空间",
    category_slug: "space",
    project_title: item.title,
    project_slug: item.slug,
    project_year: "2026",
    project_location: "武汉"
  }))
);

export function mergeImportedPptProjects(projects: any[]) {
  const merged = new Map((projects || []).map((item: any) => [String(item.id), item]));
  for (const project of importedPptProjects) {
    merged.set(String(project.id), { ...(merged.get(String(project.id)) || {}), ...project });
  }
  return [...merged.values()];
}

export function mergeImportedPptMedia(media: any[]) {
  const importedProjectIds = new Set(definitions.map((item) => String(item.id)));
  const preserved = (media || []).filter((item: any) => !importedProjectIds.has(String(item.project_id)));
  const merged = new Map(preserved.map((item: any) => [String(item.id), item]));
  for (const item of importedPptMedia) merged.set(String(item.id), item);
  return [...merged.values()];
}
