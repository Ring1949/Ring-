import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite");

export type ArchiveDatabase = any;

let dbInstance: ArchiveDatabase | null = null;
let initialized = false;

export function now() {
  return new Date().toISOString();
}

export function slugify(value: unknown) {
  return String(value || "").trim().toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{Letter}\p{Number}-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || `item-${Date.now()}`;
}

export function getDataDirectory() {
  return process.env.VERCEL
    ? path.join("/tmp", "shanchuan-visual-archive-data")
    : path.join(process.cwd(), "data");
}

export function getDatabasePath() {
  return path.join(getDataDirectory(), "archive.db");
}

export function getDb(): ArchiveDatabase {
  if (!dbInstance) {
    fs.mkdirSync(getDataDirectory(), { recursive: true });
    dbInstance = new DatabaseSync(getDatabasePath());
    dbInstance.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  }
  return dbInstance;
}

function addColumn(db: ArchiveDatabase, table: string, definition: string) {
  const name = definition.trim().split(/\s+/)[0];
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((column: any) => column.name);
  if (!columns.includes(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
}

function seedBaseDatabase(db: ArchiveDatabase) {
  if (db.prepare("SELECT COUNT(*) AS count FROM categories").get().count) return;

  const insertCategory = db.prepare(`
    INSERT INTO categories (name,slug,description,cover_image,sort_order,created_at)
    VALUES (?,?,?,?,?,?)
  `);
  [
    ["摄影","photo","用图像记录城市、时间与偶然发生的光。","",1],
    ["平面","graphic","品牌、版式与视觉系统的持续实验。","",2],
    ["空间","interior","研究尺度、光线、材料与日常生活。","",3],
    ["三维与动态","motion","建模、渲染、短片与动态视觉练习。","",4],
    ["日常研究","daily","手绘、食物、灵感与未完成的想法。","",5],
    ["资料库","database","按兴趣而非价值排序的私人资料库。","",6]
  ].forEach((row) => insertCategory.run(...row, now()));

  const categoryMap = Object.fromEntries(
    db.prepare("SELECT id,slug FROM categories").all().map((row: any) => [row.slug,row.id])
  );
  const insertProject = db.prepare(`
    INSERT INTO projects (
      title,subtitle,slug,category_id,description,cover_image,year,location,
      is_featured,is_recommended,status,sort_order,created_at,updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,'published',?,?,?)
  `);
  [
    ["城市边缘","武汉的缝隙、夜晚与临时风景","city-edge","photo","一项持续进行的城市观察计划。","","2024–2026","武汉",1,0,1],
    ["无序之序","实验性展览视觉系统","order-in-chaos","graphic","一套可以持续变化的实验性视觉识别。","","2025","武汉",1,0,2],
    ["留白住宅","89㎡旧房改造与光线研究","blank-house","interior","以自然光和收纳边界为核心的住宅更新项目。","","2025","武汉",1,0,3],
    ["器材与观看方式","相机、镜头，以及它们如何改变观看","camera-and-seeing","photo","关于工具如何塑造视觉习惯的长期记录。","","2019–NOW","",1,0,4],
    ["凌晨四点","关于失眠和城市光源的图像","four-am","photo","夜晚结束前，城市短暂显露出的安静结构。","","2025","武汉",1,1,5],
    ["未命名的光","胶片、漏光与不可复制的瞬间","unnamed-light","photo","接受胶片的不确定性，把意外作为图像的一部分。","","2023","",0,1,6],
    ["微型工作室","21㎡多功能创作空间","micro-studio","interior","在有限尺度内容纳摄影、绘图、模型制作和日常工作。","","2026","武汉",0,1,7],
    ["田野笔记","地方手工艺口述史装帧","field-notes","graphic","将访谈、照片和手写记录组织成地方档案。","","2024","",0,1,8],
    ["视觉采样","材质、字体、配色与好看的东西","visual-sampling","database","一个不断增长的视觉参考集合。","","ONGOING","",0,1,9]
  ].forEach(([title,subtitle,slug,cat,description,cover,year,location,featured,recommended,order]) => {
    insertProject.run(title,subtitle,slug,categoryMap[cat as string],description,cover,year,location,featured,recommended,order,now(),now());
  });

  const setting = db.prepare("INSERT INTO settings (key,value) VALUES (?,?)");
  Object.entries({
    site_name:"山川止行",
    hero_title:"山川止行",
    hero_subtitle:"摄影 / 平面设计 / 空间 / 日常研究",
    hero_media:"/assets/hero-default.jpg",
    hero_media_type:"image",
    about_text:"作品不是终点，而是我理解世界的索引。你好，我是山川止行，一名横跨视觉、空间与影像的独立创作者。",
    contact_email:"hello@example.com"
  }).forEach((entry) => setting.run(...entry));

  const tag = db.prepare("INSERT INTO tags (name,slug) VALUES (?,?)");
  [["纪实","documentary"],["胶片","film"],["城市","city"],["空间","space"],["编辑设计","editorial"]]
    .forEach((entry) => tag.run(...entry));
}

function migrateArchiveDatabase(db: ArchiveDatabase) {
  addColumn(db, "settings", "updated_at TEXT");
  addColumn(db, "categories", "updated_at TEXT");
  addColumn(db, "categories", "is_primary INTEGER DEFAULT 0");
  addColumn(db, "projects", "tags TEXT DEFAULT ''");
  addColumn(db, "projects", "is_series INTEGER DEFAULT 0");
  addColumn(db, "projects", "series_style TEXT DEFAULT ''");
  addColumn(db, "media", "original_name TEXT DEFAULT ''");
  addColumn(db, "media", "mime_type TEXT DEFAULT ''");
  addColumn(db, "media", "size INTEGER DEFAULT 0");
  addColumn(db, "media", "media_type TEXT DEFAULT 'image'");
  addColumn(db, "media", "show_in_database INTEGER DEFAULT 1");
  addColumn(db, "media", "show_in_inspiration INTEGER DEFAULT 0");
  addColumn(db, "media", "updated_at TEXT");
  addColumn(db, "media", "camera TEXT DEFAULT ''");
  addColumn(db, "media", "lens TEXT DEFAULT ''");
  addColumn(db, "media", "aperture TEXT DEFAULT ''");
  addColumn(db, "media", "shutter_speed TEXT DEFAULT ''");
  addColumn(db, "media", "iso TEXT DEFAULT ''");
  addColumn(db, "media", "captured_at TEXT DEFAULT ''");
  addColumn(db, "tags", "created_at TEXT");

  const updateMediaMetadata = db.prepare(`
    UPDATE media SET original_name=?,file_type=?,mime_type=?,media_type=?,updated_at=? WHERE id=?
  `);
  db.prepare("SELECT * FROM media").all().forEach((item: any) => {
    const extension = path.extname(item.file_path || "").slice(1).toLowerCase();
    const legacyType = ["image","video","file"].includes(item.file_type) ? item.file_type : "";
    const mediaType = item.media_type || legacyType || "image";
    const mimeType = item.mime_type || (mediaType === "image" ? `image/${extension === "jpg" ? "jpeg" : extension || "jpeg"}` : mediaType === "video" ? `video/${extension || "mp4"}` : "application/octet-stream");
    updateMediaMetadata.run(
      item.original_name || path.basename(item.file_path || ""),
      extension || item.file_type || "",
      mimeType,
      mediaType,
      item.updated_at || item.created_at || now(),
      item.id
    );
  });
  db.exec(`
    UPDATE categories SET updated_at=COALESCE(updated_at,created_at);
    UPDATE tags SET created_at=COALESCE(created_at,datetime('now'));
  `);

  const insertSetting = db.prepare("INSERT OR IGNORE INTO settings (key,value,updated_at) VALUES (?,?,?)");
  Object.entries({
    site_name:"山川止行",
    hero_title:"山川止行",
    hero_subtitle:"摄影 / 平面设计 / 空间 / 日常研究",
    hero_kicker:"SHANCHUAN VISUAL ARCHIVE · 2026",
    hero_media:"/assets/hero-default.jpg",
    hero_media_type:"image",
    intro_text:"独立设计师与影像创作者\nBASED IN WUHAN",
    about_kicker:"ABOUT SHANCHUAN",
    about_title:"作品不是终点，\n而是我理解世界的索引。",
    about_text:"作品不是终点，而是我理解世界的索引。你好，我是山川止行，一名横跨视觉、空间与影像的独立创作者。",
    contact_email:"hello@example.com",
    contact_link:"mailto:hello@example.com",
    contact_button_text:"一起做点什么 ↗",
    contact_title:"联系我",
    contact_intro:"如果你想聊聊摄影、设计、空间或新的合作，可以通过下面的方式找到我。",
    contact_location:"武汉 / 可远程合作",
    wechat:"",
    xiaohongshu:"",
    instagram:"",
    behance:"",
    footer_text:"视觉档案 / 武汉 / 2026",
    footer_copyright:"© 2026 SHANCHUAN STUDIO"
  }).forEach(([key,value]) => insertSetting.run(key,value,now()));

  const insertCategory = db.prepare(`
    INSERT OR IGNORE INTO categories (name,slug,description,cover_image,sort_order,created_at,updated_at,is_primary)
    VALUES (?,?,?,?,?,?,?,?)
  `);
  [
    ["摄影","photo","城市、光线、胶片与观看方式。","",1],
    ["平面","graphic","字体、版式、品牌与视觉系统。","",2],
    ["空间","space","尺度、材质、光线与空间秩序。","",3],
    ["AI","ai","图像生成、风格测试与概念草图。","",4],
    ["其他","other","日常实验、手绘、厨艺、手工与未完成想法。","",5]
  ].forEach((row) => insertCategory.run(...row, now(), now(), 1));

  function ensurePrimaryCategory(slug: string, fallbackSlug: string | null, name: string, description: string, sortOrder: number) {
    let category = db.prepare("SELECT * FROM categories WHERE slug=?").get(slug);
    if (!category && fallbackSlug) {
      category = db.prepare("SELECT * FROM categories WHERE slug=?").get(fallbackSlug);
      if (category) {
        db.prepare("UPDATE categories SET slug=?,name=?,description=?,sort_order=?,updated_at=?,is_primary=1 WHERE id=?")
          .run(slug,name,description,sortOrder,now(),category.id);
      }
    }
    if (!category) insertCategory.run(name,slug,description,"",sortOrder,now(),now(),1);
    category = db.prepare("SELECT * FROM categories WHERE slug=?").get(slug);
    db.prepare("UPDATE categories SET name=?,description=?,sort_order=?,updated_at=?,is_primary=1 WHERE id=?")
      .run(name,description,sortOrder,now(),category.id);
    return category.id;
  }

  const primaryIds = {
    photo: ensurePrimaryCategory("photo",null,"摄影","城市、光线、胶片与观看方式。",1),
    graphic: ensurePrimaryCategory("graphic",null,"平面","字体、版式、品牌与视觉系统。",2),
    space: ensurePrimaryCategory("space","interior","空间","尺度、材质、光线与空间秩序。",3),
    ai: ensurePrimaryCategory("ai",null,"AI","图像生成、风格测试与概念草图。",4),
    other: ensurePrimaryCategory("other","daily","其他","日常实验、手绘、厨艺、手工与未完成想法。",5)
  };
  db.prepare("UPDATE categories SET is_primary=0 WHERE id NOT IN (?,?,?,?,?)")
    .run(primaryIds.photo,primaryIds.graphic,primaryIds.space,primaryIds.ai,primaryIds.other);

  const compatibilityMap: Record<string, number> = {
    motion: primaryIds.space,
    "three-d": primaryIds.space,
    interior: primaryIds.space,
    video: primaryIds.other,
    food: primaryIds.other,
    database: primaryIds.other,
    daily: primaryIds.other
  };
  Object.entries(compatibilityMap).forEach(([legacySlug,targetId]) => {
    const legacy = db.prepare("SELECT id FROM categories WHERE slug=?").get(legacySlug);
    if (!legacy || legacy.id === targetId) return;
    db.prepare("UPDATE projects SET category_id=?,updated_at=? WHERE category_id=?").run(targetId,now(),legacy.id);
    db.prepare("UPDATE media SET category_id=?,updated_at=? WHERE category_id=?").run(targetId,now(),legacy.id);
  });

  const insertTag = db.prepare("INSERT OR IGNORE INTO tags (name,slug,created_at) VALUES (?,?,?)");
  [
    ["3D","3d"],["视频","video"],["厨艺","cooking"],["手绘","drawing"],["手工","craft"],
    ["建模","modeling"],["空间设计","space-design"],["摄影","photography"],["品牌","branding"],["AI生成","ai-generated"]
  ].forEach(([name,slug]) => insertTag.run(name,slug,now()));

  const archiveSeeded = db.prepare("SELECT value FROM settings WHERE key='archive_examples_seeded'").get();
  if (!archiveSeeded) seedArchiveExamples(db, insertSetting);
}

function seedArchiveExamples(db: ArchiveDatabase, insertSetting: any) {
  const categoryIds = Object.fromEntries(
    db.prepare("SELECT id,slug FROM categories").all().map((row: any) => [row.slug, row.id])
  );
  const insertProject = db.prepare(`
    INSERT OR IGNORE INTO projects (
      title,subtitle,slug,category_id,description,cover_image,year,location,
      is_featured,is_recommended,status,sort_order,created_at,updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?, 'published',?,?,?)
  `);
  const examples = [
    ["厨房实验","菜谱与火候的反复测试","kitchen-lab","food","记录每一次配方调整和最终成品。",11],
    ["一人食记录","简单但认真地吃饭","solo-meals","food","一个人的餐桌，也值得被完整记录。",12],
    ["配方笔记","可复现的味道档案","recipe-notes","food","把食材、比例和过程整理成长期可用的笔记。",13],
    ["三维练习","形体、灯光与构图","three-d-practice","three-d","从基础建模到完整画面的阶段性练习。",14],
    ["材质测试","表面、反射与触感","material-tests","three-d","持续积累材质节点和光照测试。",15],
    ["微型工作室","小尺度创作空间研究","micro-studio-3d","three-d","以三维方式推演有限空间中的工作与生活。",16],
    ["动态影像","运动、节奏与声音","moving-images","video","收集运动镜头和动态视觉实验。",17],
    ["短片练习","从分镜到成片","short-film-practice","video","用短片验证叙事、摄影和剪辑方法。",18],
    ["剪辑片段","时间线上的片段档案","editing-fragments","video","保留值得回看的节奏、转场和声音片段。",19],
    ["视觉采样","材质、字体、配色与好看的东西","visual-sampling-graphic","graphic","一个不断增长的平面视觉参考集合。",20],
    ["AI 图像实验","生成与后期的混合工作流","ai-image-lab","ai","测试提示词、控制方法与后期处理的边界。",21],
    ["风格测试","不同视觉语言的快速验证","style-tests","ai","在正式创作前进行色彩、材质和构图实验。",22],
    ["概念草图","想法形成之前的图像","concept-sketches","ai","将模糊概念快速转化为可讨论的视觉草图。",23]
  ];
  const categoryFallbacks: Record<string, string> = { food: "other", "three-d": "space", video: "other", interior: "space", motion: "other", daily: "other", database: "other" };
  examples.forEach(([title, subtitle, slug, categorySlug, description, order]) => {
    const resolvedCategorySlug = categoryIds[categorySlug as string] ? categorySlug as string : categoryFallbacks[categorySlug as string] || "other";
    insertProject.run(title, subtitle, slug, categoryIds[resolvedCategorySlug], description, "", "2026", "", 0, 0, order, now(), now());
  });

  const sampleSlugs = [
    "city-edge","four-am","unnamed-light","kitchen-lab","solo-meals","recipe-notes",
    "three-d-practice","material-tests","micro-studio-3d","moving-images","short-film-practice",
    "editing-fragments","order-in-chaos","field-notes","visual-sampling-graphic","ai-image-lab","style-tests","concept-sketches"
  ];
  const sampleAssets = ["/assets/hero-default.jpg", "/assets/archive-collage.png"];
  const insertMedia = db.prepare(`
    INSERT INTO media (
      project_id,category_id,title,description,file_path,original_name,file_type,mime_type,size,media_type,tags,
      is_hero,is_selected,is_cover,show_in_database,sort_order,created_at,updated_at
    ) VALUES (?,?,?,?,?,?,'jpg','image/jpeg',0,'image',?,0,?,0,1,?,?,?)
  `);
  sampleSlugs.forEach((slug, index) => {
    const project = db.prepare("SELECT id,title,description,category_id FROM projects WHERE slug=?").get(slug);
    if (!project) return;
    const exists = db.prepare("SELECT id FROM media WHERE project_id=? AND show_in_database=1 LIMIT 1").get(project.id);
    if (!exists) {
      const asset = sampleAssets[index % sampleAssets.length];
      insertMedia.run(project.id, project.category_id, project.title, project.description, asset, path.basename(asset), index % 3 === 0 ? "精选,档案" : "灵感,练习", index < 6 ? 1 : 0, index + 1, now(), now());
    }
  });
  insertSetting.run("archive_examples_seeded","1",now());
}

function createCoverTriggers(db: ArchiveDatabase) {
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS media_cover_insert
    AFTER INSERT ON media WHEN NEW.is_cover=1 AND NEW.project_id IS NOT NULL
    BEGIN
      UPDATE projects SET cover_image=NEW.file_path,updated_at=datetime('now') WHERE id=NEW.project_id;
    END;
    CREATE TRIGGER IF NOT EXISTS media_cover_update
    AFTER UPDATE OF is_cover,project_id ON media WHEN NEW.is_cover=1 AND NEW.project_id IS NOT NULL
    BEGIN
      UPDATE projects SET cover_image=NEW.file_path,updated_at=datetime('now') WHERE id=NEW.project_id;
    END;
    CREATE TRIGGER IF NOT EXISTS media_cover_delete
    AFTER DELETE ON media WHEN OLD.is_cover=1 AND OLD.project_id IS NOT NULL
    BEGIN
      UPDATE projects SET cover_image='',updated_at=datetime('now')
      WHERE id=OLD.project_id AND cover_image=OLD.file_path;
    END;
  `);
}

export function initDatabase() {
  if (initialized) return getDb();
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '', cover_image TEXT DEFAULT '', sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, subtitle TEXT DEFAULT '',
      slug TEXT NOT NULL UNIQUE, category_id INTEGER, description TEXT DEFAULT '', cover_image TEXT DEFAULT '',
      year TEXT DEFAULT '', location TEXT DEFAULT '', is_featured INTEGER DEFAULT 0,
      is_recommended INTEGER DEFAULT 0, status TEXT DEFAULT 'draft' CHECK(status IN ('draft','published')),
      tags TEXT DEFAULT '', sort_order INTEGER DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER, category_id INTEGER,
      title TEXT DEFAULT '', description TEXT DEFAULT '', file_path TEXT NOT NULL,
      original_name TEXT DEFAULT '', file_type TEXT DEFAULT '', mime_type TEXT DEFAULT '',
      size INTEGER DEFAULT 0, media_type TEXT DEFAULT 'image', tags TEXT DEFAULT '', is_hero INTEGER DEFAULT 0,
      is_selected INTEGER DEFAULT 0, is_cover INTEGER DEFAULT 0, sort_order INTEGER DEFAULT 0,
      show_in_database INTEGER DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, slug TEXT NOT NULL UNIQUE, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS project_tags (
      project_id INTEGER NOT NULL, tag_id INTEGER NOT NULL, PRIMARY KEY(project_id,tag_id),
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS media_tags (
      media_id INTEGER NOT NULL, tag_id INTEGER NOT NULL, PRIMARY KEY(media_id,tag_id),
      FOREIGN KEY(media_id) REFERENCES media(id) ON DELETE CASCADE,
      FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT DEFAULT '', updated_at TEXT);
  `);
  seedBaseDatabase(db);
  migrateArchiveDatabase(db);
  createCoverTriggers(db);
  initialized = true;
  return db;
}

export function getSettings(): Record<string, string> {
  const db = initDatabase();
  return Object.fromEntries(db.prepare("SELECT key,value FROM settings").all().map((row: any) => [row.key,row.value]));
}

export function setSettings(values: Record<string, unknown>) {
  const db = initDatabase();
  const statement = db.prepare(`
    INSERT INTO settings (key,value,updated_at) VALUES (?,?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at
  `);
  db.exec("BEGIN");
  try {
    Object.entries(values).forEach(([key,value]) => statement.run(key,String(value ?? ""),now()));
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return getSettings();
}

export function replaceTagLinks(table: string, ownerColumn: string, ownerId: number, tagIds: unknown[] = []) {
  const db = initDatabase();
  if (!["project_tags", "media_tags"].includes(table)) throw new Error(`Invalid tag table: ${table}`);
  if (!["project_id", "media_id"].includes(ownerColumn)) throw new Error(`Invalid tag owner column: ${ownerColumn}`);
  db.prepare(`DELETE FROM ${table} WHERE ${ownerColumn}=?`).run(ownerId);
  const insert = db.prepare(`INSERT OR IGNORE INTO ${table} (${ownerColumn},tag_id) VALUES (?,?)`);
  tagIds.map(Number).filter(Boolean).forEach((tagId) => insert.run(ownerId,tagId));
}
