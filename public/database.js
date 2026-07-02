const archiveState = {
  items: [],
  category: "all",
  categoryNames: {
    photo: "摄影", food: "美食", "three-d": "3D",
    video: "视频", graphic: "平面设计", ai: "AI作品"
  }
};

archiveState.categoryNames = {
  photo: "摄影",
  graphic: "平面",
  space: "空间",
  ai: "AI",
  other: "其他"
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

function normalizeArchiveItem(item) {
  return {
    ...item,
    tagsList: String(item.tags || "").split(/[,，]/).map((tag) => tag.trim()).filter(Boolean)
  };
}

function archiveCard(item) {
  return `
    <article class="masonry-card" tabindex="0" data-id="${item.id}">
      <div class="masonry-media">${mediaMarkup(item.file_path, item.media_type || "image", item.title)}</div>
      <div class="masonry-copy">
        <h2>${escapeHtml(item.title || "未命名档案")}</h2>
        <p>${escapeHtml(item.description || "一条持续补充中的视觉记录。")}</p>
        <div class="masonry-meta">
          <span class="category">${escapeHtml(item.category_name || archiveState.categoryNames[item.category_slug] || "未分类")}</span>
          ${item.tagsList.slice(0, 3).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
        </div>
      </div>
    </article>`;
}

function renderArchive() {
  const visible = archiveState.category === "all"
    ? archiveState.items
    : archiveState.items.filter((item) => item.category_slug === archiveState.category);
  const grid = document.querySelector("#masonry-grid");
  const status = document.querySelector("#database-status");
  grid.innerHTML = visible.map(archiveCard).join("");
  status.textContent = visible.length ? "" : "这个栏目还没有公开内容。";
}

function openArchiveItem(item) {
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
  const box = document.createElement("div");
  box.className = "database-lightbox";
  box.innerHTML = `
    <section class="database-lightbox-panel" role="dialog" aria-modal="true">
      <button class="database-lightbox-close" type="button" aria-label="关闭">×</button>
      <div class="database-lightbox-media">${mediaMarkup(item.file_path, item.media_type || "image", item.title)}</div>
      <div class="database-lightbox-copy">
        <p>${escapeHtml(item.category_name || "PERSONAL WORK LIBRARY")}</p>
        <h2>${escapeHtml(item.title || "未命名档案")}</h2>
        <span>${escapeHtml(item.description || "暂无描述。")}</span>
        <div class="database-lightbox-tags">${item.tagsList.map((tag) => `<i>${escapeHtml(tag)}</i>`).join("")}</div>
      </div>
    </section>`;
  box.addEventListener("click", (event) => {
    if (event.target === box || event.target.closest(".database-lightbox-close")) box.remove();
  });
  document.body.appendChild(box);
}

async function initArchive() {
  archiveState.items = (await api("/api/database"))
    .filter((item) => Object.hasOwn(archiveState.categoryNames, item.category_slug))
    .map(normalizeArchiveItem);
  renderArchive();
}

document.querySelector("#database-filters").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-category]");
  if (!button) return;
  archiveState.category = button.dataset.category;
  document.querySelectorAll("#database-filters button").forEach((item) => item.classList.toggle("active", item === button));
  renderArchive();
});

document.querySelector("#masonry-grid").addEventListener("click", (event) => {
  const card = event.target.closest(".masonry-card");
  if (card) openArchiveItem(archiveState.items.find((item) => String(item.id) === card.dataset.id));
});
document.querySelector("#masonry-grid").addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest(".masonry-card");
  if (card) openArchiveItem(archiveState.items.find((item) => String(item.id) === card.dataset.id));
});
setupNavigation();
initArchive().catch((error) => {
  console.error("资料库加载失败：", error);
  document.querySelector("#database-status").textContent = error.message || "资料库加载失败";
});
