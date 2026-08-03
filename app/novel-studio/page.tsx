"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type Project = { project_id: string; title: string; genre: string; creative_brief: string; length_category: string; target_words: number; word_tolerance: number; stage: string; status: string; provider: string; model_name: string; provider_status: string; provider_ready: boolean; updated_at: string };
type Provider = { provider_id: string; display_name: string; provider_type: "real" | "simulation"; ready: boolean; status: "checking" | "connected" | "unavailable" | "test_required" | "error"; safe_message: string; model_name: string; real_test_passed: boolean };
type Monitor = {
  project: Project;
  current_status: string;
  active: boolean;
  run_status?: { current_agent?: string; current_task?: string; estimated_finish?: string };
  runs?: { run_id: string; stage?: string; status?: string; error_summary?: string | null }[];
  events: { step?: string }[];
};
type Message = { id: string; role: string; content: string; kind?: string };
type Artifact = { artifact_id: string; name: string; category: string; format: string; size_bytes: number; created_at: string; status: string; can_preview: boolean; can_open: boolean; can_download: boolean; can_open_folder: boolean };
type ArtifactPreview = { name: string; format: string; content: string };
type FolderResult = { selected: boolean; cancelled?: boolean; display_path?: string };
type OutputConfig = { mode: "local" | "public"; isLocal: boolean; canOpenLocalDirectory: boolean; displayPath?: string | null };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/novel/${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers }
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.message || "操作失败");
  return data;
}

const stages = ["项目创建", "需求理解", "故事构思", "世界观与人物设计", "大纲生成", "等待大纲审批", "章节规划", "正文写作", "编辑修订", "质量检查", "Word 导出", "完成交付"];
const lengthOptions = [
  { id: "SHORT", label: "短篇", range: "1,000–20,000 字", target: 10000 },
  { id: "MEDIUM", label: "中篇", range: "20,000–100,000 字", target: 60000 },
  { id: "LONG", label: "长篇", range: "150,000–500,000 字", target: 300000 },
  { id: "ULTRA", label: "超长篇", range: "500,000 字以上", target: 600000 }
];

const stageIndex: Record<string, number> = {
  INTAKE: 0,
  NEEDS_INPUT: 1,
  ROUTED: 2,
  PLANNING: 3,
  REPLAN: 3,
  SUMMARY_READY: 5,
  APPROVED: 6,
  PRODUCING: 7,
  PAUSED: 7,
  FINAL_AUDIT: 9,
  REPAIRING: 8,
  MANUSCRIPT_READY: 10,
  DELIVERED: 11,
  FAILED: 0
};

function stageLabel(stage: string, currentStatus?: string) {
  if (stage === "PLANNING" && currentStatus === "WAITING_APPROVAL") return "等待大纲审批";
  return stages[stageIndex[stage] ?? 0];
}

function translateIssueSummary(raw: string) {
  const text = raw.trim();
  if (!text) return "当前流程中断，但系统没有返回更具体的问题说明。";
  if (text.includes("request timed out") || text.includes("stream disconnected")) {
    return "真实模型连接超时：工作室已经发起了 Codex 请求，但与模型服务的网络通信反复超时，所以卡在这一环节。";
  }
  if (text.includes("falling back to HTTP")) {
    return "实时连接不稳定：系统先尝试实时通道，失败后切换到普通网络请求，但这一轮仍然没顺利完成。";
  }
  if (text.includes("Invalid schema") || text.includes("invalid_json_schema")) {
    return "模型输出格式不符合系统要求：这一环节收到的返回结构不合法，系统因此中止。";
  }
  if (text.includes("timed out")) {
    return "这一环节执行超时：系统等待模型或任务结果太久，没有在规定时间内完成。";
  }
  if (text.includes("non-zero exit code")) {
    return "模型进程异常退出：Codex 已经启动，但这一步没有正常返回结果。";
  }
  if (text.includes("WAITING_APPROVAL")) {
    return "当前没有报错，流程停在等待你审批大纲。";
  }
  return `环节异常：${text.slice(0, 140)}${text.length > 140 ? "…" : ""}`;
}

