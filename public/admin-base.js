const state = { settings:{}, categories:[], projects:[], media:[], tags:[], workFilters:{} };
const viewNames = { settings:"\u9996\u9875\u8bbe\u7f6e",media:"\u4f5c\u54c1\u5de5\u4f5c\u53f0",projects:"\u7cfb\u5217\u7ba1\u7406",categories:"\u5206\u7c7b\u4e0e\u6807\u7b7e",filters:"\u4f5c\u54c1\u5e93\u7b5b\u9009",contact:"\u8054\u7cfb\u65b9\u5f0f" };

const REQUEST_TIMEOUT_MS = 45000;
function readableRequestError(error, action = "操作") {
  const message = String(error?.message || error || "");
  if (error?.name === "AbortError") return `${action}超时，请检查网络后重试。`;
  if (/failed to fetch|networkerror|network request failed/i.test(message)) return `${action}失败：网络连接不可用，请检查网络后重试。`;
  return `${action}失败：${message || "服务器未返回可用信息，请稍后重试。"}`;
}
async function request(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { cache: "no-store", ...options, signal: options.signal || controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `服务器返回 ${response.status}`);
    return payload;
  } catch (error) {
    throw new Error(readableRequestError(error));
  } finally {
    clearTimeout(timeout);
  }
}
function notify(message, error = false) {
  const status = document.querySelector("#save-status");
  status.textContent = message;
  status.style.color = error ? "#c93345" : "#3d8c67";
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => status.textContent = "", 2500);
}
const formDataObject = (form) => Object.fromEntries(new FormData(form));
const optionList = (items, selected, empty = "未选择") => `<option value="">${empty}</option>${items.map((item) => `<option value="${item.id}" ${String(item.id)===String(selected)?"selected":""}>${escapeHtml(item.name || item.title)}</option>`).join("")}`;

function heroContentType(file) {
  if (file.type) return file.type;
  const extension = String(file.name || "").split(".").pop().toLowerCase();
  return ({ mp4:"video/mp4", m4v:"video/mp4", mov:"video/quicktime", webm:"video/webm" })[extension] || "application/octet-stream";
}

function uploadHeroObject(url, file, headers, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    Object.entries(headers || {}).forEach(([name, value]) => xhr.setRequestHeader(name, value));
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress?.(Math.round(event.loaded / event.total * 100));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`对象存储返回 ${xhr.status}${xhr.responseText ? `：${xhr.responseText}` : ""}`));
    });
    xhr.addEventListener("error", () => reject(new Error("无法连接到对象存储，请检查网络或 R2 CORS 设置。")));
    xhr.addEventListener("abort", () => reject(new Error("上传已取消。")));
    xhr.send(file);
  });
}

async function uploadHeroBackgroundFile(file, onProgress) {
  const contentType = heroContentType(file);
  const signed = await request("/api/r2/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "legacy-media", filename: file.name, contentType, size: file.size })
  });
  await uploadHeroObject(signed.upload_url || signed.signed_url, file, signed.upload_headers, onProgress);
  return request("/api/media/direct-record", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "首页全屏背景",
      is_hero: true,
      show_in_database: false,
      files: [{
        ...signed,
        filename: signed.object_key.split("/").pop(),
        storage_path: signed.object_key,
        public_url: signed.url,
        originalname: file.name,
        mimetype: contentType,
        size: file.size,
        storage_provider: "r2"
      }]
    })
  });
}

async function uploadCategoryCoverFile(file, categoryId, onProgress) {
  if (!file?.type?.startsWith("image/")) throw new Error("分类封面必须是图片文件。");
  if (file.size > 20 * 1024 * 1024) throw new Error("分类封面不能超过 20 MB。");
  const signed = await request("/api/r2/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "cover", filename: file.name, contentType: file.type, size: file.size })
  });
  await uploadHeroObject(signed.upload_url || signed.signed_url, file, signed.upload_headers, onProgress);
  return request("/api/portfolio-covers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: "category",
      target_id: String(categoryId),
      url: signed.url,
      pathname: signed.object_key,
      size: file.size,
      content_type: file.type,
      storage_provider: "r2"
    })
  });
}

async function useExistingCategoryCover(categoryId, url) {
  return request("/api/portfolio-covers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "category", target_id: String(categoryId), existing_url: url })
  });
}

