const core = require("./database-settings-wrapper");
const path = require("path");

function addColumn(table, definition) {
  const name = definition.trim().split(/\s+/)[0];
  const columns = core.db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name);
  if (!columns.includes(name)) core.db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
}

function migrateArchiveDatabase() {
  addColumn("settings", "updated_at TEXT");
  addColumn("categories", "updated_at TEXT");
  addColumn("categories", "is_primary INTEGER DEFAULT 0");
  addColumn("projects", "tags TEXT DEFAULT ''");
  addColumn("projects", "is_series INTEGER DEFAULT 0");
  addColumn("projects", "series_style TEXT DEFAULT ''");
  addColumn("media", "original_name TEXT DEFAULT ''");
  addColumn("media", "mime_type TEXT DEFAULT ''");
  addColumn("media", "size INTEGER DEFAULT 0");
  addColumn("media", "media_type TEXT DEFAULT 'image'");
  addColumn("media", "show_in_database INTEGER DEFAULT 1");
  addColumn("media", "show_in_inspiration INTEGER DEFAULT 0");
  addColumn("media", "updated_at TEXT");
  addColumn("media", "camera TEXT DEFAULT ''");
  addColumn("media", "lens TEXT DEFAULT ''");
  addColumn("media", "aperture TEXT DEFAULT ''");
  addColumn("media", "shutter_speed TEXT DEFAULT ''");
  addColumn("media", "iso TEXT DEFAULT ''");
  addColumn("media", "captured_at TEXT DEFAULT ''");
  addColumn("tags", "created_at TEXT");

  const updateMediaMetadata = core.db.prepare(`
    UPDATE media SET original_name=?,file_type=?,mime_type=?,media_type=?,updated_at=? WHERE id=?
  `);
  core.db.prepare("SELECT * FROM media").all().forEach((item) => {
    const extension = path.extname(item.file_path || "").slice(1).toLowerCase();
    const legacyType = ["image","video","file"].includes(item.file_type) ? item.file_type : "";
    const mediaType = item.media_type || legacyType || "image";
    const mimeType = item.mime_type || (mediaType === "image" ? `image/${extension === "jpg" ? "jpeg" : extension || "jpeg"}` : mediaType === "video" ? `video/${extension || "mp4"}` : "application/octet-stream");
    updateMediaMetadata.run(
      item.original_name || path.basename(item.file_path || ""),
      extension || item.file_type || "",
      mimeType,
      mediaType,
      item.updated_at || item.created_at || core.now(),
      item.id
    );
  });
  core.db.exec(`
    UPDATE categories SET updated_at=COALESCE(updated_at,created_at);
    UPDATE tags SET created_at=COALESCE(created_at,datetime('now'));
  `);

  const insertSetting = core.db.prepare("INSERT OR IGNORE INTO settings (key,value,updated_at) VALUES (?,?,?)");
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
  }).forEach(([key,value]) => insertSetting.run(key,value,core.now()));

  const insertCategory = core.db.prepare(`
    INSERT OR IGNORE INTO categories (name,slug,description,cover_image,sort_order,created_at,updated_at,is_primary)
    VALUES (?,?,?,?,?,?,?,?)
  `);
  [
    ["摄影","photo","城市、光线、胶片与观看方式。","",1],
    ["平面","graphic","字体、版式、品牌与视觉系统。","",2],
    ["空间","space","尺度、材质、光线与空间秩序。","",3],
    ["AI","ai","图像生成、风格测试与概念草图。","",4],
    ["其他","other","日常实验、手绘、厨艺、手工与未完成想法。","",5]
  ].forEach((row) => insertCategory.run(...row, core.now(), core.now(), 1));

  function ensurePrimaryCategory(slug, fallbackSlug, name, description, sortOrder) {
    let category = core.db.prepare("SELECT * FROM categories WHERE slug=?").get(slug);
    if (!category && fallbackSlug) {
      category = core.db.prepare("SELECT * FROM categories WHERE slug=?").get(fallbackSlug);
      if (category) {
        core.db.prepare("UPDATE categories SET slug=?,name=?,description=?,sort_order=?,updated_at=?,is_primary=1 WHERE id=?")
          .run(slug,name,description,sortOrder,core.now(),category.id);
      }
    }
    if (!category) {
      insertCategory.run(name,slug,description,"",sortOrder,core.now(),core.now(),1);
    }
    category = core.db.prepare("SELECT * FROM categories WHERE slug=?").get(slug);
    core.db.prepare("UPDATE categories SET name=?,description=?,sort_order=?,updated_at=?,is_primary=1 WHERE id=?")
      .run(name,description,sortOrder,core.now(),category.id);
    return category.id;
  }

  const primaryIds = {
    photo: ensurePrimaryCategory("photo",null,"摄影","城市、光线、胶片与观看方式。",1),
    graphic: ensurePrimaryCategory("graphic",null,"平面","字体、版式、品牌与视觉系统。",2),
    space: ensurePrimaryCategory("space","interior","空间","尺度、材质、光线与空间秩序。",3),
    ai: ensurePrimaryCategory("ai",null,"AI","图像生成、风格测试与概念草图。",4),
    other: ensurePrimaryCategory("other","daily","其他","日常实验、手绘、厨艺、手工与未完成想法。",5)
  };
  core.db.prepare("UPDATE categories SET is_primary=0 WHERE id NOT IN (?,?,?,?,?)")
    .run(primaryIds.photo,primaryIds.graphic,primaryIds.space,primaryIds.ai,primaryIds.other);

  const compatibilityMap = {
    motion: primaryIds.space,
    "three-d": primaryIds.space,
    interior: primaryIds.space,
    video: primaryIds.other,
    food: primaryIds.other,
    database: primaryIds.other,
    daily: primaryIds.other
  };
  Object.entries(compatibilityMap).forEach(([legacySlug,targetId]) => {
    const legacy = core.db.prepare("SELECT id FROM categories WHERE slug=?").get(legacySlug);
    if (!legacy || legacy.id === targetId) return;
    core.db.prepare("UPDATE projects SET category_id=?,updated_at=? WHERE category_id=?").run(targetId,core.now(),legacy.id);
    core.db.prepare("UPDATE media SET category_id=?,updated_at=? WHERE category_id=?").run(targetId,core.now(),legacy.id);
  });

  const insertTag = core.db.prepare("INSERT OR IGNORE INTO tags (name,slug,created_at) VALUES (?,?,?)");
  [
    ["3D","3d"],["视频","video"],["厨艺","cooking"],["手绘","drawing"],["手工","craft"],
    ["建模","modeling"],["空间设计","space-design"],["摄影","photography"],["品牌","branding"],["AI生成","ai-generated"]
  ].forEach(([name,slug]) => insertTag.run(name,slug,core.now()));

  const archiveSeeded = core.db.prepare("SELECT value FROM settings WHERE key='archive_examples_seeded'").get();
  if (!archiveSeeded) {
  const categoryIds = Object.fromEntries(
    core.db.prepare("SELECT id,slug FROM categories").all().map((row) => [row.slug, row.id])
  );
  const insertProject = core.db.prepare(`
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
  const categoryFallbacks = { food: "other", "three-d": "space", video: "other", interior: "space", motion: "other", daily: "other", database: "other" };
  examples.forEach(([title, subtitle, slug, categorySlug, description, order]) => {
    const resolvedCategorySlug = categoryIds[categorySlug] ? categorySlug : categoryFallbacks[categorySlug] || "other";
    insertProject.run(
      title, subtitle, slug, categoryIds[resolvedCategorySlug], description, "", "2026", "",
      0, 0, order, core.now(), core.now()
    );
  });

  const sampleSlugs = [
    "city-edge","four-am","unnamed-light",
    "kitchen-lab","solo-meals","recipe-notes",
    "three-d-practice","material-tests","micro-studio-3d",
    "moving-images","short-film-practice","editing-fragments",
    "order-in-chaos","field-notes","visual-sampling-graphic",
    "ai-image-lab","style-tests","concept-sketches"
  ];
  const sampleAssets = ["/assets/hero-default.jpg", "/assets/archive-collage.png"];
  const insertMedia = core.db.prepare(`
    INSERT INTO media (
      project_id,category_id,title,description,file_path,original_name,file_type,mime_type,size,media_type,tags,
      is_hero,is_selected,is_cover,show_in_database,sort_order,created_at,updated_at
    ) VALUES (?,?,?,?,?,?,'jpg','image/jpeg',0,'image',?,0,?,0,1,?,?,?)
  `);
  sampleSlugs.forEach((slug, index) => {
    const project = core.db.prepare("SELECT id,title,description,category_id FROM projects WHERE slug=?").get(slug);
    if (!project) return;
    const exists = core.db.prepare("SELECT id FROM media WHERE project_id=? AND show_in_database=1 LIMIT 1").get(project.id);
    if (!exists) {
      insertMedia.run(
        project.id, project.category_id, project.title, project.description,
        sampleAssets[index % sampleAssets.length], path.basename(sampleAssets[index % sampleAssets.length]),
        index % 3 === 0 ? "精选,档案" : "灵感,练习",
        index < 6 ? 1 : 0, index + 1, core.now(), core.now()
      );
    }
  });
    insertSetting.run("archive_examples_seeded","1",core.now());
  }
}

function initDatabase() {
  core.initDatabase();
  migrateArchiveDatabase();
  core.db.exec(`
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

module.exports = { ...core, initDatabase };
