export type CreativeGraphNode = {
  id: string;
  name: string;
  category: string;
  summary: string;
  detail: string;
  level: "core" | "hub" | "node";
  status: "active" | "planned";
  link?: string;
  image?: string;
  image_alt?: string;
};

export type CreativeGraphLink = { id: string; source: string; target: string };
export type CreativeGraphData = { version: number; data_revision: number; updated_at: string; nodes: CreativeGraphNode[]; links: CreativeGraphLink[] };

const node = (id: string, name: string, category: string, summary: string, detail: string, level: CreativeGraphNode["level"] = "node", status: CreativeGraphNode["status"] = "active", link = ""): CreativeGraphNode => ({ id, name, category, summary, detail, level, status, ...(link ? { link } : {}) });
const edge = (source: string, target: string): CreativeGraphLink => ({ id: `${source}--${target}`, source, target });

const restoredNode = (id: string, name: string, category: string, summary: string): CreativeGraphNode =>
  node(id, name, category, summary, `${summary}。这是原关系图谱中保留的内容节点，可在后台继续补充文字、图片和链接。`);

const restoredNodes: CreativeGraphNode[] = [
  restoredNode("ai-tech", "AI与技术", "技术", "AI 技术方向与实践索引"),
  restoredNode("photo-film", "摄影与影视", "视觉", "摄影、影像与视频创作方向"),
  restoredNode("ai-app", "AI应用开发", "技术", "把模型能力做成可以使用的产品"),
  restoredNode("prompts", "Prompt素材库", "技术", "提示词、范例与模型交互素材"),
  restoredNode("game-cs2", "CS2", "游戏", "竞技射击与团队协作体验"),
  restoredNode("photo-davinci", "DaVinci调色", "视觉", "影像调色与后期工作流"),
  restoredNode("game-gta5", "GTA5", "游戏", "开放世界与城市体验"),
  restoredNode("game-inside", "INSIDE", "游戏", "氛围叙事与关卡体验"),
  restoredNode("game-pubg", "PUBG", "游戏", "战术竞技与多人协作"),
  restoredNode("photo-contest", "参加摄影比赛", "视觉", "摄影作品整理与公开投稿"),
  restoredNode("geography", "地理", "知识", "地点、空间与自然环境观察"),
  restoredNode("game-limbo", "地狱边境 Limbo", "游戏", "黑白美术与环境叙事"),
  restoredNode("web-development", "网站开发", "技术", "个人网站的开发、维护与发布"),
  restoredNode("personal-knowledge", "个人知识库", "知识", "个人资料、方法与长期知识沉淀"),
  restoredNode("portfolio-design", "作品集设计", "作品", "作品选择、编排与展示方式"),
  restoredNode("game-sky", "光遇 Sky", "游戏", "社交探索与情绪化视觉体验"),
  restoredNode("game-forza4", "极限竞速：地平线4", "游戏", "开放世界驾驶与汽车文化"),
  restoredNode("game-forza-series", "极限竞速：地平线系列", "游戏", "地平线系列的驾驶与场景体验"),
  restoredNode("photo-architecture", "建筑摄影", "视觉", "建筑、结构与空间秩序"),
  restoredNode("inspiration-library", "灵感库", "知识", "跨项目灵感与参考资料"),
  restoredNode("game-luoke", "洛克王国", "游戏", "养成、探索与童年数字记忆"),
  restoredNode("game-travel-frog", "旅行青蛙", "游戏", "轻量收集与旅行叙事"),
  restoredNode("game-left4dead", "求生之路 Left 4 Dead", "游戏", "合作生存与关卡节奏"),
  restoredNode("game-delta", "三角洲行动", "游戏", "战术射击与多人行动"),
  restoredNode("game-forest-son", "森林之子 Sons of the Forest", "游戏", "生存建造与多人探索"),
  restoredNode("photo-landscape", "风光摄影", "视觉", "自然景观、光线与地点观察"),
  restoredNode("documentary-video", "纪录片拍摄", "视觉", "真实人物与事件的连续影像记录"),
  restoredNode("travel", "旅行", "生活", "地点体验、路线与途中观察"),
  restoredNode("visual-china", "签约视觉中国", "职业", "摄影作品的图库签约与商业发布"),
  restoredNode("astro-timelapse", "星空延时", "视觉", "夜空拍摄与延时影像"),
  restoredNode("game-it-takes-two", "双人成行", "游戏", "双人合作与互动叙事"),
  restoredNode("astro-photo", "天文摄影", "视觉", "星空与天体的影像记录"),
  restoredNode("game-civ6", "文明6 Civilization VI", "游戏", "文明发展与策略系统"),
  restoredNode("game-valorant", "无畏契约 Valorant", "游戏", "角色技能与战术竞技"),
  restoredNode("game-little-nightmares", "小小梦魇 Little Nightmares", "游戏", "暗黑童话与环境叙事"),
  restoredNode("game-stardew", "星露谷物语 Stardew Valley", "游戏", "经营、社区与日常节奏"),
  restoredNode("film-book-list", "影视和书籍总清单维护", "知识", "影视与阅读资料的长期索引"),
  restoredNode("game-goose", "鹅鸭杀", "游戏", "多人社交推理"),
  restoredNode("game-moving-out", "胡闹搬家 Moving Out", "游戏", "多人协作与派对玩法"),
  restoredNode("game-hogwarts", "霍格沃茨之遗 Hogwarts Legacy", "游戏", "魔法世界探索与叙事"),
  restoredNode("game-monument", "纪念碑谷 Monument Valley", "游戏", "空间错觉与视觉解谜"),
  restoredNode("game-party-animals", "猛兽派对", "游戏", "物理互动与多人派对"),
  restoredNode("game-ball", "球球大作战", "游戏", "轻量竞技与成长机制"),
  restoredNode("game-snake", "贪吃蛇大作战", "游戏", "轻量竞技与经典机制"),
  restoredNode("game-king", "王者荣耀", "游戏", "多人竞技与角色协作"),
  restoredNode("game-battlefield1", "战地1", "游戏", "历史战争场景与多人对战"),
  restoredNode("project-template", "项目模板", "系统", "新项目的结构与复用模板")
];

