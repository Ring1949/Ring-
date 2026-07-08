const api = async (url, options = {}) => {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "请求失败");
  return payload;
};

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
})[char]);

const mediaMarkup = (path, type = "image", alt = "") => {
  if (!path) return `<div class="media-placeholder"><span>${escapeHtml(alt).slice(0, 2) || "SC"}</span></div>`;
  if (type === "video") return `<video src="${escapeHtml(path)}" controls playsinline preload="metadata"></video>`;
  if (type === "file") return `<a class="file-download-card" href="${escapeHtml(path)}" download><b>↧</b><span>${escapeHtml(alt || "下载文件")}</span></a>`;
  return `<img src="${escapeHtml(path)}" alt="${escapeHtml(alt)}" loading="lazy">`;
};

const heroMediaMarkup = (path, type = "image", alt = "") => {
  if (type === "video") return `<video src="${escapeHtml(path)}" muted autoplay loop playsinline preload="auto" aria-label="${escapeHtml(alt)}"></video>`;
  return mediaMarkup(path, "image", alt);
};

function setupNavigation(hero) {
  const nav = document.querySelector(".nav");
  const update = () => {
    const scrolled = hero ? scrollY >= hero.offsetHeight - 70 : true;
    nav.classList.toggle("nav-scrolled", scrolled);
    nav.classList.toggle("nav-over-hero", !scrolled);
  };
  addEventListener("scroll", update, { passive: true });
  update();
  const button = document.querySelector(".menu-button");
  const links = document.querySelector(".nav-links");
  const closeMenu = () => {
    links?.classList.remove("open");
    button?.setAttribute("aria-expanded","false");
  };
  button?.setAttribute("aria-expanded","false");
  button?.addEventListener("click", () => {
    const open = !links.classList.contains("open");
    links.classList.toggle("open",open);
    button.setAttribute("aria-expanded",String(open));
  });
  links?.querySelectorAll("a").forEach((link) => link.addEventListener("click",closeMenu));
  document.addEventListener("keydown",(event)=>{if(event.key==="Escape")closeMenu();});
  document.addEventListener("click",(event)=>{
    if(!nav.contains(event.target))closeMenu();
  });
}

function openLightbox(path, type = "image", title = "") {
  const box = document.createElement("div");
  box.className = "lightbox";
  box.innerHTML = `<button aria-label="关闭">×</button><div>${mediaMarkup(path, type, title)}<p>${escapeHtml(title)}</p></div>`;
  box.addEventListener("click", (event) => {
    if (event.target === box || event.target.tagName === "BUTTON") box.remove();
  });
  document.body.appendChild(box);
}

function setupAdminLogin() {
  document.querySelectorAll(".admin-login-trigger").forEach((trigger) => {
    trigger.addEventListener("click", () => {
      if (document.querySelector(".admin-login-overlay")) return;
      const overlay = document.createElement("div");
      overlay.className = "admin-login-overlay";
      overlay.innerHTML = `
        <section class="admin-login-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-login-title">
          <button class="admin-login-close" type="button" aria-label="关闭">×</button>
          <div class="admin-login-top"><span>SHANCHUAN LAB</span><b>ADMIN ACCESS</b></div>
          <h2 id="admin-login-title">登录</h2>
          <p>Log in</p>
          <form class="admin-login-form">
            <label><input name="password" type="password" inputmode="numeric" maxlength="64" autocomplete="current-password" placeholder="输入四位密码" required><button class="password-visibility" type="button" aria-label="显示密码" aria-pressed="false"><span></span></button></label>
            <button type="submit" aria-label="进入后台">→</button>
          </form>
          <small>仅限内容管理使用<br>请输入管理员密码进入编辑系统。</small>
          <div class="admin-login-message" aria-live="polite"></div>
        </section>`;
      const close = () => overlay.remove();
      const passwordInput = overlay.querySelector('input[name="password"]');
      const visibilityButton = overlay.querySelector(".password-visibility");
      visibilityButton.addEventListener("pointerdown", (event) => event.preventDefault());
      visibilityButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const showPassword = visibilityButton.getAttribute("aria-pressed") !== "true";
        passwordInput.type = showPassword ? "text" : "password";
        visibilityButton.setAttribute("aria-pressed", String(showPassword));
        visibilityButton.setAttribute("aria-label", showPassword ? "隐藏密码" : "显示密码");
        passwordInput.focus();
      });
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay || event.target.closest(".admin-login-close")) close();
      });
      overlay.querySelector(".admin-login-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = event.submitter;
        const message = overlay.querySelector(".admin-login-message");
        button.disabled = true;
        message.textContent = "正在验证…";
        try {
          const password = new FormData(event.currentTarget).get("password");
          const result = await api("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password })
          });
          if (!result.success && !result.authenticated) throw new Error("登录状态异常");
          location.href = "/admin";
        } catch (error) {
          console.error("后台登录失败：", error);
          message.textContent = error.message || "密码错误";
          button.disabled = false;
        }
      });
      document.body.appendChild(overlay);
      overlay.querySelector("input").focus();
    });
  });
}

