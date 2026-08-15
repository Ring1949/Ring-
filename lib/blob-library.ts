import {
  del as deleteVercelBlob,
  get as getVercelBlob,
  head as headVercelBlob,
  list as listVercelBlobs,
  put as putVercelBlob
} from "@vercel/blob";
import { deleteR2Object, r2Configured, readLatestR2Json, verifyR2Object, writeR2Json } from "@/lib/r2";

export const SKILL_FILE_PREFIX = "skill-library/files/";
export const MEDIA_FILE_PREFIX = "portfolio/admin/";
const SKILL_MANIFEST_PREFIX = "site-state/v1/skill-library/";
const MEDIA_MANIFEST_PREFIX = "site-state/v1/media-library/";
const PORTFOLIO_COVER_MANIFEST_PREFIX = "site-state/v1/portfolio-covers/";

export const DEFAULT_SKILL_MAX_BYTES = 100 * 1024 * 1024;
export const DEFAULT_MEDIA_MAX_BYTES = 250 * 1024 * 1024;

export type SkillCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  sort_order: number;
};

export type SkillRecord = {
  id: string;
  name: string;
  slug: string;
  category_id: string;
  category_name: string;
  category_slug: string;
  description: string;
  original_name: string;
  pathname: string;
  url: string;
  download_url: string;
  size: number;
  content_type: string;
  version: number;
  storage_state: "verified" | "missing" | "error";
  created_at: string;
  updated_at: string;
  last_verified_at: string;
  storage_provider?: "vercel-blob" | "r2";
  object_key?: string;
};

export type SkillManifest = {
  version: number;
  updated_at: string;
  categories: SkillCategory[];
  skills: SkillRecord[];
};

export type BlobMediaRecord = Record<string, unknown> & {
  id: string;
  title: string;
  file_path: string;
  download_url: string;
  storage_path: string;
  original_name: string;
  size: number;
  mime_type: string;
  media_type: string;
  category_id: number | null;
  category_name: string;
  category_slug: string;
  project_id: number | null;
  project_title: string;
  project_slug: string;
  show_in_database: number;
  created_at: string;
  updated_at: string;
  storage_provider?: "vercel-blob" | "r2";
  object_key?: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
};

type MediaManifest = { version: number; updated_at: string; media: BlobMediaRecord[] };
type ManifestObject = { pathname: string; uploadedAt: Date; url: string };

const defaultSkillCategories: SkillCategory[] = [
  { id: "writing", name: "写作", slug: "writing", description: "小说创作、编辑与叙事工作流。", sort_order: 10 },
  { id: "visual", name: "视觉", slug: "visual", description: "摄影、设计与图像生产。", sort_order: 20 },
  { id: "research", name: "研究", slug: "research", description: "资料整理、检索与分析。", sort_order: 30 },
  { id: "automation", name: "自动化", slug: "automation", description: "重复任务与生产流程。", sort_order: 40 },
  { id: "other", name: "其他", slug: "other", description: "尚未归入固定方向的 Skill。", sort_order: 90 }
];

const emptySkillManifest = (): SkillManifest => ({
  version: 1,
  updated_at: new Date(0).toISOString(),
  categories: defaultSkillCategories,
  skills: []
});
const emptyMediaManifest = (): MediaManifest => ({ version: 1, updated_at: new Date(0).toISOString(), media: [] });

function vercelToken() {
  const value = process.env.BLOB_READ_WRITE_TOKEN;
  if (!value) throw new Error("网站尚未连接现有的 Vercel Blob 文件存储。");
  return value;
}

export function blobStorageConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function storageErrorMessage(error: unknown, fallback = "文件存储暂时不可用，请稍后重试。") {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/store has been suspended|BlobStoreSuspended/i.test(message)) {
    return "现有 Vercel Blob 存储已被平台暂停。文件仍然保留，但恢复前不能上传新文件；请在 Vercel Storage 中恢复该存储后重试。";
  }
  if (/BLOB_READ_WRITE_TOKEN|not connected|尚未连接/i.test(message)) {
    return "网站尚未连接现有的 Vercel Blob 存储，请检查部署环境变量。";
  }
  return message || fallback;
}

