import { getSettings } from "@/lib/db";
import { getSupabaseServer } from "@/lib/supabase";
import { fallbackHomePayload, isSupabaseConfigError } from "@/lib/fallback-data";

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
async function addSeriesCovers(projects: any[]) {
  const supabase = getSupabaseServer();
  return Promise.all(projects.map(async (project: any) => {
    let cover = project.cover_image || "";
    let mediaType = "image";
    if (!cover) {
      const media = await supabase
        .from("media")
        .select("file_path,media_type")
        .eq("project_id", project.id)
        .in("media_type", ["image", "video"])
        .order("is_cover", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (media.error) throw media.error;
      cover = media.data?.file_path || "";
      mediaType = media.data?.media_type || "image";
    }
    return { ...project, cover_image: cover, series_cover: cover, series_media_type: mediaType };
  }));
}

async function getHomePayloadFromSupabase() {
  const supabase = getSupabaseServer();
  const settings = await getSettings();

  const [projectsResult, recommendedSeriesResult, categoriesResult, heroResult, databasePreviewResult] = await Promise.all([
    supabase
      .from("projects")
      .select("*, categories:category_id(name,slug)")
      .eq("status", "published")
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
    supabase
      .from("projects")
      .select("*, categories:category_id(name,slug)")
      .eq("is_series", true)
      .eq("is_recommended", true)
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

  for (const result of [projectsResult, recommendedSeriesResult, categoriesResult, heroResult, databasePreviewResult]) {
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
  const recommended = await addSeriesCovers((recommendedSeriesResult.data || []).map(normalizeProject));

  return {
    settings,
    hero,
    featured: projects.filter((project: any) => project.is_featured),
    recommended,
    categories,
    database_preview: databasePreview
  };
}

export async function getHomePayload() {
  try {
    return await getHomePayloadFromSupabase();
  } catch (error) {
    if (isSupabaseConfigError(error)) return fallbackHomePayload;
    throw error;
  }
}

