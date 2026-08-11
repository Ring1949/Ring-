#!/usr/bin/env node
/** Backfill derived WebP preview dimensions without touching source photos. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const libraryPath = path.join(root, "public", "generated", "photo-library.json");
const preparedPath = path.join(root, ".photo-import-prepared.json");
const backupDir = path.join(root, "docs", "data-backups");

function uint24le(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function webpSize(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.length < 30 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") return null;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString("ascii", offset, offset + 4);
    const length = buffer.readUInt32LE(offset + 4);
    const payload = offset + 8;
    if (type === "VP8X" && payload + 10 <= buffer.length) {
      return { width: uint24le(buffer, payload + 4) + 1, height: uint24le(buffer, payload + 7) + 1 };
    }
    if (type === "VP8 " && payload + 10 <= buffer.length && buffer[payload + 3] === 0x9d && buffer[payload + 4] === 0x01 && buffer[payload + 5] === 0x2a) {
      return { width: buffer.readUInt16LE(payload + 6) & 0x3fff, height: buffer.readUInt16LE(payload + 8) & 0x3fff };
    }
    if (type === "VP8L" && payload + 5 <= buffer.length && buffer[payload] === 0x2f) {
      const b1 = buffer[payload + 1];
      const b2 = buffer[payload + 2];
      const b3 = buffer[payload + 3];
      const b4 = buffer[payload + 4];
      return { width: 1 + (((b2 & 0x3f) << 8) | b1), height: 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6)) };
    }
    offset = payload + length + (length % 2);
  }
  return null;
}

function atomicJson(filePath, value) {
  const temporary = `${filePath}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temporary, filePath);
}

const library = JSON.parse(fs.readFileSync(libraryPath, "utf8"));
const prepared = JSON.parse(fs.readFileSync(preparedPath, "utf8"));
const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(libraryPath, path.join(backupDir, `photo-library-before-dimensions-${stamp}.json`));
fs.copyFileSync(preparedPath, path.join(backupDir, `photo-import-prepared-before-dimensions-${stamp}.json`));

const dimensions = new Map();
let missingOrVideo = 0;
for (const record of Object.values(prepared.records || {})) {
  const media = record.media || {};
  const pathname = String(record.pathname || media.storage_path || "");
  const previewPath = String(record.preview_path || "");
  if (!pathname || !previewPath || !fs.existsSync(previewPath) || media.media_type === "video") {
    missingOrVideo += 1;
    continue;
  }
  const size = webpSize(previewPath);
  if (!size?.width || !size?.height) {
    missingOrVideo += 1;
    continue;
  }
  const aspectRatio = Number((size.width / size.height).toFixed(6));
  dimensions.set(pathname, { ...size, aspectRatio });
  media.width = size.width;
  media.height = size.height;
  media.aspect_ratio = aspectRatio;
}

let updated = 0;
for (const media of library.media || []) {
  const size = dimensions.get(String(media.storage_path || ""));
  if (!size) continue;
  media.width = size.width;
  media.height = size.height;
  media.aspect_ratio = size.aspectRatio;
  updated += 1;
}
library.dimensions_backfilled_at = new Date().toISOString();
atomicJson(preparedPath, prepared);
atomicJson(libraryPath, library);
process.stdout.write(`${JSON.stringify({ updated, available: dimensions.size, missingOrVideo })}\n`);
if (!updated) process.exitCode = 1;
