import fs from "node:fs";
import path from "node:path";
import { del } from "@vercel/blob";

const root = process.cwd();
const generatedPath = path.join(root, "public", "generated", "photo-library.json");
const statePath = path.join(root, ".blob-upload-state.json");
const preparedPath = path.join(root, ".photo-import-prepared.json");
const backupPath = path.join(root, ".photo-prune-backup.json");
const progressPath = path.join(root, ".photo-prune-progress.json");
const shouldApply = process.argv.includes("--apply");
const shouldDeleteBlob = process.argv.includes("--delete-blob");

function loadJson(filePath, fallback = null) {
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf8")) : fallback;
}

function loadLocalEnv() {
  for (const fileName of [".env.local", ".env.photo-import"]) {
    const filePath = path.join(root, fileName);
    if (!fs.existsSync(filePath)) continue;
    for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      process.env[match[1]] = value;
    }
  }
}

function isProduct(item) {
  return item.collection_slug === "product" || String(item.project_slug || "").startsWith("product-");
}

function selectBalanced(items, count) {
  const groups = new Map();
  for (const item of items.filter(isProduct)) {
    const key = String(item.project_slug || "product-uncategorized");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const total = [...groups.values()].reduce((sum, group) => sum + group.length, 0);
  if (total < count) throw new Error(`产品摄影只有 ${total} 张，无法删除 ${count} 张。`);
  const quotas = [...groups.entries()].map(([project, group]) => {
    const exact = group.length * count / total;
    return { project, group, quota: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let remaining = count - quotas.reduce((sum, item) => sum + item.quota, 0);
  for (const item of [...quotas].sort((a, b) => b.remainder - a.remainder || a.project.localeCompare(b.project)).slice(0, remaining)) item.quota += 1;
  const selected = [];
  for (const entry of quotas.sort((a, b) => a.project.localeCompare(b.project))) {
    const ordered = [...entry.group].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.id).localeCompare(String(b.id)));
    const indexes = new Set();
    for (let index = 0; index < entry.quota; index += 1) indexes.add(Math.min(ordered.length - 1, Math.floor((index + 0.5) * ordered.length / entry.quota)));
    for (const index of indexes) selected.push(ordered[index]);
  }
  if (selected.length !== count) throw new Error(`删除清单数量异常：${selected.length}，预期 ${count}。`);
  return selected;
}

function rebuildCovers(payload) {
  for (const project of payload.projects || []) {
    const available = payload.media.filter((item) => String(item.project_slug) === String(project.slug));
    const currentStillExists = available.some((item) => item.file_path === project.cover_image || item.url === project.cover_image);
    if (!currentStillExists) project.cover_image = available[0]?.file_path || available[0]?.url || "";
    project.media_count = available.length;
  }
  payload.projects = (payload.projects || []).filter((project) => Number(project.media_count || 0) > 0);
  for (const category of payload.categories || []) {
    const available = payload.media.filter((item) => item.category_slug === category.slug);
    const currentStillExists = available.some((item) => item.file_path === category.cover_image || item.url === category.cover_image);
    if (!currentStillExists) category.cover_image = available[0]?.file_path || available[0]?.url || "";
    category.project_count = payload.projects.filter((project) => project.category_slug === category.slug).length;
  }
  payload.updated_at = new Date().toISOString();
  payload.version = Math.max(2, Number(payload.version) || 2) + 1;
}

async function removeFromBlob(selected) {
  loadLocalEnv();
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("没有找到 BLOB_READ_WRITE_TOKEN，未执行远端删除。");
  const previous = loadJson(progressPath, { deleted: [] });
  const completed = new Set(previous.deleted || []);
  const pending = selected.filter((item) => !completed.has(String(item.id)));
  for (let offset = 0; offset < pending.length; offset += 100) {
    const batch = pending.slice(offset, offset + 100);
    await del(batch.map((item) => item.file_path || item.url), { token });
    for (const item of batch) completed.add(String(item.id));
    fs.writeFileSync(progressPath, JSON.stringify({ updated_at: new Date().toISOString(), deleted: [...completed] }, null, 2));
    console.log(`远端已删除 ${completed.size}/${selected.length}`);
  }
  if (completed.size !== selected.length) throw new Error(`远端只删除了 ${completed.size}/${selected.length} 张。`);
}

function applyLocalChanges(payload, selected) {
  const selectedIds = new Set(selected.map((item) => String(item.id)));
  const selectedUrls = new Set(selected.map((item) => item.file_path || item.url));
  payload.media = payload.media.filter((item) => !selectedIds.has(String(item.id)));
  rebuildCovers(payload);
  fs.writeFileSync(generatedPath, `${JSON.stringify(payload, null, 2)}\n`);

  const state = loadJson(statePath);
  if (state?.uploaded) {
    for (const [key, value] of Object.entries(state.uploaded)) {
      const record = value?.record || {};
      if (selectedIds.has(String(record.id)) || selectedUrls.has(value?.url || record.file_path)) delete state.uploaded[key];
    }
    fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
  }

  const prepared = loadJson(preparedPath);
  if (prepared?.records) {
    for (const [key, value] of Object.entries(prepared.records)) {
      if (selectedIds.has(String(value?.media?.id))) delete prepared.records[key];
    }
    fs.writeFileSync(preparedPath, `${JSON.stringify(prepared, null, 2)}\n`);
  }
}

const payload = loadJson(generatedPath);
if (!payload?.media) throw new Error("作品索引不存在或格式错误。");
const selected = selectBalanced(payload.media, 1000);
const distribution = Object.values(selected.reduce((map, item) => {
  const key = item.project_slug;
  map[key] ||= { project: key, deleted: 0, bytes: 0 };
  map[key].deleted += 1;
  map[key].bytes += Number(item.size || 0);
  return map;
}, {}));
const backup = {
  created_at: new Date().toISOString(),
  reason: "用户要求从现有产品摄影中均匀删除 1,000 张，为 Skill 库预留空间。",
  source_media_count: payload.media.length,
  selected_count: selected.length,
  selected_bytes: selected.reduce((sum, item) => sum + Number(item.size || 0), 0),
  distribution,
  media: selected
};
fs.writeFileSync(backupPath, `${JSON.stringify(backup, null, 2)}\n`);
console.table(distribution.map((item) => ({ project: item.project, delete: item.deleted, megabytes: Math.round(item.bytes / 1024 / 1024 * 100) / 100 })));
console.log(`删除清单：${selected.length} 张，共 ${(backup.selected_bytes / 1024 / 1024).toFixed(2)} MB；预计保留 ${payload.media.length - selected.length} 张。`);

if (shouldDeleteBlob) await removeFromBlob(selected);
if (shouldApply) {
  if (shouldDeleteBlob) {
    const progress = loadJson(progressPath, { deleted: [] });
    if (new Set(progress.deleted || []).size !== selected.length) throw new Error("远端删除未完成，拒绝改写公开索引。");
  }
  applyLocalChanges(payload, selected);
  console.log("公开索引与本地上传断点已经同步更新。");
} else {
  console.log("当前仅生成清单；添加 --delete-blob --apply 才会执行删除并更新索引。 ");
}
