import { getSupabaseServer } from "@/lib/supabase";

const flag = (value: unknown) => value === true || value === 1 ? 1 : 0;
const normalizeMedia = (media: any) => ({
  ...media,
  is_hero: flag(media.is_hero),
  is_selected: flag(media.is_selected),
  is_cover: flag(media.is_cover),
  show_in_database: flag(media.show_in_database),
  show_in_inspiration: flag(media.show_in_inspiration),
  project_title: media.projects?.title || "",
  project_slug: media.projects?.slug || "",
  category_name: media.categories?.name || "",
  category_slug: media.categories?.slug || ""
});

export async function getDatabaseMedia(category: string | null) {
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
    if (!categoryResult.data) return [];
    query = query.eq("category_id", categoryResult.data.id);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(normalizeMedia);
}
