const fallbackCovers = ["visual-a","visual-b","visual-c","visual-d","visual-e"];
let recommended = [];
let recommendVirtualItems = [];
let recommendIndex = 0;
let recommendScroll = 0;
let recommendTarget = 0;
let recommendFrame = 0;
let recommendLastFrame = 0;
let recommendPointer = { x: innerWidth / 2, y: innerHeight / 2, inside: false };
let recommendTilt = { x: 0, y: 0 };
let recommendHover = -1;
const seriesBookPalettes = [
  ["#183b36", "#d5c38c"],
  ["#9a3428", "#ead6b4"],
  ["#1e4d78", "#d9c89d"],
  ["#8a7048", "#171a1a"],
  ["#343438", "#ded5bc"],
  ["#d9d0b8", "#223b53"],
  ["#592f2a", "#e7c89e"]
];
const HOME_PAYLOAD_CACHE_KEY = "ring:home-payload-cache";
const HOME_PAYLOAD_CACHE_AGE = 30 * 60 * 1000;
const HOME_PAYLOAD_CACHE_VERSION = 2;

function readHomePayloadCache(){
  try{
    const cached=JSON.parse(sessionStorage.getItem(HOME_PAYLOAD_CACHE_KEY)||"null");
    return cached&&cached.version===HOME_PAYLOAD_CACHE_VERSION&&Date.now()-cached.savedAt<HOME_PAYLOAD_CACHE_AGE?cached.payload:null;
  }catch{return null;}
}

function saveHomePayloadCache(payload){
  try{sessionStorage.setItem(HOME_PAYLOAD_CACHE_KEY,JSON.stringify({version:HOME_PAYLOAD_CACHE_VERSION,savedAt:Date.now(),payload}));}catch{/* continue without cache */}
  return payload;
}

function readHomeBootstrap(){
  try{return JSON.parse(document.querySelector("#home-bootstrap")?.textContent||"null");}catch{return null;}
}

function publishHomePayload(home){
  window.__ringHomePayload=home;
  window.dispatchEvent(new CustomEvent("ring:home-payload",{detail:home}));
  return home;
}

