#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const libraryPath = path.join(root, "public", "generated", "photo-library.json");
const preparedPath = path.join(root, ".photo-import-prepared.json");
const statePath = path.join(root, ".blob-upload-state.json");
const publicRoot = path.join(root, "public", "portfolio-static");

function readJson(filePath, fallback = null) {
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf8")) : fallback;
}

function writeJson(filePath, payload) {
  const temporary = `${filePath}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  fs.renameSync(temporary, filePath);
}

function localUrl(storagePath) {
  return `/portfolio-static/${storagePath.split("/").map(encodeURIComponent).join("/")}`;
}

function safeDestination(storagePath) {
  const destination = path.resolve(publicRoot, ...storagePath.split("/"));
  const relative = path.relative(publicRoot, destination);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`不安全的静态文件路径：${storagePath}`);
  return destination;
}

const library = readJson(libraryPath);
const prepared = readJson(preparedPath, { records: {} });
const state = readJson(statePath, { uploaded: {} });
if (!library?.media?.length) throw new Error("作品索引为空。");

const preparedById = new Map(Object.values(prepared.records || {}).map((item) => [String(item?.media?.id), item]));
const stateById = new Map(Object.entries(state.uploaded || {}).map(([source, item]) => [String(item?.record?.media?.id), { source, item }]));
const oldToNew = new Map();
let copied = 0;
let bytes = 0;

for (const media of library.media) {
  const preparedItem = preparedById.get(String(media.id));
  if (!preparedItem?.preview_path || !fs.existsSync(preparedItem.preview_path)) throw new Error(`缺少本机预览文件：${media.id} ${media.title}`);
  const storagePath = String(media.storage_path || preparedItem.pathname || "");
  if (!storagePath) throw new Error(`缺少持久路径：${media.id}`);
  const destination = safeDestination(storagePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(preparedItem.preview_path, destination);
  const nextUrl = localUrl(storagePath);
  oldToNew.set(media.file_path, nextUrl);
  media.blob_url = media.file_path;
  media.file_path = nextUrl;
  const stateItem = stateById.get(String(media.id));
  if (stateItem) stateItem.item.local_url = nextUrl;
  copied += 1;
  bytes += fs.statSync(destination).size;
}

const byProject = new Map();
for (const media of library.media) {
  const list = byProject.get(String(media.project_slug)) || [];
  list.push(media);
  byProject.set(String(media.project_slug), list);
}
for (const project of library.projects || []) {
  const first = byProject.get(String(project.slug))?.[0];
  project.cover_image = oldToNew.get(project.cover_image) || first?.file_path || "";
  project.series_cover = oldToNew.get(project.series_cover) || project.cover_image;
}
for (const category of library.categories || []) {
  category.cover_image = oldToNew.get(category.cover_image) || library.media.find((item) => item.category_slug === category.slug)?.file_path || "";
}

library.version = 4;
library.static_assets = true;
library.localized_at = new Date().toISOString();
writeJson(libraryPath, library);
writeJson(statePath, state);
process.stdout.write(`${JSON.stringify({ copied, megabytes: Math.round(bytes / 1024 / 1024 * 100) / 100, media: library.media.length, projects: library.projects.length })}\n`);
