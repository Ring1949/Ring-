const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const exifr = require("exifr");

const materialsDir = path.resolve(__dirname, "..", "..", "制作网站素材图片");
const root = path.join(materialsDir, "01-原始作品库");
const outputDir = path.join(materialsDir, "04-审计与渲染产物", "work-audit");
const imagePattern = /\.(?:jpe?g|png|webp|gif|arw)$/i;

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(filePath) : [filePath];
  });
}

function escapeXml(value) {
  return String(value).replace(/[<>&'"]/g, (character) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;"
  })[character]);
}

async function readMetadata(filePath) {
  const stat = fs.statSync(filePath);
  let image = {};
  let exif = {};
  try {
    image = await sharp(filePath, { failOn: "none" }).metadata();
  } catch (error) {
    image.error = error.message;
  }
  try {
    exif = await exifr.parse(filePath, {
      pick: [
        "DateTimeOriginal", "CreateDate", "Make", "Model", "LensModel",
        "FNumber", "ExposureTime", "ISO", "FocalLength"
      ]
    }) || {};
  } catch {
    // RAW files and exported PNGs may not expose readable EXIF.
  }
  return {
    folder: path.basename(path.dirname(filePath)),
    file: path.basename(filePath),
    path: filePath,
    bytes: stat.size,
    width: image.width || null,
    height: image.height || null,
    ...exif
  };
}

async function createContactSheet(folderName, items) {
  const visible = items.filter((item) => imagePattern.test(item.file) && !/\.arw$/i.test(item.file));
  if (!visible.length) return;
  const cellWidth = 320;
  const cellHeight = 250;
  const columns = 4;
  const rows = Math.ceil(visible.length / columns);
  const composites = [];

  for (let index = 0; index < visible.length; index += 1) {
    const item = visible[index];
    const x = (index % columns) * cellWidth;
    const y = Math.floor(index / columns) * cellHeight;
    const thumbnail = await sharp(item.path, { failOn: "none" })
      .rotate()
      .resize(300, 190, { fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#eeeeeb" })
      .jpeg({ quality: 75 })
      .toBuffer();
    const thumbnailMeta = await sharp(thumbnail).metadata();
    composites.push({
      input: thumbnail,
      left: x + Math.round((cellWidth - thumbnailMeta.width) / 2),
      top: y + 8
    });
    const label = escapeXml(item.file.length > 30 ? `${item.file.slice(0, 28)}…` : item.file);
    const detail = `${item.width || "?"}×${item.height || "?"} · ${(item.bytes / 1048576).toFixed(1)}MB`;
    const text = Buffer.from(`
      <svg width="${cellWidth}" height="48">
        <style>
          .name { font: 15px "Microsoft YaHei", sans-serif; fill: #202126; }
          .detail { font: 12px "Microsoft YaHei", sans-serif; fill: #777b82; }
        </style>
        <text x="10" y="18" class="name">${label}</text>
        <text x="10" y="38" class="detail">${escapeXml(detail)}</text>
      </svg>
    `);
    composites.push({ input: text, left: x, top: y + 198 });
  }

  const background = {
    create: {
      width: columns * cellWidth,
      height: rows * cellHeight,
      channels: 3,
      background: "#f7f7f4"
    }
  };
  await sharp(background)
    .composite(composites)
    .jpeg({ quality: 84 })
    .toFile(path.join(outputDir, `${folderName}.jpg`));
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const files = listFiles(root);
  const metadata = [];
  for (const filePath of files) {
    if (imagePattern.test(filePath)) metadata.push(await readMetadata(filePath));
  }
  fs.writeFileSync(path.join(outputDir, "metadata.json"), JSON.stringify(metadata, null, 2));
  const folders = Object.groupBy(metadata, (item) => item.folder);
  for (const [folderName, items] of Object.entries(folders)) {
    await createContactSheet(folderName, items);
  }
  console.log(`Audited ${metadata.length} image files into ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
