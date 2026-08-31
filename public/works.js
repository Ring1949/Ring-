const categories = {
  all: ["作品集", "全部正式作品"],
  photo: ["摄影", "人物、现场、城市与观看方式"],
  graphic: ["平面", "Graphic design"],
  space: ["空间", "尺度、材质与空间秩序"],
  ai: ["AI", "Generative studies"],
  other: ["其他", "Other works"]
};

let filters = {
  all: [["全部", "all"], ["摄影", "photo"], ["平面", "graphic"], ["空间", "space"], ["AI", "ai"], ["其他", "other"]],
  photo: [["全部摄影", "all"], ["产品摄影", "product"], ["人物", "portrait"], ["校园活动", "campus"], ["纪实", "documentary"], ["展览与文化", "culture"], ["风光与建筑", "landscape"], ["创作", "creative"], ["戒指", "ring"], ["项链", "necklace"], ["手串手镯", "bracelet"], ["耳饰", "earring"], ["矿标", "mineral"], ["摆件", "ornament"], ["其他珠宝", "jewelry"]],
  graphic: [["全部平面", "all"], ["设计", "design"], ["手绘", "drawing"], ["海报", "poster"]],
  space: [["全部空间", "all"], ["室内", "interior"], ["建筑", "architecture"], ["3D建模", "threeD"]],
  ai: [["全部 AI", "all"], ["生成图像", "generated"], ["概念草图", "concept"], ["工作流", "workflow"]],
  other: [["全部其他", "all"], ["视频", "video"], ["手工", "craft"], ["日常", "daily"]]
};

const pageParams = new URLSearchParams(location.search);
const requested = pageParams.get("category");
const category = requested === "product" ? "photo" : categories[requested] ? requested : "all";
const requestedFilter = pageParams.get("filter");
const [title, description] = categories[category];
const pageSize = 24;
const items = new Map();
const details = new Map();
let activeFilter = "all";
let query = "";
let nextCursor = null;
let loading = false;
let hasMore = true;
let total = 0;
let requestSequence = 0;
let controller = null;
let searchTimer = null;

const grid = document.querySelector("#grid");
const empty = document.querySelector("#empty");
const dialog = document.querySelector("#detail");
const primaryFilters = document.querySelector(".primary-filters");
const loadStatus = document.createElement("div");
const sentinel = document.createElement("div");
loadStatus.className = "gallery-status";
loadStatus.setAttribute("aria-live", "polite");
sentinel.className = "gallery-sentinel";
sentinel.setAttribute("aria-hidden", "true");
grid.after(loadStatus, sentinel);

const esc = (value = "") => {
  const node = document.createElement("div");
  node.textContent = value;
  return node.innerHTML;
};
const listUrl = (item) => item.thumbnail_url || item.file_path || "";
const detailUrl = (item) => item.preview_url || item.file_path || item.thumbnail_url || "";
const isVideo = (item) => item.media_type === "video" || /\.(mp4|webm|mov)$/i.test(detailUrl(item));
const isFile = (item) => item.media_type === "file";

document.title = `${title}｜作品库｜山川行止`;
document.querySelector("#title").textContent = title;
document.querySelector("#description").textContent = description;
document.querySelectorAll("[data-category]").forEach((link) => link.classList.toggle("active", link.dataset.category === category));
if (requested === "product") history.replaceState(null, "", "/works.html?category=photo&filter=product");

function skeletons() {
  return Array.from({ length: 12 }, (_, index) => `<span class="item item-skeleton" aria-hidden="true" style="--skeleton-ratio:${index % 3 === 0 ? "4/5" : index % 3 === 1 ? "3/2" : "1/1"}"></span>`).join("");
}

