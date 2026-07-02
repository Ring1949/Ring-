const seriesState={projects:[],category:""};

function seriesCard(project,index){
  const cover=project.series_cover || project.cover_image;
  const type=project.series_media_type || "image";
  return `<a class="series-card" href="/project.html?id=${project.id}">
    <div class="series-image visual-${["a","b","c","d","e"][index%5]}">${mediaMarkup(cover,type,project.title)}</div>
    <div class="series-copy"><h2>${escapeHtml(project.title)}</h2>
      <p>${escapeHtml(project.subtitle || project.description || "持续更新中的系列作品。")}</p>
      <span>${escapeHtml(project.category_name || "SERIES")} · ${escapeHtml(project.year || "")}</span>
    </div>
  </a>`;
}

function renderSeries(){
  const visible=seriesState.category?seriesState.projects.filter((item)=>item.category_slug===seriesState.category):seriesState.projects;
  document.querySelector("#series-grid").innerHTML=visible.length?visible.map(seriesCard).join(""):`<div class="series-loading">这个分类还没有系列作品。</div>`;
}

async function initSeries(){
  const [projects,categories]=await Promise.all([api("/api/series"),api("/api/categories")]);
  seriesState.projects=projects;
  const slugs=new Set(projects.map((item)=>item.category_slug));
  document.querySelector("#series-filters").innerHTML+=categories.filter((item)=>slugs.has(item.slug)).map((item)=>`<button data-category="${escapeHtml(item.slug)}">${escapeHtml(item.name)}</button>`).join("");
  renderSeries();
}

document.querySelector("#series-filters").addEventListener("click",(event)=>{
  const button=event.target.closest("button[data-category]");
  if(!button)return;
  seriesState.category=button.dataset.category;
  document.querySelectorAll("#series-filters button").forEach((item)=>item.classList.toggle("active",item===button));
  renderSeries();
});
setupNavigation();
initSeries().catch((error)=>{document.querySelector("#series-grid").innerHTML=`<div class="series-loading">${escapeHtml(error.message)}</div>`;});