const languageDictionary = {
  "首页":"Home","系列作品":"Series","作品库":"Works","关于":"About","进入后台":"Admin",
  "也许你会喜欢":"You may also like","进入更多系列 ↗":"More series ↗","我的作品库":"Works Library",
  "查看全部 ↗":"View all ↗","灵感频道":"Inspiration Channels","摄影":"Photography","平面":"Graphic",
  "空间":"Space","其他":"Other","进入频道 ↗":"Explore ↗","一起做点什么 ↗":"Start a project ↗",
  "作品集":"Works","登录":"Log in","输入四位密码":"Enter 4-digit password"
};
function setupLanguageToggle(){
  const actions=document.querySelector(".nav-actions");
  if(!actions||actions.querySelector(".language-toggle"))return;
  const button=document.createElement("button");
  button.className="language-toggle";
  button.type="button";
  button.setAttribute("aria-label","切换中英文");
  actions.insertBefore(button,actions.querySelector(".admin-login-trigger"));
  const apply=()=>{
    const english=localStorage.getItem("site-language")==="en";
    document.documentElement.lang=english?"en":"zh-CN";
    button.textContent=english?"中":"EN";
    document.querySelectorAll("body *:not(script):not(style):not(.language-toggle)").forEach((element)=>{
      if(element.children.length)return;
      const value=element.textContent.trim();
      if(!value)return;
      if(!element.dataset.zhText)element.dataset.zhText=value;
      const original=element.dataset.zhText;
      const target=english?(languageDictionary[original]||original):original;
      if(element.textContent!==target)element.textContent=target;
    });
    document.querySelectorAll("[placeholder]").forEach((element)=>{
      if(!element.dataset.zhPlaceholder)element.dataset.zhPlaceholder=element.placeholder;
      const target=english?(languageDictionary[element.dataset.zhPlaceholder]||element.dataset.zhPlaceholder):element.dataset.zhPlaceholder;
      if(element.placeholder!==target)element.placeholder=target;
    });
  };
  button.addEventListener("click",()=>{localStorage.setItem("site-language",localStorage.getItem("site-language")==="en"?"zh":"en");apply();});
  new MutationObserver(()=>requestAnimationFrame(apply)).observe(document.body,{childList:true,subtree:true});
  apply();
}

function setupThemeToggle(){
  const host=document.querySelector(".nav-actions")||document.querySelector(".works-nav")||document.querySelector(".main-nav");
  if(!host||host.querySelector(".theme-toggle"))return;
  const button=document.createElement("button");
  button.className="theme-toggle";
  button.type="button";
  button.setAttribute("aria-label","切换日间 / 夜间模式");
  const target=host.querySelector(".admin-login-trigger")||host.querySelector(".menu-button")||null;
  const getTheme=()=>localStorage.getItem("site-theme")||"light";
  const apply=()=>{
    const theme=getTheme();
    document.documentElement.dataset.theme=theme;
    button.dataset.theme=theme;
    button.innerHTML=theme==="dark"?"<span>☾</span>":"<span>☼</span>";
    button.setAttribute("aria-pressed",String(theme==="dark"));
    button.setAttribute("title",theme==="dark"?"切换到白天":"切换到黑夜");
  };
  button.addEventListener("click",()=>{
    localStorage.setItem("site-theme",getTheme()==="dark"?"light":"dark");
    apply();
  });
  if(target)host.insertBefore(button,target);else host.appendChild(button);
  apply();
}
setupAdminLogin();
setupThemeToggle();
setupLanguageToggle();
