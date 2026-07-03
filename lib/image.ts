import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import exifr from "exifr";

export type UploadedFileLike = {
  fieldname?: string;
  originalname: string;
  encoding?: string;
  mimetype: string;
  destination?: string;
  filename: string;
  path: string;
  size: number;
  metadata?: Record<string, unknown>;
};

const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const optimizeThreshold = Number(process.env.IMAGE_OPTIMIZE_THRESHOLD_MB || 2) * 1024 * 1024;
const maxDimension = Number(process.env.IMAGE_MAX_DIMENSION || 2560);
const webpQuality = Number(process.env.IMAGE_WEBP_QUALITY || 84);

export function isImage(filePath: string) {
  return imageExtensions.has(path.extname(filePath).toLowerCase());
}

function formatExposureTime(value: unknown) {
  const number = Number(value);
  if (!number) return "";
  if (number >= 1) return `${Number(number.toFixed(2))}s`;
  return `1/${Math.round(1 / number)}s`;
}

function formatDate(value: unknown) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export async function readImageInfo(filePath: string) {
  if (!isImage(filePath)) return {};
  const metadata = await sharp(filePath, { failOn: "none" }).metadata();
  let exif: Record<string, any> = {};
  try {
    exif = await exifr.parse(filePath, {
      pick: [
        "DateTimeOriginal", "CreateDate", "Make", "Model", "LensModel",
        "FNumber", "ExposureTime", "ISO", "FocalLength"
      ]
    }) || {};
  } catch {
    // Exported images often have no EXIF block.
  }
  const camera = [exif.Make, exif.Model].filter(Boolean).join(" ");
  return {
    width: metadata.width || null,
    height: metadata.height || null,
    camera,
    lens: exif.LensModel || "",
    aperture: exif.FNumber ? `f/${Number(exif.FNumber)}` : "",
    shutter_speed: formatExposureTime(exif.ExposureTime),
    iso: exif.ISO ? String(exif.ISO) : "",
    focal_length: exif.FocalLength ? `${Number(exif.FocalLength)}mm` : "",
    captured_at: formatDate(exif.DateTimeOriginal || exif.CreateDate)
  };
}

export async function optimizeImage(sourcePath: string, outputDirectory: string, options: { originalName?: string } = {}) {
  const originalName = options.originalName || path.basename(sourcePath);
  const stat = fs.statSync(sourcePath);
  const info = await readImageInfo(sourcePath);
  const largestDimension = Math.max(Number((info as any).width) || 0, Number((info as any).height) || 0);
  const shouldOptimize = stat.size > optimizeThreshold || largestDimension > maxDimension;
  const token = `${Date.now()}-${crypto.randomBytes(5).toString("hex")}`;

  fs.mkdirSync(outputDirectory, { recursive: true });
  if (!shouldOptimize) {
    const extension = path.extname(originalName).toLowerCase();
    const filename = `${token}${extension}`;
    const outputPath = path.join(outputDirectory, filename);
    fs.copyFileSync(sourcePath, outputPath);
    return {
      filename,
      path: outputPath,
      size: stat.size,
      mimetype: extension === ".png" ? "image/png" : extension === ".webp" ? "image/webp" : "image/jpeg",
      optimized: false,
      originalSize: stat.size,
      ...info
    };
  }

  const filename = `${token}.webp`;
  const outputPath = path.join(outputDirectory, filename);
  const image = sharp(sourcePath, { failOn: "none" }).rotate();
  if (largestDimension > maxDimension) {
    image.resize(maxDimension, maxDimension, { fit: "inside", withoutEnlargement: true });
  }
  await image.webp({ quality: webpQuality, effort: 5, smartSubsample: true }).toFile(outputPath);
  return {
    filename,
    path: outputPath,
    size: fs.statSync(outputPath).size,
    mimetype: "image/webp",
    optimized: true,
    originalSize: stat.size,
    ...info
  };
}

export async function processUploadedImage(file: UploadedFileLike): Promise<UploadedFileLike> {
  if (!file || !isImage(file.path)) return { ...file, metadata: {} };
  const sourcePath = file.path;
  const result = await optimizeImage(sourcePath, path.dirname(sourcePath), { originalName: file.originalname });
  if (path.resolve(result.path) !== path.resolve(sourcePath) && fs.existsSync(sourcePath)) fs.unlinkSync(sourcePath);
  return {
    ...file,
    filename: result.filename,
    path: result.path,
    size: result.size,
    mimetype: result.mimetype,
    metadata: result
  };
}

export const imageSettings = { optimizeThreshold, maxDimension, webpQuality };