async function bootstrap() {
  const me = await request("/api/me");
  if (!me.authenticated) {
    location.replace("/");
    return;
  }
  document.querySelector("#admin-app").hidden = false;
  await loadAll();
}
document.querySelector("#logout").addEventListener("click", async () => { await request("/api/logout",{method:"POST"}); location.reload(); });

function openAdminView(view, activeButton = null) {
  const panel=document.querySelector(`[data-panel="${view}"]`);
  if(!panel)return;
  document.querySelectorAll("[data-view]").forEach((item) => item.classList.toggle("active",item===activeButton || (!activeButton && item.dataset.view===view)));
  document.querySelectorAll("[data-panel]").forEach((item) => item.classList.toggle("active",item===panel));
  document.querySelector("#view-title").textContent = viewNames[view] || "内容管理";
  history.replaceState(null,"",`#${view}`);
}
document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => openAdminView(button.dataset.view,button)));
document.querySelectorAll("[data-jump-view]").forEach((button) => button.addEventListener("click", () => {
  openAdminView(button.dataset.jumpView);
}));

async function loadAll() {
  [state.settings,state.categories,state.projects,state.media,state.tags,state.workFilters] = await Promise.all([
    request("/api/settings"),request("/api/categories"),request("/api/projects"),request("/api/media"),request("/api/tags"),request("/api/work-filters")
  ]);
  renderSettings(); renderCategories(); renderProjects(); renderMedia(); renderTags(); renderWorkFilters(); populateSelects();
  const requested=location.hash.slice(1);if(requested)openAdminView(requested);
}

function renderSettings() {
  [document.querySelector("#settings-form"),document.querySelector("#contact-form")].forEach((form) => {
    Object.entries(state.settings).forEach(([key,value]) => { if (form?.elements[key]) form.elements[key].value = value; });
  });
}
const settingsForm = document.querySelector("#settings-form");
settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = document.querySelector("#settings-save-status");
  const submitButton = settingsForm.querySelector('button[type="submit"], button.primary');
  const setStatus = (message, kind) => {
    status.textContent = message;
    status.className = `media-upload-status wide ${kind}`;
  };
  try {
    submitButton.disabled = true;
    setStatus("\u6b63\u5728\u4fdd\u5b58\u9996\u9875\u8bbe\u7f6e\u2026", "working");
    const data = new FormData(settingsForm);
    const heroFile = data.get("hero_background_file");
    data.delete("hero_background_file");
    const savedSettings = await request("/api/settings", { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(Object.fromEntries(data)) });
    state.settings = { ...state.settings, ...savedSettings };
    if (heroFile?.size) {
      setStatus("\u9996\u9875\u6587\u6848\u5df2\u4fdd\u5b58\uff0c\u6b63\u5728\u4e0a\u4f20\u80cc\u666f\u6587\u4ef6\u2026", "working");
      await uploadHeroBackgroundFile(heroFile, (percentage) => {
        setStatus(`\u6b63\u5728\u4e0a\u4f20\u9996\u9875\u80cc\u666f\u2026 ${percentage}%`, "working");
      });
      settingsForm.hero_background_file.value = "";
      document.querySelector("#hero-file-name").textContent = "\u672a\u9009\u62e9\u65b0\u6587\u4ef6\u65f6\uff0c\u4fdd\u7559\u5f53\u524d\u80cc\u666f";
      document.querySelector("#hero-file-preview").innerHTML = "";
      setStatus("\u9996\u9875\u8bbe\u7f6e\u548c\u80cc\u666f\u5df2\u4fdd\u5b58\u3002", "success");
    } else {
      setStatus("\u9996\u9875\u8bbe\u7f6e\u5df2\u4fdd\u5b58\u3002", "success");
    }
    notify("\u9996\u9875\u8bbe\u7f6e\u5df2\u4fdd\u5b58");
  } catch (error) {
    const message = error?.message || "\u672a\u77e5\u9519\u8bef";
    setStatus(`\u4fdd\u5b58\u5931\u8d25\uff1a${message}`, "error");
    notify(message, true);
  } finally {
    submitButton.disabled = false;
  }
});if(false) document.querySelector("#contact-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    state.settings = { ...state.settings, ...await request("/api/settings",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(formDataObject(event.target))}) };
    renderSettings();
    notify("联系方式已保存");
  } catch (error) { notify(error.message,true); }
});

