export type ExtensionProject = {
  id: string;
  index: string;
  category: string;
  title: string;
  description: string;
  introduction: string;
  cover: string;
  href: string;
  status: string;
};

export const extensionProjects: ExtensionProject[] = [
  {
    id: "novel-studio", index: "01", category: "AI WORKSPACE", title: "AI 小说工作室",
    description: "小说策划、协作生产与输出管理。",
    introduction: "一个持续建设中的 AI 小说生产工作台，用于组织项目、模型、创作进度和最终作品文件。",
    cover: "/assets/hero-default.jpg", href: "/extensions/novel-studio", status: "ACTIVE"
  },
  {
    id: "skill-library", index: "02", category: "SYSTEM", title: "Skill 库",
    description: "保存可复用的创作与自动化能力。",
    introduction: "将写作、视觉、研究和自动化 Skill 按自定义分类保存，并提供查看、下载与后台维护入口。",
    cover: "/assets/archive-collage.png", href: "/extensions/skill-library", status: "ACTIVE"
  },
  {
    id: "creative-graph", index: "03", category: "ARCHIVE", title: "创作关系图谱",
    description: "个人项目、兴趣与知识的动态索引。",
    introduction: "把作品、技术、摄影、游戏和资料节点连接成可探索、可编辑的个人创作宇宙。",
    cover: "/assets/news-series-cover.webp", href: "/extensions/creative-graph", status: "ONGOING"
  },
  {
    id: "visual-archive", index: "04", category: "DIGITAL ARCHIVE", title: "视觉档案系统",
    description: "作品、系列与长期资料的数字归档。",
    introduction: "围绕 Ring 网站持续整理的数字档案结构，用于保存作品、系列、分类和创作过程。",
    cover: "/assets/ring-profile-lanyard.jpg", href: "/extensions/visual-archive", status: "ONGOING"
  }
];

export const getExtensionProject = (id: string) => extensionProjects.find((project) => project.id === id);
