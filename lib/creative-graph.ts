export type CreativeGraphNode = {
  id: string;
  name: string;
  category: string;
  summary: string;
  detail: string;
  level: "core" | "hub" | "node";
  status: "active" | "planned";
  link?: string;
};

export type CreativeGraphLink = { id: string; source: string; target: string };
export type CreativeGraphData = { version: number; updated_at: string; nodes: CreativeGraphNode[]; links: CreativeGraphLink[] };

const node = (id: string, name: string, category: string, summary: string, detail: string, level: CreativeGraphNode["level"] = "node", status: CreativeGraphNode["status"] = "active", link = ""): CreativeGraphNode => ({ id, name, category, summary, detail, level, status, ...(link ? { link } : {}) });
const edge = (source: string, target: string): CreativeGraphLink => ({ id: `${source}--${target}`, source, target });

export const defaultCreativeGraph: CreativeGraphData = {
  version: 1,
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
    node("game-cities", "城市：天际线", "游戏", "城市系统与空间规划", "从交通、分区和公共服务理解复杂城市系统。"),
    node("game-forest", "森林 The Forest", "游戏", "生存、建造与协作", "关注环境叙事、资源循环和多人协作体验。"),
    node("books", "书籍库", "知识", "阅读记录和主题索引", "保存值得复看、引用和延伸研究的书籍。"),
    node("images", "图片素材库", "知识", "视觉参考与图片资料", "按用途、主题和项目整理可复用的视觉素材。"),
    node("film", "电影库", "知识", "影像作品与叙事参考", "记录电影、镜头、声音和世界观方面的观察。")
  ],
  links: [
    edge("control", "ai"), edge("control", "portfolio"), edge("control", "website"), edge("control", "photography"), edge("control", "games"), edge("control", "knowledge"), edge("control", "career"), edge("control", "writing"), edge("control", "visual"), edge("control", "life"), edge("control", "language"), edge("control", "nature"), edge("control", "materials"), edge("control", "review"), edge("control", "inbox"), edge("control", "jobs"), edge("control", "publish"),
    edge("ai", "ai-agent"), edge("ai", "ai-workflow"), edge("ai", "skills"), edge("ai", "website"), edge("ai", "writing"),
    edge("portfolio", "website"), edge("portfolio", "photography"), edge("portfolio", "visual"), edge("portfolio", "jobs"),
    edge("photography", "photo-product"), edge("photography", "photo-portrait"), edge("photography", "photo-documentary"), edge("photography", "photo-travel"), edge("photography", "nature"),
    edge("games", "game-minecraft"), edge("games", "game-cities"), edge("games", "game-forest"), edge("games", "life"),
    edge("knowledge", "books"), edge("knowledge", "images"), edge("knowledge", "film"), edge("knowledge", "skills"), edge("knowledge", "materials"),
    edge("career", "jobs"), edge("career", "portfolio"), edge("review", "inbox"), edge("review", "publish")
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
    return { id, name, category: String(item.category || "未分类").slice(0, 40), summary: String(item.summary || "").slice(0, 160), detail: String(item.detail || "").slice(0, 2000), level: ["core", "hub", "node"].includes(item.level) ? item.level : "node", status: item.status === "planned" ? "planned" : "active", ...(item.link ? { link: String(item.link).slice(0, 500) } : {}) } as CreativeGraphNode;
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
  return { version: Math.max(1, Number(raw.version) || 1), updated_at: String(raw.updated_at || new Date().toISOString()), nodes, links };
}