function renderCategories() {
  document.querySelector("#category-list").innerHTML = state.categories.map((item) => `
    <article class="admin-row"><div class="admin-thumb">${item.cover_image?`<img src="${item.cover_image}">`:""}</div>
    <div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description)} · ${Number(item.project_count || 0)} 个作品</p></div>
    <div class="row-actions"><button data-edit-category="${item.id}">编辑</button><button class="danger" data-delete-category="${item.id}">删除</button></div></article>`).join("");
}
function renderProjects() {
  const filter = document.querySelector("#project-filter").value;
  const seriesProjects = state.projects.filter((item) => Number(item.is_series) === 1);
  const items = filter ? seriesProjects.filter((item) => item.status===filter) : seriesProjects;
  document.querySelector("#project-list").innerHTML = items.map((item) => `
    <article class="admin-row"><div class="admin-thumb">${item.cover_image?`<img src="${item.cover_image}">`:""}</div>
    <div><h3>${escapeHtml(item.title)} <span class="status ${item.status}">${item.status==="published"?"已发布":"草稿"}</span></h3>
    <p>${escapeHtml(item.category_name||"未分类")} · ${escapeHtml(item.year)} ${item.is_featured?"· 首页精选":""} ${item.is_recommended?"· 推荐":""}</p></div>
    <div class="row-actions"><button data-edit-project="${item.id}">编辑</button><a href="/project.html?id=${item.id}" target="_blank"><button>查看</button></a><button class="danger" data-delete-project="${item.id}">删除</button></div></article>`).join("");
}
document.querySelector("#project-filter").addEventListener("change",renderProjects);

function renderMedia() {
  document.querySelector("#media-count").textContent = `${state.media.length} 项内容`;
  document.querySelector("#media-list").innerHTML = state.media.map((item) => `
    <article class="media-admin-card"><div>${item.media_type==="video"?`<video src="${item.file_path}" muted controls></video>`:item.media_type==="file"?`<a class="admin-file-card" href="${item.file_path}" download>↧<span>${escapeHtml(item.file_type || "FILE").toUpperCase()}</span></a>`:`<img src="${item.file_path}">`}</div>
    <h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.project_title||item.category_name||"未归类")} ${item.is_hero?"· 首页背景":""} ${item.is_selected?"· 精选":""} ${item.show_in_database?"· 作品库":""}</p>
    <div class="row-actions"><button data-edit-media="${item.id}">编辑</button><button class="danger" data-delete-media="${item.id}">删除</button></div></article>`).join("");
}
function renderTags() {
  document.querySelector("#tag-list").innerHTML = state.tags.map((tag) => `<span class="tag-pill">${escapeHtml(tag.name)} <button data-delete-tag="${tag.id}">×</button></span>`).join("");
}

const workFilterGroupNames = { photo:"摄影", graphic:"平面", space:"空间", ai:"AI", other:"其他" };
function renderWorkFilters() {
  const list = document.querySelector("#work-filter-list");
  const group = document.querySelector("#work-filter-group")?.value || "photo";
  if (!list) return;
  const rows = Array.isArray(state.workFilters[group]) ? state.workFilters[group] : [];
  list.innerHTML = rows.map((item, index) => item.value === "all" ? `
    <article class="filter-admin-row filter-admin-fixed">
      <span class="filter-order">${String(index + 1).padStart(2,"0")}</span>
      <div><b>${escapeHtml(item.label)}</b><small>固定入口 · 显示 ${workFilterGroupNames[group]}全部作品</small></div>
      <span class="filter-fixed-label">不可删除</span>
    </article>` : `
    <article class="filter-admin-row" data-work-filter-row data-filter-value="${escapeHtml(item.value)}">
      <span class="filter-order">${String(index + 1).padStart(2,"0")}</span>
      <label><span>显示名称</span><input name="filter_label" value="${escapeHtml(item.label)}" maxlength="30"></label>
      <label><span>匹配关键词</span><input name="filter_value" value="${escapeHtml(item.value)}" maxlength="60"></label>
      <div class="row-actions"><button type="button" data-save-work-filter>保存</button><button class="danger" type="button" data-delete-work-filter>删除</button></div>
    </article>`).join("");
}

async function persistWorkFilters(message) {
  state.workFilters = await request("/api/work-filters", {
    method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(state.workFilters)
  });
  renderWorkFilters();
  notify(message);
}

