const mediaInput=document.querySelector("#media-files");
const mediaDropZone=document.querySelector("#media-drop-zone");
const mediaSummary=document.querySelector("#media-file-summary");
const mediaStatus=document.querySelector("#media-upload-status");
const mediaUploadButton=document.querySelector("#media-upload-button");
const heroBackgroundInput=document.querySelector("#hero-background-file");

heroBackgroundInput.addEventListener("change",(event)=>{
  const file=event.target.files[0];
  const preview=document.querySelector("#hero-file-preview");
  document.querySelector("#hero-file-name").textContent=file?`${file.name} · ${(file.size/1024/1024).toFixed(2)} MB`:"未选择新文件时，保留当前背景";
  preview.innerHTML="";
  if(!file)return;
  const element=document.createElement(file.type.startsWith("video/")?"video":"img");
  element.src=URL.createObjectURL(file);
  if(element.tagName==="VIDEO"){element.muted=true;element.autoplay=true;element.loop=true;element.playsInline=true;}
  preview.appendChild(element);
});
function renderSelectedFiles(files){
  const preview=document.querySelector("#upload-preview");preview.innerHTML="";
  const selected=[...files];
  const total=selected.reduce((sum,file)=>sum+file.size,0);
  mediaSummary.textContent=selected.length?`已选择 ${selected.length} 个文件 · ${(total/1024/1024).toFixed(2)} MB`:"尚未选择文件";
  mediaDropZone.classList.toggle("has-files",selected.length>0);
  selected.forEach((file)=>{
    const url=URL.createObjectURL(file);
    if(file.type.startsWith("image/")||file.type.startsWith("video/")){
      const element=document.createElement(file.type.startsWith("video/")?"video":"img");
      element.src=url;element.title=file.name;if(element.tagName==="VIDEO"){element.muted=true;element.controls=true;}preview.appendChild(element);
    }else{
      const element=document.createElement("div");element.className="upload-file-preview";
      element.innerHTML=`<b>↧</b><span>${escapeHtml(file.name)}</span>`;preview.appendChild(element);
    }
  });
}

mediaInput.addEventListener("change",(event)=>renderSelectedFiles(event.target.files));
["dragenter","dragover"].forEach((name)=>mediaDropZone.addEventListener(name,(event)=>{
  event.preventDefault();mediaDropZone.classList.add("dragging");
}));
["dragleave","drop"].forEach((name)=>mediaDropZone.addEventListener(name,(event)=>{
  event.preventDefault();mediaDropZone.classList.remove("dragging");
}));