function renderRecommended(projects=[]){
  recommended=projects;
  const track=document.querySelector("#recommend-track");
  const windowElement=document.querySelector(".recommend-window");
  if(!track||!windowElement)return;
  if(!recommended.length){track.innerHTML="";windowElement.classList.add("is-empty");return;}
  const copies=7;
  const middleCopy=Math.floor(copies/2);
  recommendVirtualItems=Array.from({length:recommended.length*copies},(_,virtualIndex)=>({
    project:recommended[virtualIndex%recommended.length],
    realIndex:virtualIndex%recommended.length,
    virtualIndex
  }));
  recommendIndex=Math.min(recommendIndex,recommended.length-1);
  recommendScroll=middleCopy*recommended.length+recommendIndex;
  recommendTarget=recommendScroll;
  track.innerHTML=recommendVirtualItems.map(({project,realIndex,virtualIndex})=>{
    const title=project.title||"未命名系列";
    const subtitle=project.subtitle||project.description||project.category_name||"SERIES ARCHIVE";
    const mediaPath=project.series_cover||project.cover_image||"";
    const mediaType=project.series_media_type||"image";
    const [bookColor,bookInk]=seriesBookPalettes[realIndex%seriesBookPalettes.length];
    return `
    <a class="recommend-card series-book" data-series-index="${realIndex}" data-virtual-index="${virtualIndex}" style="--book-color:${bookColor};--book-ink:${bookInk}" href="/project.html?id=${project.id}" aria-label="${escapeHtml(title)}">
      <span class="series-book-spine"><strong>${escapeHtml(title)}</strong><small>RING · SERIES</small><i>${String(realIndex+1).padStart(2,"0")}</i></span>
      <span class="series-book-volume" aria-hidden="true"><i></i><b></b></span>
      <span class="series-book-cover card-media ${fallbackCovers[(realIndex+2)%fallbackCovers.length]}">
        ${mediaMarkup(mediaPath,mediaType,title)}
        <span class="series-book-cover-shade"></span>
        ${mediaPath?"":`<span class="series-book-cover-copy"><small>RING VISUAL ARCHIVE</small><strong>${escapeHtml(title)}</strong></span>`}
      </span>
      <div class="recommend-info"><b>${String(realIndex+1).padStart(2,"0")}</b><div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(subtitle)}</p></div></div>
    </a>`;
  }).join("");
  windowElement.classList.remove("is-empty");
  let filters=windowElement.querySelector(".series-filter-tabs");
  if(!filters){
    filters=document.createElement("nav");
    filters.className="series-filter-tabs";
    filters.setAttribute("aria-label","系列筛选");
    windowElement.prepend(filters);
  }
  filters.innerHTML=`<button data-series-filter="all">ALL / 全部</button>${recommended.map((_,index)=>`<button data-series-filter="${index}">${String(index+1).padStart(2,"0")}</button>`).join("")}`;
  filters.querySelectorAll("button").forEach((button)=>button.addEventListener("click",(event)=>{
    event.preventDefault();event.stopPropagation();
    const requested=button.dataset.seriesFilter;
    if(requested==="all"){recommendTarget=Math.round(recommendTarget/recommended.length)*recommended.length;return;}
    const real=Number(requested);const current=Math.round(recommendTarget);const currentReal=((current%recommended.length)+recommended.length)%recommended.length;let delta=real-currentReal;if(delta>recommended.length/2)delta-=recommended.length;if(delta<-recommended.length/2)delta+=recommended.length;recommendTarget=current+delta;
  }));
  let caption=windowElement.querySelector(".series-caption");
  if(!caption){
    caption=document.createElement("div");
    caption.className="series-caption";
    caption.setAttribute("aria-live","polite");
    caption.innerHTML='<div class="series-caption-title"><span></span></div><div class="series-caption-meta"><span></span></div><div class="series-caption-count"><span></span></div>';
    windowElement.append(caption);
  }
  let cursor=windowElement.querySelector(".series-cursor");
  if(!cursor){
    cursor=document.createElement("span");
    cursor.className="series-cursor";
    cursor.innerHTML='<i></i><b>OPEN<small>打开</small></b>';
    windowElement.append(cursor);
  }
  updateSeriesCaption(recommendIndex,1,true);
  startRecommendMotion();
  if(location.hash==="#series"&&!windowElement.dataset.seriesAligned){
    windowElement.dataset.seriesAligned="true";
    requestAnimationFrame(()=>{
      const section=document.querySelector("#series");
      const navHeight=document.querySelector(".nav")?.getBoundingClientRect().height||70;
      if(section)scrollTo({top:Math.max(0,section.offsetTop-navHeight-24),behavior:"auto"});
    });
  }
}

async function initHome(homeOverride=null) {
  const cachedHome=readHomePayloadCache();
  const bootstrapHome=!cachedHome&&!homeOverride?readHomeBootstrap():null;
  if(bootstrapHome){
    publishHomePayload(bootstrapHome);
    renderRecommended(bootstrapHome.recommended||[]);
  }
  try{sessionStorage.removeItem("ring:home-returning");}catch{/* continue normally */}
  const homeRequest=homeOverride?Promise.resolve(homeOverride):cachedHome?Promise.resolve(cachedHome):api("/api/home").then(saveHomePayloadCache);
  window.__ringHomePromise = homeRequest;
  const home = await homeRequest;
  publishHomePayload(home);
  if(cachedHome&&!homeOverride){
    api("/api/home").then(saveHomePayloadCache).then((fresh)=>{
      if(JSON.stringify(fresh)===JSON.stringify(home))return publishHomePayload(fresh);
      return initHome(fresh);
    }).catch(()=>undefined);
  }
  const { settings, hero } = home;
  document.title = `${settings.site_name || "山川行止"} — 个人视觉档案`;
  document.querySelector("#hero-title").textContent = settings.hero_title || settings.site_name;
  document.querySelector("#hero-subtitle").textContent = settings.hero_subtitle || "";
  document.querySelector("#hero-kicker").textContent = settings.hero_kicker || "";
  document.querySelector("#intro-text").innerHTML = escapeHtml(settings.intro_text || "").replace(/\n/g,"<br>");
  document.querySelector("#about-kicker").textContent = settings.about_kicker || "";
  document.querySelector("#about-title").innerHTML = escapeHtml(settings.about_title || "").replace(/\n/g,"<br>");
  document.querySelector("#about-text").textContent = settings.about_text || "";
  document.querySelector("#contact-link").textContent = settings.contact_button_text || "一起做点什么 ↗";
  document.querySelector("#contact-link").href = "#contact";
  // Contact interaction is owned by the React lanyard overlay.
  document.querySelector("#footer-email").textContent = `EMAIL · ${settings.contact_email || ""}`;
  document.querySelector("#footer-logo").textContent = settings.site_name || "山川行止";
  document.querySelector("#footer-text").textContent = settings.footer_text || "";
  document.querySelector("#footer-copyright").textContent = settings.footer_copyright || "";
  const socialLinks = [
    ["小红书",settings.xiaohongshu],["Instagram",settings.instagram],["Behance",settings.behance]
  ].filter(([,href]) => href);
  document.querySelector("#footer-links").innerHTML = [
    `<a href="/series.html">系列作品</a>`,`<a href="/works.html?category=all">作品库</a>`,`<a href="#extensions">扩展</a>`,`<a href="#about">关于</a>`,
    ...socialLinks.map(([label,href]) => `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${label}</a>`)
  ].join("");
  document.querySelector("#hero-media").innerHTML = heroMediaMarkup(hero.file_path, hero.media_type || hero.file_type || settings.hero_media_type, settings.site_name);
  const heroVideo = document.querySelector("#hero-media video");
  if (heroVideo) {
    heroVideo.muted = true;
    heroVideo.loop = true;
    heroVideo.autoplay = true;
    heroVideo.playsInline = true;
    const keepHeroPlaying = () => heroVideo.play().catch(() => {});
    heroVideo.addEventListener("loadeddata",keepHeroPlaying);
    heroVideo.addEventListener("canplay",keepHeroPlaying);
    heroVideo.addEventListener("ended",()=>{
      heroVideo.currentTime=0;
      keepHeroPlaying();
    });
    heroVideo.addEventListener("pause",()=>{
      if(!document.hidden)setTimeout(keepHeroPlaying,80);
    });
    document.addEventListener("visibilitychange",()=>{
      if(!document.hidden)keepHeroPlaying();
    });
    keepHeroPlaying();
  }

  renderRecommended(home.recommended||[]);

}

