const categoryId = new URLSearchParams(location.search).get("id");
const albumState = { category:null, items:[], tags:[], query:"", tag:"" };
const albumEnglishNames = {
  photo:"Photography album", food:"Food archive", "three-d":"3D works",
  video:"Motion works", graphic:"Graphic design", ai:"AI works"
};

const splitTags = (value) => String(value || "").split(/[,，]/).map((tag) => tag.trim()).filter(Boolean);

function albumTile(item) {
  if (item.media_type === "file") {
    return `<a class="album-tile album-file" href="${escapeHtml(item.file_path)}" download>
      ${mediaMarkup(item.file_path,"file",item.title)}
      <span>${escapeHtml(item.title)}</span>
    </a>`;
  }
  const content = item.media_type === "video"
    ? `<video src="${escapeHtml(item.file_path)}" muted loop playsinline preload="metadata"></video><i>▶</i>`
    : `<img src="${escapeHtml(item.file_path)}" alt="${escapeHtml(item.title)}" loading="lazy">`;
  return `<button class="album-tile" type="button" data-media-id="${item.id}" aria-label="查看 ${escapeHtml(item.title || "作品")}">${content}</button>`;
}

function renderAlbum() {
  const normalizedQuery = albumState.query.trim().toLowerCase();
  const visible = albumState.items.filter((item) => {
    const text = [item.title,item.description,item.tags,item.project_title,item.category_name].join(" ").toLowerCase();
    const matchesQuery = !normalizedQuery || text.includes(normalizedQuery);
    const matchesTag = !albumState.tag || splitTags(item.tags).includes(albumState.tag);
    return matchesQuery && matchesTag;
  });
  document.querySelector("#album-grid").innerHTML = visible.length
    ? visible.map(albumTile).join("")
    : `<div class="album-empty">没有找到匹配的作品。</div>`;
  document.querySelector("#album-count").textContent = `${visible.length} / ${albumState.items.length}`;
}

function detailRows(item) {
  const rows = [
    ["拍摄时间",item.captured_at || item.project_year],
    ["地点",item.project_location],
    ["相机",item.camera],
    ["镜头",item.lens],
    ["光圈",item.aperture],
    ["快门",item.shutter_speed],
    ["ISO",item.iso],
    ["文件",item.original_name],
    ["格式",item.file_type?.toUpperCase()]
  ].filter(([,value]) => value);
  return rows.map(([label,value]) => `<div><span>${label}</span><b>${escapeHtml(value)}</b></div>`).join("");
}

function openAlbumDetail(item) {
  const tags = splitTags(item.tags);
  const overlay = document.createElement("div");
  overlay.className = "album-detail-overlay";
  overlay.innerHTML = `
    <section class="album-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="album-detail-title">
      <button class="album-detail-close" type="button" aria-label="关闭">×</button>
      <div class="album-detail-media">${mediaMarkup(item.file_path,item.media_type || "image",item.title)}</div>
      <aside class="album-detail-copy">
        <p>${escapeHtml(item.category_name || "VISUAL ARCHIVE")}</p>
        <h2 id="album-detail-title">${escapeHtml(item.title || "未命名作品")}</h2>
        ${item.project_title ? `<a href="/project.html?id=${item.project_id}">${escapeHtml(item.project_title)} ↗</a>` : ""}
        <div class="album-detail-description">${escapeHtml(item.description || "暂无介绍。")}</div>
        ${tags.length ? `<div class="album-detail-tags">${tags.map((tag)=>`<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
        <div class="album-detail-info">${detailRows(item)}</div>
      </aside>
    </section>`;
  const close = () => overlay.remove();
  overlay.addEventListener("click",(event)=>{
    if(event.target===overlay || event.target.closest(".album-detail-close")) close();
  });
  document.addEventListener("keydown",function escapeClose(event){
    if(event.key==="Escape"){close();document.removeEventListener("keydown",escapeClose);}
  });
  document.body.appendChild(overlay);
}

async function initCategory() {
  const [categories, media, tags] = await Promise.all([
    api("/api/categories"),
    api(categoryId ? `/api/media?category_id=${categoryId}` : "/api/media"),
    api("/api/tags")
  ]);
  albumState.category = categories.find((item) => String(item.id) === String(categoryId))
    || { name:"全部作品",description:"持续整理中的个人视觉档案。" };
  albumState.items = media.filter((item) => !item.is_hero || item.show_in_database);
  albumState.tags = [...new Set([
    ...tags.map((tag)=>tag.name),
    ...albumState.items.flatMap((item)=>splitTags(item.tags))
  ])];

  document.title = `${albumState.category.name} — 山川止行`;
  document.querySelector("#category-page").innerHTML = `
    <header class="album-heading">
      <div><h1>${escapeHtml(albumState.category.name)}集</h1><p>${escapeHtml(albumEnglishNames[albumState.category.slug] || "Creative works")}</p></div>
    </header>
    <section class="album-tools">
      <label class="album-search"><span>⌕</span><input id="album-search" type="search" placeholder="搜索标题、介绍或标签"></label>
      <div class="album-tags"><button class="active" data-album-tag="">全部</button>${albumState.tags.map((tag)=>`<button data-album-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join("")}</div>
      <span id="album-count"></span>
    </section>
    <section id="album-grid" class="album-grid"></section>`;

  document.querySelector("#album-search").addEventListener("input",(event)=>{
    albumState.query=event.target.value;
    renderAlbum();
  });
  document.querySelector(".album-tags").addEventListener("click",(event)=>{
    const button=event.target.closest("button[data-album-tag]");
    if(!button)return;
    albumState.tag=button.dataset.albumTag;
    document.querySelectorAll("[data-album-tag]").forEach((item)=>item.classList.toggle("active",item===button));
    renderAlbum();
  });
  document.querySelector("#album-grid").addEventListener("click",(event)=>{
    const tile=event.target.closest("[data-media-id]");
    if(!tile)return;
    const item=albumState.items.find((mediaItem)=>String(mediaItem.id)===tile.dataset.mediaId);
    if(item)openAlbumDetail(item);
  });
  renderAlbum();
}

setupNavigation();
initCategory().catch((error)=>{
  console.error("作品集加载失败：",error);
  document.querySelector("#category-page").innerHTML=`<div class="empty-state">${escapeHtml(error.message)}</div>`;
});
