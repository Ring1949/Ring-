#!/usr/bin/env node

import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { put } from "@vercel/blob";

function parseArgs(argv) {
  const args = { env: ".env.photo-import", prepared: ".photo-import-prepared.json", state: ".blob-upload-state.json", source: "all", limit: 0, workers: 4, generateOnly: false };
  for (let i = 0; i < argv.length; i += 1) {
    const name = argv[i];
    if (name === "--env") args.env = argv[++i];
    else if (name === "--prepared") args.prepared = argv[++i];
    else if (name === "--state") args.state = argv[++i];
    else if (name === "--source") args.source = argv[++i];
    else if (name === "--limit") args.limit = Number(argv[++i] || 0);
    else if (name === "--workers") args.workers = Math.max(1, Number(argv[++i] || 4));
    else if (name === "--generate-only") args.generateOnly = true;
  }
  return args;
}

function parseEnv(path) {
  const values = {};
  for (const sourceLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = sourceLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[key] = value;
  }
  return values;
}

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value, pretty = true) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, JSON.stringify(value, null, pretty ? 2 : 0), "utf8");
  renameSync(temporary, path);
}

function generatedPayload(uploaded) {
  const media = Object.values(uploaded).map((item) => {
    const { show_in_inspiration: _removedChannelFlag, ...source } = item.record.media;
    const product = item.record.root_kind === "product"
      || source.collection_slug === "product"
      || String(source.project_slug || "").startsWith("product-");
    return {
      ...source,
      file_path: item.url,
      category_id: 1,
      category_name: "摄影",
      category_slug: "photo",
      collection_slug: product ? "product" : "photo"
    };
  });
  media.sort((a, b) => String(a.category_slug).localeCompare(String(b.category_slug)) || String(a.project_title).localeCompare(String(b.project_title), "zh-CN") || Number(a.sort_order) - Number(b.sort_order));
  const projectsBySlug = new Map();
  for (const item of media) {
    let project = projectsBySlug.get(item.project_slug);
    if (!project) {
      project = {
        id: item.project_id,
        title: item.project_title,
        subtitle: item.collection_slug === "product" ? "珠宝、静物与商业产品视觉" : "现场、人物与时代切片",
        slug: item.project_slug,
        category_id: item.category_id,
        category_name: item.category_name,
        category_slug: item.category_slug,
        collection_slug: item.collection_slug,
        description: `${item.project_title}公开作品集，收录经网页优化的高清预览。`,
        cover_image: "",
        year: item.project_year,
        location: item.project_location,
        is_featured: 0,
        is_recommended: 1,
        is_series: 1,
        series_style: item.collection_slug === "product" ? "product-neutral" : "documentary-light",
        series_cover: "",
        series_media_type: "image",
        status: "published",
        tags: item.tags,
        sort_order: 1000 + projectsBySlug.size,
        media_count: 0
      };
      projectsBySlug.set(item.project_slug, project);
    }
    project.media_count += 1;
    if (!project.cover_image || item.is_cover) {
      project.cover_image = item.file_path;
      project.series_cover = item.file_path;
      project.series_media_type = item.media_type;
    }
  }
  const projects = [...projectsBySlug.values()];
  const photoCover = media.find((item) => item.collection_slug === "photo")?.file_path || media[0]?.file_path || "";
  const categories = [
    { id: 1, name: "摄影", slug: "photo", description: "人物、现场、城市、产品与观看方式。", cover_image: photoCover, sort_order: 1, is_primary: 1, project_count: projects.length }
  ];
  return { version: 3, generated_at: new Date().toISOString(), categories, projects, media };
}

async function uploadOne(record, token) {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const blob = await put(record.pathname, createReadStream(record.preview_path), {
        access: "public",
        token,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: record.content_type,
        cacheControlMaxAge: 31_536_000,
        multipart: Number(record.size) > 4 * 1024 * 1024
      });
      return { record, url: blob.url, downloadUrl: blob.downloadUrl, uploaded_at: new Date().toISOString() };
    } catch (error) {
      lastError = error;
      if (attempt < 4) await new Promise((resolveDelay) => setTimeout(resolveDelay, Math.min(20_000, 1000 * 2 ** attempt)));
    }
  }
  throw lastError;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const statePath = resolve(args.state);
  const state = readJson(statePath, { uploaded: {}, failed: {} });
  state.uploaded ||= {};
  state.failed ||= {};
  if (args.generateOnly) {
    const payload = generatedPayload(state.uploaded);
    writeJson(resolve("public/generated/photo-library.json"), payload, false);
    console.log(`Generated index only: media=${payload.media.length}, projects=${payload.projects.length}, categories=${payload.categories.length}`);
    return;
  }
  const env = parseEnv(resolve(args.env));
  const token = env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is missing from the selected environment file");
  const prepared = readJson(resolve(args.prepared), { records: {} });
  let pending = Object.values(prepared.records).filter((record) => args.source === "all" || record.root_kind === args.source);
  pending = pending.filter((record) => !state.uploaded[record.source]);
  if (args.limit > 0) pending = pending.slice(0, args.limit);
  console.log(`Uploading ${pending.length} prepared previews with ${args.workers} workers`);
  let cursor = 0;
  let completed = 0;
  const workers = Array.from({ length: args.workers }, async () => {
    while (cursor < pending.length) {
      const record = pending[cursor++];
      try {
        const result = await uploadOne(record, token);
        state.uploaded[record.source] = result;
        delete state.failed[record.source];
        completed += 1;
        console.log(`[${completed}/${pending.length}] uploaded: ${record.media.title}`);
      } catch (error) {
        state.failed[record.source] = { record, error: error instanceof Error ? error.message : String(error) };
        completed += 1;
        console.error(`[${completed}/${pending.length}] FAILED: ${record.relative} — ${state.failed[record.source].error}`);
      }
      writeJson(statePath, state);
      writeJson(resolve("public/generated/photo-library.json"), generatedPayload(state.uploaded), false);
    }
  });
  await Promise.all(workers);
  const payload = generatedPayload(state.uploaded);
  writeJson(resolve("public/generated/photo-library.json"), payload, false);
  console.log(`Finished: uploaded_total=${Object.keys(state.uploaded).length}, failed=${Object.keys(state.failed).length}, public_media=${payload.media.length}`);
  const sample = payload.media[0]?.file_path;
  if (sample) console.log(`Public sample: ${sample}`);
  if (Object.keys(state.failed).length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
