import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const R2_REGION = "auto";
const PRESIGNED_UPLOAD_TTL_SECONDS = 15 * 60;

export type R2UploadKind = "media" | "cover" | "graph" | "skill" | "prompt" | "poetry" | "thumbnail" | "legacy-media";

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
};

let client: S3Client | null = null;

function env(name: "R2_ACCOUNT_ID" | "R2_ACCESS_KEY_ID" | "R2_SECRET_ACCESS_KEY" | "R2_BUCKET_NAME" | "R2_ENDPOINT") {
  return String(process.env[name] || "").trim();
}

export function r2Configured() {
  return Boolean(env("R2_ACCOUNT_ID") && env("R2_ACCESS_KEY_ID") && env("R2_SECRET_ACCESS_KEY") && env("R2_BUCKET_NAME") && env("R2_ENDPOINT"));
}

export function getR2Config(): R2Config {
  const config = {
    accountId: env("R2_ACCOUNT_ID"),
    accessKeyId: env("R2_ACCESS_KEY_ID"),
    secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
    bucket: env("R2_BUCKET_NAME"),
    endpoint: env("R2_ENDPOINT").replace(/\/$/, "")
  };
  const missing = Object.entries(config).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) throw new Error(`R2 is not configured: missing ${missing.join(", ")}`);
  return config;
}

export function getR2Client() {
  if (client) return client;
  const config = getR2Config();
  client = new S3Client({
    region: R2_REGION,
    endpoint: config.endpoint,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
  });
  return client;
}

export function safeObjectName(filename: string) {
  const normalized = String(filename || "file")
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 140);
  return normalized || "file";
}

function prefixFor(kind: R2UploadKind) {
  const day = new Date().toISOString().slice(0, 10);
  if (kind === "skill") return "skill-library/files";
  if (kind === "cover") return "portfolio/admin/covers";
  if (kind === "graph") return "portfolio/admin/graph-nodes";
  if (kind === "prompt") return "prompt-library/images";
  if (kind === "poetry") return "poetry-library/images";
  if (kind === "legacy-media") return `media/${day}`;
  return "portfolio/admin";
}

export function maximumUploadBytes(kind: R2UploadKind) {
  if (kind === "skill") return Number(process.env.SKILL_FILE_MAX_BYTES) || 100 * 1024 * 1024;
  if (kind === "cover" || kind === "graph" || kind === "prompt" || kind === "poetry") return 20 * 1024 * 1024;
  if (kind === "thumbnail") return 2 * 1024 * 1024;
  return Number(process.env.MEDIA_FILE_MAX_BYTES) || 250 * 1024 * 1024;
}

export function assertObjectKey(key: string) {
  if (!key || key.startsWith("/") || key.includes("..") || key.includes("\\") || Buffer.byteLength(key, "utf8") > 1024) {
    throw new Error("Invalid R2 object key");
  }
  return key;
}

export function createObjectKey(kind: R2UploadKind, filename: string, parentKey = "") {
  if (kind === "thumbnail") {
    const parent = assertObjectKey(parentKey);
    return assertObjectKey(`thumbnails/${parent}.webp`);
  }
  return assertObjectKey(`${prefixFor(kind)}/${crypto.randomUUID()}-${safeObjectName(filename)}`);
}

function encodeKey(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}

export function publicR2Url(key: string, origin = "") {
  const publicBase = String(process.env.R2_PUBLIC_BASE_URL || "").trim().replace(/\/$/, "");
  if (publicBase) return `${publicBase}/${encodeKey(assertObjectKey(key))}`;
  return `${origin.replace(/\/$/, "")}/api/r2/object/${encodeKey(assertObjectKey(key))}`;
}

export function thumbnailR2Url(key: string, origin = "") {
  return publicR2Url(`thumbnails/${assertObjectKey(key)}.webp`, origin);
}