function projectCard(project, index, main) {
  return `<a class="project-card ${main ? "project-main" : ""}" href="/project.html?id=${project.id}">
    <div class="card-media ${fallbackCovers[index % fallbackCovers.length]}">${mediaMarkup(project.cover_image, "image", project.title)}</div>
    <div class="project-copy"><h3>${escapeHtml(project.title)}</h3><p>${escapeHtml(project.subtitle)}</p><span>${escapeHtml(project.year || project.category_name || "")}</span></div>
  </a>`;
}

function smoothSeriesStep(value){const x=Math.max(0,Math.min(1,value));return x*x*(3-2*x);}
function seriesBend(relative){return Math.abs(relative)<1?(relative+Math.sin(Math.PI*relative)/Math.PI)/2:Math.sign(relative)*.5;}
function updateSeriesCaption(realIndex,direction=1,instant=false){
  const project=recommended[realIndex];
  if(!project)return;
  const values=[project.title||"未命名系列",project.subtitle||project.description||"RING SERIES ARCHIVE",`${String(realIndex+1).padStart(2,"0")} / ${String(recommended.length).padStart(2,"0")}`];
  const lines=[...document.querySelectorAll(".series-caption>div")];
  lines.forEach((line,index)=>{
    const old=line.querySelector("span");
    const next=document.createElement("span");
    next.textContent=values[index];
    if(instant||!old){line.replaceChildren(next);return;}
    line.append(next);
    const from=direction>0?"105%":"-105%";
    const to=direction>0?"-105%":"105%";
    next.animate([{transform:`translateY(${from})`},{transform:"translateY(0)"}],{duration:650,easing:"cubic-bezier(.2,.8,.2,1)",fill:"both"});
    old.animate([{transform:"translateY(0)"},{transform:`translateY(${to})`}],{duration:650,easing:"cubic-bezier(.2,.8,.2,1)",fill:"both"}).finished.then(()=>old.remove()).catch(()=>old.remove());
  });
  document.querySelectorAll(".series-filter-tabs button").forEach((button)=>button.classList.toggle("active",button.dataset.seriesFilter===String(realIndex)));
}
function updateRecommend(time=performance.now()) {
  const track=document.querySelector("#recommend-track");
  const windowElement=document.querySelector(".recommend-window");
  if(!track||!recommended.length||!windowElement)return;
  const dt=Math.min((time-(recommendLastFrame||time))/1000,.05);recommendLastFrame=time;
  const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
  recommendScroll+=(recommendTarget-recommendScroll)*(reduced?1:1-Math.exp(-5.6*dt));
  if(Math.abs(recommendTarget-recommendScroll)<.0001)recommendScroll=recommendTarget;
  const rect=windowElement.getBoundingClientRect();
  const height=Math.min(innerHeight*.46,innerWidth*.31,470);
  const spineWidth=height*142/840;
  const depth=height*474/900;
  const gap=height*.03;
  track.style.setProperty("--tape-h",`${height}px`);track.style.setProperty("--spine-w",`${spineWidth}px`);track.style.setProperty("--cover-w",`${depth}px`);
  const pointerX=(recommendPointer.x-(rect.left+rect.width/2))/(depth*.55);
  const pointerY=(recommendPointer.y-(rect.top+rect.height*.49))/(height*.5);
  const settled=Math.abs(recommendTarget-recommendScroll)<.3;
  const tiltY=recommendPointer.inside&&settled?Math.max(-1,Math.min(1,pointerX))*9:0;
  const tiltX=recommendPointer.inside&&settled?Math.max(-1,Math.min(1,-pointerY))*6:0;
  recommendTilt.y+=(tiltY-recommendTilt.y)*(1-Math.exp(-7*dt));
  recommendTilt.x+=(tiltX-recommendTilt.x)*(1-Math.exp(-7*dt));
  [...track.children].forEach((card)=>{
    const virtualIndex=Number(card.dataset.virtualIndex);
    const relative=virtualIndex-recommendScroll;
    const openness=smoothSeriesStep(Math.max(0,1-Math.abs(relative)));
    const x=relative*(spineWidth+gap)+(depth-spineWidth+1.6*gap)*seriesBend(relative);
    const visible=Math.abs(x)<rect.width/2+depth*1.5;
    card.style.visibility=visible?"visible":"hidden";
    if(!visible)return;
    const hoverLift=virtualIndex===recommendHover&&Math.abs(relative)>.5?1:0;
    card.style.setProperty("--book-x",`${x}px`);
    card.style.setProperty("--book-y",`${-openness*.025*height-hoverLift*.045*height}px`);
    card.style.setProperty("--book-z",`${openness*.2*height}px`);
    card.style.setProperty("--book-rx",`${recommendTilt.x*openness}deg`);
    card.style.setProperty("--book-ry",`${recommendTilt.y*openness}deg`);
    card.style.setProperty("--book-rz",`${-4.5*openness}deg`);
    card.style.setProperty("--spine-turn",`${-90*openness}deg`);
    card.style.setProperty("--cover-turn",`${90*(1-openness)}deg`);
    card.style.setProperty("--cover-clip",`${(1-openness)*50}%`);
    card.style.setProperty("--spine-clip",`${openness*50}%`);
    card.style.setProperty("--book-depth",`${openness*11}px`);
    card.style.setProperty("--spine-shade",`${openness*.55}`);
    card.style.setProperty("--cover-shade",`${(1-openness)*.5}`);
    card.style.zIndex=String(Math.round(100-Math.abs(relative)*4));
    card.classList.toggle("current",Math.abs(relative)<.5);
  });
  const rounded=((Math.round(recommendScroll)%recommended.length)+recommended.length)%recommended.length;
  if(rounded!==recommendIndex){const direction=Math.sign(recommendTarget-recommendScroll)||1;recommendIndex=rounded;updateSeriesCaption(rounded,direction);}
  const cursor=windowElement.querySelector(".series-cursor");
  if(cursor){cursor.style.transform=`translate3d(${recommendPointer.x-rect.left}px,${recommendPointer.y-rect.top}px,0)`;cursor.classList.toggle("visible",recommendPointer.inside);cursor.classList.toggle("open",Math.abs(pointerX)<1&&Math.abs(pointerY)<1&&settled);}
}
function startRecommendMotion(){if(recommendFrame)return;const frame=(time)=>{updateRecommend(time);recommendFrame=requestAnimationFrame(frame);};recommendFrame=requestAnimationFrame(frame);}
function moveRecommend(direction) {
  if (recommended.length <= 1) return;
  recommendTarget=Math.round(recommendTarget)+direction;
}

