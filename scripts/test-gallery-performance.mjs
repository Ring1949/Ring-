#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4179";

async function json(pathname) {
  const response = await fetch(`${baseUrl}${pathname}`);
  assert.equal(response.ok, true, `${pathname} returned ${response.status}`);
  return { response, payload: await response.json() };
}

const generated = JSON.parse(fs.readFileSync(new URL("../public/generated/photo-library.json", import.meta.url), "utf8"));
assert.equal(generated.version, 4, "the durable static index must use version 4");
assert.equal(generated.categories.length, 1, "product photography is no longer a top-level category");
assert.equal(generated.categories[0].slug, "photo");
assert.equal(generated.projects.length, 34, "all photography projects must remain");
assert.equal(generated.media.length, 1203, "exactly 1,000 of the original 2,203 public photos must be removed");
assert.equal(generated.media.every((item) => item.category_slug === "photo"), true);
assert.equal(generated.media.filter((item) => item.collection_slug === "product").length, 723, "product photography remains a photography subcollection");
assert.equal(generated.media.every((item) => String(item.file_path).startsWith("/portfolio-static/")), true, "public photos must use durable in-repository URLs");

const first = await json("/api/database?view=gallery&category=photo&filter=product&limit=24");
assert.equal(first.payload.items.length, 24, "gallery should return one small first page");
assert.equal(first.payload.total, 723, "the retained product collection count must match the pruned index");
assert.equal(first.payload.items.every((item) => item.category_slug === "photo"), true, "product items must report the canonical photography category");
assert.equal(first.payload.hasMore, true);
assert.ok(first.payload.nextCursor);
assert.match(first.response.headers.get("cache-control") || "", /s-maxage=300/);
assert.ok(Number(first.payload.items[0].width) > 0 && Number(first.payload.items[0].height) > 0, "image dimensions are required");
assert.equal("description" in first.payload.items[0], false, "gallery must not expose full detail fields");
assert.equal("camera" in first.payload.items[0], false, "EXIF must be loaded on demand");

const firstBytes = Buffer.byteLength(JSON.stringify(first.payload));
assert.ok(firstBytes < 30_000, `first gallery payload is too large: ${firstBytes} bytes`);

const second = await json(`/api/database?view=gallery&category=photo&filter=product&limit=24&cursor=${encodeURIComponent(first.payload.nextCursor)}`);
const firstIds = new Set(first.payload.items.map((item) => String(item.id)));
assert.equal(second.payload.items.some((item) => firstIds.has(String(item.id))), false, "cursor pages must not overlap");

const filtered = await json("/api/database?view=gallery&category=photo&filter=ring&limit=24");
assert.ok(filtered.payload.total > 0 && filtered.payload.total < first.payload.total, "server-side subcategory filter should narrow results");

const query = encodeURIComponent(first.payload.items[0].title);
const searched = await json(`/api/database?view=gallery&category=photo&filter=product&q=${query}&limit=24`);
assert.ok(searched.payload.items.some((item) => String(item.id) === String(first.payload.items[0].id)), "server-side search should find the selected title");

const detail = await json(`/api/database?view=detail&id=${encodeURIComponent(first.payload.items[0].id)}`);
assert.equal(String(detail.payload.id), String(first.payload.items[0].id));
assert.ok("camera" in detail.payload && "description" in detail.payload, "detail should retain metadata");

const legacy = await json("/api/database?category=product&page=0&limit=2");
assert.equal(Array.isArray(legacy.payload), true, "legacy API must remain an array");
assert.equal(legacy.payload.length, 2);
assert.equal(legacy.payload.every((item) => item.category_slug === "photo"), true, "legacy product links must return canonical photography records");

const legacyGallery = await json("/api/database?view=gallery&category=product&limit=24");
assert.equal(legacyGallery.payload.total, 723, "legacy category=product links must retain the product subcollection");
assert.equal(legacyGallery.payload.items.every((item) => item.category_slug === "photo"), true);

process.stdout.write(`${JSON.stringify({ firstPageItems: first.payload.items.length, firstPageBytes: firstBytes, total: first.payload.total, filtered: filtered.payload.total, legacyCompatible: true })}\n`);
