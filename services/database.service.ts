import { getSupabaseServer } from "@/lib/supabase";
import { getRecoveredMedia } from "@/lib/recovered-data";
import { importedDatabaseMedia, importedPhotoLibrary, isProductPhotography } from "@/lib/photo-library";
import { getBlobMediaRecords, getPortfolioCoverOverrides } from "@/lib/blob-library";
import { isPortfolioProjectDeleted } from "@/lib/portfolio-state";

const flag = (value: unknown) => value === true || value === 1 ? 1 : 0;
const normalizeMedia = (media: any) => {
  const { show_in_inspiration: _removedChannelFlag, ...cleanMedia } = media;
  const rawCategorySlug = media.categories?.slug || media.category_slug || "";
  const product = rawCategorySlug === "product" || isProductPhotography(media);
  return {
    ...cleanMedia,
    is_hero: flag(media.is_hero),
    is_selected: flag(media.is_selected),
    is_cover: flag(media.is_cover),
    show_in_database: flag(media.show_in_database),
    project_title: media.projects?.title || media.project_title || "",
    project_slug: media.projects?.slug || media.project_slug || "",
    ...(product ? { collection_slug: "product" } : {}),
    category_id: rawCategorySlug === "product" ? 1 : media.category_id,
    category_name: rawCategorySlug === "product" ? "摄影" : media.categories?.name || media.category_name || "",
    category_slug: rawCategorySlug === "product" ? "photo" : rawCategorySlug
  };
};

const galleryFilterTerms: Record<string, string[]> = {
  portrait: ["portrait", "人物", "人像", "情侣", "毕业", "采访"],
  campus: ["campus", "校园", "军训", "歌手", "典礼", "论坛", "比赛", "支教"],
  documentary: ["humanity", "documentary", "reportage", "纪实", "新闻", "现场", "社会"],
  culture: ["exhibition", "culture", "展", "石窟", "壁画", "陶瓷", "艺术"],
  landscape: ["landscape", "architecture", "风光", "风景", "建筑", "武汉大学", "樱花"],
  creative: ["creative", "创作", "光影", "实验"],
  ring: ["ring", "戒指"],
  necklace: ["necklace", "项链", "吊坠"],
  bracelet: ["bracelet", "手串", "手镯"],
  earring: ["earring", "耳饰", "耳环", "耳钉"],
  mineral: ["mineral", "矿标", "晶矿"],
  ornament: ["ornament", "摆件", "佛像", "香炉", "能量柱"],
  jewelry: ["jewelry", "珠宝", "胸针", "袖扣", "中古", "商业图集"],
  design: ["design", "graphic", "brand", "设计", "品牌"],
  drawing: ["drawing", "sketch", "手绘", "素描"],
  poster: ["poster", "海报"],
  interior: ["interior", "室内"],
  architecture: ["architecture", "建筑"],
  threeD: ["3d", "model", "render", "建模"],
  generated: ["image", "visual", "图像", "生成"],
  concept: ["concept", "概念"],
  workflow: ["workflow", "工作流"],
  video: ["video", "film", "视频"],
  craft: ["craft", "making", "手工"],
  daily: ["daily", "life", "日常"]
};

function buildCachedDatabaseMedia() {
  const combined = [...getRecoveredMedia(), ...importedDatabaseMedia(null)];
  const seen = new Set<string>();
  return combined
    .map(normalizeMedia)
    .filter((item: any) => item.show_in_database && item.file_path)
    .filter((item: any) => {
      const key = String(item.storage_path || item.file_path || item.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a: any, b: any) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) || String(a.id).localeCompare(String(b.id)));
}

// The generated import is immutable for the lifetime of a deployment. Build and
// sort it once instead of repeating O(N log N) work for every gallery page.
const cachedDatabaseMedia = buildCachedDatabaseMedia();
const liveMediaCacheTtlMs = 30_000;
let liveMediaCache: { expiresAt: number; items: any[] } | null = null;
let liveMediaRequest: Promise<any[]> | null = null;

function mediaIdentity(item: any) {
  return String(item.storage_path || item.file_path || item.id);
}

function mergeDatabaseMedia(liveItems: any[]) {
  const merged = new Map(cachedDatabaseMedia.map((item: any) => [mediaIdentity(item), item]));
  liveItems.forEach((item: any) => merged.set(mediaIdentity(item), item));
  return [...merged.values()]
    .filter((item: any) => item.show_in_database && item.file_path)
    .sort((a: any, b: any) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) || String(a.id).localeCompare(String(b.id)));
}

async function fetchLiveDatabaseMedia() {
  const items: any[] = [];
  const pageSize = 1_000;
  for (let start = 0; start < 10_000; start += pageSize) {
    const { data, error } = await getSupabaseServer()
      .from("media")
      .select("*, projects:project_id(title,slug), categories:category_id(name,slug)")
      .eq("show_in_database", true)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true })
      .range(start, start + pageSize - 1);
    if (error) throw error;
    const page = (data || []).map(normalizeMedia);
    items.push(...page);
    if (page.length < pageSize) break;
  }
  return items;
}

