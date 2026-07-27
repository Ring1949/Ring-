import { getSupabaseServer } from "@/lib/supabase";
import { getRecoveredMedia } from "@/lib/recovered-data";

const flag = (value: unknown) => value === true || value === 1 ? 1 : 0;
const normalizeMedia = (media: any) => ({
  ...media,
  is_hero: flag(media.is_hero),
  is_selected: flag(media.is_selected),
  is_cover: flag(media.is_cover),
  show_in_database: flag(media.show_in_database),
  show_in_inspiration: flag(media.show_in_inspiration),
  project_title: media.projects?.title || media.project_title || "",
  project_slug: media.projects?.slug || media.project_slug || "",
  category_name: media.categories?.name || media.category_name || "",
  category_slug: media.categories?.slug || media.category_slug || ""
});

function recoveredDatabaseMedia(category: string | null) {
  const slug = category === "3d" ? "three-d" : category;
  return getRecoveredMedia()
    .map(normalizeMedia)
    .filter((item: any) => item.show_in_database && item.file_path)
    .filter((item: any) => !slug || slug === "all" || item.category_slug === slug)
    .sort((a: any, b: any) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) || (Number(a.id) || 0) - (Number(b.id) || 0));
}

export async function getDatabaseMedia(category: string | null) {
  try {
    let query = getSupabaseServer()
      .from("media")
      .select("*, projects:project_id(title,slug), categories:category_id(name,slug)")
      .eq("show_in_database", true)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });

    if (category && category !== "all") {
      const slug = category === "3d" ? "three-d" : category;
      const categoryResult = await getSupabaseServer().from("categories").select("id").eq("slug", slug).maybeSingle();
      if (categoryResult.error) throw categoryResult.error;
      if (!categoryResult.data) return recoveredDatabaseMedia(category);
      query = query.eq("category_id", categoryResult.data.id);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(normalizeMedia);
  } catch {
    return recoveredDatabaseMedia(category);
  }
}