document.querySelector("#work-filter-group")?.addEventListener("change", renderWorkFilters);
document.querySelector("#work-filter-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const group = document.querySelector("#work-filter-group").value;
  const data = new FormData(event.target);
  const label = String(data.get("label") || "").trim();
  const value = String(data.get("value") || label).trim();
  const rows = state.workFilters[group] || [];
  if (!label) return notify("请输入分类名称", true);
  if (rows.some((item) => item.value === value)) return notify("匹配关键词已存在，请换一个。", true);
  rows.push({ label, value });
  state.workFilters[group] = rows;
  try { await persistWorkFilters("筛选分类已新增"); event.target.reset(); }
  catch (error) { notify(error.message, true); }
});
function populateSelects() {
  document.querySelector("#media-project").innerHTML = optionList(state.projects,null,"不归属具体作品");
  document.querySelector("#media-category").innerHTML = optionList(state.categories,null,"不归属分类");
  document.querySelector("#media-tag-options").innerHTML = state.tags.map((tag) =>
    `<label class="system-tag-option"><input name="tag_ids" value="${tag.id}" type="checkbox"><span>${escapeHtml(tag.name)}</span></label>`
  ).join("");
}

document.querySelector("[data-new=category]").addEventListener("click",()=>openCategoryModal());
document.querySelector("[data-new=project]").addEventListener("click",()=>openProjectModal());
document.addEventListener("click", async (event) => {
  const target = event.target;
  if (target.dataset.editCategory) openCategoryModal(state.categories.find((item)=>String(item.id)===target.dataset.editCategory));
  if (target.dataset.editProject) openProjectModal(state.projects.find((item)=>String(item.id)===target.dataset.editProject));
  if (target.dataset.editMedia) openMediaModal(state.media.find((item)=>String(item.id)===target.dataset.editMedia));
  if (target.dataset.deleteCategory) await removeItem("categories",target.dataset.deleteCategory,"作品分类");
  if (target.dataset.deleteProject) await removeItem("projects",target.dataset.deleteProject,"系列");
  if (target.dataset.deleteMedia) await removeItem("media",target.dataset.deleteMedia,"作品素材");
  if (target.dataset.deleteTag) await removeItem("tags",target.dataset.deleteTag,"标签");
  if (target.hasAttribute("data-save-work-filter")) {
    const row = target.closest("[data-work-filter-row]");
    const group = document.querySelector("#work-filter-group").value;
    const previousValue = row.dataset.filterValue;
    const label = row.querySelector('[name="filter_label"]').value.trim();
    const value = row.querySelector('[name="filter_value"]').value.trim() || label;
    if (!label) return notify("分类名称不能为空", true);
    if ((state.workFilters[group] || []).some((item) => item.value === value && item.value !== previousValue)) return notify("匹配关键词已存在，请换一个。", true);
    const item = (state.workFilters[group] || []).find((entry) => entry.value === previousValue);
    if (item) { item.label = label; item.value = value; }
    try { await persistWorkFilters("筛选分类已保存"); }
    catch (error) { notify(error.message, true); }
  }
  if (target.hasAttribute("data-delete-work-filter")) {
    const row = target.closest("[data-work-filter-row]");
    const group = document.querySelector("#work-filter-group").value;
    const value = row.dataset.filterValue;
    const item = (state.workFilters[group] || []).find((entry) => entry.value === value);
    if (!confirm(`确定删除筛选分类「${item?.label || value}」吗？作品本身不会被删除。`)) return;
    state.workFilters[group] = (state.workFilters[group] || []).filter((entry) => entry.value !== value);
    try { await persistWorkFilters("筛选分类已删除，作品内容保持不变"); }
    catch (error) { notify(error.message, true); }
  }
});

function openModal(content) {
  document.querySelector("#modal-content").innerHTML = content;
  document.querySelector("#modal").hidden = false;
}
function closeModal() { document.querySelector("#modal").hidden = true; }
document.querySelector(".modal-close").addEventListener("click",closeModal);
document.querySelector("#modal").addEventListener("click",(event)=>{if(event.target.id==="modal")closeModal();});

