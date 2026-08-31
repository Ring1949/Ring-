export const WORK_FILTER_GROUPS = ["photo", "graphic", "space", "ai", "other"] as const;
export type WorkFilterGroup = (typeof WORK_FILTER_GROUPS)[number];
export type WorkFilterItem = { label: string; value: string };
export type WorkFilterConfig = Record<WorkFilterGroup, WorkFilterItem[]>;

export const defaultWorkFilters: WorkFilterConfig = {
  photo: [
    { label: "全部摄影", value: "all" }, { label: "产品摄影", value: "product" },
    { label: "人物", value: "portrait" }, { label: "校园活动", value: "campus" },
    { label: "纪实", value: "documentary" }, { label: "展览与文化", value: "culture" },
    { label: "风光与建筑", value: "landscape" }, { label: "创作", value: "creative" },
    { label: "戒指", value: "ring" }, { label: "项链", value: "necklace" },
    { label: "手串手镯", value: "bracelet" }, { label: "耳饰", value: "earring" },
    { label: "矿标", value: "mineral" }, { label: "摆件", value: "ornament" },
    { label: "其他珠宝", value: "jewelry" }
  ],
  graphic: [
    { label: "全部平面", value: "all" }, { label: "设计", value: "design" },
    { label: "手绘", value: "drawing" }, { label: "海报", value: "poster" }
  ],
  space: [
    { label: "全部空间", value: "all" }, { label: "室内", value: "interior" },
    { label: "建筑", value: "architecture" }, { label: "3D建模", value: "threeD" }
  ],
  ai: [
    { label: "全部 AI", value: "all" }, { label: "生成图像", value: "generated" },
    { label: "概念草图", value: "concept" }, { label: "工作流", value: "workflow" }
  ],
  other: [
    { label: "全部其他", value: "all" }, { label: "视频", value: "video" },
    { label: "手工", value: "craft" }, { label: "日常", value: "daily" }
  ]
};

const cleanText = (value: unknown, max: number) => String(value || "").trim().slice(0, max);
const fallbackAllLabel: Record<WorkFilterGroup, string> = {
  photo: "全部摄影", graphic: "全部平面", space: "全部空间", ai: "全部 AI", other: "全部其他"
};

export function normalizeWorkFilters(input: unknown): WorkFilterConfig {
  const source = input && typeof input === "object" ? input as Record<string, unknown> : {};
  return Object.fromEntries(WORK_FILTER_GROUPS.map((group) => {
    const rows = Array.isArray(source[group]) ? source[group] as unknown[] : defaultWorkFilters[group];
    const seen = new Set(["all"]);
    const items: WorkFilterItem[] = [{ label: fallbackAllLabel[group], value: "all" }];
    rows.slice(0, 40).forEach((row) => {
      if (!row || typeof row !== "object") return;
      const item = row as Record<string, unknown>;
      const label = cleanText(item.label, 30);
      const value = cleanText(item.value, 60);
      if (!label || !value || value === "all" || seen.has(value)) return;
      seen.add(value);
      items.push({ label, value });
    });
    return [group, items];
  })) as WorkFilterConfig;
}

export function parseWorkFilters(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return normalizeWorkFilters(defaultWorkFilters);
  try { return normalizeWorkFilters(JSON.parse(value)); }
  catch { return normalizeWorkFilters(defaultWorkFilters); }
}