export default function Studio() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectLoadError, setProjectLoadError] = useState<string | null>(null);
  const [outputCount, setOutputCount] = useState<number | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [artifactsLoading, setArtifactsLoading] = useState(false);
  const [artifactsError, setArtifactsError] = useState<string | null>(null);
  const [previewArtifact, setPreviewArtifact] = useState<ArtifactPreview | null>(null);
  const [artifactBusy, setArtifactBusy] = useState<string | null>(null);
  const [monitor, setMonitor] = useState<Monitor | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [modal, setModal] = useState(false);
  const [title, setTitle] = useState("");
  const [outline, setOutline] = useState("");
  const [length, setLength] = useState("SHORT");
  const [provider, setProvider] = useState("");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [settingsModal, setSettingsModal] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<Project | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [note, setNote] = useState("准备就绪");
  const [outputBusy, setOutputBusy] = useState(false);
  const [outputConfig, setOutputConfig] = useState<OutputConfig | null>(null);
  const [localhost, setLocalhost] = useState(false);
  const [failureDialog, setFailureDialog] = useState<{ runId: string; summary: string } | null>(null);
  const seenFailureRuns = useRef(new Set<string>());

  const openProject = useCallback(async (id: string, updateUrl = true) => {
    setActiveProjectId(id);
    setActiveProject(null);
    setMonitor(null);
    setMessages([]);
    setOutputCount(null);
    setArtifacts([]); setArtifactsLoading(true); setArtifactsError(null); setPreviewArtifact(null);
    setProjectLoadError(null);
    setProjectLoading(true);
    if (updateUrl) window.history.pushState({ projectId: id }, "", `/novel-studio?project=${encodeURIComponent(id)}`);
    try {
      const [detail, monitorData, messageList, outputFiles] = await Promise.all([
        api<Project>(`projects/${id}`),
        api<Monitor>(`projects/${id}/monitor`),
        api<Message[]>(`projects/${id}/messages`),
        api<unknown[]>(`outputs?projectId=${encodeURIComponent(id)}`)
      ]);
      setActiveProject(detail);
      setMonitor(monitorData);
      setMessages(messageList);
      setOutputCount(outputFiles.length);
      try {
        const artifactData = await api<{ items: Artifact[] }>(`projects/${id}/artifacts`);
        setArtifacts(artifactData.items);
        setOutputCount(artifactData.items.length);
      } catch (error) {
        setArtifactsError(error instanceof Error ? error.message : "作品文件加载失败，请重试。");
      }
    } catch (error) {
      setProjectLoadError(error instanceof Error ? error.message : "项目加载失败");
      setNote(error instanceof Error ? error.message : "连接失败");
    }
    setProjectLoading(false);
    setArtifactsLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const projectList = await api<Project[]>("projects");
        setProjects(projectList);
        const requestedId = new URLSearchParams(window.location.search).get("project");
        const initialId = requestedId ?? projectList[0]?.project_id;
        if (initialId) await openProject(initialId, !requestedId);
      } catch (error) {
        setProjectLoadError(error instanceof Error ? error.message : "项目列表加载失败");
      }
    })();
    const restoreFromUrl = () => {
      const projectId = new URLSearchParams(window.location.search).get("project");
      if (projectId) void openProject(projectId, false);
    };
    window.addEventListener("popstate", restoreFromUrl);
    return () => window.removeEventListener("popstate", restoreFromUrl);
  }, [openProject]);
  useEffect(() => {
    setLocalhost(["localhost", "127.0.0.1", "::1"].includes(window.location.hostname));
    void api<OutputConfig>("outputs/config").then(setOutputConfig).catch(() => setOutputConfig(null));
  }, []);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setModal(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  const stage = monitor?.project.stage || "INTAKE";
  const currentStatus = monitor?.current_status || monitor?.run_status?.current_task || "";
  const latestRun = monitor?.runs?.[0];
  const hasFailure = currentStatus === "FAILED" || latestRun?.status === "FAILED" || stage === "FAILED";
  const index = hasFailure ? Math.max(stageIndex[latestRun?.stage || stage] ?? 0, 0) : stage === "SUMMARY_READY" && currentStatus === "WAITING_APPROVAL" ? 5 : stageIndex[stage] ?? 0;
  const projectTitle = activeProject?.title || "未选择项目";
  const issueSummary = translateIssueSummary(latestRun?.error_summary || (hasFailure ? "当前流程在这个环节中断，但后端没有返回更具体的错误摘要。" : ""));
  const visibleMessages = messages.filter((message) => message.role === "user" || message.kind === "model_update");
  const runNoticeCount = messages.filter((message) => ["run_status", "error", "approval_request"].includes(message.kind || "")).length;

  useEffect(() => {
    if (!hasFailure || !latestRun?.run_id || seenFailureRuns.current.has(latestRun.run_id)) return;
    seenFailureRuns.current.add(latestRun.run_id);
    setFailureDialog({ runId: latestRun.run_id, summary: issueSummary });
  }, [hasFailure, issueSummary, latestRun?.run_id]);

  const primaryAction = useMemo(() => {
    if (!activeProjectId || stage === "DELIVERED") return null;
    if (stage === "PRODUCING") return { label: "暂停创作", path: "pause", tone: "secondary" };
    if (stage === "PAUSED") return { label: "继续创作", path: "resume", tone: "primary" };
    if (stage === "SUMMARY_READY") return { label: "批准大纲，进入正文", path: "outline/approve", tone: "primary" };
    if (stage === "APPROVED") return { label: "开始正文生产", path: "start", tone: "primary" };
    if (stage === "FAILED") return { label: "重新启动生产", path: "start", tone: "primary" };
    return { label: "开始构思", path: "start", tone: "primary" };
  }, [activeProjectId, stage]);

  const showLocalOutput = Boolean(localhost && outputConfig?.canOpenLocalDirectory);

  async function openOutputLibrary() {
    setOutputBusy(true);
    setNote("正在打开输出目录。");
    try {
      const item = await api<FolderResult>("system/output-folder", { method: "POST", body: JSON.stringify({ open: true }) });
      if (item.display_path) {
        setNote(`输出目录已打开：${item.display_path}`);
      }
    } catch (error) {
      setNote(error instanceof Error ? error.message : "无法打开输出目录");
    } finally {
      setOutputBusy(false);
    }
  }

  const loadProviders = useCallback(async () => {
    setProvidersLoading(true);
    setProvidersError(null);
    try {
      const rows = await api<Provider[]>("providers");
      setProviders(rows.map((row) => ({ ...row, provider_id: row.provider_id || (row as unknown as { provider_name: string }).provider_name })));
    } catch (error) {
      setProvidersError(error instanceof Error ? error.message : "模型状态加载失败，请重试。");
    } finally {
      setProvidersLoading(false);
    }
  }, []);

  function openCreateModal() {
    setProvider("");
    setModal(true);
    void loadProviders();
  }

  function openProjectSettings() {
    if (!activeProject) return;
    setSettingsDraft({ ...activeProject });
    setSettingsModal(true);
    void loadProviders();
  }

  async function saveProjectSettings(event: FormEvent) {
    event.preventDefault();
    if (!activeProjectId || !settingsDraft) return;
    if (settingsDraft.target_words !== activeProject?.target_words && !["INTAKE", "NEEDS_INPUT"].includes(activeProject?.stage || "") && !window.confirm("目标字数已变化，现有大纲不会自动重写。是否仅保存新的项目设置？")) return;
    setSettingsSaving(true);
    try {
      const updated = await api<Project>(`projects/${activeProjectId}`, { method: "PATCH", body: JSON.stringify({ name: settingsDraft.title, genre: settingsDraft.genre, creative_brief: settingsDraft.creative_brief, length_category: settingsDraft.length_category, target_words: Number(settingsDraft.target_words), word_tolerance: settingsDraft.word_tolerance, provider: settingsDraft.provider, model_name: settingsDraft.model_name }) });
      setSettingsModal(false);
      setProjects((rows) => rows.map((row) => row.project_id === updated.project_id ? updated : row));
      await openProject(updated.project_id, false);
      setNote("项目设置已保存");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "项目设置保存失败");
    } finally {
      setSettingsSaving(false);
    }
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return setNote("请填写小说标题。");
    const preset = lengthOptions.find((item) => item.id === length)!;
    const chosenProvider = providers.find((item) => item.provider_id === provider);
    if (!chosenProvider) return setNote("请主动选择一个可用模型。");
    if (!chosenProvider.ready) return setNote("所选模型尚未连接，请先完成模型检测。");
    setCreating(true);
    try {
      const project = await api<Project>("projects", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          user_requirements: outline,
          genre: "自由创作",
          target_length: preset.target,
          story_form: length === "SHORT" ? "SHORT" : "LONG",
          length_category: length,
          creative_brief: outline,
          provider_name: provider
        })
      });
      setModal(false);
      setTitle("");
      setOutline("");
      const nextProjects = await api<Project[]>("projects");
      setProjects(nextProjects);
      await openProject(project.project_id);
      setNote("项目已创建，等待你从右侧开始构思。");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "创建失败");
    } finally {
      setCreating(false);
    }
  }

  async function chat(event: FormEvent) {
    event.preventDefault();
    if (!activeProjectId || !text.trim()) return;
    try {
      await api(`projects/${activeProjectId}/chat`, { method: "POST", body: JSON.stringify({ content: text }) });
      setText("");
      await openProject(activeProjectId, false);
    } catch (error) {
      setNote(error instanceof Error ? error.message : "发送失败");
    }
  }

  async function removeMessage(message: Message) {
    if (!activeProjectId) return;
    if (!window.confirm("确认删除这条聊天记录吗？")) return;
    try {
      await api(`projects/${activeProjectId}/messages/${encodeURIComponent(message.id)}`, { method: "DELETE" });
      await openProject(activeProjectId, false);
      setNote("聊天记录已删除");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "删除聊天记录失败");
    }
  }

  async function clearRunNotices() {
    if (!activeProjectId || !runNoticeCount) return;
    try {
      const result = await api<{ deleted: number }>(`projects/${activeProjectId}/messages/run-notices`, { method: "DELETE", body: "{}" });
      await openProject(activeProjectId, false);
      setNote(`已清理 ${result.deleted} 条旧运行提示。`);
    } catch (error) {
      setNote(error instanceof Error ? error.message : "清理运行提示失败");
    }
  }

  async function action(path: string) {
    if (!activeProjectId) return;
    try {
      await api(`projects/${activeProjectId}/${path}`, { method: "POST", body: "{}" });
      await openProject(activeProjectId, false);
    } catch (error) {
      const summary = error instanceof Error ? error.message : "操作失败";
      setFailureDialog({ runId: `action-${Date.now()}`, summary: translateIssueSummary(summary) });
      setNote(error instanceof Error ? error.message : "操作失败");
    }
  }

  const refreshArtifacts = useCallback(async () => {
    if (!activeProjectId) return;
    setArtifacts([]);
    setArtifactsLoading(true);
    setArtifactsError(null);
    try {
      const data = await api<{ items: Artifact[] }>(`projects/${activeProjectId}/artifacts`);
      setArtifacts(data.items);
    } catch (error) {
      setArtifactsError(error instanceof Error ? error.message : "作品文件加载失败，请重试。");
    } finally {
      setArtifactsLoading(false);
    }
  }, [activeProjectId]);

  async function previewArtifactFile(artifact: Artifact) {
    if (!activeProjectId) return;
    setArtifactBusy(`${artifact.artifact_id}:preview`);
    try {
      const data = await api<ArtifactPreview>(`projects/${activeProjectId}/artifacts/${artifact.artifact_id}/preview`);
      setPreviewArtifact(data);
    } catch (error) {
      setNote(error instanceof Error ? error.message : "文件预览失败");
    } finally {
      setArtifactBusy(null);
    }
  }

  async function artifactAction(artifact: Artifact, operation: "open" | "open-folder") {
    if (!activeProjectId) return;
    setArtifactBusy(`${artifact.artifact_id}:${operation}`);
    try {
      await api(`projects/${activeProjectId}/artifacts/${artifact.artifact_id}/${operation}`, { method: "POST", body: "{}" });
      setNote(operation === "open" ? "已交给 Windows 默认程序打开文件。" : "已在资源管理器中定位文件。");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "文件操作失败");
    } finally {
      setArtifactBusy(null);
    }
  }

  async function deleteArtifact(artifact: Artifact) {
    if (!activeProjectId) return;
    setArtifactBusy(`${artifact.artifact_id}:delete`);
    try {
      const analysis = await api<{ affected: string[]; message: string }>(`projects/${activeProjectId}/artifacts/${artifact.artifact_id}/dependencies`);
      const affected = analysis.affected.length ? `\n\n会标记为需要更新：${analysis.affected.join("、")}` : "";
      if (!window.confirm(`删除《${artifact.name}》？文件会移入项目回收目录，不会自动调用模型重新生成。${affected}`)) return;
      await api(`projects/${activeProjectId}/artifacts/${artifact.artifact_id}`, { method: "DELETE", body: "{}" });
      setNote("文件已移入项目回收目录；下游文件如有依赖会标记为需要更新。");
      await refreshArtifacts();
    } catch (error) {
      setNote(error instanceof Error ? error.message : "删除文件失败");
    } finally {
      setArtifactBusy(null);
    }
  }

  function formatFileSize(size: number) {
    return size < 1024 * 1024 ? `${Math.max(1, Math.ceil(size / 1024))} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`;
  }

  function artifactCategoryLabel(category: string) {
    return ({ outline: "大纲与规划", world: "世界观与人物", manuscript: "正文与章节", editorial: "编辑与质检", final: "最终成品" } as Record<string, string>)[category] || "作品文件";
  }

  const artifactGroups = ["outline", "world", "manuscript", "editorial", "final"].map((category) => ({
    category,
    name: artifactCategoryLabel(category),
    items: artifacts.filter((artifact) => artifact.category === category)
  })).filter((group) => group.items.length > 0);

  async function remove(project: Project) {
    if (!window.confirm(`删除《${project.title}》？项目会进入回收站，可稍后恢复。`)) return;
    try {
      await api(`projects/${project.project_id}`, { method: "DELETE", body: JSON.stringify({ confirmed: true, confirmation: "DELETE" }) });
      setNote("项目已移入回收站。");
      const remaining = await api<Project[]>("projects");
      setProjects(remaining);
      if (activeProjectId === project.project_id) {
        const nextProjectId = remaining[0]?.project_id ?? null;
        if (nextProjectId) await openProject(nextProjectId);
        else { setActiveProjectId(null); setActiveProject(null); setMonitor(null); setMessages([]); }
      }
    } catch (error) {
      setNote(error instanceof Error ? error.message : "删除失败");
    }
  }

  return (
    <>
      <main className="studio">
        <aside className="spaces">
          <div className="brand">AI小说公司</div>
          <button className="new" onClick={openCreateModal}>新建小说</button>
          <p>小说项目</p>
          {projects.map((project) => (
            <div className={project.project_id === activeProjectId ? "projectRow active" : "projectRow"} key={project.project_id}>
              <button className="project" type="button" aria-current={project.project_id === activeProjectId ? "page" : undefined} onClick={() => void openProject(project.project_id)}>
                <b>{project.title}</b>
                <small>{project.stage}</small>
              </button>
              <button className="deleteProject" title="删除项目" onClick={() => void remove(project)}>×</button>
            </div>
          ))}
          <div className="bottom">
            <Link href="/novel-studio/outputs">输出文件</Link>
            <Link href="/novel-studio/settings/models">模型连接</Link>
            <Link href="/novel-studio/trash">回收站</Link>
          </div>
        </aside>

        <section className="conversation">
          <header>
            <div>
              <small className="currentProjectLabel">当前项目</small>
              <h1>《{projectTitle}》</h1>
              {activeProject && <small className="projectMeta">状态：{activeProject.status} · 模型：{activeProject.model_name} · 更新于：{new Date(activeProject.updated_at).toLocaleString()} · 产物：{outputCount ?? 0}</small>}
              {activeProject && <small className="projectMeta">{activeProject.genre} · {activeProject.length_category === "short" ? "短篇" : activeProject.length_category === "medium" ? "中篇" : activeProject.length_category === "long" ? "长篇" : "自定义"} · 约 {Math.round(activeProject.target_words / 10000)} 万字 · 模型状态：{activeProject.provider_ready ? "已连接" : "当前不可用"}</small>}
              <span>{monitor?.project.provider === "fake" ? "模拟模型（不会调用真实 AI）" : monitor?.project.provider || "选择模型"}</span>
            </div>
            {activeProject && <button type="button" className="compact" onClick={openProjectSettings}>项目设置</button>}
          </header>
          <div className="dialogue">
            {projectLoading ? (
              <div className="welcome"><h2>正在打开项目……</h2><p>正在加载项目详情、状态和产物摘要。</p></div>
            ) : projectLoadError ? (
              <div className="welcome projectLoadError"><h2>项目加载失败</h2><p>{projectLoadError}</p><button type="button" className="controlPrimary" onClick={() => activeProjectId && void openProject(activeProjectId, false)}>重试</button><button type="button" className="controlSecondary" onClick={() => { window.history.pushState({}, "", "/novel-studio"); setActiveProjectId(null); setActiveProject(null); setProjectLoadError(null); }}>返回小说项目</button></div>
            ) : !activeProjectId ? (
              <div className="welcome">
                <h2>今天想写什么故事？</h2>
                <p>点击左侧新建小说，提交标题和创作大纲。</p>
              </div>
            ) : visibleMessages.map((message) => (
              <div className={message.role === "user" ? "messageRow user" : "messageRow ai"} key={message.id}>
                <div className={message.role === "user" ? "bubble user" : "bubble ai"}>{message.content}</div>
                <button className="deleteMessage" type="button" onClick={() => void removeMessage(message)}>删除</button>
              </div>
            ))}
            <div className="hint">{note}</div>
          </div>
          {activeProjectId && !projectLoading && !projectLoadError && (
            <section className="artifactSection" aria-label="作品文件">
              <div className="artifactHeading"><div><h2>作品文件</h2><p>完成大纲、章节或导出后，文件会直接显示在这里。</p></div><button type="button" className="compact" onClick={() => void refreshArtifacts()} disabled={artifactsLoading}>刷新</button></div>
              {artifactsLoading ? <p className="artifactEmpty">正在加载作品文件……</p> : artifactsError ? <div className="artifactEmpty"><p>{artifactsError}</p><button type="button" className="compact" onClick={() => void refreshArtifacts()}>重试</button></div> : artifactGroups.length === 0 ? <div className="artifactEmpty"><p>这个项目还没有生成作品文件。</p><small>完成大纲、章节或导出后，文件会直接显示在这里。</small></div> : artifactGroups.map((group) => <section className="artifactGroup" key={group.category}><h3>{group.name}</h3><div className="artifactGrid">{group.items.map((artifact) => <article className="artifactCard" key={artifact.artifact_id}><div className="artifactIcon">{artifact.format === "docx" ? "W" : artifact.format === "pdf" ? "P" : "文"}</div><div className="artifactInfo"><b>{artifact.name}</b><small>{artifact.format.toUpperCase()} · {formatFileSize(artifact.size_bytes)}</small><small>{artifactCategoryLabel(artifact.category)} · {new Date(artifact.created_at).toLocaleString()} · 已就绪</small></div><div className="artifactActions">{artifact.can_preview && <button type="button" className="compact" onClick={() => void previewArtifactFile(artifact)} disabled={artifactBusy === `${artifact.artifact_id}:preview`}>预览</button>}{artifact.can_open && <button type="button" className="compact" onClick={() => void artifactAction(artifact, "open")} disabled={artifactBusy === `${artifact.artifact_id}:open`}>打开</button>}{artifact.can_download && <a className="compact" href={`/api/novel/projects/${activeProjectId}/artifacts/${artifact.artifact_id}/download`}>下载</a>}{artifact.can_open_folder && <button type="button" className="compact" onClick={() => void artifactAction(artifact, "open-folder")} disabled={artifactBusy === `${artifact.artifact_id}:open-folder`}>打开文件夹</button>}<button type="button" className="compact danger" onClick={() => void deleteArtifact(artifact)} disabled={artifactBusy === `${artifact.artifact_id}:delete`}>删除</button></div></article>)}</div></section>)}
            </section>
          )}
          {activeProjectId && !projectLoading && !projectLoadError && (
            <form className="composer" onSubmit={chat}>
              <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="补充修改意见或新的创作方向；将发送给当前项目…" />
              <button>发送指导</button>
            </form>
          )}
          {activeProjectId && !projectLoading && !projectLoadError && runNoticeCount > 0 && (
            <button className="clearRunNotices" type="button" onClick={() => void clearRunNotices()}>
              清理 {runNoticeCount} 条旧运行提示
            </button>
          )}
        </section>

        <aside className="production">
          <h3>创作进度</h3>
          <div className="meter">
            {stages.map((item, itemIndex) => (
              <div className={hasFailure && itemIndex === index ? "failed" : itemIndex < index ? "done" : itemIndex === index ? "current" : "future"} key={item}>
                <i />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <section className="task">
            <b>{stageLabel(stage, monitor?.current_status)}</b>
            <p>{hasFailure ? "该环节执行失败" : monitor?.run_status?.current_task || (monitor?.current_status === "WAITING_APPROVAL" ? "等待你审批大纲" : "等待开始")}</p>
            <small>负责人：{monitor?.run_status?.current_agent || "PM"}</small>
            <small>预计完成：{monitor?.run_status?.estimated_finish || "初步估算将在开始后给出"}</small>
          </section>
          {hasFailure && <section className="task issue"><b>问题概述</b><p>{issueSummary}</p></section>}
          {primaryAction && (
            <div className="controls">
              <button className={primaryAction.tone === "primary" ? "controlPrimary" : "controlSecondary"} onClick={() => void action(primaryAction.path)}>
                {primaryAction.label}
              </button>
            </div>
          )}
          {showLocalOutput ? (
            <button className="outputOpen" onClick={() => void openOutputLibrary()} disabled={outputBusy}>{outputBusy ? "正在打开…" : "打开本机输出目录"}</button>
          ) : (
            <Link className="outputOpen" href="/novel-studio/outputs">进入输出文件</Link>
          )}
        </aside>
      </main>

      {modal && (
        <div className="overlay" onClick={() => setModal(false)}>
          <form className="modal" onClick={(event) => event.stopPropagation()} onSubmit={create}>
            <button className="close" type="button" onClick={() => setModal(false)}>×</button>
            <h2>创建一部新小说</h2>
            <label>项目标题 *</label>
            <input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：合租屋里的夏天" />
            <label>提交大纲 / 创作灵感</label>
            <textarea value={outline} onChange={(event) => setOutline(event.target.value)} placeholder="自由创作：人物、背景、冲突、章节构想或完整大纲都可以。后续创作将以此为主。" />
            <label>小说体量</label>
            <div className="lengthChoices">
              {lengthOptions.map((item) => (
                <button type="button" className={length === item.id ? "length selected" : "length"} key={item.id} onClick={() => setLength(item.id)}>
                  <b>{item.label}</b>
                  <small>{item.range}</small>
                </button>
              ))}
            </div>
            <small>系统按区间规划，不要求你填写一个不现实的精确字数。</small>
            <small>成品会自动保存到后端输出目录，可在右侧工作台直接打开预览。</small>
            <label>选择模型</label>
            {providersLoading ? <p className="providerLoading">正在检测模型……</p> : providersError ? <p className="providerLoading">{providersError} <button type="button" className="compact" onClick={() => void loadProviders()}>重试</button></p> : <><small className="providerLoading">当前可用真实模型：{providers.filter((item) => item.provider_type === "real" && item.ready).length} 个</small><div className="providerCards">{providers.map((item) => <div className={`providerCard ${provider === item.provider_id ? "selected" : ""} ${item.ready ? "" : "disabled"}`} key={item.provider_id} onClick={() => item.ready && setProvider(item.provider_id)} role={item.ready ? "button" : undefined} tabIndex={item.ready ? 0 : -1}><b>{item.display_name}</b><small>{item.status === "connected" ? "已连接" : item.status === "test_required" ? "需要连接测试" : item.status === "error" ? "连接异常" : item.status === "checking" ? "正在检测" : "未连接"}</small><small>{item.safe_message}</small>{!item.ready && item.provider_type === "real" && <Link className="compact" href="/novel-studio/settings/models" onClick={(event) => event.stopPropagation()}>{item.status === "test_required" || item.status === "error" ? "重新检测" : "去连接"}</Link>}{item.provider_type === "simulation" && <small>模拟模型，不会调用真实 AI。</small>}</div>)}</div>{providers.filter((item) => item.provider_type === "real" && item.ready).length === 0 && <p className="providerLoading">当前没有已连接的真实模型。你可以前往模型连接，或主动选择模拟模式测试流程。</p>}</>}
            {creating && <small aria-live="polite">创建中…</small>}
            <button className="create">创建小说项目</button>
          </form>
        </div>
      )}

      {settingsModal && settingsDraft && (
        <div className="overlay" onClick={() => setSettingsModal(false)}>
          <form className="modal settingsModal" onClick={(event) => event.stopPropagation()} onSubmit={saveProjectSettings}>
            <button className="close" type="button" onClick={() => setSettingsModal(false)}>×</button>
            <h2>项目设置</h2>
            <label>项目名称<input required value={settingsDraft.title} onChange={(event) => setSettingsDraft({ ...settingsDraft, title: event.target.value })} /></label>
            <label>题材<input required value={settingsDraft.genre} onChange={(event) => setSettingsDraft({ ...settingsDraft, genre: event.target.value })} /></label>
            <label>大概构思<textarea value={settingsDraft.creative_brief || ""} onChange={(event) => setSettingsDraft({ ...settingsDraft, creative_brief: event.target.value })} /></label>
            <label>小说体量<select value={settingsDraft.length_category} onChange={(event) => setSettingsDraft({ ...settingsDraft, length_category: event.target.value })}><option value="short">短篇</option><option value="medium">中篇</option><option value="long">长篇</option><option value="custom">自定义</option></select></label>
            <label>预期字数<input type="number" min="1000" max="2000000" required value={settingsDraft.target_words} onChange={(event) => setSettingsDraft({ ...settingsDraft, target_words: Number(event.target.value) })} /></label>
            <small>预期字数用于控制后续故事规模，不要求最终字数完全一致。</small>
            <label>项目模型</label>
            <div className="providerCards">{providers.map((item) => <div className={`providerCard ${settingsDraft.provider === item.provider_id ? "selected" : ""} ${item.ready ? "" : "disabled"}`} key={item.provider_id} onClick={() => item.ready && setSettingsDraft({ ...settingsDraft, provider: item.provider_id, model_name: item.model_name })} role={item.ready ? "button" : undefined} tabIndex={item.ready ? 0 : -1}><b>{item.display_name}</b><small>{item.status === "connected" ? "已连接" : item.status === "test_required" ? "需要连接测试" : "未连接"}</small><small>{item.safe_message}</small>{!item.ready && item.provider_type === "real" && <Link className="compact" href="/novel-studio/settings/models" onClick={(event) => event.stopPropagation()}>{item.status === "test_required" ? "重新检测" : "去连接"}</Link>}</div>)}</div>
            {activeProject && ["PRODUCING", "FINAL_AUDIT", "REPAIRING"].includes(activeProject.stage) && <p className="settingsWarning">项目正在运行，请先暂停，再更换模型。</p>}
            <button className="create" disabled={settingsSaving}>{settingsSaving ? "保存中…" : "保存设置"}</button>
          </form>
        </div>
      )}

      {failureDialog && (
        <div className="overlay failureOverlay" role="presentation" onClick={() => setFailureDialog(null)}>
          <section className="failureDialog" role="alertdialog" aria-modal="true" aria-labelledby="failure-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="failure-title">运行未完成</h2>
            <p>{failureDialog.summary}</p>
            <button className="controlPrimary" type="button" onClick={() => setFailureDialog(null)}>我知道了</button>
          </section>
        </div>
      )}
      {previewArtifact && <div className="overlay" onClick={() => setPreviewArtifact(null)}><section className="modal previewModal" onClick={(event) => event.stopPropagation()}><button className="close" type="button" onClick={() => setPreviewArtifact(null)}>×</button><h2>{previewArtifact.name}</h2><pre>{previewArtifact.content}</pre></section></div>}
    </>
  );
}
