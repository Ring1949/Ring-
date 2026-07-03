import { getSettings } from "@/lib/db";
import { getSupabaseServer } from "@/lib/supabase";

const flag = (value: unknown) => value === true || value === 1 ? 1 : 0;
const normalizeProject = (project: any) => ({
  ...project,
  is_featured: flag(project.is_featured),
  is_recommended: flag(project.is_recommended),
  is_series: flag(project.is_series),
  category_name: project.categories?.name || project.category_name || "",
  category_slug: project.categories?.slug || project.category_slug || ""
});
const normalizeMedia = (media: any) => ({
  ...media,
  is_hero: flag(media.is_hero),
  is_selected: flag(media.is_selected),
  is_cover: flag(media.is_cover),
  show_in_database: flag(media.show_in_database),
  show_in_inspiration: flag(media.show_in_inspiration),
  category_name: media.categories?.name || media.category_name || "",
  category_slug: media.categories?.slug || media.category_slug || ""
});

export async function getHomePayload() {
  const supabase = getSupabaseServer();
  const settings = await getSettings();

  const [projectsResult, categoriesResult, heroResult, databasePreviewResult] = await Promise.all([
    supabase
      .from("projects")
      .select("*, categories:category_id(name,slug)")
      .eq("status", "published")
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
    supabase
      .from("categories")
      .select("*")
      .eq("is_primary", true)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
    supabase
      .from("media")
      .select("*")
      .eq("is_hero", true)
      .order("updated_at", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("media")
      .select("*, categories:category_id(name,slug)")
      .eq("show_in_database", true)
      .order("is_selected", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true })
      .limit(12)
  ]);

  for (const result of [projectsResult, categoriesResult, heroResult, databasePreviewResult]) {
    if (result.error) throw result.error;
  }

  const projects = (projectsResult.data || []).map(normalizeProject);
  const categories = await Promise.all((categoriesResult.data || []).map(async (category: any) => {
    const { count } = await supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("category_id", category.id)
      .eq("status", "published");
    return { ...category, is_primary: flag(category.is_primary), project_count: count || 0 };
  }));

  const hero = heroResult.data ? normalizeMedia(heroResult.data) : {
    file_path: settings.hero_media || settings.hero_image || "/assets/hero-default.jpg",
    media_type: settings.hero_media_type || "image"
  };
  const databasePreview = (databasePreviewResult.data || []).map(normalizeMedia);
  const seriesProjects = projects.filter((project: any) => project.is_series);
  const recommended = seriesProjects.filter((project: any) => project.is_recommended);

  return {
    settings,
    hero,
    featured: projects.filter((project: any) => project.is_featured),
    recommended: recommended.length ? recommended : seriesProjects.slice(0, 5),
    categories,
    database_preview: databasePreview
  };
}
