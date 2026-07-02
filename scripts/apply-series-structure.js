const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const sharp = require("sharp");
const database = require("../database");
const { optimizeImage } = require("../image-processing");

const root = path.resolve(__dirname, "..");
const materialsDir = path.resolve(root, "..", "制作网站素材图片");
const uploadDir = path.join(materialsDir, "02-后台上传素材");
const backupDir = path.join(root, "data", "backups");
const worksDir = path.join(materialsDir, "01-原始作品库");
const renderDir = path.join(materialsDir, "04-审计与渲染产物", "series-render");

function backupDatabase() {
  fs.mkdirSync(backupDir, { recursive: true });
  database.db.exec("PRAGMA wal_checkpoint(FULL)");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const output = path.join(backupDir, `archive-before-series-rules-${stamp}.db`);
  fs.copyFileSync(path.join(root, "data", "archive.db"), output);
  return output;
}

function copyAttachment(sourcePath) {
  const extension = path.extname(sourcePath).toLowerCase();
  const filename = `${Date.now()}-${crypto.randomBytes(5).toString("hex")}${extension}`;
  const output = path.join(uploadDir, filename);
  fs.copyFileSync(sourcePath, output);
  return { filename, output, size: fs.statSync(output).size };
}

async function createFarmCover(mediaDir) {
  const aerial = await sharp(path.join(mediaDir, "image1.jpeg")).resize(1600, 1000, { fit: "cover" }).toBuffer();
  const detail = await sharp(path.join(mediaDir, "image9.jpeg")).resize(520, 420, { fit: "cover" }).toBuffer();
  const title = Buffer.from(`
    <svg width="1600" height="1000">
      <style>
        .k{font:600 20px "Microsoft YaHei",sans-serif;letter-spacing:6px;fill:#dbe6d6}
        .t{font:600 76px "Microsoft YaHei",sans-serif;fill:#fff}
        .s{font:400 24px "Microsoft YaHei",sans-serif;fill:#e0eadc}
      </style>
      <rect width="1600" height="1000" fill="rgba(23,47,35,.3)"/>
      <rect x="0" y="0" width="1600" height="1000" fill="url(#g)"/>
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#173426" stop-opacity=".88"/><stop offset=".65" stop-color="#173426" stop-opacity=".16"/><stop offset="1" stop-color="#173426" stop-opacity=".7"/></linearGradient></defs>
      <text x="88" y="112" class="k">ENVIRONMENTAL RESEARCH / SERIES 01</text>
      <text x="88" y="214" class="t">武汉麓客岛·动物农场</text>
      <text x="92" y="262" class="s">多感官维度下的野趣与舒适平衡设计</text>
    </svg>
  `);
  const filename = `${Date.now()}-${crypto.randomBytes(5).toString("hex")}.webp`;
  const output = path.join(uploadDir, filename);
  await sharp(aerial).composite([
    { input: title, left: 0, top: 0 },
    { input: detail, left: 990, top: 500 }
  ]).webp({ quality: 88 }).toFile(output);
  return { filename, output, size: fs.statSync(output).size };
}

async function importImage(sourcePath) {
  return optimizeImage(sourcePath, uploadDir, { originalName: path.basename(sourcePath) });
}

