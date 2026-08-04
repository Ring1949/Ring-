"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Project = { project_id: string; title: string };
type OutputConfig = { mode: "local" | "public"; isLocal: boolean; canOpenLocalDirectory: boolean; displayPath?: string | null; blobConfigured: boolean };
type OutputFile = {
  id: string;
  projectId: string;
  fileName: string;
  pathname: string;
  url: string;
  size: number;
  contentType: string;
  createdAt: string;
  generationId: string;
  version: number;
  volume: string;
  chapter: string;
  uploadStatus: string;
  errorSummary?: string | null;
  storageMode: string;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/novel/${path}`, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message ?? "请求失败");
  return data;
}

function sizeLabel(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export default function OutputsPage() {
  const [config, setConfig] = useState<OutputConfig | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [files, setFiles] = useState<OutputFile[]>([]);
  const [projectId, setProjectId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState("加载中…");

  async function load(nextProject = projectId) {
    try {
      const [configData, projectList, outputList] = await Promise.all([
        api<OutputConfig>("outputs/config"),
        api<Project[]>("projects"),
        api<OutputFile[]>(`outputs${nextProject ? `?projectId=${nextProject}` : ""}`)
      ]);
      setConfig(configData);
      setProjects(projectList);
      setFiles(outputList);
      setNote(configData.isLocal ? "本机模式：可通过资源管理器管理输出文件。" : configData.blobConfigured ? "公网模式：文件通过私有对象存储下载。" : "公网模式：尚未配置 Vercel Blob Private Storage。");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "加载失败");
    }
  }

  useEffect(() => { void load(""); }, []);

  const projectName = useMemo(() => new Map(projects.map((item) => [item.project_id, item.title])), [projects]);
  const groups = useMemo(() => {
    const data = new Map<string, OutputFile[]>();
    for (const file of files) {
      const key = `${projectName.get(file.projectId) || file.projectId} / ${file.volume || "未分卷"} / ${file.chapter || "未分章"}`;
      data.set(key, [...(data.get(key) || []), file]);
    }
    return [...data.entries()];
  }, [files, projectName]);

  async function rename(file: OutputFile) {
    const fileName = window.prompt("新的文件名：", file.fileName);
    if (!fileName || fileName === file.fileName) return;
    try {
      await api(`outputs/${file.id}/rename`, { method: "POST", body: JSON.stringify({ fileName }) });
      setNote("文件已重命名。");
      await load();
    } catch (error) {
      setNote(error instanceof Error ? error.message : "重命名失败");
    }
  }

  async function remove(file: OutputFile) {
    if (!window.confirm(`删除 ${file.fileName}？`)) return;
    try {
      await api(`outputs/${file.id}`, { method: "DELETE", body: "{}" });
      setSelected((items) => items.filter((id) => id !== file.id));
      setNote("文件已删除。");
      await load();
    } catch (error) {
      setNote(error instanceof Error ? error.message : "删除失败");
    }
  }

  async function mutate(file: OutputFile, action: "retry" | "regenerate") {
    try {
      await api(`outputs/${file.id}/${action}`, { method: "POST", body: "{}" });
      setNote(action === "retry" ? "已重新尝试上传。" : "已重新生成输出文件。");
      await load();
    } catch (error) {
      setNote(error instanceof Error ? error.message : "操作失败");
    }
  }

  function toggle(id: string) {
    setSelected((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  }

  function download(file: OutputFile) {
    window.location.href = `/api/novel/outputs/download?id=${encodeURIComponent(file.id)}`;
  }

  function batchDownload() {
    if (!selected.length) return setNote("请先选择要打包下载的文件。");
    window.location.href = `/api/novel/outputs/download?ids=${encodeURIComponent(selected.join(","))}`;
  }

  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">OUTPUT CENTER</p>
          <h1>输出文件</h1>
        </div>
        <nav className="pageNav">
          <Link href="/novel-studio">控制中心</Link>
          <Link href="/novel-studio/settings/models">模型连接</Link>
          <Link href="/novel-studio/trash">回收站</Link>
        </nav>
      </header>
      <p className="notice">{note}</p>
      <section className="panel outputPanel">
        <div className="outputToolbar">
          <select value={projectId} onChange={(event) => { setProjectId(event.target.value); setSelected([]); void load(event.target.value); }}>
            <option value="">全部小说项目</option>
            {projects.map((project) => <option key={project.project_id} value={project.project_id}>{project.title}</option>)}
          </select>
          <button className="secondary" onClick={batchDownload}>批量打包下载</button>
        </div>
        {config?.isLocal && config.displayPath && <small className="muted">本机输出目录：{config.displayPath}</small>}
        {!groups.length && <p className="muted">暂无输出文件。</p>}
        {groups.map(([group, items]) => (
          <section className="outputGroup" key={group}>
            <h2>{group}</h2>
            {items.map((file) => (
              <article className="outputFile" key={file.id}>
                <label><input type="checkbox" checked={selected.includes(file.id)} onChange={() => toggle(file.id)} /> <b>{file.fileName}</b></label>
                <small>{file.contentType} · {sizeLabel(file.size)} · v{file.version} · {new Date(file.createdAt).toLocaleString()}</small>
                <small>生成：{file.generationId} · 上传状态：{file.uploadStatus}{file.errorSummary ? ` · ${file.errorSummary}` : ""}</small>
                <div className="outputActions">
                  <button onClick={() => download(file)}>下载</button>
                  <button onClick={() => void rename(file)}>重命名</button>
                  <button onClick={() => void mutate(file, "regenerate")}>重新生成</button>
                  {file.uploadStatus === "failed" && <button onClick={() => void mutate(file, "retry")}>重试上传</button>}
                  <button className="danger compact" onClick={() => void remove(file)}>删除</button>
                </div>
              </article>
            ))}
          </section>
        ))}
      </section>
    </main>
  );
}