export async function createR2PresignedUpload(input: {
  kind: R2UploadKind;
  filename: string;
  contentType: string;
  size: number;
  origin?: string;
  parentKey?: string;
}) {
  const maximum = maximumUploadBytes(input.kind);
  if (!Number.isFinite(input.size) || input.size <= 0 || input.size > maximum) {
    throw new Error(`File size must be between 1 byte and ${Math.round(maximum / 1024 / 1024)} MB`);
  }
  const config = getR2Config();
  const key = createObjectKey(input.kind, input.filename, input.parentKey);
  const contentType = String(input.contentType || "application/octet-stream").slice(0, 200);
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable"
  });
  const uploadUrl = await getSignedUrl(getR2Client(), command, { expiresIn: PRESIGNED_UPLOAD_TTL_SECONDS });
  return {
    provider: "r2" as const,
    upload_url: uploadUrl,
    signed_url: uploadUrl,
    upload_headers: { "Content-Type": contentType },
    object_key: key,
    pathname: key,
    storage_path: key,
    url: publicR2Url(key, input.origin),
    public_url: publicR2Url(key, input.origin),
    content_type: contentType,
    expires_at: new Date(Date.now() + PRESIGNED_UPLOAD_TTL_SECONDS * 1000).toISOString()
  };
}

export async function verifyR2Object(key: string, expectedSize = 0) {
  const config = getR2Config();
  const objectKey = assertObjectKey(key);
  const result = await getR2Client().send(new HeadObjectCommand({ Bucket: config.bucket, Key: objectKey }));
  const size = Number(result.ContentLength || 0);
  if (expectedSize > 0 && size !== expectedSize) throw new Error("R2 upload verification failed: object size does not match the selected file.");
  return {
    provider: "r2" as const,
    pathname: objectKey,
    key: objectKey,
    url: publicR2Url(objectKey),
    downloadUrl: publicR2Url(objectKey),
    size,
    contentType: result.ContentType || "application/octet-stream",
    etag: result.ETag || ""
  };
}

export async function getR2Object(key: string) {
  const config = getR2Config();
  return getR2Client().send(new GetObjectCommand({ Bucket: config.bucket, Key: assertObjectKey(key) }));
}

export async function readLatestR2Json<T>(prefix: string): Promise<T | null> {
  const config = getR2Config();
  const page = await getR2Client().send(new ListObjectsV2Command({ Bucket: config.bucket, Prefix: assertObjectKey(prefix), MaxKeys: 1000 }));
  const latest = (page.Contents || [])
    .filter((item) => item.Key?.endsWith(".json"))
    .sort((a, b) => Number(b.LastModified || 0) - Number(a.LastModified || 0))[0];
  if (!latest?.Key) return null;
  const object = await getR2Object(latest.Key);
  const text = await object.Body?.transformToString();
  return text ? JSON.parse(text) as T : null;
}

export async function writeR2Json(prefix: string, payload: unknown) {
  const config = getR2Config();
  const key = assertObjectKey(`${prefix}${Date.now()}-${crypto.randomUUID()}.json`);
  await getR2Client().send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: JSON.stringify(payload, null, 2),
    ContentType: "application/json; charset=utf-8",
    CacheControl: "private, no-store"
  }));
  return key;
}

export async function deleteR2Object(key: string) {
  const config = getR2Config();
  await getR2Client().send(new DeleteObjectCommand({ Bucket: config.bucket, Key: assertObjectKey(key) }));
}

export async function getR2StorageSnapshot() {
  const config = getR2Config();
  let continuationToken: string | undefined;
  let count = 0;
  let size = 0;
  let pages = 0;
  do {
    const page = await getR2Client().send(new ListObjectsV2Command({
      Bucket: config.bucket,
      ContinuationToken: continuationToken,
      MaxKeys: 1000
    }));
    count += page.Contents?.length || 0;
    size += (page.Contents || []).reduce((total, item) => total + Number(item.Size || 0), 0);
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    pages += 1;
  } while (continuationToken && pages < 20);
  return {
    configured: true,
    provider: "cloudflare-r2",
    object_count: count,
    size_bytes: size,
    size_mb: Math.round(size / 1024 / 1024 * 100) / 100,
    checked_at: new Date().toISOString()
  };
}

export async function checkR2Writable() {
  const config = getR2Config();
  const key = `site-state/v1/health/write-probe-${Date.now()}-${crypto.randomUUID()}.txt`;
  await getR2Client().send(new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: "ok", ContentType: "text/plain" }));
  try {
    await verifyR2Object(key, 2);
    return { writable: true, checked_at: new Date().toISOString() };
  } finally {
    await deleteR2Object(key);
  }
}
