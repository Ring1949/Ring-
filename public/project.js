const projectId = new URLSearchParams(location.search).get("id");

async function initProject() {
  if (!projectId) throw new Error("缺少项目 ID");
  const project = await api(`/api/projects/${projectId}`);
  document.title = `${project.title} — 山川行止`;
  document.body.classList.toggle("series-detail-page",Boolean(project.is_series));
  if (project.series_style) document.body.classList.add(`series-style-${project.series_style}`);
  const cover = project.cover_image || project.media.find((item) => item.is_cover)?.file_path;
  document.querySelector("#project-page").innerHTML = `
    <section class="detail-hero">
      <div class="detail-hero-media">${mediaMarkup(cover, "image", project.title)}</div>
      <div class="detail-title"><p>${escapeHtml(project.category_name || "PROJECT")}</p><h1>${escapeHtml(project.title)}</h1><h2>${escapeHtml(project.subtitle)}</h2>
        <div class="detail-meta"><span>${escapeHtml(project.year)}</span><span>${escapeHtml(project.location)}</span></div>
      </div>
    </section>
    <div class="detail-content">
      <section class="detail-intro"><div><p>${project.is_series ? "SERIES STORY" : "PROJECT STORY"}</p><h2>${escapeHtml(project.subtitle || project.title)}</h2><div class="tag-list">${project.tags.map((tag) => `<span>${escapeHtml(tag.name)}</span>`).join("")}</div></div><p>${escapeHtml(project.description)}</p></section>
      <section class="media-gallery ${project.is_series ? "series-media-gallery" : ""}">${project.media.length ? project.media.map((item) => item.media_type === "file"
        ? `<a class="gallery-item" href="${escapeHtml(item.file_path)}" download>${mediaMarkup(item.file_path,"file",item.title)}</a>`
        : `<button class="gallery-item" data-path="${escapeHtml(item.file_path)}" data-type="${item.media_type || "image"}" data-title="${escapeHtml(item.title)}">${mediaMarkup(item.file_path,item.media_type || "image",item.title)}</button>`).join("") : `<div class="empty-state">这个项目还没有上传详情内容。</div>`}</section>
      <section class="related"><h2>${project.is_series ? "其他系列" : "同分类项目"}</h2><div class="related-grid">${project.related.map(miniCard).join("")}</div></section>
      <div class="back-links"><a href="/">← 返回首页</a>${project.is_series ? `<a href="/series.html">返回系列作品</a>` : ""}${project.category ? `<a href="/category.html?id=${project.category.id}">返回${escapeHtml(project.category.name)}分类</a>` : ""}</div>
    </div>`;
  document.querySelectorAll(".gallery-item[data-path]").forEach((item) => item.addEventListener("click", () => openLightbox(item.dataset.path,item.dataset.type,item.dataset.title)));
}
function miniCard(project) {
  return `<a class="mini-card" href="/project.html?id=${project.id}"><div class="card-media visual-c">${mediaMarkup(project.cover_image,"image",project.title)}</div><h3>${escapeHtml(project.title)}</h3><p>${escapeHtml(project.subtitle)}</p></a>`;
}
setupNavigation();
initProject().catch((error) => document.querySelector("#project-page").innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`);
