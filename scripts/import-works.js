const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const database = require("../lib/db");
const { isImage, optimizeImage } = require("../lib/image");

const root = path.resolve(__dirname, "..");
const materialsDir = path.resolve(root, "..", "制作网站素材图片");
const worksDir = path.join(materialsDir, "01-原始作品库");
const uploadDir = path.join(materialsDir, "02-后台上传素材");
const backupDir = path.join(root, "data", "backups");
const manifestPath = path.join(root, "data", "works-import-manifest.json");

const projectDefinitions = {
  人物报道: {
    title: "人物报道",
    subtitle: "采访、观察与人物关系的现场记录",
    slug: "portrait-reportage",
    category: "photo",
    year: "2025",
    tags: "人物,报道摄影,采访,纪实",
    description: "以人物为叙事中心，通过采访、环境与互动瞬间呈现真实关系。作品关注现场中的动作、表情和空间信息。",
    cover: "11-00340.jpg"
  },
  创作性拍摄: {
    title: "创作性拍摄",
    subtitle: "光、夜色与城市切片",
    slug: "creative-photography",
    category: "photo",
    year: "2024–2026",
    tags: "创作摄影,城市,夜景,色彩,观察",
    description: "围绕光线、色彩、尺度与城市空间展开的视觉练习，在纪实观察与主观表达之间寻找画面的节奏。",
    cover: "11-.jpg"
  },
  商业拍摄: {
    title: "商业拍摄",
    subtitle: "珠宝静物与产品视觉",
    slug: "commercial-jewelry-photography",
    category: "photo",
    year: "2025",
    tags: "商业摄影,珠宝,静物,产品视觉",
    description: "以珠宝和配饰为主体的商业静物拍摄，强调材质、结构、色彩与细节的准确呈现。",
    cover: "15 57+6 (1).png"
  },
  "室内设计项目（养老住宅改造）": {
    title: "适老化住宅改造",
    subtitle: "安全、动线与居家环境优化",
    slug: "age-friendly-home-renovation",
    category: "space",
    year: "2026",
    tags: "室内设计,适老化,住宅改造,空间设计",
    description: "面向老年居住需求的住宅改造方案，从安全性、通行尺度、收纳、照明和日常使用习惯出发，完成平面、立面与效果表达。",
    cover: "客厅效果图.png"
  },
  新闻上稿成果: {
    title: "新闻上稿成果",
    subtitle: "摄影作品的媒体发布记录",
    slug: "published-news-work",
    category: "photo",
    year: "2026",
    tags: "新闻摄影,媒体发布,校园新闻",
    description: "收录摄影作品在新闻与社交媒体平台中的实际发布页面，呈现影像从现场采集到公共传播的完整结果。",
    cover: "屏幕截图 2026-06-04 231111.png"
  },
  校园活动: {
    title: "校园活动",
    subtitle: "校园现场与公共活动记录",
    slug: "campus-events",
    category: "photo",
    year: "2025",
    tags: "校园,活动摄影,体育,展览,新闻摄影",
    description: "记录运动会、军训、展览、会议与文体活动中的关键瞬间，关注群体秩序、人物动作和现场氛围。",
    cover: "f8558b73848570eae341965472bccae0.jpg"
  },
  社会纪实: {
    title: "社会纪实",
    subtitle: "教育、城市与公共生活观察",
    slug: "social-documentary",
    category: "photo",
    year: "2025–2026",
    tags: "社会纪实,教育,公共空间,城市观察",
    description: "从教育评估、实验现场、公共活动与城市建设中提取叙事片段，记录人与环境之间真实而具体的联系。",
    cover: "作品.jpg"
  },
  键帽建模: {
    title: "键帽建模",
    subtitle: "机械键盘的形态与配色实验",
    slug: "keyboard-keycap-modeling",
    category: "space",
    year: "2026",
    tags: "三维建模,键帽,产品设计,渲染",
    description: "以机械键盘与键帽为对象进行三维建模和视觉渲染，通过紫、白、黄色块建立产品识别与画面层次。",
    cover: "键盘透视.png"
  }
};