function card(item, index) {
  const source = listUrl(item);
  const ratio = Number(item.aspect_ratio) > 0 ? Number(item.aspect_ratio) : 4 / 3;
  const width = Number(item.width) > 0 ? ` width="${Number(item.width)}"` : "";
  const height = Number(item.height) > 0 ? ` height="${Number(item.height)}"` : "";
  const priority = index < 4 ? "eager" : "lazy";
  const fetchPriority = index === 0 ? " fetchpriority=\"high\"" : "";
  const media = isVideo(item)
    ? `<video src="${esc(source)}" muted loop playsinline preload="metadata"></video>`
    : isFile(item)
      ? `<span class="file-tile"><b>↧</b><small>${esc(item.file_type || "FILE")}</small></span>`
      : `<img src="${esc(source)}" alt="${esc(item.title || title)}" loading="${priority}" decoding="async"${fetchPriority}${width}${height}>`;
  return `<button class="item" data-id="${esc(String(item.id))}" type="button"><span class="item-media" style="--media-ratio:${ratio}">${media}</span><span class="label"><strong>${esc(item.title || "未命名作品")}</strong><small>${esc(item.project_title || title)}</small></span></button>`;
}

function updateStatus() {
  const shown = items.size;
  if (loading && shown === 0) {
    loadStatus.textContent = "正在载入作品……";
  } else if (loading) {
    loadStatus.textContent = `已显示 ${shown} 件，正在载入更多……`;
  } else if (shown) {
    loadStatus.textContent = hasMore ? `已显示 ${shown} / ${total} 件，继续向下浏览` : `已显示全部 ${shown} 件作品`;
  } else {
    loadStatus.textContent = "";
  }
}

function showError(message) {
  empty.innerHTML = `${esc(message)} <button class="gallery-retry" type="button">重试</button>`;
  empty.hidden = false;
  empty.querySelector(".gallery-retry")?.addEventListener("click", () => loadPage({ reset: items.size === 0 }));
}

function appendItems(batch) {
  const fresh = batch.filter((item) => listUrl(item) && !items.has(String(item.id)));
  const start = items.size;
  fresh.forEach((item) => items.set(String(item.id), item));
  grid.insertAdjacentHTML("beforeend", fresh.map((item, index) => card(item, start + index)).join(""));
  empty.hidden = items.size > 0;
}

function renderPrimaryFilters() {
  const options = filters[category] || [["全部", "all"]];
  primaryFilters.innerHTML = options.map(([label, value]) => `<button class="${value === activeFilter ? "active" : ""}" type="button" data-filter="${value}">${label}</button>`).join("");
  primaryFilters.onclick = (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button || button.dataset.filter === activeFilter) return;
    activeFilter = button.dataset.filter;
    primaryFilters.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
    const nextUrl = new URL(location.href);
    nextUrl.searchParams.set("category", category);
    if (activeFilter === "all") nextUrl.searchParams.delete("filter");
    else nextUrl.searchParams.set("filter", activeFilter);
    history.replaceState(null, "", `${nextUrl.pathname}${nextUrl.search}`);
    loadPage({ reset: true });
  };
}

async function loadFilterConfig() {
  if (category === "all") return;
  try {
    const response = await fetch("/api/work-filters", { cache: "no-store" });
    if (!response.ok) return;
    const config = await response.json();
    ["photo", "graphic", "space", "ai", "other"].forEach((group) => {
      if (!Array.isArray(config[group])) return;
      const rows = config[group]
        .map((item) => [String(item?.label || "").trim(), String(item?.value || "").trim()])
        .filter(([label, value]) => label && value);
      if (rows.length) filters[group] = rows;
    });
  } catch {
    // The built-in taxonomy remains available if the remote setting is unavailable.
  }
}

async function initializeGallery() {
  await loadFilterConfig();
  activeFilter = requested === "product"
    ? "product"
    : (filters[category] || []).some(([, value]) => value === requestedFilter) ? requestedFilter : "all";
  renderPrimaryFilters();
  loadPage({ reset: true });
}