async function createSeriesProject(definition, categoryId) {
  const timestamp = new Date().toISOString();
  const existing = database.db.prepare("SELECT * FROM projects WHERE slug=?").get(definition.slug);
  let projectId;
  if (existing) {
    projectId = existing.id;
    database.db.prepare("DELETE FROM media WHERE project_id=?").run(projectId);
    database.db.prepare(`
      UPDATE projects SET title=?,subtitle=?,category_id=?,description=?,cover_image=?,year=?,tags=?,
      is_featured=0,is_recommended=1,status='published',sort_order=?,updated_at=?,is_series=1,series_style=? WHERE id=?
    `).run(definition.title, definition.subtitle, categoryId, definition.description, definition.cover,
      definition.year, definition.tags, definition.order, timestamp, definition.style, projectId);
  } else {
    const result = database.db.prepare(`
      INSERT INTO projects
      (title,subtitle,slug,category_id,description,cover_image,year,location,tags,is_featured,is_recommended,
       status,sort_order,created_at,updated_at,is_series,series_style)
      VALUES (?,?,?,?,?,?,?,?,?,0,1,'published',?,?,?,?,?)
    `).run(definition.title, definition.subtitle, definition.slug, categoryId, definition.description,
      definition.cover, definition.year, "", definition.tags, definition.order, timestamp, timestamp, 1, definition.style);
    projectId = Number(result.lastInsertRowid);
  }
  return projectId;
}

function insertMedia(projectId, categoryId, item, index, coverPath = "") {
  const timestamp = new Date().toISOString();
  const extension = path.extname(item.filename).slice(1).toLowerCase();
  database.db.prepare(`
    INSERT INTO media
    (project_id,category_id,title,description,file_path,original_name,file_type,mime_type,size,media_type,tags,
     is_hero,is_selected,is_cover,show_in_database,show_in_inspiration,sort_order,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,0,0,?,0,0,?,?,?)
  `).run(projectId, categoryId, item.title, item.description || "", `/uploads/${item.filename}`,
    item.originalName, extension, item.mimeType, item.size, item.mediaType, item.tags || "",
    `/uploads/${item.filename}` === coverPath ? 1 : 0, index, timestamp, timestamp);
}