const customTitles = {
  人物报道: {
    "11-00340.jpg": "温室里的讲解",
    "作品-12.jpg": "放学后的拥抱",
    "场外采访中景2 刘铮摄.jpg": "场外对话"
  },
  创作性拍摄: {
    "11-.jpg": "橙红赛道",
    "11-.png": "橙色秩序",
    "DSC00243.jpg": "银幕与人潮",
    "DSC00278-已增强-降噪-2.jpg": "夜色肖像",
    "DSC00297-已增强-降噪.jpg": "看台之间",
    "DSC05394.jpg": "浮灯",
    "DSC05444.jpg": "器物与光",
    "DSC09260.jpg": "童宾老街",
    "DSC09722-已增强-降噪.jpg": "赛场余温",
    "修建.jpg": "生长中的城市",
    "小菊花球.JPG": "小菊花球",
    "微信图片_20260605001226_425_11.jpg": "火焰瞬间",
    "微信图片_20260605011313_426_11.jpg": "城市边缘",
    "微信图片_20260605011345_427_11.jpg": "舞台之光",
    "微信图片_20260605011425_428_11.jpg": "午后校园",
    "微观？宏观？.JPG": "微观？宏观？",
    "成果图1png.png": "蓝色夜空",
    "桥.jpg": "行进中的桥"
  },
  商业拍摄: {
    "1 4 (1)~1.png": "银枝琥珀吊坠",
    "1 5.9x4.5 宽1.8 (3).png": "金色结构戒指",
    "1.png": "紫晶珠链",
    "15 57+6 (1).png": "孔雀石吊坠",
    "15 6 (1)~1.png": "银叶胸针",
    "2 102+8 (1).png": "彩石手链",
    "2 7 (1).png": "蝶翼胸针",
    "22.jpg": "蓝绿宝石耳饰",
    "3 60+5吊坠6.5 (1).png": "紫晶吊坠",
    "5 5 (1).png": "花卉珐琅胸针",
    "60.jpg": "春日花卉胸针",
    "66.jpg": "紫晶流苏手链"
  },
  新闻上稿成果: {
    "屏幕截图 2026-06-04 230946.png": "媒体发布记录 01",
    "屏幕截图 2026-06-04 231021.png": "媒体发布记录 02",
    "屏幕截图 2026-06-04 231111.png": "媒体发布记录 03",
    "屏幕截图 2026-06-04 231143.png": "媒体发布记录 04",
    "屏幕截图 2026-06-04 231219.png": "媒体发布记录 05",
    "屏幕截图 2026-06-05 010634.png": "媒体发布记录 06"
  },
  校园活动: {
    "ada1bd60b7584814efd81083873180c9_0.jpg": "开幕式影像记录",
    "f8558b73848570eae341965472bccae0.jpg": "秋季田径运动会开幕"
  },
  社会纪实: {
    "作品-5.jpg": "实验室里的协作",
    "作品-7.jpg": "显微观察",
    "作品.jpg": "建设中的城市"
  },
  键帽建模: {
    "111.png": "方向键细节",
    "1112.png": "紫色键盘近景",
    "122.png": "键盘斜向视图",
    "233.png": "键盘正视图",
    "无标题.png": "键帽结构测试",
    "键盘全局.png": "键盘全局",
    "键盘带文字.png": "字符与配色细节",
    "键盘透视.png": "键盘透视"
  },
  "室内设计项目（养老住宅改造）": {
    "平面布置图 (2).png": "平面布置图（深化版）",
    "微信图片_20260513003409_322_11.jpg": "空间配色方案",
    "微信图片_20260513005430_324_11.jpg": "材质肌理样本",
    "202419408033刘铮 适老化安全与居家环境优化(1).pptx": "适老化安全与居家环境优化方案",
    "武汉麓客岛·动物农场环境调研.pptx": "武汉麓客岛动物农场环境调研",
    "装修图纸.dwg": "住宅改造施工图"
  }
};

const folderDescriptions = {
  人物报道: "围绕人物关系与现场交流展开的报道摄影。",
  创作性拍摄: "以光线、色彩、城市和空间尺度为线索的创作性影像。",
  商业拍摄: "在统一视觉控制下完成的珠宝产品静物作品。",
  "室内设计项目（养老住宅改造）": "适老化住宅改造项目的设计表达与过程文件。",
  新闻上稿成果: "摄影作品在新闻与媒体平台中的发布记录。",
  校园活动: "校园公共活动中的人物、秩序与氛围记录。",
  社会纪实: "教育、城市建设与公共生活的纪实观察。",
  键帽建模: "机械键盘产品建模与配色渲染实验。"
};

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(directory, entry.name));
}

