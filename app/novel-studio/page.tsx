"use client";

import { FormEvent, MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Project = {
  project_id: string; title: string; genre: string; creative_brief: string; length_category: string;
  target_words: number; stage: string; status: string; provider: string; model_name: string;
  provider_status: string; provider_ready: boolean; updated_at: string;
};
type Provider = { provider_id: string; display_name: string; provider_type: "real" | "simulation"; ready: boolean; safe_message: string; model_name: string };
type Vitals = {
  temperature: number; phase: string; agent_id: string; agent_name: string; task: string;
  recent_action: string; next_step: string; reading: string[]; progress_percent: number;
  eta: string; eta_kind: string; model: string; provider: string; provider_ready: boolean;
};
type HistoryNode = { label: string; status: "completed" | "active" | "waiting" };
type Monitor = {
  project: Project; current_status: string; active: boolean;
  run_status?: { current_agent?: string; current_task?: string; progress?: { completed?: number; total?: number }; checkpoint?: string };
  vitals: Vitals; history_nodes: HistoryNode[]; outline_gate: { approved: boolean; message: string };
};
type MessageMetadata = { status?: string; summary?: string; impact?: string[]; actions?: string[] };
type Message = { id: string; role: string; content: string; kind?: string; created_at?: string; metadata?: MessageMetadata };
type Artifact = {
  artifact_id: string; name: string; category: string; format: string; size_bytes: number; status: string;
  approval_status?: "approved" | "waiting" | "required"; can_preview: boolean; can_open: boolean; can_download: boolean;
};
type ArtifactPreview = { name: string; format: string; content: string };
type ContextMenu = { project: Project; x: number; y: number } | null;

const lengthOptions = [
  { id: "SHORT", label: "短篇", range: "1,000–20,000 字", target: 12000, storyForm: "SHORT" },
  { id: "MEDIUM", label: "中篇", range: "20,000–100,000 字", target: 60000, storyForm: "LONG" },
  { id: "LONG", label: "长篇", range: "150,000–500,000 字", target: 300000, storyForm: "LONG" },
  { id: "ULTRA", label: "超长篇", range: "500,000 字以上", target: 600000, storyForm: "LONG" },
] as const;

const phaseLabels: Record<string, string> = {
  INTAKE: "等待开始", ROUTED: "路线确认", PLANNING: "策划中", REPLAN: "需要重新规划",
  OUTLINE_REQUIRED: "需要重新规划", SUMMARY_READY: "等待大纲审批", APPROVED: "准备写作",
  PRODUCING: "正文生成", PAUSED: "已暂停", FINAL_AUDIT: "最终质检", REPAIRING: "修订中",
  MANUSCRIPT_READY: "正文完成", DELIVERED: "已完成", FAILED: "遇到问题",
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/novel/${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "操作没有完成，请稍后重试。");
  return data as T;
}

function projectStatus(project: Project) {
  if (!project.provider_ready && project.provider !== "fake") return "模型未连接";
  return phaseLabels[project.stage] || "准备中";
}

function fileLabel(artifact: Artifact) {
  if (artifact.approval_status === "approved") return "已批准";
  if (artifact.approval_status === "waiting") return "等待审批";
  if (artifact.approval_status === "required") return "需要重新生成";
  if (artifact.category === "final") return "最终作品";
  if (artifact.category === "draft") return "创作草稿";
  return "已生成";
}

function previewText(file: ArtifactPreview) {
  const raw = file.content.trim();
  if (!raw.startsWith("{") && !raw.startsWith("[")) return raw;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const body = parsed.content ?? parsed.text ?? parsed.body ?? parsed.markdown;
    if (typeof body !== "string") return raw;
    const title = parsed.title ?? parsed.chapter_title ?? parsed.scene_title;
    return typeof title === "string" && title.trim() ? `${title.trim()}\n\n${body}` : body;
  } catch {
    return raw;
  }
}