export const defaultCreativeGraph: CreativeGraphData = {
  version: 1,
  data_revision: 2,
  updated_at: "2026-08-12T00:00:00.000Z",
  nodes: [
    node("control", "00-总控台", "核心", "创作宇宙的中心入口", "连接作品、技术、职业、知识与生活方向，负责汇总当前项目和长期计划。", "core"),
    node("ai", "AI", "技术", "AI 工具、Agent 与自动化", "用于探索模型能力、工作流设计、内容生产和个人效率系统。", "hub"),
    node("portfolio", "个人作品集", "作品", "公开展示创作成果", "整理摄影、设计、空间和 AI 作品，形成可持续更新的个人档案。", "hub", "active", "/works.html?category=all"),
    node("website", "个人网站", "作品", "Ring 的个人网络空间", "承载作品库、小说工作台、关系图谱与长期创作资料。", "hub", "active", "/"),
    node("photography", "摄影", "视觉", "纪实、人物、产品与风景", "以现场观察和视觉叙事为主，持续整理拍摄项目、设备经验和公开作品。", "hub", "active", "/works.html?category=photo"),
    node("games", "游戏与数字世界", "兴趣", "游戏体验与数字世界观察", "记录游戏机制、视觉体验、世界构建和多人协作中的兴趣线索。", "hub"),
    node("knowledge", "知识与资料库", "系统", "资料、Skill 与知识索引", "保存可复用的方法、参考资料、工具和长期积累的知识结构。", "hub", "active", "/skill-library"),
    node("career", "职业与商业", "职业", "职业方向与商业实践", "连接求职、个人品牌、商业摄影和可持续创作收入。", "hub"),
    node("writing", "写作与世界构建", "创作", "小说、角色与世界观", "通过 AI 小说公司工作台组织长篇写作、设定、剧情和正文生产。", "hub", "active", "/novel-studio"),
    node("visual", "视觉设计与空间", "视觉", "平面、品牌与空间设计", "研究版式、色彩、材质、空间尺度和视觉系统之间的关系。", "hub"),
    node("life", "生活美学与手作", "生活", "日常、器物与手作", "关注生活中的质感、手工实践、产品观察和个人审美。"),
    node("language", "语言与音乐", "兴趣", "语言学习与声音体验", "记录语言、音乐和声音相关的学习与灵感。"),
    node("nature", "运动旅行与自然", "生活", "运动、旅行和自然观察", "通过身体行动和旅行建立对地点、自然与生活节奏的感受。"),
    node("materials", "知识与素材系统", "系统", "素材收集与生产资料", "管理图片、文本、Prompt、Skill 和项目参考素材。"),
    node("review", "周复盘", "系统", "阶段总结与下一步", "定期回看项目进展、问题、选择和下一阶段重点。"),
    node("inbox", "进度收件箱", "系统", "项目状态与待处理事项", "集中查看正在进行、被阻塞和等待确认的任务。"),
    node("jobs", "求职", "职业", "作品、经历与机会", "组织作品展示、岗位方向、简历材料和职业行动。"),
    node("publish", "网站发布规则", "系统", "网站修改与上线流程", "确保每次网站修改经过检查、同步 GitHub、部署 Vercel 并核验公网。"),
    node("ai-agent", "AI Agent", "技术", "能持续执行任务的 AI 员工", "探索状态管理、工具调用、任务分工和可观测的 Agent 生产方式。"),
    node("ai-workflow", "AI 工作流与自动化", "技术", "把重复步骤变成可靠流程", "组合模型、脚本、接口和审核节点，让内容生产更稳定。"),
    node("skills", "Skill 素材库", "技术", "可复用的 Codex 能力包", "收集具有明确说明、步骤和资源的 Skill 文件。", "node", "active", "/skill-library"),
    node("photo-product", "产品摄影", "视觉", "珠宝、器物与商业静物", "通过布光、构图和材质表现建立产品视觉。"),
    node("photo-portrait", "人像摄影", "视觉", "人物关系和现场状态", "关注人物、环境与真实互动中的叙事瞬间。"),
    node("photo-documentary", "纪实摄影", "视觉", "社会现场与公共生活", "通过连续观察和影像记录建立具有语境的故事。"),
    node("photo-travel", "旅行记录", "视觉", "地点、自然与途中观察", "用影像保存旅行中的空间、人物和情绪。"),
    node("game-minecraft", "我的世界 Minecraft", "游戏", "建造与开放世界", "长期的数字建造、探索和多人协作兴趣。"),
    node("game-cities", "城市：天际线 Cities - Skylines", "游戏", "城市系统与空间规划", "从交通、分区和公共服务理解复杂城市系统。"),
    node("game-forest", "森林 The Forest", "游戏", "生存、建造与协作", "关注环境叙事、资源循环和多人协作体验。"),
    node("books", "书籍库", "知识", "阅读记录和主题索引", "保存值得复看、引用和延伸研究的书籍。"),
    node("images", "图片素材库", "知识", "视觉参考与图片资料", "按用途、主题和项目整理可复用的视觉素材。"),
    node("film", "电影库", "知识", "影像作品与叙事参考", "记录电影、镜头、声音和世界观方面的观察。"),
    ...restoredNodes
  ],
  links: [
    edge("control", "ai"), edge("control", "portfolio"), edge("control", "website"), edge("control", "photography"), edge("control", "games"), edge("control", "knowledge"), edge("control", "career"), edge("control", "writing"), edge("control", "visual"), edge("control", "life"), edge("control", "language"), edge("control", "nature"), edge("control", "materials"), edge("control", "review"), edge("control", "inbox"), edge("control", "jobs"), edge("control", "publish"),
    edge("ai", "ai-agent"), edge("ai", "ai-workflow"), edge("ai", "skills"), edge("ai", "website"), edge("ai", "writing"),
    edge("portfolio", "website"), edge("portfolio", "photography"), edge("portfolio", "visual"), edge("portfolio", "jobs"),
    edge("photography", "photo-product"), edge("photography", "photo-portrait"), edge("photography", "photo-documentary"), edge("photography", "photo-travel"), edge("photography", "nature"),
    edge("games", "game-minecraft"), edge("games", "game-cities"), edge("games", "game-forest"), edge("games", "life"),
    edge("knowledge", "books"), edge("knowledge", "images"), edge("knowledge", "film"), edge("knowledge", "skills"), edge("knowledge", "materials"),
    edge("career", "jobs"), edge("career", "portfolio"), edge("review", "inbox"), edge("review", "publish"),
    edge("control", "ai-tech"), edge("control", "photo-film"),
    edge("ai", "ai-app"), edge("ai", "ai-tech"), edge("ai", "prompts"), edge("ai", "portfolio"), edge("ai", "jobs"), edge("ai", "knowledge"), edge("ai", "review"),
    edge("games", "game-cs2"), edge("photography", "photo-davinci"), edge("games", "game-gta5"), edge("games", "game-inside"), edge("knowledge", "prompts"), edge("games", "game-pubg"),
    edge("photography", "photo-contest"), edge("photography", "geography"), edge("games", "game-limbo"),
    edge("website", "jobs"), edge("website", "photography"), edge("website", "web-development"), edge("website", "review"), edge("knowledge", "personal-knowledge"),
    edge("portfolio", "inbox"), edge("portfolio", "publish"), edge("portfolio", "review"), edge("portfolio", "portfolio-design"),
    edge("games", "game-sky"), edge("games", "game-forza4"), edge("games", "game-forza-series"), edge("photography", "photo-architecture"), edge("knowledge", "inspiration-library"),
    edge("games", "game-luoke"), edge("games", "game-travel-frog"), edge("games", "game-left4dead"), edge("games", "game-delta"), edge("games", "game-forest-son"),
    edge("photography", "photo-landscape"), edge("photography", "documentary-video"), edge("photography", "travel"), edge("photography", "visual-china"), edge("photography", "jobs"), edge("photography", "astro-timelapse"),
    edge("games", "game-it-takes-two"), edge("photography", "astro-photo"), edge("publish", "inbox"),
    edge("games", "game-civ6"), edge("games", "game-valorant"), edge("games", "game-little-nightmares"), edge("games", "game-stardew"), edge("knowledge", "film-book-list"),
    edge("games", "game-goose"), edge("games", "game-moving-out"), edge("games", "game-hogwarts"), edge("games", "game-monument"), edge("games", "game-party-animals"), edge("games", "game-ball"), edge("games", "game-snake"), edge("games", "game-king"), edge("games", "game-battlefield1"),
    edge("review", "jobs"), edge("review", "photography"), edge("review", "knowledge")
  ]
};