export function slugifyLabel(value: string, fallback = "item") {
  const normalized = String(value || "")
    .trim()
    .toLocaleLowerCase("zh-CN")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

async function listManifestObjects(prefix: string) {
  let cursor: string | undefined;
  const objects: ManifestObject[] = [];
  let pages = 0;
  do {
    const page = await listVercelBlobs({ prefix, limit: 1000, cursor, token: vercelToken() });
    objects.push(...page.blobs.map((blob) => ({ pathname: blob.pathname, uploadedAt: new Date(blob.uploadedAt), url: blob.url })));
    cursor = page.cursor;
    pages += 1;
  } while (cursor && pages < 20);
  return objects;
}

async function readLatestManifest<T>(prefix: string, fallback: () => T): Promise<T> {
  if (r2Configured()) {
    const r2Manifest = await readLatestR2Json<T>(prefix).catch(() => null);
    if (r2Manifest) return r2Manifest;
  }
  if (!blobStorageConfigured()) return fallback();
  const objects = (await listManifestObjects(prefix)).filter((item) => item.pathname.endsWith(".json"));
  objects.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
  if (!objects[0]) return fallback();
  const response = await getVercelBlob(objects[0].url, { access: "public", token: vercelToken() });
  if (!response || response.statusCode !== 200 || !response.stream) return fallback();
  const text = await new Response(response.stream).text();
  return text ? JSON.parse(text) as T : fallback();
}

async function appendManifest(prefix: string, payload: unknown) {
  if (r2Configured()) {
    await writeR2Json(prefix, payload);
    return;
  }
  const pathname = `${prefix}${Date.now()}-${crypto.randomUUID()}.json`;
  await putVercelBlob(pathname, JSON.stringify(payload, null, 2), {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json; charset=utf-8",
    cacheControlMaxAge: 31_536_000,
    token: vercelToken()
  });
}

export async function getSkillManifest() {
  const manifest = await readLatestManifest(SKILL_MANIFEST_PREFIX, emptySkillManifest);
  return {
    ...emptySkillManifest(),
    ...manifest,
    categories: Array.isArray(manifest.categories) && manifest.categories.length ? manifest.categories : defaultSkillCategories,
    skills: Array.isArray(manifest.skills) ? manifest.skills : []
  } satisfies SkillManifest;
}

export async function saveSkillManifest(manifest: SkillManifest) {
  const next: SkillManifest = {
    ...manifest,
    version: Math.max(1, Number(manifest.version) || 1) + 1,
    updated_at: new Date().toISOString()
  };
  await appendManifest(SKILL_MANIFEST_PREFIX, next);
  return next;
}

export async function getBlobMediaRecords() {
  const manifest = await readLatestManifest(MEDIA_MANIFEST_PREFIX, emptyMediaManifest);
  return Array.isArray(manifest.media) ? manifest.media : [];
}

export async function saveBlobMediaRecords(media: BlobMediaRecord[]) {
  const current = await readLatestManifest(MEDIA_MANIFEST_PREFIX, emptyMediaManifest);
  const next: MediaManifest = {
    version: Math.max(1, Number(current.version) || 1) + 1,
    updated_at: new Date().toISOString(),
    media
  };
  await appendManifest(MEDIA_MANIFEST_PREFIX, next);
  return next;
}

export async function getPortfolioCoverOverrides() {
  const { normalizeCoverOverrides } = await import("@/lib/portfolio-state");
  return normalizeCoverOverrides(await readLatestManifest(PORTFOLIO_COVER_MANIFEST_PREFIX, () => ({
    version: 1,
    updated_at: new Date(0).toISOString(),
    categories: {},
    projects: {}
  })));
}

export async function savePortfolioCoverOverrides(overrides: unknown) {
  const { normalizeCoverOverrides } = await import("@/lib/portfolio-state");
  const current = normalizeCoverOverrides(overrides);
  const next = {
    ...current,
    version: Math.max(1, Number(current.version) || 1) + 1,
    updated_at: new Date().toISOString()
  };
  await appendManifest(PORTFOLIO_COVER_MANIFEST_PREFIX, next);
  return next;
}

export async function verifyUploadedBlob(input: {
  url: string;
  pathname: string;
  expectedSize: number;
  prefix: string;
  maximumSize: number;
}) {
  if (!input.pathname.startsWith(input.prefix)) throw new Error("文件路径不属于当前文件库。");
  if (input.expectedSize <= 0) throw new Error("文件大小无效。");
  if (input.expectedSize > input.maximumSize) {
    throw new Error(`单个文件不能超过 ${Math.round(input.maximumSize / 1024 / 1024)} MB。`);
  }
  const metadata = await headVercelBlob(input.url, { token: vercelToken() });
  if (metadata.pathname !== input.pathname) throw new Error("上传完成后的文件路径校验失败。");
  if (Number(metadata.size) !== Number(input.expectedSize)) {
    throw new Error("上传后的文件大小与本机文件不一致，请重新上传。");
  }
  return metadata;
}

export async function verifyUploadedObject(input: {
  url: string;
  pathname: string;
  expectedSize: number;
  prefix: string;
  maximumSize: number;
  storageProvider?: string;
}) {
  if (input.storageProvider === "r2") {
    if (input.expectedSize <= 0 || input.expectedSize > input.maximumSize) throw new Error("文件大小无效或超过限制。");
    const metadata = await verifyR2Object(input.pathname, input.expectedSize);
    if (!metadata.pathname.startsWith(input.prefix)) throw new Error("R2 文件路径不属于当前文件库。");
    return metadata;
  }
  return { ...(await verifyUploadedBlob(input)), provider: "vercel-blob" as const };
}

export async function removeBlobFile(url: string) {
  if (url) await deleteVercelBlob(url, { token: vercelToken() });
}

export async function removeStoredFile(input: { url: string; pathname?: string; storageProvider?: string }) {
  if (input.storageProvider === "r2") {
    if (input.pathname) await deleteR2Object(input.pathname);
    return;
  }
  await removeBlobFile(input.url);
}

export async function getBlobStorageSnapshot() {
  let cursor: string | undefined;
  let count = 0;
  let size = 0;
  let pages = 0;
  do {
    const page = await listVercelBlobs({ limit: 1000, cursor, token: vercelToken() });
    count += page.blobs.length;
    size += page.blobs.reduce((total, blob) => total + Number(blob.size || 0), 0);
    cursor = page.cursor;
    pages += 1;
  } while (cursor && pages < 20);
  return {
    configured: true,
    provider: "vercel-blob",
    object_count: count,
    size_bytes: size,
    size_mb: Math.round(size / 1024 / 1024 * 100) / 100,
    checked_at: new Date().toISOString()
  };
}

export async function checkBlobWritable() {
  const pathname = `site-state/v1/health/write-probe-${Date.now()}-${crypto.randomUUID()}.txt`;
  const uploaded = await putVercelBlob(pathname, "ok", {
    access: "public",
    addRandomSuffix: false,
    contentType: "text/plain; charset=utf-8",
    cacheControlMaxAge: 60,
    token: vercelToken()
  });
  try {
    const metadata = await headVercelBlob(uploaded.url, { token: vercelToken() });
    if (metadata.size !== 2) throw new Error("存储写入校验失败。");
    return { writable: true, checked_at: new Date().toISOString() };
  } finally {
    await deleteVercelBlob(uploaded.url, { token: vercelToken() });
  }
}
