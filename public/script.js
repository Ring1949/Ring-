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
      settings.contact_email && ["邮箱",settings.contact_email,`mailto:${settings.contact_email}`],
      settings.wechat && ["微信",settings.wechat,""],
      settings.xiaohongshu && ["小红书","查看主页",settings.xiaohongshu],
      settings.instagram && ["Instagram","查看主页",settings.instagram],
      settings.behance && ["Behance","查看主页",settings.behance]
    ].filter(Boolean);
    overlay.innerHTML = `<section class="contact-dialog" role="dialog" aria-modal="true"><button class="contact-dialog-close" type="button">×</button>
      <p>CONTACT / SHANCHUAN</p><h2>${escapeHtml(settings.contact_title||"联系我")}</h2>
      <span>${escapeHtml(settings.contact_intro||"如果你想聊聊新的合作，可以通过下面的方式找到我。")}</span>
      ${settings.contact_location?`<small>${escapeHtml(settings.contact_location)}</small>`:""}
      <div class="contact-methods">${methods.map(([label,value,href])=>href?`<a href="${escapeHtml(href)}" ${href.startsWith("http")?'target="_blank" rel="noreferrer"':""}><b>${label}</b><span>${escapeHtml(value)}</span><i>↗</i></a>`:`<button type="button" data-copy-contact="${escapeHtml(value)}"><b>${label}</b><span>${escapeHtml(value)}</span><i>复制</i></button>`).join("")}</div><div class="contact-copy-status"></div></section>`;
    overlay.onclick = async (e) => { if(e.target===overlay||e.target.closest(".contact-dialog-close")) overlay.remove(); const copy=e.target.closest("[data-copy-contact]"); if(copy){await navigator.clipboard.writeText(copy.dataset.copyContact);overlay.querySelector(".contact-copy-status").textContent="已复制到剪贴板";} };
    document.body.appendChild(overlay);
  };
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

  recommended = home.recommended.length ? home.recommended : (home.featured.length ? home.featured : (home.database_preview || []));
  recommendVirtualItems = recommended.length > 1 ? [...recommended, ...recommended, ...recommended] : [...recommended];
  recommendIndex = recommended.length > 1 ? recommended.length : 0;
  document.querySelector("#recommend-track").innerHTML = recommendVirtualItems.map((item, index) => {
    const realIndex = recommended.length ? index % recommended.length : index;
    const isMedia = !item.cover_image && item.file_path;
    const title = item.title || item.original_name || "未命名作品";
    const subtitle = item.subtitle || item.description || item.category_name || "MEDIA ARCHIVE";
    const mediaPath = item.cover_image || item.file_path || "";
    const mediaType = item.media_type || item.file_type || "image";
    const href = isMedia ? `/works.html?category=${encodeURIComponent(item.category_slug || "all")}` : `/project.html?id=${item.id}`;
    return `
    <a class="recommend-card ${index === recommendIndex ? "current" : ""}" href="${href}">
      <div class="card-media ${fallbackCovers[(realIndex + 2) % fallbackCovers.length]}">${mediaMarkup(mediaPath, mediaType, title)}</div>
      <div class="recommend-info"><b>${String(realIndex + 1).padStart(2, "0")}</b><div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(subtitle)}</p></div></div>
    </a>`;
  }).join("");
  document.querySelector(".recommend-window")?.classList.toggle("is-empty", !recommended.length);
  updateRecommend();

  const inspirationChannels = [
    ["摄影","PHOTOGRAPHY","●"],["平面","GRAPHIC","◆"],
    ["空间","SPACE","□"],["AI","GENERATIVE","✦"],["其他","OTHER","＋"]
  ];
  document.querySelector("#channel-list").innerHTML = inspirationChannels.map(([name,label,icon], index) => `
    <a class="channel" href="/inspiration.html">
      <div class="channel-index">0${index+1}</div><div class="channel-icon">${icon}</div>
      <h3>${name}</h3><p>${label} · 尚未添加内容</p><span>进入灵感库 ↗</span>
    </a>`).join("");
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
document.querySelector(".carousel-button.left").addEventListener("click", () => moveRecommend(-1));
document.querySelector(".carousel-button.right").addEventListener("click", () => moveRecommend(1));
addEventListener("resize", updateRecommend);
setupNavigation(document.querySelector(".hero"));
initHome().catch((error) => console.error(error));
