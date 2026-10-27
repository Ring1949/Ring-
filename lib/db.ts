import { getSupabaseServer } from "@/lib/supabase";
import { defaultSettings, isSupabaseConfigError } from "@/lib/fallback-data";
import { r2Configured, readLatestR2Json, writeR2Json } from "@/lib/r2";

const SETTINGS_BACKUP_PREFIX = "site-state/v1/settings/";

async function getR2Settings() {
  if (!r2Configured()) return {};
  try {
    return await readLatestR2Json<Record<string, string>>(SETTINGS_BACKUP_PREFIX) || {};
  } catch {
    return {};
  }
}

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
  let databaseSettings: Record<string, string> = {};
  let databaseError: unknown = null;
  try {
    const { data, error } = await getSupabaseServer()
      .from("settings")
      .select("key,value");
    if (error) throw error;
    databaseSettings = Object.fromEntries((data || []).map((row: any) => [row.key, row.value ?? ""]));
  } catch (error) {
    databaseError = error;
  }
  const r2Settings = await getR2Settings();
  if (databaseError && !Object.keys(r2Settings).length && !isSupabaseConfigError(databaseError)) throw databaseError;
  return { ...defaultSettings, ...databaseSettings, ...r2Settings };
}

export async function setSettings(values: Record<string, unknown>) {
  const rows = Object.entries(values).map(([key, value]) => ({
    key,
    value: String(value ?? ""),
    updated_at: now()
  }));
  const changed = Object.fromEntries(rows.map(({ key, value }) => [key, value]));
  if (!rows.length) return changed;

  let databaseError: unknown = null;
  try {
    const { error } = await getSupabaseServer().from("settings").upsert(rows, { onConflict: "key" });
    if (error) throw new Error(error.message || "Supabase settings write failed");
  } catch (error) {
    databaseError = error;
  }

  let backupError: unknown = null;
  if (r2Configured()) {
    try {
      const current = await getR2Settings();
      await writeR2Json(SETTINGS_BACKUP_PREFIX, { ...current, ...changed });
    } catch (error) {
      backupError = error;
    }
  }
  if (databaseError && backupError) {
    const databaseMessage = databaseError instanceof Error ? databaseError.message : "Supabase settings write failed";
    const backupMessage = backupError instanceof Error ? backupError.message : "R2 settings backup failed";
    throw new Error(`${databaseMessage}; ${backupMessage}`);
  }
  if (databaseError && !r2Configured()) throw databaseError;
  // The admin already holds the current settings in memory. Returning only the
  // changed values prevents every save from making a second full-table read.
  return changed;
}

export async function replaceTagLinks(table: string, ownerColumn: string, ownerId: number, tagIds: unknown[] = []) {
  if (!["project_tags", "media_tags"].includes(table)) throw new Error(`Invalid tag table: ${table}`);
  if (!["project_id", "media_id"].includes(ownerColumn)) throw new Error(`Invalid tag owner column: ${ownerColumn}`);
  const supabase = getSupabaseServer();
  const deleted = await supabase.from(table).delete().eq(ownerColumn, ownerId);
  if (deleted.error) throw deleted.error;
  const rows = tagIds.map(Number).filter(Boolean).map((tagId) => ({ [ownerColumn]: ownerId, tag_id: tagId }));
  if (rows.length) {
    const inserted = await supabase.from(table).insert(rows);
    if (inserted.error) throw inserted.error;
  }
}