function setupSeriesBookshelf(){
  const windowElement=document.querySelector(".recommend-window");
  const track=document.querySelector("#recommend-track");
  if(!windowElement||!track||windowElement.dataset.bookshelfReady)return;
  windowElement.dataset.bookshelfReady="true";
  windowElement.tabIndex=0;
  let dragStart=null;
  let dragMoved=false;
  windowElement.addEventListener("click",(event)=>{
    const filter=event.target.closest("[data-series-filter]");
    if(filter){
      const requested=filter.dataset.seriesFilter;
      if(requested==="all"){recommendTarget=Math.round(recommendTarget/recommended.length)*recommended.length;return;}
      const real=Number(requested);const current=Math.round(recommendTarget);const currentReal=((current%recommended.length)+recommended.length)%recommended.length;let delta=real-currentReal;if(delta>recommended.length/2)delta-=recommended.length;if(delta<-recommended.length/2)delta+=recommended.length;recommendTarget=current+delta;return;
    }
    const card=event.target.closest(".recommend-card[data-series-index]");
    if(!card)return;
    if(dragMoved){event.preventDefault();dragMoved=false;return;}
    const virtualIndex=Number(card.dataset.virtualIndex);
    const relative=virtualIndex-recommendScroll;
    if(Math.abs(relative)>=.5){event.preventDefault();recommendTarget=Math.round(recommendTarget+relative);}
  });
  windowElement.addEventListener("keydown",(event)=>{
    if(event.key==="ArrowLeft"){event.preventDefault();moveRecommend(-1);}
    if(event.key==="ArrowRight"){event.preventDefault();moveRecommend(1);}
    if(event.key==="Enter")document.querySelector(".recommend-card.current")?.click();
  });
  windowElement.addEventListener("pointerenter",()=>{recommendPointer.inside=true;});
  windowElement.addEventListener("pointerleave",()=>{recommendPointer.inside=false;recommendHover=-1;});
  windowElement.addEventListener("pointerdown",(event)=>{if(event.target.closest?.("button"))return;dragStart={id:event.pointerId,x:event.clientX,target:recommendTarget};dragMoved=false;windowElement.setPointerCapture?.(event.pointerId);});
  windowElement.addEventListener("pointermove",(event)=>{recommendPointer.x=event.clientX;recommendPointer.y=event.clientY;const card=event.target.closest?.(".series-book");recommendHover=card?Number(card.dataset.virtualIndex):-1;if(dragStart&&dragStart.id===event.pointerId){const dx=event.clientX-dragStart.x;if(Math.abs(dx)>5)dragMoved=true;const h=Math.min(innerHeight*.46,innerWidth*.31,470);recommendTarget=dragStart.target-dx/(h*142/840+h*.03);}});
  windowElement.addEventListener("pointerup",(event)=>{
    if(!dragStart||dragStart.id!==event.pointerId)return;
    dragStart=null;recommendTarget=Math.round(recommendTarget);
    setTimeout(()=>{dragMoved=false;},0);
  });
  windowElement.addEventListener("pointercancel",()=>{dragStart=null;});
  let wheelSnap=0;
  windowElement.addEventListener("wheel",(event)=>{
    event.preventDefault();
    const delta=Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY;
    const h=Math.min(innerHeight*.46,innerWidth*.31,470);recommendTarget+=delta/(h*142/840+h*.03)*.22;
    clearTimeout(wheelSnap);wheelSnap=setTimeout(()=>{recommendTarget=Math.round(recommendTarget);},160);
  },{passive:false});
}

