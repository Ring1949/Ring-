export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_MEDIA_MAX_BYTES,
  DEFAULT_SKILL_MAX_BYTES,
  MEDIA_FILE_PREFIX,
  SKILL_FILE_PREFIX,
  storageErrorMessage
} from "@/lib/blob-library";
import { isAdmin } from "@/lib/utils";

function maximumBytes(kind: "skill" | "media") {
  const configured = Number(process.env[kind === "skill" ? "SKILL_FILE_MAX_BYTES" : "MEDIA_FILE_MAX_BYTES"]);
  return configured > 0 ? configured : kind === "skill" ? DEFAULT_SKILL_MAX_BYTES : DEFAULT_MEDIA_MAX_BYTES;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as HandleUploadBody;
    const result = await handleUpload({
      request,
      body,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!isAdmin(request)) throw new Error("请先登录后台再上传文件。");
        let payload: { kind?: string } = {};
        try { payload = JSON.parse(clientPayload || "{}"); } catch { /* use validation below */ }
        const kind = payload.kind === "skill" ? "skill" : payload.kind === "media" ? "media" : payload.kind === "prompt" ? "prompt" : payload.kind === "poetry" ? "poetry" : null;
        if (!kind) throw new Error("无法识别上传目标。");
        const prefix = kind === "skill" ? SKILL_FILE_PREFIX : kind === "prompt" ? "prompt-library/images/" : kind === "poetry" ? "poetry-library/images/" : MEDIA_FILE_PREFIX;
        if (!pathname.startsWith(prefix)) throw new Error("上传路径不合法。");
        return {
          maximumSizeInBytes: kind === "prompt" || kind === "poetry" ? 20 * 1024 * 1024 : maximumBytes(kind),
          addRandomSuffix: true,
          allowOverwrite: false,
          cacheControlMaxAge: 31_536_000
        };
      }
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = storageErrorMessage(error, "上传授权失败");
    return NextResponse.json({ error: message }, { status: /登录/.test(message) ? 401 : 400 });
  }
}
