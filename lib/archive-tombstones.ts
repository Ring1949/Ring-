import { getSettings, setSettings } from "@/lib/db";

const CATEGORY_KEY = "__archive_deleted_categories";
const TAG_KEY = "__archive_deleted_tags";
const TAG_CATEGORY_KEY = "work_tag_category_map";

type DeletedIds = Record<string, string>;

function parseDeletedIds(value: unknown): DeletedIds {
  if (!value) return {};
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter(([id]) => Boolean(String(id).trim()))
        .map(([id, deletedAt]) => [String(id), String(deletedAt || "")])
    );
  } catch {
    return {};
  }
}

export async function getArchiveTombstones() {
  const settings = await getSettings();
  return {
    categories: parseDeletedIds(settings[CATEGORY_KEY]),
    tags: parseDeletedIds(settings[TAG_KEY])
  };
}

export async function markArchiveItemDeleted(kind: "categories" | "tags", id: unknown) {
  const itemId = String(id || "").trim();
  if (!itemId) throw new Error("缺少要删除的记录编号");
  const settings = await getSettings();
  const current = kind === "categories" ? parseDeletedIds(settings[CATEGORY_KEY]) : parseDeletedIds(settings[TAG_KEY]);
  const next = { ...current, [itemId]: new Date().toISOString() };
  const changes: Record<string, string> = {
    [kind === "categories" ? CATEGORY_KEY : TAG_KEY]: JSON.stringify(next)
  };
  if (kind === "tags") {
    let categoryMap: Record<string, unknown> = {};
    try { categoryMap = JSON.parse(settings[TAG_CATEGORY_KEY] || "{}"); } catch { categoryMap = {}; }
    delete categoryMap[itemId];
    changes[TAG_CATEGORY_KEY] = JSON.stringify(categoryMap);
  }
  await setSettings(changes);
  return next;
}

export function removeArchivedItems<T extends { id?: unknown }>(items: T[], deleted: DeletedIds) {
  return items.filter((item) => !deleted[String(item.id ?? "")]);
}