async function databaseMedia() {
  const currentTime = Date.now();
  let items: any[];
  if (liveMediaCache && liveMediaCache.expiresAt > currentTime) {
    items = liveMediaCache.items;
  } else {
    if (!liveMediaRequest) {
      liveMediaRequest = Promise.all([
        fetchLiveDatabaseMedia().catch(() => []),
        getBlobMediaRecords().catch(() => [])
      ])
        .then(([supabaseItems, blobItems]) => {
          const merged = mergeDatabaseMedia([...supabaseItems, ...blobItems.map(normalizeMedia)]);
          liveMediaCache = { expiresAt: Date.now() + liveMediaCacheTtlMs, items: merged };
          return merged;
        })
        .catch(() => cachedDatabaseMedia)
        .finally(() => {
          liveMediaRequest = null;
        });
    }
    items = await liveMediaRequest;
  }
  const overrides = await getPortfolioCoverOverrides().catch(() => null);
  return overrides ? items.filter((item: any) => !isPortfolioProjectDeleted(item.project_id, overrides)) : items;
}

function categorySlug(category: string | null) {
  return category === "3d" ? "three-d" : category;
}

function filterByCategory(items: any[], category: string | null) {
  const slug = categorySlug(category);
  if (!slug || slug === "all") return items;
  if (slug === "product") return items.filter(isProductPhotography);
  return items.filter((item) => item.category_slug === slug);
}

function mediaSearchText(item: any) {
  return [item.title, item.description, item.tags, item.project_title, item.project_slug, item.category_name]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("zh-CN");
}

function includesFilterTerm(text: string, term: string) {
  const normalized = term.toLocaleLowerCase("zh-CN");
  if (!/^[a-z0-9-]+$/i.test(normalized)) return text.includes(normalized);
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
}

function filterGalleryItems(items: any[], filter: string | null, query: string | null) {
  let result = items;
  if (filter && filter !== "all") {
    if (filter === "product") {
      result = result.filter(isProductPhotography);
    } else if (["photo", "graphic", "space", "ai", "other"].includes(filter)) {
      result = result.filter((item) => item.category_slug === filter);
    } else {
      const terms = galleryFilterTerms[filter] || [];
      if (terms.length) result = result.filter((item) => terms.some((term) => includesFilterTerm(mediaSearchText(item), term)));
    }
  }
  const normalizedQuery = String(query || "").trim().toLocaleLowerCase("zh-CN");
  if (normalizedQuery) result = result.filter((item) => mediaSearchText(item).includes(normalizedQuery));
  return result;
}

function galleryItem(item: any) {
  const width = Number(item.width) || undefined;
  const height = Number(item.height) || undefined;
  return {
    id: item.id,
    title: item.title || "",
    thumbnail_url: item.thumbnail_url || item.file_path || "",
    media_type: item.media_type || "image",
    file_type: item.file_type || "",
    category_slug: item.category_slug || "",
    project_title: item.project_title || "",
    width,
    height,
    aspect_ratio: width && height ? width / height : undefined
  };
}

function encodeCursor(offset: number) {
  return Buffer.from(`v1:${offset}`, "utf8").toString("base64url");
}

function decodeCursor(cursor: string | null) {
  if (!cursor) return 0;
  try {
    const value = Buffer.from(cursor, "base64url").toString("utf8");
    if (!value.startsWith("v1:")) return 0;
    return Math.max(0, Number(value.slice(3)) || 0);
  } catch {
    return 0;
  }
}

export async function getDatabaseGalleryPage(options: {
  category: string | null;
  cursor: string | null;
  limit: number;
  filter: string | null;
  query: string | null;
}) {
  const limit = Math.min(60, Math.max(1, Math.floor(Number(options.limit) || 24)));
  const offset = decodeCursor(options.cursor);
  const categoryItems = filterByCategory(await databaseMedia(), options.category);
  const filtered = filterGalleryItems(categoryItems, options.filter, options.query);
  const page = filtered.slice(offset, offset + limit);
  const nextOffset = offset + page.length;
  return {
    items: page.map(galleryItem),
    nextCursor: nextOffset < filtered.length ? encodeCursor(nextOffset) : null,
    hasMore: nextOffset < filtered.length,
    total: filtered.length,
    version: importedPhotoLibrary.version || 1
  };
}

export async function getDatabaseMediaDetail(id: string) {
  return (await databaseMedia()).find((item) => String(item.id) === String(id)) || null;
}

async function recoveredDatabaseMedia(category: string | null) {
  return filterByCategory(await databaseMedia(), category);
}

export async function getDatabaseMedia(category: string | null, page = 0, pageSize = 500) {
  const safePage = Math.max(0, Math.floor(Number(page) || 0));
  const safePageSize = Math.min(500, Math.max(1, Math.floor(Number(pageSize) || 500)));
  const start = safePage * safePageSize;
  if (importedDatabaseMedia(category).length) {
    return (await recoveredDatabaseMedia(category)).slice(start, start + safePageSize);
  }
  try {
    let query = getSupabaseServer()
      .from("media")
      .select("*, projects:project_id(title,slug), categories:category_id(name,slug)")
      .eq("show_in_database", true)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true })
      .range(start, start + safePageSize - 1);

    if (category && category !== "all") {
      const slug = categorySlug(category);
      const categoryResult = await getSupabaseServer().from("categories").select("id").eq("slug", slug).maybeSingle();
      if (categoryResult.error) throw categoryResult.error;
      if (!categoryResult.data) return (await recoveredDatabaseMedia(category)).slice(start, start + safePageSize);
      query = query.eq("category_id", categoryResult.data.id);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(normalizeMedia);
  } catch {
    return (await recoveredDatabaseMedia(category)).slice(start, start + safePageSize);
  }
}
