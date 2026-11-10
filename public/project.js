const projectId = new URLSearchParams(location.search).get("id");

async function initProject() {
  if (!projectId) throw new Error("缺少项目 ID");
  const project = await api(`/api/projects/${projectId}`);
  document.title = `${project.title} — 山川行止`;
  document.body.classList.toggle("series-detail-page",Boolean(project.is_series));
  if (project.series_style) document.body.classList.add(`series-style-${project.series_style}`);
  if (project.is_series) {
    renderSeriesPresentation(project);
    return;
  }
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

function renderSeriesPresentation(project) {
  document.body.classList.add("series-presentation-page");
  const media = Array.isArray(project.media) ? [...project.media] : [];
  const slides = media
    .filter((item) => item?.file_path && (item.media_type === "image" || item.media_type === "video" || /\.(jpe?g|png|webp|gif|avif|mp4|webm|mov)(\?|$)/i.test(item.file_path)))
    .sort((a,b)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0));
  if (!slides.length && project.cover_image) slides.push({ file_path:project.cover_image, media_type:"image", title:project.title, sort_order:0 });
  const originalPpt = project.presentation_file || media.find((item)=>/\.(ppt|pptx)(\?|$)/i.test(item.file_path || ""))?.file_path || "";
  document.querySelector("#project-page").className = "presentation-page";
  document.querySelector("#project-page").innerHTML = `
    <header class="presentation-toolbar">
      <a class="presentation-back" href="/series.html" aria-label="返回系列作品">←</a>
      <div><strong>${escapeHtml(project.title)}</strong><span>${escapeHtml(project.subtitle || "PRESENTATION")}</span></div>
      <div class="presentation-actions"><span id="presentation-progress">01 / ${String(Math.max(slides.length,1)).padStart(2,"0")}</span>${originalPpt ? `<a href="${escapeHtml(originalPpt)}" download>下载 PPT</a>` : ""}</div>
    </header>
    <section class="presentation-deck" aria-label="${escapeHtml(project.title)}演示文稿">
      ${slides.length ? slides.map((item,index)=>`<article class="presentation-slide" data-slide="${index+1}">
        <div class="presentation-stage">${item.media_type === "video" ? `<video src="${escapeHtml(item.file_path)}" controls playsinline preload="metadata"></video>` : `<img src="${escapeHtml(item.file_path)}" alt="${escapeHtml(item.title || `${project.title} 第 ${index+1} 页`)}" loading="${index < 2 ? "eager" : "lazy"}" decoding="async">`}</div>
        <span>${String(index+1).padStart(2,"0")}</span>
      </article>`).join("") : `<div class="presentation-empty"><h1>${escapeHtml(project.title)}</h1><p>演示页面暂时无法载入。</p>${originalPpt ? `<a href="${escapeHtml(originalPpt)}" download>下载原始 PPT</a>` : ""}</div>`}
    </section>`;
  const slideNodes = [...document.querySelectorAll(".presentation-slide")];
  const progress = document.querySelector("#presentation-progress");
  const observer = new IntersectionObserver((entries)=>{
    const current = entries.filter((entry)=>entry.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
    if (!current) return;
    const index = Number(current.target.dataset.slide) || 1;
    progress.textContent = `${String(index).padStart(2,"0")} / ${String(Math.max(slideNodes.length,1)).padStart(2,"0")}`;
  },{threshold:[.55,.75]});
  slideNodes.forEach((slide)=>observer.observe(slide));
  document.addEventListener("keydown",(event)=>{
    if (!["ArrowDown","ArrowRight","PageDown","ArrowUp","ArrowLeft","PageUp","Home","End"].includes(event.key)) return;
    event.preventDefault();
    const current = Math.max(0,slideNodes.findIndex((slide)=>Math.abs(slide.getBoundingClientRect().top)<innerHeight*.45));
    const target = event.key === "Home" ? 0 : event.key === "End" ? slideNodes.length-1 : current + (["ArrowUp","ArrowLeft","PageUp"].includes(event.key) ? -1 : 1);
    slideNodes[Math.max(0,Math.min(slideNodes.length-1,target))]?.scrollIntoView({behavior:"smooth",block:"start"});
  });
}
function miniCard(project) {
  return `<a class="mini-card" href="/project.html?id=${project.id}"><div class="card-media visual-c">${mediaMarkup(project.cover_image,"image",project.title)}</div><h3>${escapeHtml(project.title)}</h3><p>${escapeHtml(project.subtitle)}</p></a>`;
}
setupNavigation();
initProject().catch((error) => document.querySelector("#project-page").innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`);