function setupWorksLibraryBorderGlow(){
  const cards=[...document.querySelectorAll(".works-library-grid .library-cover")];
  if(!cards.length)return;
  const palettes=[
    {glow:"190 72 72",colors:["#9ee7ff","#b7f8da","#ffffff"]},
    {glow:"34 88 74",colors:["#ffd7a1","#fff2cf","#b8d7ff"]},
    {glow:"210 58 76",colors:["#b7d7ff","#d9f0ff","#fff8e6"]},
    {glow:"136 74 72",colors:["#b8ffcf","#8bdcff","#f0fff7"]},
    {glow:"22 88 74",colors:["#ffd0a8","#fff0d6","#f8e4ff"]}
  ];
  const gradientPositions=["80% 55%","69% 34%","8% 6%","41% 38%","86% 85%","82% 18%","51% 4%"];
  const gradientKeys=["--gradient-one","--gradient-two","--gradient-three","--gradient-four","--gradient-five","--gradient-six","--gradient-seven"];
  const colorMap=[0,1,2,0,1,2,1];
  const parseGlow=(value)=>{
    const parts=String(value).trim().split(/\s+/).map(Number);
    return {h:parts[0]||40,s:parts[1]||80,l:parts[2]||80};
  };
  const centerOf=(el)=>{const rect=el.getBoundingClientRect();return [rect.width/2,rect.height/2];};
  const edgeProximity=(el,x,y)=>{
    const [cx,cy]=centerOf(el);const dx=x-cx;const dy=y-cy;
    let kx=Infinity;let ky=Infinity;
    if(dx!==0)kx=cx/Math.abs(dx);if(dy!==0)ky=cy/Math.abs(dy);
    return Math.min(Math.max(1/Math.min(kx,ky),0),1);
  };
  const cursorAngle=(el,x,y)=>{
    const [cx,cy]=centerOf(el);const dx=x-cx;const dy=y-cy;
    if(dx===0&&dy===0)return 0;
    let degrees=Math.atan2(dy,dx)*(180/Math.PI)+90;
    if(degrees<0)degrees+=360;
    return degrees;
  };
  cards.forEach((card,index)=>{
    const palette=palettes[index%palettes.length];
    const {h,s,l}=parseGlow(palette.glow);
    const opacities=[100,60,50,40,30,20,10];
    const suffixes=["","-60","-50","-40","-30","-20","-10"];
    card.classList.add("border-glow-card");
    card.style.setProperty("--edge-proximity","0");
    card.style.setProperty("--cursor-angle","45deg");
    card.style.setProperty("--edge-sensitivity","26");
    card.style.setProperty("--color-sensitivity","48");
    card.style.setProperty("--border-radius","28px");
    card.style.setProperty("--glow-padding","42px");
    card.style.setProperty("--cone-spread","24");
    card.style.setProperty("--fill-opacity","0.34");
    opacities.forEach((opacity,i)=>card.style.setProperty(`--glow-color${suffixes[i]}`,`hsl(${h}deg ${s}% ${l}% / ${opacity}%)`));
    gradientKeys.forEach((key,i)=>card.style.setProperty(key,`radial-gradient(at ${gradientPositions[i]}, ${palette.colors[colorMap[i]]} 0px, transparent 52%)`));
    card.style.setProperty("--gradient-base",`linear-gradient(${palette.colors[0]} 0 100%)`);
    if(!card.querySelector(":scope > .edge-light"))card.insertAdjacentHTML("afterbegin",'<span class="edge-light" aria-hidden="true"></span>');
    card.addEventListener("pointermove",(event)=>{
      const rect=card.getBoundingClientRect();const x=event.clientX-rect.left;const y=event.clientY-rect.top;
      card.style.setProperty("--edge-proximity",(edgeProximity(card,x,y)*100).toFixed(3));
      card.style.setProperty("--cursor-angle",`${cursorAngle(card,x,y).toFixed(3)}deg`);
    });
    card.addEventListener("pointerleave",()=>card.style.setProperty("--edge-proximity","0"));
  });
}
function setupExtensionHomeSnapshot(){
  if(window.__ringExtensionSnapshotReady)return;
  window.__ringExtensionSnapshotReady=true;
  const extensionPaths=new Set(["/extensions","/skill-library","/prompt-library","/knowledge-library","/poetry-library","/novel-studio"]);
  document.addEventListener("click",(event)=>{
    const anchor=event.target.closest?.("a[href]");
    if(!anchor)return;
    const target=new URL(anchor.href,location.href);
    if(target.origin!==location.origin||!extensionPaths.has(target.pathname))return;
    try{sessionStorage.setItem("ring:home-history-entry",JSON.stringify({historyLength:history.length,href:location.href,createdAt:Date.now()}));}catch{/* normal navigation remains available */}
  },true);
}
setupWorksLibraryBorderGlow();
setupExtensionHomeSnapshot();
document.querySelector(".carousel-button.left").addEventListener("click", () => moveRecommend(-1));
document.querySelector(".carousel-button.right").addEventListener("click", () => moveRecommend(1));
setupSeriesBookshelf();
let recommendResizeFrame = 0;
addEventListener("resize", () => {
  cancelAnimationFrame(recommendResizeFrame);
  recommendResizeFrame = requestAnimationFrame(updateRecommend);
});
setupNavigation(document.querySelector(".hero"));
initHome().catch((error) => console.error(error));
addEventListener("pageshow",(event)=>{
  const navigation=performance.getEntriesByType("navigation")[0];
  if(!event.persisted&&navigation?.type!=="back_forward")return;
  api("/api/home").then(saveHomePayloadCache).then((fresh)=>{
    if(JSON.stringify(fresh)===JSON.stringify(window.__ringHomePayload))return publishHomePayload(fresh);
    return initHome(fresh);
  }).catch((error)=>console.error(error));
});