async function removeItem(resource, id, label) {
  const item = resource === "projects"
    ? state.projects.find((entry) => String(entry.id) === String(id))
    : resource === "categories"
      ? state.categories.find((entry) => String(entry.id) === String(id))
      : resource === "media"
        ? state.media.find((entry) => String(entry.id) === String(id))
        : state.tags.find((entry) => String(entry.id) === String(id));
  const itemName = item?.title || item?.name || label;
  const confirmMessage = resource === "categories"
    ? `确定删除${label}「${itemName}」吗？该分类下的作品和素材会保留，并转入未分类。`
    : resource === "tags"
      ? `确定删除${label}「${itemName}」吗？作品和素材本身不会被删除。`
      : `确定删除${label}「${itemName}」吗？此操作无法撤销。`;
  if (!confirm(confirmMessage)) return;

  const button = document.querySelector(`[data-delete-${resource === "projects" ? "project" : resource === "categories" ? "category" : resource === "media" ? "media" : "tag"}="${CSS.escape(String(id))}"]`);
  if (button) {
    button.disabled = true;
    button.textContent = "删除中…";
  }
  notify(`正在删除${label}…`);

  try {
    await request(`/api/${resource}/${encodeURIComponent(id)}`, { method: "DELETE" });
    await loadAll();
    notify(`${label}已删除`);
  } catch (error) {
    if (button) {
      button.disabled = false;
      button.textContent = "删除";
    }
    notify(error?.message || `删除${label}失败，请稍后重试。`, true);
  }
}

function openCategoryModal(item={}) {
  const coverAssets = state.media.filter((media) => media.file_path && (media.media_type === "image" || String(media.mime_type || "").startsWith("image/") || /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(media.file_path)));
  openModal(`<form id="category-form" class="modal-form" enctype="multipart/form-data"><h2>${item.id?"编辑":"新增"}分类</h2>
    <input type="hidden" name="id" value="${item.id||""}"><div class="field"><label>名称</label><input name="name" value="${escapeHtml(item.name||"")}" required></div>
    <div class="field"><label>Slug</label><input name="slug" value="${escapeHtml(item.slug||"")}"></div>
    <div class="field wide"><label>描述</label><textarea name="description">${escapeHtml(item.description||"")}</textarea></div>
    <div class="field"><label>排序</label><input name="sort_order" type="number" value="${item.sort_order||0}"></div>
    <div class="field category-cover-field"><label>分类封面</label><div class="category-cover-preview">${item.cover_image?`<img src="${escapeHtml(item.cover_image)}" alt="当前分类封面">`:`<span>暂无封面</span>`}</div></div>
    <div class="field category-cover-controls"><label>直接更换，不跳转页面</label><select name="existing_cover"><option value="">保留当前封面</option>${coverAssets.map((media)=>`<option value="${escapeHtml(media.file_path)}">使用素材 · ${escapeHtml(media.title||media.original_name||"未命名图片")}</option>`).join("")}</select><label class="category-cover-file"><input name="cover_file" type="file" accept="image/*"><span>或选择本地图片</span></label><small class="category-cover-status">选择后与分类资料一起保存</small></div>
    <button class="primary wide">保存分类与封面</button></form>`);
  document.querySelector("#category-form").addEventListener("submit",saveCategory);
}
async function saveCategory(event) {
  event.preventDefault();
  const form=event.target, data=new FormData(form), id=data.get("id"), coverFile=data.get("cover_file"), existingCover=String(data.get("existing_cover")||"");
  data.delete("id");data.delete("cover_file");data.delete("existing_cover");
  const submit=form.querySelector("button[type=submit],button.primary"), status=form.querySelector(".category-cover-status");
  submit.disabled=true;
  try {
    const hasNewCover=Boolean(coverFile?.size||existingCover);
    status.textContent=hasNewCover?"正在准备分类封面…":"正在保存分类资料…";
    const saved=await request(id?`/api/categories/${id}`:"/api/categories",{method:id?"PUT":"POST",body:data});
    const categoryId=saved.id||id;
    if(coverFile?.size){
      status.textContent="正在上传分类封面…";
      await uploadCategoryCoverFile(coverFile,categoryId,(percentage)=>status.textContent=`正在上传分类封面 ${percentage}%`);
    }else if(existingCover){
      status.textContent="正在设置分类封面…";
      await useExistingCategoryCover(categoryId,existingCover);
    }
    status.textContent="保存完成";
    closeModal();await loadAll();notify(hasNewCover?"分类封面已更新":"分类已保存");
  }catch(error){status.textContent=error.message||"保存失败";notify(error.message||"分类保存失败",true);}
  finally{submit.disabled=false;}
}