function cleanTitle(filename) {
  return path.basename(filename, path.extname(filename))
    .replace(/\s*刘铮摄?\s*/g, " ")
    .replace(/[-_ ]*已增强[-_ ]*降噪[-_ ]*\d*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleFor(folder, filename) {
  return customTitles[folder]?.[filename] || cleanTitle(filename);
}

function mimeTypeFor(extension) {
  return ({
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".dwg": "application/acad"
  })[extension] || "application/octet-stream";
}

function copyAttachment(sourcePath) {
  const extension = path.extname(sourcePath).toLowerCase();
  const filename = `${Date.now()}-${crypto.randomBytes(5).toString("hex")}${extension}`;
  const outputPath = path.join(uploadDir, filename);
  fs.copyFileSync(sourcePath, outputPath);
  return {
    filename,
    path: outputPath,
    size: fs.statSync(outputPath).size,
    mimetype: mimeTypeFor(extension),
    optimized: false,
    originalSize: fs.statSync(sourcePath).size
  };
}

async function prepareFiles() {
  const prepared = [];
  for (const [folder, definition] of Object.entries(projectDefinitions)) {
    const directory = path.join(worksDir, folder);
    for (const sourcePath of listFiles(directory)) {
      if (/\.arw$/i.test(sourcePath)) continue;
      const originalName = path.basename(sourcePath);
      const result = isImage(sourcePath)
        ? await optimizeImage(sourcePath, uploadDir, { originalName })
        : copyAttachment(sourcePath);
      prepared.push({
        folder,
        definition,
        sourcePath,
        originalName,
        title: titleFor(folder, originalName),
        result
      });
    }
  }
  return prepared;
}

function backupDatabase() {
  fs.mkdirSync(backupDir, { recursive: true });
  database.db.exec("PRAGMA wal_checkpoint(FULL)");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `archive-before-works-${stamp}.db`);
  fs.copyFileSync(path.join(root, "data", "archive.db"), backupPath);
  return backupPath;
}

async function main() {
  database.initDatabase();
  fs.mkdirSync(uploadDir, { recursive: true });
  const backupPath = backupDatabase();
  const prepared = await prepareFiles();
  const createdPaths = prepared.map((item) => item.result.path);
  const manifest = [];

  database.db.exec("BEGIN");
  try {
    database.db.exec(`
      UPDATE media SET project_id=NULL,category_id=NULL WHERE is_hero=1;
      DELETE FROM projects;
      DELETE FROM media WHERE is_hero=0;
    `);
    const categories = Object.fromEntries(
      database.db.prepare("SELECT slug,id FROM categories").all().map((row) => [row.slug, row.id])
    );
    const insertProject = database.db.prepare(`
      INSERT INTO projects
      (title,subtitle,slug,category_id,description,cover_image,year,location,tags,
       is_featured,is_recommended,status,sort_order,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,0,0,'published',?,?,?)
    `);
    const insertMedia = database.db.prepare(`
      INSERT INTO media
      (project_id,category_id,title,description,file_path,original_name,file_type,mime_type,size,media_type,tags,
       camera,lens,aperture,shutter_speed,iso,captured_at,
       is_hero,is_selected,is_cover,show_in_database,sort_order,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,0,?,1,?,?,?)
    `);

    let projectOrder = 1;
    for (const [folder, definition] of Object.entries(projectDefinitions)) {
      const items = prepared.filter((item) => item.folder === folder);
      const coverItem = items.find((item) => item.originalName === definition.cover && isImage(item.sourcePath))
        || items.find((item) => isImage(item.sourcePath));
      const coverPath = coverItem ? `/uploads/${coverItem.result.filename}` : "";
      const categoryId = categories[definition.category];
      const timestamp = new Date().toISOString();
      const projectResult = insertProject.run(
        definition.title, definition.subtitle, definition.slug, categoryId, definition.description,
        coverPath, definition.year, "", definition.tags, projectOrder, timestamp, timestamp
      );
      const projectId = Number(projectResult.lastInsertRowid);

      items.forEach((item, index) => {
        const extension = path.extname(item.result.filename).slice(1).toLowerCase();
        const mediaType = isImage(item.sourcePath) ? "image" : "file";
        const meta = item.result;
        const lens = [meta.lens, meta.focal_length].filter(Boolean).join(" · ");
        insertMedia.run(
          projectId, categoryId, item.title, folderDescriptions[folder],
          `/uploads/${meta.filename}`, item.originalName, extension, meta.mimetype,
          meta.size, mediaType, definition.tags,
          meta.camera || "", lens, meta.aperture || "", meta.shutter_speed || "",
          meta.iso || "", meta.captured_at || "",
          item === coverItem ? 1 : 0, index + 1, timestamp, timestamp
        );
        manifest.push({
          folder,
          project: definition.title,
          title: item.title,
          originalName: item.originalName,
          sourceBytes: meta.originalSize,
          outputBytes: meta.size,
          optimized: meta.optimized,
          output: `/uploads/${meta.filename}`
        });
      });
      projectOrder += 1;
    }
    database.db.exec("COMMIT");
  } catch (error) {
    database.db.exec("ROLLBACK");
    createdPaths.forEach((filePath) => {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });
    throw error;
  }

  fs.writeFileSync(manifestPath, JSON.stringify({
    importedAt: new Date().toISOString(),
    backupPath,
    skipped: ["作品/人物报道/DSC00340.ARW（与 JPG 重复的相机 RAW 源文件）"],
    items: manifest
  }, null, 2));

  const sourceBytes = manifest.reduce((sum, item) => sum + item.sourceBytes, 0);
  const outputBytes = manifest.reduce((sum, item) => sum + item.outputBytes, 0);
  console.log(JSON.stringify({
    projects: Object.keys(projectDefinitions).length,
    media: manifest.length,
    optimized: manifest.filter((item) => item.optimized).length,
    sourceMB: Number((sourceBytes / 1048576).toFixed(2)),
    outputMB: Number((outputBytes / 1048576).toFixed(2)),
    backupPath,
    manifestPath
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
