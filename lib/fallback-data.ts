export const defaultSettings: Record<string, string> = {
  site_name: "山川止行",
  hero_title: "山川止行",
  hero_subtitle: "摄影 / 平面设计 / 空间 / 日常研究",
  hero_kicker: "SHANCHUAN VISUAL ARCHIVE · 2026",
  hero_media: "/assets/hero-default.jpg",
  hero_media_type: "image",
  intro_text: "独立设计师与影像创作者\nBASED IN WUHAN",
  about_kicker: "ABOUT SHANCHUAN",
  about_title: "作品不是终点，\n而是我理解世界的索引。",
  about_text: "作品不是终点，而是我理解世界的索引。你好，我是山川止行，一名横跨视觉、空间与影像的独立创作者。",
  contact_email: "hello@example.com",
  contact_link: "mailto:hello@example.com",
  contact_button_text: "一起做点什么 ↗",
  contact_title: "联系我",
  contact_intro: "如果你想聊聊摄影、设计、空间或新的合作，可以通过下面的方式找到我。",
  contact_location: "武汉 / 可远程合作",
  contact_name: "RING",
  contact_phone: "18569569185",
  contact_role: "Visual Creator / Designer",
  footer_text: "视觉档案 / 武汉 / 2026",
  footer_copyright: "© 2026 SHANCHUAN STUDIO"
};

export const defaultCategories = [
  { id: 1, name: "摄影", slug: "photo", description: "城市、光线、胶片与观看方式。", cover_image: "", sort_order: 1, is_primary: 1, project_count: 0 },
  { id: 2, name: "平面", slug: "graphic", description: "字体、版式、品牌与视觉系统。", cover_image: "", sort_order: 2, is_primary: 1, project_count: 0 },
  { id: 3, name: "空间", slug: "space", description: "尺度、材质、光线与空间秩序。", cover_image: "", sort_order: 3, is_primary: 1, project_count: 0 },
  { id: 4, name: "AI", slug: "ai", description: "图像生成、风格测试与概念草图。", cover_image: "", sort_order: 4, is_primary: 1, project_count: 0 },
  { id: 5, name: "其他", slug: "other", description: "日常实验、手绘、厨艺、手工与未完成想法。", cover_image: "", sort_order: 5, is_primary: 1, project_count: 0 }
];

export const fallbackHomePayload = {
  settings: defaultSettings,
  hero: { file_path: defaultSettings.hero_media, media_type: defaultSettings.hero_media_type },
  featured: [],
  recommended: [],
  categories: defaultCategories,
  database_preview: []
};

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "未知错误");
}

export function isSupabaseConfigError(error: unknown) {
  return /Missing NEXT_PUBLIC_SUPABASE|Invalid API key|fetch failed|relation .* does not exist|schema cache|Could not find/i.test(errorMessage(error));
}
