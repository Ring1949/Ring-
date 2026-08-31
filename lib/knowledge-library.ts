import { deleteR2Object, r2Configured, readLatestR2Json, verifyR2Object, writeR2Json } from "@/lib/r2";

export const KNOWLEDGE_IMAGE_PREFIX = "knowledge-library/images/";
const KNOWLEDGE_MANIFEST_PREFIX = "site-state/v1/knowledge-library/";
export const DEFAULT_KNOWLEDGE_TAGS = ["电影", "美术", "摄影", "建模", "乐理", "服装", "人", "材质", "空间"];

export type KnowledgeRecord = {
  id: string;
  title: string;
  summary: string;
  content: string;
  source_url: string;
  tags: string[];
  image_url: string;
  image_pathname: string;
  image_name: string;
  storage_provider?: "r2";
  object_key?: string;
  created_at: string;
  updated_at: string;
};

export type KnowledgeManifest = {
  version: number;
  updated_at: string;
  cards: KnowledgeRecord[];
};

const initialManifest: KnowledgeManifest = {
  version: 1,
  updated_at: "2026-01-01T00:00:00.000Z",
  cards: []
};

export async function getKnowledgeManifest(): Promise<KnowledgeManifest> {
  if (!r2Configured()) return initialManifest;
  const current = await readLatestR2Json<KnowledgeManifest>(KNOWLEDGE_MANIFEST_PREFIX).catch(() => null);
  if (!current) return initialManifest;
  return {
    version: Number(current.version) || 1,
    updated_at: String(current.updated_at || initialManifest.updated_at),
    cards: Array.isArray(current.cards) ? current.cards : []
  };
}

export async function saveKnowledgeManifest(manifest: KnowledgeManifest) {
  if (!r2Configured()) throw new Error("Cloudflare R2 未配置，知识卡片无法持久保存。");
  const next = { ...manifest, version: manifest.version + 1, updated_at: new Date().toISOString() };
  await writeR2Json(KNOWLEDGE_MANIFEST_PREFIX, next);
  return next;
}

export async function verifyKnowledgeImage(image: { pathname: string; object_key?: string; storage_provider?: string; size: number }) {
  const objectKey = image.object_key || image.pathname;
  if (image.storage_provider !== "r2" || !objectKey.startsWith(KNOWLEDGE_IMAGE_PREFIX)) throw new Error("知识卡片图片必须上传到知识库目录。");
  if (image.size <= 0 || image.size > 20 * 1024 * 1024) throw new Error("知识卡片图片最大为 20 MB。");
  const metadata = await verifyR2Object(objectKey, image.size);
  if (!String(metadata.contentType || "").startsWith("image/")) throw new Error("只能上传图片文件。");
}

export async function removeKnowledgeImage(record: Pick<KnowledgeRecord, "storage_provider" | "object_key">) {
  if (record.storage_provider === "r2" && record.object_key) await deleteR2Object(record.object_key);
}
