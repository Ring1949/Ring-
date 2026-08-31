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
    id: "novel-studio", index: "01", category: "NOVEL WORKBENCH", title: "AI 小说工作室",
    description: "小说策划、协作生产与输出管理。",
    introduction: "一个持续建设中的 AI 小说生产工作台，用于组织项目、模型、创作进度和最终作品文件。",
    cover: "/assets/extensions/novel-workbench.png", href: "/novel-studio", status: "ACTIVE"
  },
  {
    id: "poetry-library", index: "02", category: "POETRY", title: "诗词鉴赏",
    description: "在经典诗词中阅读语言、意象与情感。",
    introduction: "按朝代、作者和主题浏览经典诗词，并阅读简洁清楚的作品鉴赏。",
    cover: "/assets/extensions/poetry-appreciation.png", href: "/poetry-library", status: "ACTIVE"
  },
  {
    id: "skill-library", index: "03", category: "SKILL LIBRARY", title: "Skill 库",
    description: "保存可复用的创作与自动化能力。",
    introduction: "将写作、视觉、研究和自动化 Skill 按自定义分类保存，并提供查看、下载与后台维护入口。",
    cover: "/assets/extensions/skill-library.png", href: "/skill-library", status: "ACTIVE"
  },
  {
    id: "prompt-library", index: "04", category: "PROMPT LIBRARY", title: "Prompt 库",
    description: "保存、检索并快速复制可复用提示词。",
    introduction: "将常用提示词按创作方向分类整理，随时搜索、查看并复制到新的对话中。",
    cover: "/assets/extensions/prompt-library.png", href: "/prompt-library", status: "ACTIVE"
  },
  {
    id: "knowledge-library", index: "05", category: "KNOWLEDGE LIBRARY", title: "知识库",
    description: "收藏、标记并检索长期积累的知识卡片。",
    introduction: "将电影、美术、摄影、建模、乐理、服装、人物、材质与空间等知识整理成可搜索的个人卡片档案。",
    cover: "/assets/extensions/knowledge-library.svg", href: "/knowledge-library", status: "ACTIVE"
  }
];

export const getExtensionProject = (id: string) => extensionProjects.find((project) => project.id === id);