function shouldUseDirectUpload(files){return files.length>0;}
function mediaFormPayload(form, tagIds){
  const data=new FormData(form);
  data.delete("files");
  data.delete("tag_ids");
  const payload=Object.fromEntries(data.entries());
  payload.tag_ids=JSON.stringify(tagIds);
  return payload;
}
const MAX_PARALLEL_UPLOADS = 3;
async function imageDimensions(file){
  if(!file.type.startsWith("image/"))return {width:0,height:0};
  try{const bitmap=await createImageBitmap(file);const dimensions={width:bitmap.width,height:bitmap.height};bitmap.close();return dimensions;}catch{return {width:0,height:0};}
}
async function uploadFile(file){
  const signed=await request("/api/r2/upload-url",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind:"legacy-media",filename:file.name,contentType:file.type,size:file.size})});
  let response;try{response=await fetch(signed.signed_url,{method:"PUT",headers:signed.upload_headers||{},body:file});}catch{throw new Error("素材上传失败：无法连接到对象存储，请检查 R2 CORS 与网络后重试。");}
  if(!response.ok){const detail=await response.text().catch(()=>"");throw new Error(`Storage upload failed (${response.status}): ${detail || "please check the file and try again"}`);}
  return {...signed,filename:signed.object_key.split("/").pop(),storage_path:signed.object_key,public_url:signed.url,originalname:file.name,mimetype:file.type||signed.content_type,size:file.size,storage_provider:"r2",...await imageDimensions(file)};
}
async function uploadMediaDirect(form, files, tagIds, statusTarget=mediaStatus){
  const uploaded=new Array(files.length);
  let nextIndex=0;
  const worker=async()=>{
    while(nextIndex<files.length){
      const index=nextIndex++;
      if(statusTarget)statusTarget.textContent=`正在上传 ${index+1}/${files.length}：${files[index].name}`;
      uploaded[index]=await uploadFile(files[index]);
    }
  };
  await Promise.all(Array.from({length:Math.min(MAX_PARALLEL_UPLOADS,files.length)},worker));
  if(statusTarget)statusTarget.textContent="正在批量保存素材信息…";
  const payload=mediaFormPayload(form,tagIds);
  payload.files=uploaded;
  return request("/api/media/direct-record",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
}
mediaDropZone.addEventListener("drop",(event)=>{
  const transfer=new DataTransfer();
  [...event.dataTransfer.files].forEach((file)=>transfer.items.add(file));
  mediaInput.files=transfer.files;
  renderSelectedFiles(mediaInput.files);
});
document.querySelector("#media-upload-form").addEventListener("submit",async(event)=>{
  event.preventDefault();
  if(!mediaInput.files.length){
    mediaStatus.textContent="Please choose image, video, or file first.";
    mediaStatus.className="media-upload-status wide error";
    return;
  }
  try{
    mediaUploadButton.disabled=true;
    mediaUploadButton.querySelector("span").textContent="Uploading...";
    mediaStatus.textContent=`Uploading ${mediaInput.files.length} file(s). Please keep this page open.`;
    mediaStatus.className="media-upload-status wide working";
    const files=[...mediaInput.files];
    const data = new FormData(event.target);
    const tagIds = data.getAll("tag_ids");
    data.delete("tag_ids");
    data.set("tag_ids", JSON.stringify(tagIds));
    const created=shouldUseDirectUpload(files)
      ? await uploadMediaDirect(event.target,files,tagIds,mediaStatus)
      : await request("/api/media/upload",{method:"POST",body:data});
    event.target.reset();document.querySelector("#upload-preview").innerHTML="";
    renderSelectedFiles([]);
    await loadAll();
    mediaStatus.textContent=`Upload complete: ${created.length} file(s) saved.`;
    mediaStatus.className="media-upload-status wide success";
    notify("Media uploaded");
  }catch(error){
    console.error("Media upload failed:",error);
    mediaStatus.textContent=`Upload failed: ${error.message}`;
    mediaStatus.className="media-upload-status wide error";
    notify(error.message,true);
  }finally{
    mediaUploadButton.disabled=false;
    mediaUploadButton.querySelector("span").textContent="Upload and save";
  }
});

function openMediaModal(item) {
  const selectedTagIds = String(item.tag_ids || "").split(",").filter(Boolean);
  openModal(`<form id="media-form" class="modal-form"><h2>编辑媒体</h2>
    <div class="field"><label>归属作品</label><select name="project_id">${optionList(state.projects,item.project_id,"不归属具体作品")}</select></div>
    <div class="field"><label>作品分类</label><select name="category_id">${optionList(state.categories,item.category_id,"不归属分类")}</select></div>
    <div class="field wide"><label>标题</label><input name="title" value="${escapeHtml(item.title)}"></div>
    <div class="field wide"><label>描述</label><textarea name="description">${escapeHtml(item.description)}</textarea></div>
    <div class="field wide"><label>文字标签</label><input name="tags" value="${escapeHtml(item.tags)}"></div>
    <details class="shooting-fields wide" ${(item.camera||item.lens||item.captured_at)?"open":""}><summary>拍摄 / 创作信息（可选）</summary><div>
      <label>相机<input name="camera" value="${escapeHtml(item.camera||"")}"></label>
      <label>镜头<input name="lens" value="${escapeHtml(item.lens||"")}"></label>
      <label>光圈<input name="aperture" value="${escapeHtml(item.aperture||"")}"></label>
      <label>快门<input name="shutter_speed" value="${escapeHtml(item.shutter_speed||"")}"></label>
      <label>ISO<input name="iso" value="${escapeHtml(item.iso||"")}"></label>
      <label>拍摄时间<input name="captured_at" value="${escapeHtml(item.captured_at||"")}"></label>
    </div></details>
    <div class="field wide"><label>系统标签</label><div class="checks media-edit-tags">${state.tags.map((tag)=>`<label class="system-tag-option"><input name="tag_ids" value="${tag.id}" type="checkbox" ${selectedTagIds.includes(String(tag.id))?"checked":""}><span>${escapeHtml(tag.name)}</span></label>`).join("")}</div></div>
    <div class="field"><label>排序</label><input name="sort_order" type="number" value="${item.sort_order}"></div>
    <div class="checks purpose-options"><label><input name="is_hero" type="checkbox" ${item.is_hero?"checked":""}> 首页全屏背景</label><label><input name="is_selected" type="checkbox" ${item.is_selected?"checked":""}> 精选作品</label><label><input name="show_in_database" type="checkbox" ${item.show_in_database?"checked":""}> 加入作品库</label><label><input name="is_cover" type="checkbox" ${item.is_cover?"checked":""}> 所属作品封面</label></div>
    <button class="primary wide">保存媒体</button></form>`);
  document.querySelector("#media-form").addEventListener("submit",async(event)=>{
    event.preventDefault();const values=formDataObject(event.target);
    values.tag_ids=[...event.target.querySelectorAll('input[name="tag_ids"]:checked')].map((input)=>input.value);
    values.is_hero=event.target.is_hero.checked;values.is_selected=event.target.is_selected.checked;values.show_in_database=event.target.show_in_database.checked;values.is_cover=event.target.is_cover.checked;
    await request(`/api/media/${item.id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(values)});
    closeModal();await loadAll();notify("媒体已保存");
  });
}

document.querySelector("#tag-form").addEventListener("submit",async(event)=>{
  event.preventDefault();
  try{
    await request("/api/tags",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(formDataObject(event.target))});
    event.target.reset();await loadAll();notify("标签已新增");
  }catch(error){notify(error.message,true);}
});

bootstrap().catch((error)=>{
  console.error("后台初始化失败：",error);
  document.body.innerHTML=`<main class="admin-load-error"><h1>后台加载失败</h1><p>${escapeHtml(error.message)}</p><a href="/">返回首页</a></main>`;
});

/* Persistent series batch deletion */
const seriesBatchState={active:false,selected:new Set(),busy:false};
function visibleSeriesProjects(){
  const filter=document.querySelector("#project-filter")?.value||"";
  const series=state.projects.filter(item=>Number(item.is_series)===1);
  return filter?series.filter(item=>item.status===filter):series;
}
function ensureSeriesBatchToolbar(){
  if(document.querySelector("#series-batch-toolbar"))return;
  const toolbar=document.createElement("div");
  toolbar.id="series-batch-toolbar";
  toolbar.className="media-batch-toolbar series-batch-toolbar";
  toolbar.innerHTML='<button data-series-batch-start>批量选择</button><button data-series-batch-all hidden>全选当前列表</button><span data-series-batch-count hidden>已选择 0 个系列</span><button class="danger" data-series-batch-delete hidden disabled>删除所选</button><button data-series-batch-cancel hidden>取消</button>';
  document.querySelector("#project-list")?.before(toolbar);
}
function refreshSeriesBatchUI(){
  ensureSeriesBatchToolbar();
  const toolbar=document.querySelector("#series-batch-toolbar");
  if(!toolbar)return;
  const active=seriesBatchState.active,count=seriesBatchState.selected.size,items=visibleSeriesProjects();
  toolbar.querySelector("[data-series-batch-start]").hidden=active;
  ["[data-series-batch-all]","[data-series-batch-count]","[data-series-batch-delete]","[data-series-batch-cancel]"].forEach(selector=>toolbar.querySelector(selector).hidden=!active);
  toolbar.querySelector("[data-series-batch-count]").textContent=seriesBatchState.busy?`正在删除…`:`已选择 ${count} 个系列`;
  toolbar.querySelector("[data-series-batch-delete]").disabled=!count||seriesBatchState.busy;
  toolbar.querySelector("[data-series-batch-all]").disabled=seriesBatchState.busy;
  toolbar.querySelector("[data-series-batch-cancel]").disabled=seriesBatchState.busy;
  toolbar.querySelector("[data-series-batch-all]").textContent=items.length&&items.every(item=>seriesBatchState.selected.has(String(item.id)))?"取消全选":"全选当前列表";
  document.querySelectorAll("#project-list .admin-row").forEach((card,index)=>{
    const item=items[index];if(!item)return;
    const id=String(item.id);card.dataset.batchSeriesId=id;
    card.classList.toggle("batch-mode",active);card.classList.toggle("selected",seriesBatchState.selected.has(id));
    card.querySelector(".series-select-control")?.remove();
    if(active){const control=document.createElement("label");control.className="media-select-control series-select-control";control.innerHTML=`<input type="checkbox" ${seriesBatchState.selected.has(id)?"checked":""} aria-label="选择${escapeHtml(item.title||"系列")}"><span></span>`;card.prepend(control);}
  });
}
const originalRenderProjects=renderProjects;
renderProjects=function(){originalRenderProjects();requestAnimationFrame(refreshSeriesBatchUI);};
document.querySelector("#project-filter")?.addEventListener("change",()=>{
  seriesBatchState.selected.clear();
  requestAnimationFrame(refreshSeriesBatchUI);
});
document.addEventListener("click",async(event)=>{
  if(event.target.closest("[data-series-batch-start]")){seriesBatchState.active=true;seriesBatchState.selected.clear();refreshSeriesBatchUI();return;}
  if(event.target.closest("[data-series-batch-cancel]")){seriesBatchState.active=false;seriesBatchState.selected.clear();refreshSeriesBatchUI();return;}
  if(event.target.closest("[data-series-batch-all]")){
    const items=visibleSeriesProjects();
    if(items.length&&items.every(item=>seriesBatchState.selected.has(String(item.id))))items.forEach(item=>seriesBatchState.selected.delete(String(item.id)));
    else items.forEach(item=>seriesBatchState.selected.add(String(item.id)));
    refreshSeriesBatchUI();return;
  }
  const card=event.target.closest("#project-list .admin-row.batch-mode");
  if(card&&!event.target.closest(".row-actions")&&!seriesBatchState.busy){
    const id=String(card.dataset.batchSeriesId);seriesBatchState.selected.has(id)?seriesBatchState.selected.delete(id):seriesBatchState.selected.add(id);refreshSeriesBatchUI();return;
  }
  if(event.target.closest("[data-series-batch-delete]")){
    const ids=[...seriesBatchState.selected];
    if(!ids.length||!confirm(`确定删除选中的 ${ids.length} 个系列吗？关联内容将从网站移除，此操作无法撤销。`))return;
    seriesBatchState.busy=true;refreshSeriesBatchUI();
    let succeeded=0;const failures=[];
    for(let index=0;index<ids.length;index+=1){
      document.querySelector("[data-series-batch-count]").textContent=`正在删除 ${index+1}/${ids.length}`;
      try{await request(`/api/projects/${encodeURIComponent(ids[index])}`,{method:"DELETE"});succeeded+=1;}
      catch(error){failures.push(error?.message||String(error));}
    }
    seriesBatchState.busy=false;seriesBatchState.active=false;seriesBatchState.selected.clear();
    await loadAll();
    notify(failures.length?`已删除 ${succeeded} 个系列，${failures.length} 个失败`:`已删除 ${succeeded} 个系列`,failures.length>0);
  }
});

/* Batch media deletion */
const mediaBatchState={active:false,selected:new Set()};
function ensureMediaBatchToolbar(){
  if(document.querySelector("#media-batch-toolbar"))return;
  const toolbar=document.createElement("div");toolbar.id="media-batch-toolbar";toolbar.className="media-batch-toolbar";
  toolbar.innerHTML='<button data-batch-start>批量选择</button><button data-batch-all hidden>全选</button><span data-batch-count hidden>已选择 0 项</span><button class="danger" data-batch-delete hidden disabled>删除所选</button><button data-batch-cancel hidden>取消</button>';
  document.querySelector("#media-list").before(toolbar);
}
function refreshMediaBatchUI(){
  ensureMediaBatchToolbar();
  const toolbar=document.querySelector("#media-batch-toolbar"),active=mediaBatchState.active,count=mediaBatchState.selected.size;
  toolbar.querySelector("[data-batch-start]").hidden=active;
  ["[data-batch-all]","[data-batch-count]","[data-batch-delete]","[data-batch-cancel]"].forEach(s=>toolbar.querySelector(s).hidden=!active);
  toolbar.querySelector("[data-batch-count]").textContent=`已选择 ${count} 项`;
  toolbar.querySelector("[data-batch-delete]").disabled=!count;
  toolbar.querySelector("[data-batch-all]").textContent=count===state.media.length&&state.media.length?"取消全选":"全选";
  document.querySelectorAll(".media-admin-card").forEach((card,index)=>{
    const item=state.media[index];if(!item)return;card.dataset.batchMediaId=item.id;card.classList.toggle("batch-mode",active);card.classList.toggle("selected",mediaBatchState.selected.has(String(item.id)));
    card.querySelector(".media-select-control")?.remove();
    if(active){const control=document.createElement("label");control.className="media-select-control";control.innerHTML=`<input type="checkbox" ${mediaBatchState.selected.has(String(item.id))?"checked":""}><span></span>`;card.prepend(control);}
  });
}
const originalRenderMedia=renderMedia;
renderMedia=function(){originalRenderMedia();requestAnimationFrame(refreshMediaBatchUI);};
document.addEventListener("click",async(event)=>{
  if(event.target.closest("[data-batch-start]")){mediaBatchState.active=true;mediaBatchState.selected.clear();refreshMediaBatchUI();}
  if(event.target.closest("[data-batch-cancel]")){mediaBatchState.active=false;mediaBatchState.selected.clear();refreshMediaBatchUI();}
  if(event.target.closest("[data-batch-all]")){if(mediaBatchState.selected.size===state.media.length)mediaBatchState.selected.clear();else state.media.forEach(i=>mediaBatchState.selected.add(String(i.id)));refreshMediaBatchUI();}
  const card=event.target.closest(".media-admin-card.batch-mode");
  if(card&&!event.target.closest(".row-actions")){const id=String(card.dataset.batchMediaId);mediaBatchState.selected.has(id)?mediaBatchState.selected.delete(id):mediaBatchState.selected.add(id);refreshMediaBatchUI();}
  if(event.target.closest("[data-batch-delete]")){const ids=[...mediaBatchState.selected];if(!ids.length||!confirm(`确定删除选中的 ${ids.length} 项素材吗？此操作无法撤销。`))return;const button=event.target.closest("[data-batch-delete]");button.disabled=true;button.textContent="正在删除…";const results=await Promise.allSettled(ids.map(id=>request(`/api/media/${id}`,{method:"DELETE"})));const failed=results.filter(r=>r.status==="rejected").length;mediaBatchState.active=false;mediaBatchState.selected.clear();await loadAll();notify(failed?`${ids.length-failed} 项已删除，${failed} 项失败`:`已删除 ${ids.length} 项素材`,failed>0);}
});
// Inspiration-channel administration was intentionally removed.