async function main() {
  database.initDatabase();
  fs.mkdirSync(uploadDir, { recursive: true });
  const backup = backupDatabase();
  const spaceId = database.db.prepare("SELECT id FROM categories WHERE slug='space'").get().id;

  const farmMediaDir = path.join(renderDir, "series-one-unpacked", "ppt", "media");
  const farmCover = await createFarmCover(farmMediaDir);
  const farmSelections = [
    ["image1.jpeg", "场地鸟瞰"], ["image3.png", "自然材料与色彩"], ["image5.jpeg", "林下活动空间"],
    ["image9.jpeg", "镂空构架与光影"], ["image10.jpeg", "植物阶梯"], ["image16.jpeg", "通透步道"],
    ["image17.jpeg", "林地休憩空间"], ["image20.jpeg", "湖畔整体环境"], ["image23.jpeg", "观景平台"],
    ["image25.jpeg", "动物活动空间"], ["image29.jpeg", "农场入口与动物区域"]
  ];
  const farmImages = [];
  for (const [filename, title] of farmSelections) {
    const result = await importImage(path.join(farmMediaDir, filename));
    farmImages.push({ ...result, title, originalName: filename, mimeType: result.mimetype, mediaType: "image" });
  }
  const farmAttachment = copyAttachment(path.join(worksDir, "武汉麓客岛·动物农场环境调研(系列一）.pptx"));

  const interiorSlidesDir = path.join(renderDir, "series-two");
  const interiorSlideNumbers = [2, 5, 10, 12, 13, 16, 22, 27, 28, 29, 30, 31, 32, 33];
  const interiorImages = [];
  for (const number of interiorSlideNumbers) {
    const filename = `slide-${number}.png`;
    const result = await importImage(path.join(interiorSlidesDir, filename));
    interiorImages.push({
      ...result, title: number < 27 ? `方案页面 ${String(number).padStart(2, "0")}` : `空间效果 ${number - 27}`,
      originalName: filename, mimeType: result.mimetype, mediaType: "image"
    });
  }
  const interiorCover = interiorImages[0];
  const interiorAttachment = copyAttachment(path.join(worksDir, "202419408033刘铮 适老化安全与居家环境优化（系列二）.pptx"));

  database.db.exec("BEGIN");
  try {
    database.db.prepare("UPDATE projects SET is_series=0,is_recommended=0,series_style=''").run();
    database.db.prepare(`
      UPDATE projects SET title='室内设计项目',subtitle='住宅空间效果与设计表达',
      slug='interior-design-works',is_series=0,is_recommended=0,series_style='',updated_at=?
      WHERE slug='age-friendly-home-renovation'
    `).run(new Date().toISOString());

    const interiorProject = database.db.prepare("SELECT id FROM projects WHERE slug='interior-design-works'").get();
    if (interiorProject) {
      const allowed = new Set(fs.readdirSync(path.join(worksDir, "室内设计项目（空间）")));
      database.db.prepare("SELECT id,original_name FROM media WHERE project_id=?").all(interiorProject.id)
        .filter((item) => !allowed.has(item.original_name))
        .forEach((item) => database.db.prepare("DELETE FROM media WHERE id=?").run(item.id));
      database.db.prepare("UPDATE media SET show_in_database=1,show_in_inspiration=0 WHERE project_id=?").run(interiorProject.id);
    }

    const keycap = database.db.prepare("SELECT id FROM projects WHERE slug='keyboard-keycap-modeling'").get();
    if (keycap) {
      database.db.prepare(`
        UPDATE projects SET title='键帽建模',is_series=1,is_recommended=1,series_style='product-violet',
        sort_order=3,updated_at=? WHERE id=?
      `).run(new Date().toISOString(), keycap.id);
      database.db.prepare("UPDATE media SET show_in_database=1,show_in_inspiration=0 WHERE project_id=?").run(keycap.id);
    }

    const farmId = await createSeriesProject({
      title: "武汉麓客岛·动物农场环境调研",
      subtitle: "多感官维度下的野趣与舒适平衡设计",
      slug: "luke-island-animal-farm-research",
      description: "从视觉、嗅觉、听觉与触觉四个维度，分析动物农场的动线、植物、材料、声景和人本化细节。",
      cover: `/uploads/${farmCover.filename}`, year: "2026", tags: "环境调研,景观空间,多感官设计",
      style: "nature-research", order: 1
    }, spaceId);
    farmImages.forEach((item, index) => insertMedia(farmId, spaceId, item, index + 1, `/uploads/${farmCover.filename}`));
    insertMedia(farmId, spaceId, {
      filename: farmAttachment.filename, title: "环境调研完整演示文稿",
      originalName: "武汉麓客岛·动物农场环境调研(系列一）.pptx",
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      mediaType: "file", size: farmAttachment.size
    }, 100);

    const interiorId = await createSeriesProject({
      title: "适老化安全与居家环境优化",
      subtitle: "安全、动线与居住体验的系统设计",
      slug: "age-friendly-home-series",
      description: "围绕老龄化居住需求，从前期调研、风险识别、功能分区、立面设计到最终效果图形成完整空间方案。",
      cover: `/uploads/${interiorCover.filename}`, year: "2026", tags: "适老化,住宅设计,室内空间",
      style: "warm-interior", order: 2
    }, spaceId);
    interiorImages.forEach((item, index) => insertMedia(interiorId, spaceId, item, index + 1, `/uploads/${interiorCover.filename}`));
    insertMedia(interiorId, spaceId, {
      filename: interiorAttachment.filename, title: "适老化住宅完整演示文稿",
      originalName: "202419408033刘铮 适老化安全与居家环境优化（系列二）.pptx",
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      mediaType: "file", size: interiorAttachment.size
    }, 100);

    database.db.exec("COMMIT");
  } catch (error) {
    database.db.exec("ROLLBACK");
    throw error;
  }

  console.log(JSON.stringify({
    backup,
    series: database.db.prepare("SELECT title,slug,series_style FROM projects WHERE is_series=1 ORDER BY sort_order").all(),
    libraryCount: database.db.prepare("SELECT COUNT(*) AS n FROM media WHERE show_in_database=1").get().n,
    inspirationCount: database.db.prepare("SELECT COUNT(*) AS n FROM media WHERE show_in_inspiration=1").get().n
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
