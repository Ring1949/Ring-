const state = { settings:{}, categories:[], projects:[], media:[], tags:[] };
const viewNames = { settings:"\u9996\u9875\u8bbe\u7f6e",media:"\u4e0a\u4f20\u4f5c\u54c1",projects:"\u7cfb\u5217\u7ba1\u7406",categories:"\u4f5c\u54c1\u7ba1\u7406",inspiration:"\u7075\u611f\u9891\u9053",contact:"\u8054\u7cfb\u65b9\u5f0f" };

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
    const response = await fetch(url, { ...options, signal: options.signal || controller.signal });
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

async function uploadHeroBackgroundFile(file) {
  const signed = await request("/api/media/upload-sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size })
  });
  const body = file;
  let uploadResponse;
  try {
    uploadResponse = await fetch(signed.signed_url, {
      method: "PUT",
      headers: signed.upload_headers || {},
      body
    });
  } catch {
    throw new Error("主视觉文件上传失败：无法连接到 Supabase Storage，请检查网络后重试。");
  }
  if (!uploadResponse.ok) {
    const detail = await uploadResponse.text().catch(() => "");
    throw new Error(`Hero file upload failed: ${uploadResponse.status} ${detail}`.trim());
  }
  return request("/api/media/direct-record", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "首页全屏背景",
      is_hero: true,
      show_in_database: false,
      files: [signed]
    })
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

document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-view]").forEach((item) => item.classList.toggle("active",item===button));
  document.querySelectorAll("[data-panel]").forEach((panel) => panel.classList.toggle("active",panel.dataset.panel===button.dataset.view));
  document.querySelector("#view-title").textContent = viewNames[button.dataset.view];
}));
document.querySelectorAll("[data-jump-view]").forEach((button) => button.addEventListener("click", () => {
  document.querySelector(`[data-view="${button.dataset.jumpView}"]`)?.click();
}));

async function loadAll() {
  [state.settings,state.categories,state.projects,state.media,state.tags] = await Promise.all([
    request("/api/settings"),request("/api/categories"),request("/api/projects"),request("/api/media"),request("/api/tags")
  ]);
  renderSettings(); renderCategories(); renderProjects(); renderMedia(); renderTags(); populateSelects();
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
      await uploadHeroBackgroundFile(heroFile);
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
    <div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description)} · ${item.project_count} 个作品</p></div>
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
});

function openModal(content) {
  document.querySelector("#modal-content").innerHTML = content;
  document.querySelector("#modal").hidden = false;
}
function closeModal() { document.querySelector("#modal").hidden = true; }
document.querySelector(".modal-close").addEventListener("click",closeModal);
document.querySelector("#modal").addEventListener("click",(event)=>{if(event.target.id==="modal")closeModal();});

function openCategoryModal(item={}) {
  openModal(`<form id="category-form" class="modal-form" enctype="multipart/form-data"><h2>${item.id?"编辑":"新增"}分类</h2>
    <input type="hidden" name="id" value="${item.id||""}"><div class="field"><label>名称</label><input name="name" value="${escapeHtml(item.name||"")}" required></div>
    <div class="field"><label>Slug</label><input name="slug" value="${escapeHtml(item.slug||"")}"></div>
    <div class="field wide"><label>描述</label><textarea name="description">${escapeHtml(item.description||"")}</textarea></div>
    <div class="field"><label>排序</label><input name="sort_order" type="number" value="${item.sort_order||0}"></div>
    <div class="field"><label>封面</label><input name="cover" type="file" accept="image/*"></div><button class="primary wide">保存分类</button></form>`);
  document.querySelector("#category-form").addEventListener("submit",saveCategory);
}
async function saveCategory(event) {
  event.preventDefault(); const data=new FormData(event.target),id=data.get("id");data.delete("id");
  await request(id?`/api/categories/${id}`:"/api/categories",{method:id?"PUT":"POST",body:data});closeModal();await loadAll();notify("分类已保存");
}

function openProjectModal(item={}) {
  const selectedTags = Array.isArray(item.tags) ? item.tags.map((tag)=>tag.id) : [];
  openModal(`<form id="project-form" class="modal-form" enctype="multipart/form-data"><h2>${item.id?"编辑":"新增"}系列</h2><input type="hidden" name="id" value="${item.id||""}"><input type="hidden" name="is_series" value="1">
    <div class="field"><label>标题</label><input name="title" value="${escapeHtml(item.title||"")}" required></div><div class="field"><label>副标题</label><input name="subtitle" value="${escapeHtml(item.subtitle||"")}"></div>
    <div class="field"><label>分类</label><select name="category_id">${optionList(state.categories,item.category_id)}</select></div><div class="field"><label>Slug</label><input name="slug" value="${escapeHtml(item.slug||"")}"></div>
    <div class="field"><label>年份</label><input name="year" value="${escapeHtml(item.year||"")}"></div><div class="field"><label>地点</label><input name="location" value="${escapeHtml(item.location||"")}"></div>
    <div class="field wide"><label>描述</label><textarea name="description" rows="5">${escapeHtml(item.description||"")}</textarea></div>
    <div class="field wide"><label>文字标签（逗号分隔）</label><input name="tags" value="${escapeHtml(item.tags||"")}"></div>
    <div class="field"><label>系列封面（本地图片）</label><input name="cover" type="file" accept="image/*"></div><div class="field"><label>排序</label><input name="sort_order" type="number" value="${item.sort_order||0}"></div>
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