export function validateCreativeGraph(input: unknown): CreativeGraphData {
  if (!input || typeof input !== "object") throw new Error("图谱数据格式不正确。");
  const raw = input as Partial<CreativeGraphData>;
  if (!Array.isArray(raw.nodes) || !Array.isArray(raw.links)) throw new Error("图谱必须包含节点和连接关系。");
  if (raw.nodes.length < 1 || raw.nodes.length > 200) throw new Error("图谱节点数量必须在 1 到 200 之间。");
  const ids = new Set<string>();
  const nodes = raw.nodes.map((item: any) => {
    const id = String(item.id || "").trim();
    const name = String(item.name || "").trim();
    if (!id || !name || ids.has(id)) throw new Error("节点 ID 和名称不能为空，且 ID 不能重复。");
    ids.add(id);
    return { id, name, category: String(item.category || "未分类").slice(0, 40), summary: String(item.summary || "").slice(0, 160), detail: String(item.detail || "").slice(0, 5000), level: ["core", "hub", "node"].includes(item.level) ? item.level : "node", status: item.status === "planned" ? "planned" : "active", ...(item.link ? { link: String(item.link).slice(0, 500) } : {}), ...(item.image ? { image: String(item.image).slice(0, 2000) } : {}), ...(item.image_alt ? { image_alt: String(item.image_alt).slice(0, 200) } : {}) } as CreativeGraphNode;
  });
  const seenLinks = new Set<string>();
  const links = raw.links.map((item: any) => {
    const source = String(item.source || ""); const target = String(item.target || "");
    if (!ids.has(source) || !ids.has(target) || source === target) throw new Error("连接关系指向了不存在的节点。");
    const key = [source, target].sort().join("--");
    if (seenLinks.has(key)) throw new Error("连接关系不能重复。");
    seenLinks.add(key);
    return { id: String(item.id || key), source, target };
  });
  return { version: Math.max(1, Number(raw.version) || 1), data_revision: Math.max(1, Number(raw.data_revision) || 1), updated_at: String(raw.updated_at || new Date().toISOString()), nodes, links };
}

export function upgradeCreativeGraph(input: unknown): CreativeGraphData {
  const graph = validateCreativeGraph(input);
  if (graph.data_revision >= defaultCreativeGraph.data_revision) return graph;

  const nodes = [...graph.nodes];
  const nodeIds = new Set(nodes.map((item) => item.id));
  for (const item of defaultCreativeGraph.nodes) {
    if (!nodeIds.has(item.id)) {
      nodes.push(item);
      nodeIds.add(item.id);
    }
  }

  const links = [...graph.links];
  const linkKeys = new Set(links.map((item) => [item.source, item.target].sort().join("--")));
  for (const item of defaultCreativeGraph.links) {
    const key = [item.source, item.target].sort().join("--");
    if (!linkKeys.has(key) && nodeIds.has(item.source) && nodeIds.has(item.target)) {
      links.push(item);
      linkKeys.add(key);
    }
  }

  return { ...graph, data_revision: defaultCreativeGraph.data_revision, nodes, links };
}
