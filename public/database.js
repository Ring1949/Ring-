const archiveState = {
  items: [],
  category: "all",
  nextCursor: null,
  loading: false,
  total: 0,
  categoryNames: { photo: "摄影", graphic: "平面", space: "空间", ai: "AI", other: "其他" }
};

const archiveFilters = document.querySelector("#database-filters");
if (archiveFilters) {
  archiveFilters.innerHTML = `
    <button class="active" data-category="all">全部</button>
    <button data-category="photo">摄影</button>
    <button data-category="graphic">平面</button>
    <button data-category="space">空间</button>
    <button data-category="ai">AI</button>
    <button data-category="other">其他</button>
  `;
}

const grid = document.querySelector("#masonry-grid");
const status = document.querySelector("#database-status");
const loadMore = document.createElement("button");
loadMore.type = "button";
loadMore.className = "database-load-more";
loadMore.textContent = "加载更多";
loadMore.hidden = true;
grid.insertAdjacentElement("afterend", loadMore);

function archiveCard(item) {
  const thumbnail = item.thumbnail_url || "";
  return `
    <article class="masonry-card" tabindex="0" data-id="${escapeHtml(item.id)}">
      <div class="masonry-media">${mediaMarkup(thumbnail, item.media_type || "image", item.title, 640)}</div>
      <div class="masonry-copy">
        <h2>${escapeHtml(item.title || "未命名档案")}</h2>
        <p>${escapeHtml(item.project_title || "点击按需读取作品详情与原图。")}</p>
        <div class="masonry-meta"><span class="category">${escapeHtml(archiveState.categoryNames[item.category_slug] || "未分类")}</span></div>
      </div>
    </article>`;
}

function renderArchive(items, append = false) {
  const markup = items.map(archiveCard).join("");
  if (append) grid.insertAdjacentHTML("beforeend", markup);
  else grid.innerHTML = markup;
  status.textContent = archiveState.items.length ? `已显示 ${archiveState.items.length} / ${archiveState.total} 项` : "这个栏目还没有公开内容。";
  loadMore.hidden = !archiveState.nextCursor;
  loadMore.disabled = archiveState.loading;
}

async function loadArchivePage(reset = false) {
  if (archiveState.loading) return;
  archiveState.loading = true;
  loadMore.disabled = true;
  status.textContent = reset ? "正在读取首批缩略图…" : "正在加载更多缩略图…";
  try {
    const params = new URLSearchParams({ view: "gallery", limit: "24", category: archiveState.category });
    if (!reset && archiveState.nextCursor) params.set("cursor", archiveState.nextCursor);
    const payload = await api(`/api/database?${params}`);
    const pageItems = Array.isArray(payload.items) ? payload.items : [];
    archiveState.items = reset ? pageItems : [...archiveState.items, ...pageItems];
    archiveState.nextCursor = payload.nextCursor || null;
    archiveState.total = Number(payload.total) || archiveState.items.length;
    renderArchive(pageItems, !reset);
  } finally {
    archiveState.loading = false;
    loadMore.disabled = false;
  }
}

async function openArchiveItem(summary) {
  if (!summary) return;
  status.textContent = "正在按需读取原图与作品资料…";
  const item = await api(`/api/database?view=detail&id=${encodeURIComponent(summary.id)}`);
  status.textContent = `已显示 ${grid.children.length} / ${archiveState.total} 项`;
  if (item.media_type === "file") {
    const download = document.createElement("a");
    download.href = item.file_path;
    download.download = item.original_name || item.title || "";
    download.click();
    return;
  }
  if (item.project_id) {
    location.href = `/project.html?id=${item.project_id}`;
    return;
  }
  const tags = String(item.tags || "").split(/[,，]/).map((tag) => tag.trim()).filter(Boolean);
  const box = document.createElement("div");
  box.className = "database-lightbox";
  box.innerHTML = `
    <section class="database-lightbox-panel" role="dialog" aria-modal="true">
      <button class="database-lightbox-close" type="button" aria-label="关闭">×</button>
      <div class="database-lightbox-media">${mediaMarkup(item.file_path, item.media_type || "image", item.title, 1920)}</div>
      <div class="database-lightbox-copy">
        <p>${escapeHtml(item.category_name || "PERSONAL WORK LIBRARY")}</p>
        <h2>${escapeHtml(item.title || "未命名档案")}</h2>
        <span>${escapeHtml(item.description || "暂无描述。")}</span>
        <div class="database-lightbox-tags">${tags.map((tag) => `<i>${escapeHtml(tag)}</i>`).join("")}</div>
      </div>
    </section>`;
  box.addEventListener("click", (event) => {
    if (event.target === box || event.target.closest(".database-lightbox-close")) box.remove();
  });
  document.body.appendChild(box);
}

archiveFilters.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-category]");
  if (!button || archiveState.loading) return;
  archiveState.category = button.dataset.category;
  archiveState.nextCursor = null;
  archiveState.items = [];
  archiveFilters.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
  loadArchivePage(true).catch((error) => { status.textContent = error.message || "资料库加载失败"; });
});

loadMore.addEventListener("click", () => loadArchivePage(false).catch((error) => { status.textContent = error.message || "加载失败"; }));
grid.addEventListener("click", (event) => {
  const card = event.target.closest(".masonry-card");
  if (card) openArchiveItem(archiveState.items.find((item) => String(item.id) === card.dataset.id)).catch((error) => { status.textContent = error.message || "详情读取失败"; });
});
grid.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest(".masonry-card");
  if (card) openArchiveItem(archiveState.items.find((item) => String(item.id) === card.dataset.id)).catch((error) => { status.textContent = error.message || "详情读取失败"; });
});

setupNavigation();
loadArchivePage(true).catch((error) => {
  console.error("资料库加载失败：", error);
  status.textContent = error.message || "资料库加载失败";
});