export default function Studio() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [monitor, setMonitor] = useState<Monitor | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [inspiration, setInspiration] = useState("");
  const [length, setLength] = useState<(typeof lengthOptions)[number]["id"]>("SHORT");
  const [selectedProvider, setSelectedProvider] = useState("codex");
  const [preview, setPreview] = useState<ArtifactPreview | null>(null);
  const [fileBusy, setFileBusy] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu>(null);
  const fileSection = useRef<HTMLDivElement>(null);

  const loadProjects = useCallback(async () => {
    const rows = await api<Project[]>("projects");
    setProjects(rows);
    return rows;
  }, []);

  const loadProject = useCallback(async (id: string, quiet = false, updateUrl = false) => {
    if (!quiet) setLoading(true);
    try {
      const [detail, monitorData, messageRows, artifactData] = await Promise.all([
        api<Project>(`projects/${id}`), api<Monitor>(`projects/${id}/monitor`),
        api<Message[]>(`projects/${id}/messages`), api<{ items: Artifact[] }>(`projects/${id}/artifacts`),
      ]);
      setActiveProjectId(id);
      setActiveProject(detail);
      setMonitor(monitorData);
      setMessages(messageRows.filter((item) => item.role === "user" || item.kind === "model_update"));
      setArtifacts(artifactData.items);
      setProjects((current) => current.map((item) => item.project_id === detail.project_id ? detail : item));
      if (updateUrl) window.history.pushState({ projectId: id }, "", `${window.location.pathname}?project=${encodeURIComponent(id)}`);
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "项目加载失败。");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const [rows, providerRows] = await Promise.all([loadProjects(), api<Provider[]>("providers")]);
        setProviders(providerRows);
        const ready = providerRows.find((item) => item.ready && item.provider_type === "real") || providerRows.find((item) => item.ready);
        if (ready) setSelectedProvider(ready.provider_id);
        const requested = new URLSearchParams(window.location.search).get("project");
        const first = requested || rows[0]?.project_id;
        if (first) await loadProject(first, false, !requested);
        else setLoading(false);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "作品库加载失败。");
        setLoading(false);
      }
    })();
  }, [loadProject, loadProjects]);

  useEffect(() => {
    if (!activeProjectId) return;
    const timer = window.setInterval(() => void loadProject(activeProjectId, true), monitor?.active ? 3000 : 10000);
    return () => window.clearInterval(timer);
  }, [activeProjectId, loadProject, monitor?.active]);

  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  const selectedLength = lengthOptions.find((item) => item.id === length) || lengthOptions[0];
  const provider = providers.find((item) => item.provider_id === activeProject?.provider);
  const vitals = monitor?.vitals;

  const primaryAction = useMemo(() => {
    const phase = vitals?.phase || activeProject?.stage;
    if (!activeProjectId || phase === "DELIVERED" || phase === "MANUSCRIPT_READY") return null;
    if (phase === "PRODUCING") return { label: "暂停创作", path: "pause", tone: "quiet" };
    if (phase === "PAUSED") return { label: "继续创作", path: "resume", tone: "primary" };
    if (phase === "SUMMARY_READY") return { label: "批准大纲并继续", path: "outline/approve", tone: "primary" };
    if (phase === "REPLAN" || phase === "OUTLINE_REQUIRED") return { label: "重新规划", path: "start", tone: "primary" };
    if (phase === "APPROVED") return { label: "开始写正文", path: "start", tone: "primary" };
    return { label: "开始构思", path: "start", tone: "primary" };
  }, [activeProject?.stage, activeProjectId, vitals?.phase]);

  async function runAction(path: string) {
    if (!activeProjectId) return;
    setActionBusy(true);
    try {
      await api(`projects/${activeProjectId}/${path}`, { method: "POST", body: "{}" });
      await loadProject(activeProjectId, false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "操作没有完成。");
    } finally {
      setActionBusy(false);
    }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!activeProjectId || !input.trim()) return;
    setSending(true);
    try {
      await api(`projects/${activeProjectId}/chat`, { method: "POST", body: JSON.stringify({ content: input.trim() }) });
      setInput("");
      await loadProject(activeProjectId, true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "消息发送失败。");
    } finally {
      setSending(false);
    }
  }

  async function removeMessage(message: Message) {
    if (!activeProjectId || !window.confirm("删除这条聊天记录？")) return;
    await api(`projects/${activeProjectId}/messages/${encodeURIComponent(message.id)}`, { method: "DELETE" });
    await loadProject(activeProjectId, true);
  }

  async function createProject(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !genre.trim()) return setNotice("请填写小说名称和题材。");
    const chosen = providers.find((item) => item.provider_id === selectedProvider);
    if (!chosen?.ready) return setNotice("所选模型尚未连接。");
    setCreating(true);
    try {
      const created = await api<Project>("projects", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(), genre: genre.trim(), user_requirements: inspiration.trim(), creative_brief: inspiration.trim(),
          target_length: selectedLength.target, story_form: selectedLength.storyForm, length_category: length,
          provider_name: selectedProvider, model_name: chosen.model_name,
        }),
      });
      setCreateOpen(false); setTitle(""); setGenre(""); setInspiration("");
      await loadProjects();
      await loadProject(created.project_id, false, true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "小说创建失败。");
    } finally {
      setCreating(false);
    }
  }

  async function deleteProject(project: Project) {
    setContextMenu(null);
    if (!window.confirm(`将《${project.title}》移入回收站？`)) return;
    await api(`projects/${project.project_id}`, { method: "DELETE", body: JSON.stringify({ confirmed: true, confirmation: "DELETE" }) });
    const rows = await loadProjects();
    const next = rows.find((item) => item.project_id !== project.project_id);
    if (next) await loadProject(next.project_id, false, true);
    else { setActiveProjectId(null); setActiveProject(null); setMonitor(null); setMessages([]); setArtifacts([]); }
  }

  function openContext(event: MouseEvent, project: Project) {
    event.preventDefault(); event.stopPropagation();
    setContextMenu({ project, x: Math.min(event.clientX, window.innerWidth - 210), y: Math.min(event.clientY, window.innerHeight - 230) });
  }

  async function openFile(artifact: Artifact) {
    if (!activeProjectId) return;
    setFileBusy(`${artifact.artifact_id}:open`);
    try {
      await api(`projects/${activeProjectId}/artifacts/${artifact.artifact_id}/open`, { method: "POST", body: "{}" });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "文件无法打开。");
    } finally { setFileBusy(null); }
  }

  async function previewFile(artifact: Artifact) {
    if (!activeProjectId) return;
    setFileBusy(`${artifact.artifact_id}:preview`);
    try { setPreview(await api<ArtifactPreview>(`projects/${activeProjectId}/artifacts/${artifact.artifact_id}/preview`)); }
    catch (error) { setNotice(error instanceof Error ? error.message : "文件预览失败。"); }
    finally { setFileBusy(null); }
  }

  async function deleteFile(artifact: Artifact) {
    if (!activeProjectId || !window.confirm(`删除“${artifact.name}”？如果它属于大纲，正文会立即停止。`)) return;
    setFileBusy(`${artifact.artifact_id}:delete`);
    try {
      await api(`projects/${activeProjectId}/artifacts/${artifact.artifact_id}`, { method: "DELETE" });
      await loadProject(activeProjectId, false);
    } catch (error) { setNotice(error instanceof Error ? error.message : "文件删除失败。"); }
    finally { setFileBusy(null); }
  }

  async function rejectOutline() {
    if (!activeProjectId) return;
    const reason = window.prompt("告诉创作团队需要修改什么：");
    if (!reason?.trim()) return;
    await api(`projects/${activeProjectId}/outline/reject`, { method: "POST", body: JSON.stringify({ reason }) });
    await loadProject(activeProjectId, false);
  }

  function handleMessageAction(action: string) {
    if (action === "重新规划") void runAction("outline/replan");
    if (action === "继续生产") void runAction(vitals?.phase === "PAUSED" ? "resume" : "start");
  }

  return (
    <main className="studioShell">
      <aside className="libraryPanel">
        <div className="brandBlock"><span className="brandDot" />AI小说公司</div>
        <button className="newNovelButton" onClick={() => setCreateOpen(true)}><span>＋</span> 新建小说</button>
        <div className="sectionCaption">我的作品</div>
        <div className="projectList">
          {projects.map((project) => (
            <button
              key={project.project_id}
              className={`projectCard ${activeProjectId === project.project_id ? "selected" : ""}`}
              onClick={() => void loadProject(project.project_id, false, true)}
              onContextMenu={(event) => openContext(event, project)}
            >
              <span className="bookGlyph">文</span>
              <span className="projectCopy"><strong>《{project.title}》</strong><small><i className={`statusDot ${project.stage === "FAILED" ? "danger" : ""}`} />{projectStatus(project)}</small></span>
              <span className="moreButton" onClick={(event) => openContext(event, project)}>•••</span>
            </button>
          ))}
          {!projects.length && <p className="emptyHint">还没有作品。创建第一部小说后，创作团队会在这里等你。</p>}
        </div>
        <div className="libraryFooter"><span>作品自动保存在工作室</span><a href="/novel-studio/settings/models">模型设置</a></div>
      </aside>

      <section className="conversationPanel">
        <header className="projectHeader">
          <div><span>当前作品</span><h1>{activeProject ? `《${activeProject.title}》` : "AI 小说工作台"}</h1></div>
          {activeProject && <button className="fileJump" onClick={() => fileSection.current?.scrollIntoView({ behavior: "smooth" })}>作品文件 <span>{artifacts.length}</span></button>}
        </header>

        {notice && <div className="noticeBar"><span>{notice}</span><button onClick={() => setNotice("")}>×</button></div>}

        {!activeProjectId && !loading ? (
          <div className="welcomeState"><div className="welcomeMark">AI</div><h2>把一个念头交给创作团队</h2><p>创建小说后，项目经理会组织世界观、角色、剧情、写作、编辑与质检员工协作完成作品。</p><button onClick={() => setCreateOpen(true)}>创建第一部小说</button></div>
        ) : loading ? (
          <div className="loadingState"><span /><p>正在打开作品…</p></div>
        ) : (
          <>
            <div className="chatStream">
              {!messages.length && <div className="assistantIntro"><div className="assistantAvatar">AI</div><div><strong>创作团队已就位</strong><p>你可以补充灵感、修改人物或直接开始构思。每个阶段的真实进度会显示在右侧。</p></div></div>}
              {messages.map((message) => (
                <article className={`messageRow ${message.role === "user" ? "user" : "assistant"}`} key={message.id}>
                  {message.role !== "user" && <div className="assistantAvatar small">AI</div>}
                  <div className="messageBubble">
                    <div className="messageTop"><strong>{message.role === "user" ? "你" : "AI小说公司"}</strong><button onClick={() => void removeMessage(message)} aria-label="删除消息">删除</button></div>
                    <p>{message.content}</p>
                    {message.metadata?.impact && <div className="impactCard"><span>这次修改可能影响</span>{message.metadata.impact.map((item) => <div key={item}>✓ {item}</div>)}<div className="impactActions">{message.metadata.actions?.map((item) => <button key={item} onClick={() => handleMessageAction(item)}>{item}</button>)}</div></div>}
                  </div>
                </article>
              ))}
              {monitor?.active && <div className="workingLine"><span className="workingPulse" /><div><strong>{vitals?.agent_name}正在工作</strong><small>{vitals?.task}</small></div></div>}
            </div>

            <div className="composerDock">
              <form className="composer" onSubmit={sendMessage}>
                <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="告诉创作团队你想写什么，或需要修改什么…" rows={2} />
                <div className="composerFooter"><span>AI只展示任务进度，不展示内部思考</span><button disabled={sending || !input.trim()}>{sending ? "发送中" : "发送"}</button></div>
              </form>
              {primaryAction && <button className={`primaryFlow ${primaryAction.tone}`} onClick={() => void runAction(primaryAction.path)} disabled={actionBusy}>{actionBusy ? "处理中…" : primaryAction.label}</button>}
            </div>

            <section className="filesSection" ref={fileSection}>
              <div className="filesHeading"><div><span>作品文件</span><h2>创作成果</h2></div><p>无需查找目录，直接打开、预览或下载。</p></div>
              <div className="fileGrid">
                {artifacts.map((artifact) => (
                  <article className="fileCard" key={artifact.artifact_id}>
                    <div className={`fileIcon ${artifact.format}`}>▤</div>
                    <div className="fileInfo"><strong>{artifact.name.replace(/^\d+_/, "")}</strong><small><i className={`fileState ${artifact.approval_status || "ready"}`} />{fileLabel(artifact)} · {Math.max(1, Math.round(artifact.size_bytes / 1024))} KB</small></div>
                    <div className="fileActions">
                      {artifact.can_preview && <button onClick={() => void previewFile(artifact)} disabled={fileBusy?.startsWith(artifact.artifact_id)}>预览</button>}
                      {artifact.can_open && <button onClick={() => void openFile(artifact)} disabled={fileBusy?.startsWith(artifact.artifact_id)}>打开</button>}
                      {artifact.can_download && <a href={`/api/novel/projects/${activeProjectId}/artifacts/${artifact.artifact_id}/download`}>下载</a>}
                      {artifact.approval_status === "waiting" && <><button className="approve" onClick={() => void runAction("outline/approve")}>批准</button><button onClick={() => void rejectOutline()}>退回</button></>}
                      <button className="deleteFile" onClick={() => void deleteFile(artifact)}>删除</button>
                    </div>
                  </article>
                ))}
                {!artifacts.length && <div className="emptyFiles"><span>▤</span><p>作品文件会随着构思和写作自动出现在这里。</p></div>}
              </div>
            </section>
          </>
        )}
      </section>

      <aside className="vitalsPanel">
        <div className="vitalsTitle"><span>创作生命体征</span><i className={monitor?.active ? "live" : ""}>{monitor?.active ? "实时" : "待命"}</i></div>
        {activeProject && vitals ? <>
          <section className="temperatureCard">
            <div className="thermometer"><div className="thermometerFill" style={{ height: `${Math.max(18, vitals.progress_percent)}%` }} /><b /></div>
            <div className="temperatureCopy"><span>创作热度</span><strong>{vitals.temperature.toFixed(1)}<small>℃</small></strong><p>{phaseLabels[vitals.phase] || vitals.phase}</p></div>
          </section>

          <section className="employeeCard">
            <div className="cardEyebrow">当前AI员工</div>
            <div className="employeeIdentity"><span>{vitals.agent_name.slice(0, 1)}</span><div><strong>{vitals.agent_name}</strong><small>{monitor.active ? "正在工作" : "当前负责人"}</small></div></div>
            <dl><div><dt>当前任务</dt><dd>{vitals.task}</dd></div><div><dt>最近动作</dt><dd>{vitals.recent_action}</dd></div><div><dt>下一步</dt><dd>{vitals.next_step}</dd></div></dl>
            <div className="readingList"><span>正在读取</span>{vitals.reading.map((item) => <small key={item}>✓ {item}</small>)}</div>
          </section>

          <section className="progressCard">
            <div className="progressTop"><span>当前进度</span><strong>{vitals.progress_percent}%</strong></div>
            <div className="progressTrack"><i style={{ width: `${vitals.progress_percent}%` }} /></div>
            <div className="etaRow"><span>预计完成</span><strong>{vitals.eta}</strong></div>
          </section>

          <section className={`modelCard ${activeProject.provider === "fake" ? "fake" : ""}`}>
            <div><span className="modelSignal" /><p><small>当前模型</small><strong>{activeProject.provider === "fake" ? "测试模式" : "Codex"}</strong></p></div>
            <p>{activeProject.provider === "fake" ? "不会调用真实模型，也不会产生真实小说内容。" : activeProject.provider_ready ? "已连接 · 可用于真实创作" : provider?.safe_message || "模型尚未连接"}</p>
          </section>

          <section className="timelineCard">
            <div className="cardEyebrow">历史节点</div>
            <div className="timeline">{monitor.history_nodes.map((node) => <div className={node.status} key={node.label}><i>{node.status === "completed" ? "✓" : node.status === "active" ? "•" : ""}</i><span>{node.label}</span></div>)}</div>
          </section>
        </> : <div className="vitalsEmpty"><span>♡</span><p>打开一部作品后，这里会显示创作团队的真实状态。</p></div>}
      </aside>

      {contextMenu && <div className="contextMenu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}>
        <button onClick={() => void loadProject(contextMenu.project.project_id, false, true)}>打开作品</button>
        <button onClick={() => { setContextMenu(null); if (activeProjectId !== contextMenu.project.project_id) void loadProject(contextMenu.project.project_id, false, true).then(() => fileSection.current?.scrollIntoView()); else fileSection.current?.scrollIntoView({ behavior: "smooth" }); }}>打开文件</button>
        <button onClick={() => { setContextMenu(null); if (contextMenu.project.stage === "PRODUCING") void runAction("pause"); }}>{contextMenu.project.stage === "PAUSED" ? "作品已暂停" : "暂停制作"}</button>
        <button className="danger" onClick={() => void deleteProject(contextMenu.project)}>删除项目</button>
      </div>}

      {createOpen && <div className="modalBackdrop" onMouseDown={() => setCreateOpen(false)}><form className="createModal" onSubmit={createProject} onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="modalClose" onClick={() => setCreateOpen(false)}>×</button>
        <div className="modalHeading"><span>NEW STORY</span><h2>创建新小说</h2><p>给创作团队一个起点，其余内容可以由AI自由构思。</p></div>
        <label>小说名称<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：长安夜行录" autoFocus /></label>
        <label>题材<input value={genre} onChange={(event) => setGenre(event.target.value)} placeholder="例如：古代江湖、都市情感、悬疑" /></label>
        <fieldset><legend>作品体量</legend><div className="lengthCards">{lengthOptions.map((item) => <button type="button" className={length === item.id ? "selected" : ""} onClick={() => setLength(item.id)} key={item.id}><strong>{item.label}</strong><small>{item.range}</small></button>)}</div></fieldset>
        <label>已有灵感 <small>可为空</small><textarea value={inspiration} onChange={(event) => setInspiration(event.target.value)} placeholder="人物、世界、情节或一句模糊的想法都可以。留空时由AI自由构思。" rows={4} /></label>
        <div className="modelChoice"><span>创作模型</span><div>{providers.filter((item) => item.ready).map((item) => <button type="button" key={item.provider_id} className={selectedProvider === item.provider_id ? "selected" : ""} onClick={() => setSelectedProvider(item.provider_id)}><i />{item.provider_type === "simulation" ? "测试模式" : "Codex"}<small>{item.provider_type === "simulation" ? "不调用真实AI" : "已连接"}</small></button>)}</div></div>
        <div className="outputNote"><span>⌂</span><div><strong>最终作品保存位置</strong><small>工作室默认输出库 · 创建后可在“作品文件”中直接打开</small></div></div>
        <button className="createSubmit" disabled={creating}>{creating ? "正在创建…" : "创建项目"}</button>
      </form></div>}

      {preview && <div className="modalBackdrop" onMouseDown={() => setPreview(null)}><section className="previewModal" onMouseDown={(event) => event.stopPropagation()}><header><div><span>文件预览</span><h2>{preview.name}</h2></div><button onClick={() => setPreview(null)}>×</button></header><pre>{previewText(preview)}</pre></section></div>}
    </main>
  );
}
