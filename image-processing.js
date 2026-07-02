const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const sharp = require("sharp");
const exifr = require("exifr");

const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const optimizeThreshold = Number(process.env.IMAGE_OPTIMIZE_THRESHOLD_MB || 2) * 1024 * 1024;
const maxDimension = Number(process.env.IMAGE_MAX_DIMENSION || 2560);
const webpQuality = Number(process.env.IMAGE_WEBP_QUALITY || 84);

function isImage(filePath) {
  return imageExtensions.has(path.extname(filePath).toLowerCase());
}

function formatExposureTime(value) {
  const number = Number(value);
  if (!number) return "";
  if (number >= 1) return `${Number(number.toFixed(2))}s`;
  return `1/${Math.round(1 / number)}s`;
}

function formatDate(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

async function readImageInfo(filePath) {
  if (!isImage(filePath)) return {};
  const metadata = await sharp(filePath, { failOn: "none" }).metadata();
  let exif = {};
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

async function optimizeImage(sourcePath, outputDirectory, options = {}) {
  const originalName = options.originalName || path.basename(sourcePath);
  const stat = fs.statSync(sourcePath);
  const info = await readImageInfo(sourcePath);
  const largestDimension = Math.max(info.width || 0, info.height || 0);
  const shouldOptimize = stat.size > optimizeThreshold || largestDimension > maxDimension;
  const token = `${Date.now()}-${crypto.randomBytes(5).toString("hex")}`;

  fs.mkdirSync(outputDirectory, { recursive: true });
  if (!shouldOptimize) {
    const extension = path.extname(originalName).toLowerCase();
    const filename = `${token}${extension}`;
    const outputPath = path.join(outputDirectory, filename);
    fs.copyFileSync(sourcePath, outputPath);
    return {
      filename, path: outputPath, size: stat.size,
      mimetype: extension === ".png" ? "image/png" : extension === ".webp" ? "image/webp" : "image/jpeg",
      optimized: false, originalSize: stat.size, ...info
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
    filename, path: outputPath, size: fs.statSync(outputPath).size,
    mimetype: "image/webp", optimized: true, originalSize: stat.size, ...info
  };
}

async function processUploadedImage(file) {
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

module.exports = {
  isImage,
  optimizeImage,
  processUploadedImage,
  readImageInfo,
  settings: { optimizeThreshold, maxDimension, webpQuality }
};
