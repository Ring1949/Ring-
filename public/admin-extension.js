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
  const response=await fetch(signed.signed_url,{method:"PUT",headers:signed.upload_headers||{},body});
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

/* Inspiration archive management: tree and resource assignments persist in Supabase. */
const inspirationState={tree:null,assignments:{}};
const inspirationRoot=document.querySelector('#inspiration-admin');
const iEsc=(value)=>escapeHtml(String(value||''));
const iSlug=(value,fallback)=>String(value||'').trim().toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'')||fallback;
function iChannelOptions(selected=''){return (inspirationState.tree?.channels||[]).map(channel=>'<option value="'+iEsc(channel.id)+'" '+(channel.id===selected?'selected':'')+'>'+iEsc(channel.title)+' / '+iEsc(channel.english)+'</option>').join('');}
function iChapterOptions(channelId,selected=''){const channel=(inspirationState.tree?.channels||[]).find(item=>item.id===channelId)||(inspirationState.tree?.channels||[])[0];return (channel?.chapters||[]).map(chapter=>'<option value="'+iEsc(chapter.id)+'" '+(chapter.id===selected?'selected':'')+'>'+iEsc(chapter.title)+' / '+iEsc(chapter.english)+'</option>').join('');}
function renderInspirationAdmin(){
  if(!inspirationRoot||!inspirationState.tree)return;
  const channels=inspirationState.tree.channels||[];
  const treeCards=channels.map((channel,channelIndex)=>'<article class="inspiration-channel-editor"><header><span>CHANNEL '+String(channelIndex+1).padStart(2,'0')+'</span><button type="button" data-i-remove-channel="'+channelIndex+'">\u5220\u9664\u9891\u9053</button></header><div class="inspiration-node-fields"><label>\u4e2d\u6587\u540d\u79f0<input data-i-field="channel-title" data-i-channel="'+channelIndex+'" value="'+iEsc(channel.title)+'"></label><label>ENGLISH<input data-i-field="channel-english" data-i-channel="'+channelIndex+'" value="'+iEsc(channel.english)+'"></label><label>SLUG<input data-i-field="channel-id" data-i-channel="'+channelIndex+'" value="'+iEsc(channel.id)+'"></label></div><div class="inspiration-chapter-list">'+(channel.chapters||[]).map((chapter,chapterIndex)=>'<div class="inspiration-chapter-editor"><header><span>LEVEL 02 / '+String(chapterIndex+1).padStart(2,'0')+'</span><button type="button" data-i-remove-chapter="'+channelIndex+':'+chapterIndex+'">\u5220\u9664</button></header><label>\u4e2d\u6587\u540d\u79f0<input data-i-field="chapter-title" data-i-channel="'+channelIndex+'" data-i-chapter="'+chapterIndex+'" value="'+iEsc(chapter.title)+'"></label><label>ENGLISH<input data-i-field="chapter-english" data-i-channel="'+channelIndex+'" data-i-chapter="'+chapterIndex+'" value="'+iEsc(chapter.english)+'"></label><label>\u5339\u914d\u5173\u952e\u8bcd<input data-i-field="chapter-keywords" data-i-channel="'+channelIndex+'" data-i-chapter="'+chapterIndex+'" value="'+iEsc((chapter.keywords||[]).join(', '))+'" placeholder="humanity, \u4eba\u6587"></label></div>').join('')+'<button type="button" class="inspiration-add-chapter" data-i-add-chapter="'+channelIndex+'">+ \u65b0\u589e\u4e8c\u7ea7\u8282\u70b9</button></div></article>').join('');
  const assignments=Object.entries(inspirationState.assignments||{}).map(([id,assignment])=>({id,item:state.media.find(media=>String(media.id)===String(id)),assignment}));
  inspirationRoot.innerHTML='<section class="inspiration-tree-panel"><div class="inspiration-toolbar"><div><p>LEVEL 01 + LEVEL 02</p><h3>\u7075\u611f\u9891\u9053\u7ed3\u6784</h3><span>\u7ba1\u7406\u4e00\u7ea7\u9891\u9053\u4e0e\u4e8c\u7ea7\u8282\u70b9\uff0c\u4fdd\u5b58\u540e\u4f1a\u540c\u6b65\u5230\u524d\u53f0\u3002</span></div><button type="button" class="primary" data-i-add-channel>+ \u65b0\u589e\u4e00\u7ea7\u9891\u9053</button></div><div class="inspiration-tree">'+treeCards+'</div><button type="button" class="primary" data-i-save-tree>\u4fdd\u5b58\u9891\u9053\u7ed3\u6784</button><span class="inspiration-save-status"></span></section><section class="inspiration-resources"><div class="inspiration-toolbar"><div><p>LEVEL 03 RESOURCES</p><h3>\u4e09\u7ea7\u7d20\u6750\u5e93</h3><span>\u56fe\u7247\u3001\u89c6\u9891\u3001\u94fe\u63a5\u4e0e\u7d20\u6750\u4fe1\u606f\u90fd\u5f52\u5c5e\u4e8e\u5bf9\u5e94\u7684\u4e09\u7ea7\u8282\u70b9\u3002</span></div></div><form id="inspiration-attach-form" class="inspiration-resource-form"><label>\u5df2\u4e0a\u4f20\u7d20\u6750<select name="media_id">'+state.media.map(item=>'<option value="'+item.id+'">'+iEsc(item.title||item.original_name||('#'+item.id))+'</option>').join('')+'</select></label><label>\u4e00\u7ea7\u9891\u9053<select name="channel">'+iChannelOptions(channels[0]?.id)+'</select></label><label>\u4e8c\u7ea7\u8282\u70b9<select name="chapter">'+iChapterOptions(channels[0]?.id)+'</select></label><label>\u81ea\u5b9a\u4e49\u6807\u9898<input name="title"></label><label>\u6807\u7b7e<input name="tags"></label><label class="wide">\u4ecb\u7ecd<input name="description"></label><label class="wide">\u5916\u90e8\u94fe\u63a5<input name="source_url" type="url" placeholder="https://..."></label><button class="primary" type="submit">\u5173\u8054\u5230\u4e09\u7ea7\u8282\u70b9</button></form><form id="inspiration-upload-form" class="inspiration-upload-form"><div><p>NEW RESOURCE</p><h4>\u4e0a\u4f20\u65b0\u7d20\u6750</h4><span>\u4f1a\u76f4\u63a5\u4fdd\u5b58\u5230 Supabase Storage \u5e76\u5f52\u6863\u3002</span></div><label class="file"><input name="files" type="file" accept="image/*,video/*,.pdf" required multiple><b>\u9009\u62e9\u56fe\u7247 / \u89c6\u9891 / \u6587\u4ef6</b></label><label><span>\u4e00\u7ea7\u9891\u9053</span><select name="channel">'+iChannelOptions(channels[0]?.id)+'</select></label><label><span>\u4e8c\u7ea7\u8282\u70b9</span><select name="chapter">'+iChapterOptions(channels[0]?.id)+'</select></label><label><span>\u6807\u9898</span><input name="title"></label><label><span>\u4ecb\u7ecd</span><input name="description"></label><label><span>\u5916\u90e8\u94fe\u63a5</span><input name="source_url" type="url"></label><input name="category_id" type="hidden"><input name="show_in_inspiration" type="hidden" value="true"><input name="show_in_database" type="hidden" value="false"><button class="primary" type="submit">\u4e0a\u4f20\u5e76\u5f52\u6863</button><span class="inspiration-upload-status"></span></form><div class="inspiration-assignment-list">'+(assignments.length?assignments.map(({id,item,assignment})=>'<article><div class="inspiration-assignment-thumb">'+(item?.media_type==='video'?'VIDEO':item?.file_path?'<img src="'+iEsc(item.file_path)+'">':'FILE')+'</div><div><b>'+iEsc(assignment.title||item?.title||('#'+id))+'</b><p>'+iEsc((channels.find(channel=>channel.id===assignment.channel)?.title||assignment.channel)+' / '+((channels.find(channel=>channel.id===assignment.channel)?.chapters||[]).find(chapter=>chapter.id===assignment.chapter)?.title||assignment.chapter))+'</p><span>'+iEsc(assignment.description||'')+'</span></div><button type="button" data-i-remove-resource="'+id+'">\u79fb\u51fa</button></article>').join(''):'<p class="inspiration-empty">\u6682\u65e0\u5df2\u5f52\u6863\u7d20\u6750\u3002</p>')+'</div></section>';
}
async function loadInspirationAdmin(){if(!inspirationRoot)return;inspirationRoot.innerHTML='<div class="inspiration-loading">Loading inspiration archive...</div>';const config=await request('/api/inspiration-config');inspirationState.tree=config.tree;inspirationState.assignments=config.assignments||{};renderInspirationAdmin();}
async function saveInspirationConfig(partial,message){const result=await request('/api/inspiration-config',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(partial)});inspirationState.tree=result.tree;inspirationState.assignments=result.assignments||{};renderInspirationAdmin();notify(message||'\u5df2\u4fdd\u5b58\u5230\u4e91\u7aef');}
function syncInspirationChapters(form){const channel=form.querySelector('[name="channel"]'),chapter=form.querySelector('[name="chapter"]');if(channel&&chapter)chapter.innerHTML=iChapterOptions(channel.value,'');}
if(inspirationRoot){
  document.querySelector('[data-view="inspiration"]')?.addEventListener('click',()=>loadInspirationAdmin().catch(error=>{inspirationRoot.innerHTML='<p class="inspiration-error">'+iEsc(error.message)+'</p>';}));
  inspirationRoot.addEventListener('input',event=>{const input=event.target;if(!input.dataset.iField)return;const channel=inspirationState.tree.channels[Number(input.dataset.iChannel)];const chapter=channel?.chapters?.[Number(input.dataset.iChapter)];if(input.dataset.iField==='channel-title')channel.title=input.value;if(input.dataset.iField==='channel-english')channel.english=input.value;if(input.dataset.iField==='channel-id')channel.id=iSlug(input.value,'channel-'+Date.now());if(!chapter)return;if(input.dataset.iField==='chapter-title')chapter.title=input.value;if(input.dataset.iField==='chapter-english')chapter.english=input.value;if(input.dataset.iField==='chapter-keywords')chapter.keywords=input.value.split(',').map(value=>value.trim()).filter(Boolean);});
  inspirationRoot.addEventListener('change',event=>{const form=event.target.closest('form');if(event.target.name==='channel'&&form)syncInspirationChapters(form);});
  inspirationRoot.addEventListener('click', async (event) => {
    const button=event.target.closest('button');
    if(!button)return;
    try {
      if(button.dataset.iAddChannel!==undefined){
        inspirationState.tree.channels.push({id:'channel-'+Date.now(),title:'\u65b0\u9891\u9053',english:'NEW CHANNEL',chapters:[]});
        renderInspirationAdmin(); return;
      }
      if(button.dataset.iRemoveChannel!==undefined){
        inspirationState.tree.channels.splice(Number(button.dataset.iRemoveChannel),1);
        renderInspirationAdmin(); return;
      }
      if(button.dataset.iAddChapter!==undefined){
        inspirationState.tree.channels[Number(button.dataset.iAddChapter)].chapters.push({id:'chapter-'+Date.now(),title:'\u65b0\u8282\u70b9',english:'NEW CHAPTER',keywords:[]});
        renderInspirationAdmin(); return;
      }
      if(button.dataset.iRemoveChapter){
        const [channelIndex,chapterIndex]=button.dataset.iRemoveChapter.split(':').map(Number);
        inspirationState.tree.channels[channelIndex].chapters.splice(chapterIndex,1);
        renderInspirationAdmin(); return;
      }
      if(button.dataset.iSaveTree!==undefined){
        await saveInspirationConfig({tree:inspirationState.tree},'\u9891\u9053\u7ed3\u6784\u5df2\u4fdd\u5b58'); return;
      }
      if(button.dataset.iRemoveResource){
        const id=button.dataset.iRemoveResource;
        const item=state.media.find(media=>String(media.id)===String(id));
        delete inspirationState.assignments[id];
        if(item) await request('/api/media/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...item,show_in_inspiration:false})});
        await saveInspirationConfig({assignments:inspirationState.assignments},'\u7d20\u6750\u5df2\u79fb\u51fa\u7075\u611f\u9891\u9053');
        await loadAll();
      }
    } catch(error) { notify(error.message,true); }
  });
  inspirationRoot.addEventListener('submit', async (event) => {
    const form=event.target;
    if(form.id!=='inspiration-attach-form'&&form.id!=='inspiration-upload-form')return;
    event.preventDefault();
    try {
      if(form.id==='inspiration-attach-form'){
        const data=new FormData(form),id=String(data.get('media_id'));
        const item=state.media.find(media=>String(media.id)===id);
        if(!item)throw new Error('Please select an uploaded resource.');
        inspirationState.assignments[id]={channel:String(data.get('channel')),chapter:String(data.get('chapter')),title:String(data.get('title')||''),description:String(data.get('description')||''),source_url:String(data.get('source_url')||''),tags:String(data.get('tags')||'')};
        await request('/api/media/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...item,show_in_inspiration:true})});
        await saveInspirationConfig({assignments:inspirationState.assignments},'\u7d20\u6750\u5df2\u5f52\u6863');
        await loadAll();
        return;
      }
      const status=form.querySelector('.inspiration-upload-status');
      const files=[...form.elements.files.files];
      if(!files.length)throw new Error('Please choose a file.');
      if(status)status.textContent='Uploading...';
      const category=state.categories.find(item=>item.slug===form.elements.channel.value);
      form.elements.category_id.value=category?.id||'';
      const created=shouldUseDirectUpload(files) ? await uploadMediaDirect(form,files,[]) : await request('/api/media/upload',{method:'POST',body:new FormData(form)});
      created.forEach(item => {
        inspirationState.assignments[String(item.id)]={channel:form.elements.channel.value,chapter:form.elements.chapter.value,title:String(form.elements.title.value||''),description:String(form.elements.description.value||''),source_url:String(form.elements.source_url.value||'')};
      });
      await saveInspirationConfig({assignments:inspirationState.assignments},'\u7d20\u6750\u5df2\u4e0a\u4f20\u5e76\u5f52\u6863');
      await loadAll();
    } catch(error) {
      notify(error.message,true);
      const status=form.querySelector('.inspiration-upload-status');
      if(status)status.textContent=error.message;
    }
  });
}
