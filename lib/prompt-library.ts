import { get, list } from "@vercel/blob";
import { deleteR2Object, r2Configured, readLatestR2Json, verifyR2Object, writeR2Json } from "@/lib/r2";

export const PROMPT_IMAGE_PREFIX = "prompt-library/images/";
const PROMPT_MANIFEST_PREFIX = "site-state/v1/prompt-library/";
export const PROMPT_IMAGE_MAX_BYTES = 20 * 1024 * 1024;

export type PromptRecord = {
  id: string;
  title: string;
  category: string;
  description: string;
  content: string;
  tags: string[];
  image_url: string;
  image_pathname: string;
  image_name: string;
  storage_provider?: "r2" | "vercel-blob";
  object_key?: string;
  usage_count: number;
  created_at: string;
  updated_at: string;
};

type PromptManifest = {
  version: number;
  updated_at: string;
  prompts: PromptRecord[];
};

const initialDate = "2025-01-01T00:00:00.000Z";
const defaultPrompts: PromptRecord[] = [
  { id: "novel-plan", category: "写作", title: "长篇小说策划", description: "生成完整的小说世界观、角色设定与情节大纲。", content: "你是一名资深小说策划。请根据我提供的灵感，依次输出：核心命题、世界观边界、主要人物目标与缺陷、三幕冲突链、关键转折、结局方向，以及前十章的章节目标。信息不足时先提出不超过 5 个关键问题，不要擅自补全决定性设定。", tags: ["写作", "创意"], image_url: "", image_pathname: "", image_name: "", usage_count: 18, created_at: initialDate, updated_at: initialDate },
  { id: "style-rewrite", category: "写作", title: "文风改写与保真", description: "在保持原意的基础上，调整文章的语言风格。", content: "请改写下面的文字。保持事实、人物关系、时间顺序和核心含义不变；减少空泛形容词和重复表达；加强节奏与画面感。输出改写稿，并用 3 条简短说明列出主要调整。原文：{{粘贴内容}}", tags: ["写作", "改写"], image_url: "", image_pathname: "", image_name: "", usage_count: 24, created_at: initialDate, updated_at: initialDate },
  { id: "research-map", category: "研究", title: "资料整理助手", description: "提炼要点、分类归纳，生成结构化资料清单。", content: "请整理我提供的资料，不要补写资料中不存在的事实。输出：主题摘要、关键概念、时间线、人物或组织关系、已确认结论、相互矛盾的信息、待核实问题和下一步检索关键词。每条结论标注对应资料来源。", tags: ["研究", "整理"], image_url: "", image_pathname: "", image_name: "", usage_count: 32, created_at: initialDate, updated_at: initialDate },
  { id: "photo-review", category: "视觉", title: "摄影作品分析", description: "从构图、光线和叙事三个层面阅读照片。", content: "请以摄影编辑的视角分析这张照片。分别讨论主体关系、构图秩序、光线与色彩、空间层次、情绪和叙事线索；指出最有效的部分与一个优先改进点。不要猜测无法从画面确认的拍摄背景。", tags: ["视觉", "摄影"], image_url: "", image_pathname: "", image_name: "", usage_count: 27, created_at: initialDate, updated_at: initialDate },
  { id: "meeting-notes", category: "效率", title: "会议纪要生成", description: "将会议记录整理为要点清晰的纪要。", content: "请把下面的会议记录整理成纪要。输出：会议目标、已确认决定、待办事项（负责人、截止时间）、仍有分歧的问题和下次会议需要确认的内容。不得臆测记录中没有的信息。", tags: ["写作", "效率"], image_url: "", image_pathname: "", image_name: "", usage_count: 21, created_at: initialDate, updated_at: initialDate },
  { id: "workflow", category: "自动化", title: "自动化脚本生成", description: "生成可用的脚本代码，提升自动化效率。", content: "请把下面的重复任务拆成自动化流程。标出输入、处理步骤、判断条件、输出、失败重试、人工确认点和日志记录；区分必须人工处理与可以自动执行的部分；最后给出最小可用版本和后续增强版本。任务：{{描述任务}}", tags: ["自动化", "脚本"], image_url: "", image_pathname: "", image_name: "", usage_count: 16, created_at: initialDate, updated_at: initialDate }
];

function token() {
  const value = process.env.BLOB_READ_WRITE_TOKEN;
  if (!value) throw new Error("网站尚未连接 Vercel Blob 持久存储。");
  return value;
}

function fallbackManifest(): PromptManifest {
  return { version: 1, updated_at: initialDate, prompts: defaultPrompts };
}

export async function getPromptManifest(): Promise<PromptManifest> {
  if (r2Configured()) {
    const current = await readLatestR2Json<PromptManifest>(PROMPT_MANIFEST_PREFIX).catch(() => null);
    if (current) return current;
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) return fallbackManifest();
  try {
    const result = await list({ prefix: PROMPT_MANIFEST_PREFIX, limit: 1000, token: token() });
    const latest = result.blobs.filter((item) => item.pathname.endsWith(".json")).sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt))[0];
    if (!latest) return fallbackManifest();
    const response = await get(latest.url, { access: "public", token: token() });
    if (!response || response.statusCode !== 200 || !response.stream) return fallbackManifest();
    const payload = JSON.parse(await new Response(response.stream).text()) as Partial<PromptManifest>;
    return { version: Number(payload.version) || 1, updated_at: String(payload.updated_at || initialDate), prompts: Array.isArray(payload.prompts) ? payload.prompts : defaultPrompts };
  } catch {
    return fallbackManifest();
  }
}

export async function savePromptManifest(manifest: PromptManifest) {
  const next = { ...manifest, version: manifest.version + 1, updated_at: new Date().toISOString() };
  if (!r2Configured()) throw new Error("Cloudflare R2 未配置，新内容无法保存。");
  await writeR2Json(PROMPT_MANIFEST_PREFIX, next);
  return next;
}

export async function verifyPromptImage(image: { url: string; pathname: string; object_key?: string; storage_provider?: string; size: number }) {
  const objectKey = image.object_key || image.pathname;
  if (image.storage_provider !== "r2" || !objectKey.startsWith(PROMPT_IMAGE_PREFIX)) throw new Error("新图片必须上传到 Cloudflare R2。");
  if (image.size <= 0 || image.size > PROMPT_IMAGE_MAX_BYTES) throw new Error("预览图最大为 20 MB。");
  const metadata = await verifyR2Object(objectKey, image.size);
  if (!String(metadata.contentType || "").startsWith("image/")) throw new Error("只能上传图片文件。");
}

export async function removePromptImage(record: Pick<PromptRecord, "storage_provider" | "object_key">) {
  if (record.storage_provider === "r2" && record.object_key) await deleteR2Object(record.object_key);
}