async function loadPage({ reset = false } = {}) {
  if (loading && !reset) return;
  if (!hasMore && !reset) return;
  if (reset) {
    controller?.abort();
    items.clear();
    nextCursor = null;
    hasMore = true;
    total = 0;
    grid.innerHTML = skeletons();
    empty.hidden = true;
  }

  const requestController = new AbortController();
  controller = requestController;
  const sequence = ++requestSequence;
  loading = true;
  updateStatus();
  try {
    const params = new URLSearchParams({ view: "gallery", limit: String(pageSize), filter: activeFilter });
    if (category !== "all") params.set("category", category);
    if (nextCursor) params.set("cursor", nextCursor);
    if (query) params.set("q", query);
    const response = await fetch(`/api/database?${params}`, { signal: requestController.signal });
    if (!response.ok) throw new Error(`作品载入失败 (${response.status})`);
    const payload = await response.json();
    if (sequence !== requestSequence) return;
    if (reset) grid.innerHTML = "";
    appendItems(Array.isArray(payload.items) ? payload.items : []);
    nextCursor = payload.nextCursor || null;
    hasMore = Boolean(payload.hasMore && nextCursor);
    total = Number(payload.total) || items.size;
    if (!items.size) {
      empty.textContent = query ? "没有找到符合条件的作品。" : "这个分类还没有作品。";
      empty.hidden = false;
    }
    loading = false;
    updateStatus();
  } catch (error) {
    if (error?.name === "AbortError") return;
    if (reset) grid.innerHTML = "";
    showError(error instanceof Error ? error.message : "作品暂时无法载入。");
  } finally {
    if (controller === requestController) {
      loading = false;
      updateStatus();
    }
  }
}

function renderDetail(item) {
  document.querySelector("#detail-media").innerHTML = isVideo(item)
    ? `<video src="${esc(detailUrl(item))}" controls autoplay loop playsinline></video>`
    : `<img src="${esc(detailUrl(item))}" alt="${esc(item.title || "作品预览")}">`;
  document.querySelector("#detail-category").textContent = `WORKS / ${item.project_title || title}`;
  document.querySelector("#detail-title").textContent = item.title || "未命名作品";
  document.querySelector("#detail-description").textContent = item.description || "暂无介绍";
  const rows = [
    ["系列", item.project_title], ["年份", item.project_year || item.year], ["地点", item.project_location || item.location],
    ["相机", item.camera], ["镜头", item.lens], ["光圈", item.aperture], ["快门", item.shutter_speed],
    ["ISO", item.iso], ["拍摄时间", item.captured_at], ["标签", item.tags]
  ].filter((row) => row[1]);
  document.querySelector("#detail-meta").innerHTML = rows.map((row) => `<dt>${row[0]}</dt><dd>${esc(String(row[1]))}</dd>`).join("");
}

async function openItem(id) {
  const summary = items.get(String(id));
  if (!summary) return;
  dialog.showModal();
  document.querySelector("#detail-media").innerHTML = '<span class="detail-loading" aria-label="正在载入作品"></span>';
  document.querySelector("#detail-category").textContent = "WORKS";
  document.querySelector("#detail-title").textContent = "正在打开作品……";
  document.querySelector("#detail-description").textContent = "";
  document.querySelector("#detail-meta").innerHTML = "";
  try {
    let item = details.get(String(id));
    if (!item) {
      const response = await fetch(`/api/database?view=detail&id=${encodeURIComponent(id)}`);
      if (!response.ok) throw new Error("作品详情暂时无法载入。");
      item = await response.json();
      details.set(String(id), item);
    }
    if (isFile(item)) {
      dialog.close();
      location.href = detailUrl(item);
      return;
    }
    renderDetail(item);
  } catch (error) {
    document.querySelector("#detail-title").textContent = "作品打开失败";
    document.querySelector("#detail-description").textContent = error instanceof Error ? error.message : "请稍后重试。";
  }
}

grid.onclick = (event) => {
  const button = event.target.closest(".item[data-id]");
  if (button) openItem(button.dataset.id);
};
document.querySelector("#search").oninput = (event) => {
  clearTimeout(searchTimer);
  query = event.target.value.trim();
  searchTimer = setTimeout(() => loadPage({ reset: true }), 280);
};
document.querySelector(".close").onclick = () => dialog.close();
dialog.onclick = (event) => { if (event.target === dialog) dialog.close(); };

const observer = new IntersectionObserver((entries) => {
  if (entries.some((entry) => entry.isIntersecting)) loadPage();
}, { rootMargin: "900px 0px" });
observer.observe(sentinel);

initializeGallery();
