function seedDatabase(db, now) {
  if (db.prepare("SELECT COUNT(*) AS count FROM categories").get().count) return;

  const insertCategory = db.prepare(`
    INSERT INTO categories (name,slug,description,cover_image,sort_order,created_at)
    VALUES (?,?,?,?,?,?)
  `);
  [
    ["摄影","photo","用图像记录城市、时间与偶然发生的光。","",1],
    ["平面设计","graphic","品牌、编辑与视觉系统的持续实验。","",2],
    ["空间设计","interior","研究尺度、光线、材料与日常生活。","",3],
    ["三维与动态","motion","建模、渲染、短片与动态视觉练习。","",4],
    ["日常研究","daily","手绘、食物、灵感与未完成的想法。","",5],
    ["资料库","database","按兴趣而非价值排序的私人资料库。","",6]
  ].forEach((row) => insertCategory.run(...row, now()));

  const categoryMap = Object.fromEntries(
    db.prepare("SELECT id,slug FROM categories").all().map((row) => [row.slug,row.id])
  );
  const insertProject = db.prepare(`
    INSERT INTO projects (
      title,subtitle,slug,category_id,description,cover_image,year,location,
      is_featured,is_recommended,status,sort_order,created_at,updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,'published',?,?,?)
  `);
  [
    ["城市边缘","武汉的缝隙、夜晚与临时风景","city-edge","photo","一项持续进行的城市观察计划。","","2024—2026","武汉",1,0,1],
    ["无序之序","实验性展览视觉系统","order-in-chaos","graphic","一套可以持续变化的实验性视觉识别。","","2025","武汉",1,0,2],
    ["留白住宅","89㎡旧房改造与光线研究","blank-house","interior","以自然光和收纳边界为核心的住宅更新项目。","","2025","武汉",1,0,3],
    ["器材与观看方式","相机、镜头，以及它们如何改变观看","camera-and-seeing","photo","关于工具如何塑造视觉习惯的长期记录。","","2019—NOW","",1,0,4],
    ["凌晨四点","关于失眠和城市光源的图像","four-am","photo","夜晚结束前，城市短暂显露出的安静结构。","","2025","武汉",1,1,5],
    ["未命名的光","胶片、漏光与不可复制的瞬间","unnamed-light","photo","接受胶片的不确定性，把意外作为图像的一部分。","","2023","",0,1,6],
    ["微型工作室","21㎡多功能创作空间","micro-studio","interior","在有限尺度内容纳摄影、绘图、模型制作和日常工作。","","2026","武汉",0,1,7],
    ["田野笔记","地方手工艺口述史装帧","field-notes","graphic","将访谈、照片和手写记录组织成地方档案。","","2024","",0,1,8],
    ["视觉采样","材质、字体、配色与好看的东西","visual-sampling","database","一个不断增长的视觉参考集合。","","ONGOING","",0,1,9]
  ].forEach(([title,subtitle,slug,cat,description,cover,year,location,featured,recommended,order]) => {
    insertProject.run(title,subtitle,slug,categoryMap[cat],description,cover,year,location,featured,recommended,order,now(),now());
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

module.exports = { seedDatabase };
