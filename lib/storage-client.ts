"use client";

export type StoredUpload = {
  provider: "r2";
  storageProvider: "r2";
  url: string;
  downloadUrl: string;
  pathname: string;
  objectKey: string;
  contentType: string;
  width: number;
  height: number;
  thumbnailUrl?: string;
};

type UploadKind = "media" | "cover" | "graph" | "skill" | "prompt" | "poetry" | "legacy-media";

function imageDimensions(file: File): Promise<{ width: number; height: number }> {
  if (!file.type.startsWith("image/")) return Promise.resolve({ width: 0, height: 0 });
  return new Promise((resolve) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => { URL.revokeObjectURL(url); resolve({ width: image.naturalWidth, height: image.naturalHeight }); };
    image.onerror = () => { URL.revokeObjectURL(url); resolve({ width: 0, height: 0 }); };
    image.src = url;
  });
}

function uploadWithProgress(url: string, file: Blob, headers: Record<string, string>, onProgress?: (percentage: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    Object.entries(headers).forEach(([name, value]) => xhr.setRequestHeader(name, value));
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress?.(Math.round(event.loaded / event.total * 100));
    });
    xhr.addEventListener("load", () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`R2 upload failed (${xhr.status}): ${xhr.responseText || "check bucket CORS"}`)));
    xhr.addEventListener("error", () => reject(new Error("Unable to reach Cloudflare R2. Check the bucket CORS policy and network connection.")));
    xhr.send(file);
  });
}

async function createThumbnail(file: File) {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return null;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return null;
  const maximum = 640;
  const scale = Math.min(1, maximum / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.78));
}

async function requestR2Upload(file: Blob, input: { filename: string; kind: UploadKind | "thumbnail"; parentKey?: string }) {
  const response = await fetch("/api/r2/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: input.filename, contentType: file.type || "application/octet-stream", size: file.size, kind: input.kind, parentKey: input.parentKey })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "R2 upload authorization failed") as Error & { code?: string };
    error.code = payload.code;
    throw error;
  }
  return payload;
}

export async function uploadFile(file: File, options: { kind: UploadKind; onProgress?: (percentage: number) => void }): Promise<StoredUpload> {
  const dimensions = await imageDimensions(file);
  const signed = await requestR2Upload(file, { filename: file.name, kind: options.kind });
  await uploadWithProgress(signed.upload_url, file, signed.upload_headers || {}, options.onProgress);
  let thumbnailUrl = "";
  const thumbnail = await createThumbnail(file);
  if (thumbnail) {
    const thumbnailSigned = await requestR2Upload(thumbnail, { filename: `${file.name}.webp`, kind: "thumbnail", parentKey: signed.object_key });
    await uploadWithProgress(thumbnailSigned.upload_url, thumbnail, thumbnailSigned.upload_headers || {});
    thumbnailUrl = thumbnailSigned.url;
  }
  return {
    provider: "r2",
    storageProvider: "r2",
    url: signed.url,
    downloadUrl: signed.url,
    pathname: signed.object_key,
    objectKey: signed.object_key,
    contentType: file.type || signed.content_type,
    width: dimensions.width,
    height: dimensions.height,
    thumbnailUrl
  };
}
