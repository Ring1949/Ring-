const fallbackCovers = ["visual-a","visual-b","visual-c","visual-d","visual-e"];
let recommended = [];
let recommendIndex = 0;
let recommendVirtualItems = [];

async function initHome() {
  const home = await api("/api/home");
  const { settings, categories, hero } = home;
  document.querySelectorAll("[data-category-cover]").forEach((container) => {
    const category = categories.find((item) => item.slug === container.dataset.categoryCover);
    const image = container.querySelector("img");
    image.onerror = () => { image.onerror = null; image.src = "/assets/archive-collage.png"; };
    image.src = category?.cover_image || "/assets/archive-collage.png";
  });
  document.title = `${settings.site_name || "山川止行"} — 个人视觉档案`;
  document.querySelector("#hero-title").textContent = settings.hero_title || settings.site_name;
  document.querySelector("#hero-subtitle").textContent = settings.hero_subtitle || "";
  document.querySelector("#hero-kicker").textContent = settings.hero_kicker || "";
  document.querySelector("#intro-text").innerHTML = escapeHtml(settings.intro_text || "").replace(/\n/g,"<br>");
  document.querySelector("#about-kicker").textContent = settings.about_kicker || "";
  document.querySelector("#about-title").innerHTML = escapeHtml(settings.about_title || "").replace(/\n/g,"<br>");
  document.querySelector("#about-text").textContent = settings.about_text || "";
  document.querySelector("#contact-link").textContent = settings.contact_button_text || "一起做点什么 ↗";
  document.querySelector("#contact-link").href = "#contact";
  document.querySelector("#contact-link").onclick = (event) => {
    event.preventDefault();
    const old = document.querySelector(".contact-overlay"); if (old) old.remove();
    const overlay = document.createElement("div"); overlay.className = "contact-overlay";
    const methods = [
      ["电话","18569569185","tel:18569569185"],
      settings.contact_email && ["邮箱",settings.contact_email,`mailto:${settings.contact_email}`],
      settings.wechat && ["微信",settings.wechat,""],
      settings.xiaohongshu && ["小红书","查看主页",settings.xiaohongshu],
      settings.instagram && ["Instagram","查看主页",settings.instagram],
      settings.behance && ["Behance","查看主页",settings.behance]
    ].filter(Boolean);
    overlay.innerHTML = `<section class="contact-fullscreen" role="dialog" aria-modal="true"><button class="contact-dialog-close contact-fullscreen-close" type="button">×</button>
      <div class="contact-lanyard-zone" aria-label="RING 工作证">
        <div class="contact-ceiling"></div>
        <div class="lanyard-cord contact-cord"><i></i><i></i></div>
        <article class="lanyard-badge contact-draggable-badge">
          <div class="lanyard-clip"><span></span></div>
          <div class="lanyard-photo"><img src="/assets/ring-profile-lanyard.jpg" alt="RING"></div>
          <div class="lanyard-info">
            <img class="lanyard-logo" src="/assets/ring-logo-transparent.png" alt="Ring logo">
            <small>SHANCHUAN VISUAL ARCHIVE</small>
            <h3>RING</h3>
            <p>独立设计师 / 摄影 / 视觉创作者</p>
            <dl><dt>TEL</dt><dd><a href="tel:18569569185">18569569185</a></dd><dt>ROLE</dt><dd>Portfolio Owner</dd><dt>BASE</dt><dd>Wuhan · China</dd></dl>
          </div>
        </article>
      </div>
      <aside class="contact-fullscreen-info"><p>CONTACT</p><h2>${escapeHtml(settings.contact_title||"联系我")}</h2>
      <span>${escapeHtml(settings.contact_intro||"如果你想聊聊新的合作，可以通过下面的方式找到我。")}</span>
      ${settings.contact_location?`<small>${escapeHtml(settings.contact_location)}</small>`:""}
      <div class="contact-methods">${methods.map(([label,value,href])=>href?`<a href="${escapeHtml(href)}" ${href.startsWith("http")?'target="_blank" rel="noreferrer"':""}><b>${label}</b><span>${escapeHtml(value)}</span><i>↗</i></a>`:`<button type="button" data-copy-contact="${escapeHtml(value)}"><b>${label}</b><span>${escapeHtml(value)}</span><i>复制</i></button>`).join("")}</div><div class="contact-copy-status"></div></aside></section>`;    overlay.onclick = async (e) => { if(e.target===overlay||e.target.closest(".contact-dialog-close")) overlay.remove(); const copy=e.target.closest("[data-copy-contact]"); if(copy){await navigator.clipboard.writeText(copy.dataset.copyContact);overlay.querySelector(".contact-copy-status").textContent="已复制到剪贴板";} };
    document.body.appendChild(overlay);
    const badge = overlay.querySelector(".contact-draggable-badge");
    const cord = overlay.querySelector(".contact-cord");
    let dragging=false, startX=0, startY=0, dx=0, dy=0;
    const applyBadge=()=>{
      badge.style.setProperty("--drag-x", `${dx}px`);
      badge.style.setProperty("--drag-y", `${dy}px`);
      badge.style.setProperty("--lanyard-ry", `${dx * .035}deg`);
      badge.style.setProperty("--lanyard-rx", `${dy * -.02}deg`);
      cord.style.setProperty("--cord-rotate", `${dx * .018}deg`);
    };
    badge?.addEventListener("pointerdown",(event)=>{dragging=true;badge.setPointerCapture(event.pointerId);startX=event.clientX-dx;startY=event.clientY-dy;badge.classList.add("is-dragging");});
    badge?.addEventListener("pointermove",(event)=>{if(!dragging)return;dx=(event.clientX-startX)*.72;dy=Math.max(-70,Math.min(170,(event.clientY-startY)*.72));applyBadge();});
    badge?.addEventListener("pointerup",()=>{dragging=false;dx=0;dy=0;badge.classList.remove("is-dragging");applyBadge();});
    badge?.addEventListener("pointercancel",()=>{dragging=false;dx=0;dy=0;badge.classList.remove("is-dragging");applyBadge();});  };
  document.querySelector("#footer-email").textContent = `EMAIL · ${settings.contact_email || ""}`;
  document.querySelector("#footer-logo").textContent = settings.site_name || "山川止行";
  document.querySelector("#footer-text").textContent = settings.footer_text || "";
  document.querySelector("#footer-copyright").textContent = settings.footer_copyright || "";
  const socialLinks = [
    ["小红书",settings.xiaohongshu],["Instagram",settings.instagram],["Behance",settings.behance]
  ].filter(([,href]) => href);
  document.querySelector("#footer-links").innerHTML = [
    `<a href="/series.html">系列作品</a>`,`<a href="/works.html?category=all">作品库</a>`,`<a href="/inspiration.html">灵感库</a>`,`<a href="#about">关于</a>`,
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

  recommended = home.recommended || [];
  recommendVirtualItems = recommended.length > 1 ? [...recommended, ...recommended, ...recommended] : [...recommended];
  recommendIndex = recommended.length > 1 ? recommended.length : 0;
  document.querySelector("#recommend-track").innerHTML = recommendVirtualItems.map((project, index) => {
    const realIndex = recommended.length ? index % recommended.length : index;
    const title = project.title || "未命名系列";
    const subtitle = project.subtitle || project.description || project.category_name || "SERIES ARCHIVE";
    const mediaPath = project.series_cover || project.cover_image || "";
    const mediaType = project.series_media_type || "image";
    return `
    <a class="recommend-card ${index === recommendIndex ? "current" : ""}" href="/project.html?id=${project.id}">
      <div class="card-media ${fallbackCovers[(realIndex + 2) % fallbackCovers.length]}">${mediaMarkup(mediaPath, mediaType, title)}</div>
      <div class="recommend-info"><b>${String(realIndex + 1).padStart(2, "0")}</b><div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(subtitle)}</p></div></div>
    </a>`;
  }).join("");
  document.querySelector(".recommend-window")?.classList.toggle("is-empty", !recommended.length);
  updateRecommend();

  const inspirationChannels = [
    ["摄影","PHOTOGRAPHY","photo"],["平面","GRAPHIC","graphic"],
    ["空间","SPACE","space"],["AI","GENERATIVE","ai"],["其他","OTHER","other"]
  ];
  document.querySelector("#channel-list").innerHTML = inspirationChannels.map(([name,label,slug], index) => `
    <button class="channel" type="button" data-explore-channel="${slug}">
      <div class="channel-index">0${index+1}</div><div class="channel-icon">•</div>
      <h3>${name}</h3><p>${label}</p><span>进入探索模式 ↗</span>
    </button>`).join("");
  setupHomeExploreChannels();
}


function setupHomeExploreChannels(){
  document.querySelectorAll("[data-explore-channel]").forEach((button)=>{
    button.addEventListener("click",(event)=>{
      event.preventDefault();
      const slug=button.dataset.exploreChannel;
      if(slug!=="photo"){ location.href="/inspiration.html"; return; }
      openHomeExploreMode();
    });
  });
}

async function openHomeExploreMode(){
  const old=document.querySelector(".home-explore-overlay"); if(old) old.remove();
  document.querySelector(".nav")?.classList.add("nav-hidden-explore");
  const overlay=document.createElement("section");
  overlay.className="home-explore-overlay";
  const secondary=["Humanity","News","Landscape","Commercial","Portrait","Campus","Documentary","Travel"];
  overlay.innerHTML=`<button class="home-explore-close" type="button">Exit</button><div class="home-explore-stars"></div><div class="home-explore-center"><i></i><b>Photography</b></div><svg class="home-explore-lines" viewBox="0 0 100 100" preserveAspectRatio="none">${secondary.map((_,i)=>{const a=(i/secondary.length)*Math.PI*2-Math.PI/2;const x=50+Math.cos(a)*31;const y=50+Math.sin(a)*23;return `<line x1="50" y1="50" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}"></line>`}).join("")}</svg>${secondary.map((name,i)=>{const a=(i/secondary.length)*Math.PI*2-Math.PI/2;const x=50+Math.cos(a)*31;const y=50+Math.sin(a)*23;return `<a class="home-explore-node" href="/inspiration.html" style="left:${x}%;top:${y}%;--d:${i*.08}s"><i></i><span>${name}</span></a>`}).join("")}`;
  overlay.querySelector(".home-explore-close").addEventListener("click",()=>{overlay.remove();document.querySelector(".nav")?.classList.remove("nav-hidden-explore");});
  document.body.appendChild(overlay);
}
function projectCard(project, index, main) {
  return `<a class="project-card ${main ? "project-main" : ""}" href="/project.html?id=${project.id}">
    <div class="card-media ${fallbackCovers[index % fallbackCovers.length]}">${mediaMarkup(project.cover_image, "image", project.title)}</div>
    <div class="project-copy"><h3>${escapeHtml(project.title)}</h3><p>${escapeHtml(project.subtitle)}</p><span>${escapeHtml(project.year || project.category_name || "")}</span></div>
  </a>`;
}