function openProjectModal(item={}) {
  const selectedTags = Array.isArray(item.tags) ? item.tags.map((tag)=>tag.id) : [];
  openModal(`<form id="project-form" class="modal-form" enctype="multipart/form-data"><h2>${item.id?"编辑":"新增"}系列</h2><input type="hidden" name="id" value="${item.id||""}"><input type="hidden" name="is_series" value="1">
    <div class="field"><label>标题</label><input name="title" value="${escapeHtml(item.title||"")}" required></div><div class="field"><label>副标题</label><input name="subtitle" value="${escapeHtml(item.subtitle||"")}"></div>
    <div class="field"><label>分类</label><select name="category_id">${optionList(state.categories,item.category_id)}</select></div><div class="field"><label>Slug</label><input name="slug" value="${escapeHtml(item.slug||"")}"></div>
    <div class="field"><label>年份</label><input name="year" value="${escapeHtml(item.year||"")}"></div><div class="field"><label>地点</label><input name="location" value="${escapeHtml(item.location||"")}"></div>
    <div class="field wide"><label>描述</label><textarea name="description" rows="5">${escapeHtml(item.description||"")}</textarea></div>
    <div class="field wide"><label>文字标签（逗号分隔）</label><input name="tags" value="${escapeHtml(item.tags||"")}"></div>
    <div class="field"><label>系列封面</label><a class="admin-cover-link" href="/admin/uploads?tab=covers&target=project:${item.id||""}#cover-manager">选择或更换封面 →</a></div><div class="field"><label>排序</label><input name="sort_order" type="number" value="${item.sort_order||0}"></div>
    <div class="field"><label>状态</label><select name="status"><option value="draft" ${item.status==="draft"?"selected":""}>草稿</option><option value="published" ${item.status==="published"?"selected":""}>已发布</option></select></div>
    <div class="checks"><label><input name="is_featured" type="checkbox" ${item.is_featured?"checked":""}> 首页精选</label><label><input name="is_recommended" type="checkbox" ${item.is_recommended?"checked":""}> 推荐内容</label></div>
    <div class="field wide"><label>标签</label><div class="checks project-edit-tags">${state.tags.map((tag)=>`<label class="system-tag-option"><input name="tag_ids" value="${tag.id}" type="checkbox" ${selectedTags.includes(tag.id)?"checked":""}><span>${escapeHtml(tag.name)}</span></label>`).join("")}</div></div>
    <button class="primary wide">保存系列</button></form>`);
  if(item.id) request(`/api/projects/${item.id}`).then((full)=>{full.tags.forEach((tag)=>{const box=document.querySelector(`#project-form input[name=tag_ids][value="${tag.id}"]`);if(box)box.checked=true;});});
  document.querySelector("#project-form").addEventListener("submit",saveProject);
}
async function saveProject(event) {
  event.preventDefault();const data=new FormData(event.target),id=data.get("id"),tagIds=data.getAll("tag_ids");data.delete("id");data.delete("tag_ids");data.set("tag_ids",JSON.stringify(tagIds));
  await request(id?`/api/projects/${id}`:"/api/projects",{method:id?"PUT":"POST",body:data});closeModal();await loadAll();notify("系列已保存");
}

document.querySelector("#contact-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = document.querySelector("#contact-save-status");
  try {
    if (status) { status.textContent = "\u6b63\u5728\u4fdd\u5b58\u8054\u7cfb\u4fe1\u606f\u2026"; status.className = "media-upload-status wide working"; }
    state.settings = { ...state.settings, ...await request("/api/settings", { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(formDataObject(event.target)) }) };
    renderSettings();
    if (status) { status.textContent = "\u8054\u7cfb\u4fe1\u606f\u5df2\u4fdd\u5b58\u5e76\u4f1a\u540c\u6b65\u5230\u7f51\u7ad9\u3002"; status.className = "media-upload-status wide success"; }
    notify("\u8054\u7cfb\u65b9\u5f0f\u5df2\u4fdd\u5b58");
  } catch (error) {
    if (status) { status.textContent = "\u4fdd\u5b58\u5931\u8d25\uff1a" + error.message; status.className = "media-upload-status wide error"; }
    notify(error.message, true);
  }
});
