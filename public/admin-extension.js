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

const DIRECT_UPLOAD_THRESHOLD = 3.5 * 1024 * 1024;
function shouldUseDirectUpload(files){return [...files].some((file)=>file.size>DIRECT_UPLOAD_THRESHOLD||file.type.startsWith("video/"));}
function mediaFormPayload(form, tagIds){
  const data=new FormData(form);
  data.delete("files");
  data.delete("tag_ids");
  const payload=Object.fromEntries(data.entries());
  payload.tag_ids=JSON.stringify(tagIds);
  return payload;
}
async function uploadFileDirectToSupabase(file){
  const signed=await request("/api/media/upload-sign",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({filename:file.name,contentType:file.type,size:file.size})});
  const body=new FormData();
  body.append("cacheControl","3600");
  body.append("",file);
  const response=await fetch(signed.signed_url,{method:"PUT",body});
  if(!response.ok){const detail=await response.text().catch(()=>"");throw new Error(`Supabase video upload failed: ${response.status} ${detail}`);}
  return signed;
}
async function uploadMediaDirect(form, files, tagIds){
  const uploaded=[];
  for(let index=0;index<files.length;index+=1){
    mediaStatus.textContent=`正在直传 ${index+1}/${files.length}：${files[index].name}`;
    uploaded.push(await uploadFileDirectToSupabase(files[index]));
  }
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
      ? await uploadMediaDirect(event.target,files,tagIds)
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

async function removeItem(resource,id,label) {
  if(!confirm(`确定删除这个${label}吗？此操作无法撤销。`))return;
  try{await request(`/api/${resource}/${id}`,{method:"DELETE"});await loadAll();notify(`${label}已删除`);}
  catch(error){notify(error.message,true);}
}

bootstrap().catch((error)=>{
  console.error("后台初始化失败：",error);
  document.body.innerHTML=`<main class="admin-load-error"><h1>后台加载失败</h1><p>${escapeHtml(error.message)}</p><a href="/">返回首页</a></main>`;
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