function updateRecommend() {
  const track = document.querySelector("#recommend-track");
  const cards = [...track.children];
  if (!cards.length) return;
  const width = cards[0].getBoundingClientRect().width;
  const gap = innerWidth <= 600 ? 20 : 60;
  track.style.transform = `translateX(${innerWidth / 2 - width / 2 - recommendIndex * (width + gap)}px)`;
  cards.forEach((card, index) => card.classList.toggle("current", index === recommendIndex));
}
function moveRecommend(direction) {
  if (recommended.length <= 1) return;
  recommendIndex += direction;
  updateRecommend();
  const track = document.querySelector("#recommend-track");
  clearTimeout(moveRecommend.timer);
  moveRecommend.timer = setTimeout(() => {
    if (recommendIndex < recommended.length) recommendIndex += recommended.length;
    if (recommendIndex >= recommended.length * 2) recommendIndex -= recommended.length;
    track.style.transition = "none";
    updateRecommend();
    requestAnimationFrame(() => { track.style.transition = ""; });
  }, 420);
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
setupWorksLibraryBorderGlow();
document.querySelector(".carousel-button.left").addEventListener("click", () => moveRecommend(-1));
document.querySelector(".carousel-button.right").addEventListener("click", () => moveRecommend(1));
addEventListener("resize", updateRecommend);
setupNavigation(document.querySelector(".hero"));
initHome().catch((error) => console.error(error));
