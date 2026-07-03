import { getSupabase } from "@/lib/supabase";

export function now() {
  return new Date().toISOString();
}

export function slugify(value: unknown) {
  return String(value || "").trim().toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{Letter}\p{Number}-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || `item-${Date.now()}`;
}

export async function getSettings(): Promise<Record<string, string>> {
  const { data, error } = await getSupabase()
    .from("settings")
    .select("key,value");
  if (error) throw error;
  return Object.fromEntries((data || []).map((row: any) => [row.key, row.value ?? ""]));
}

export async function setSettings(values: Record<string, unknown>) {
  const rows = Object.entries(values).map(([key, value]) => ({
    key,
    value: String(value ?? ""),
    updated_at: now()
  }));
  if (rows.length) {
    const { error } = await getSupabase()
      .from("settings")
      .upsert(rows, { onConflict: "key" });
    if (error) throw error;
  }
  return getSettings();
}

export async function replaceTagLinks(table: string, ownerColumn: string, ownerId: number, tagIds: unknown[] = []) {
  if (!["project_tags", "media_tags"].includes(table)) throw new Error(`Invalid tag table: ${table}`);
  if (!["project_id", "media_id"].includes(ownerColumn)) throw new Error(`Invalid tag owner column: ${ownerColumn}`);
  const supabase = getSupabase();
  const deleted = await supabase.from(table).delete().eq(ownerColumn, ownerId);
  if (deleted.error) throw deleted.error;
  const rows = tagIds.map(Number).filter(Boolean).map((tagId) => ({ [ownerColumn]: ownerId, tag_id: tagId }));
  if (rows.length) {
    const inserted = await supabase.from(table).insert(rows);
    if (inserted.error) throw inserted.error;
  }
}
