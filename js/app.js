/* ============================================================
   app.js — 主应用逻辑
   ============================================================ */
const App = (() => {

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  /* ---------- 工具函数 ---------- */
  const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const PRIORITY_MAP = { high: "高", mid: "中", low: "低" };
  const STATUS_MAP = { todo: "待完成", doing: "进行中", done: "已完成" };

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* ---------- 外链统一出口 ----------
     ⚠️ 绝不允许 location.href 直接导航主窗口：桌面 pywebview 壳里 window.open
     可能返回 null，旧代码兜底 location.href 会把整个星屿导航到外部网站，
     顶栏/侧边栏/退出按钮全部消失 —— 用户看到的就是「进入新闻界面退不出、
     没有退出按钮」（2026-09-04 用户报障的真根因）。
     规则：桌面壳（window.pywebview 存在）→ 服务端 /api/open-url 用系统默认
     浏览器开；普通浏览器 → window.open，被拦截就 toast + 复制链接，永不导航。 */
  async function openExternal(url) {
    try {
      // 相对路径（如 /avatar-lab.html）先解析成同源绝对地址
      url = new URL(url, location.href).href;
      if (!/^https?:/i.test(url)) { toast("仅支持 http(s) 链接", "err"); return; }
      if (window.pywebview && window.pywebview.api) {
        // 桌面壳：同源服务端用系统浏览器打开（同一台电脑，行为正确）
        try {
          const r = await fetch("/api/open-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url })
          });
          if (r.ok) { toast("已在系统浏览器打开链接", "ok"); return; }
        } catch (e) { /* 服务端失败则继续走浏览器路径 */ }
      }
      const win = window.open(url, "_blank", "noopener");
      if (win) return;
      // 弹窗被拦截：复制链接让用户自己开，绝不导航主窗口
      try { await navigator.clipboard.writeText(url); toast("浏览器拦截了弹窗，链接已复制，请粘贴到浏览器打开", "err"); }
      catch (e) { toast("浏览器拦截了弹窗，请允许弹窗后重试：" + url, "err"); }
    } catch (e) {
      toast("打开链接失败：" + (e.message || e), "err");
    }
  }
  window.openExternal = openExternal;
  function fmtDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }
  function fmtDateFull(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function daysUntil(iso) {
    if (!iso) return null;
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const d = new Date(iso); d.setHours(0, 0, 0, 0);
    return Math.ceil((d - now) / 86400000);
  }
  function localDateKey(value = new Date()) {
    const d = value instanceof Date ? new Date(value) : new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function todayISO() {
    return localDateKey();
  }
  // 记录正在显示的 toast（按 key 去重，避免重复点击时堆叠）
  const _toastActive = new Map();

  function dismissToast(key) {
    const t = _toastActive.get(key);
    if (!t) return;
    _toastActive.delete(key);
    const el = t.el;
    el.classList.add("hide");
    t.timer2 = setTimeout(() => el.remove(), 280);
  }

  function toast(msg, type = "", options = {}) {
    options = options || {};
    let wrap = $("#toastWrap");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "toastWrap";
      wrap.setAttribute("aria-live", "polite");
      wrap.setAttribute("aria-atomic", "false");
      document.body.appendChild(wrap);
    }

    const duration = options.duration || 3200;
    const key = options.key || (type + "|" + msg);

    // 同 key 已存在：复用该元素，仅刷新内容与倒计时（不会堆出多个）
    if (_toastActive.has(key)) {
      const t = _toastActive.get(key);
      t.el.querySelector(".toast-msg").textContent = msg;
      t.el.className = "toast " + type + " show";
      const bar = t.el.querySelector(".toast-bar");
      bar.style.transition = "none";
      bar.style.transform = "scaleX(1)";
      void t.el.offsetWidth;                       // 强制回流，让进度条从头开始
      bar.style.transition = "transform " + duration + "ms linear";
      bar.style.transform = "scaleX(0)";
      clearTimeout(t.timer1);
      clearTimeout(t.timer2);
      t.timer1 = setTimeout(() => dismissToast(key), duration);
      t.el.classList.remove("pop"); void t.el.offsetWidth; t.el.classList.add("pop"); // 轻微弹动反馈
      return t.el;
    }

    // 限制同时显示的条数，超出则移除最旧的一条，防止无限堆叠
    while (wrap.children.length >= 4) {
      const oldest = wrap.firstElementChild;
      if (oldest && oldest.dataset && oldest.dataset.key) _toastActive.delete(oldest.dataset.key);
      if (oldest) oldest.remove();
    }

    const el = document.createElement("div");
    el.className = "toast " + type;
    el.dataset.key = key;
    el.setAttribute("role", type === "err" ? "alert" : "status");

    const icon = document.createElement("span");
    icon.className = "toast-icon";
    icon.textContent = type === "err" ? "✕" : (type === "ok" ? "✓" : "ℹ");
    el.appendChild(icon);

    const text = document.createElement("span");
    text.className = "toast-msg";
    text.textContent = msg;
    el.appendChild(text);

    if (options.actionLabel && typeof options.onAction === "function") {
      const action = document.createElement("button");
      action.className = "toast-action";
      action.textContent = options.actionLabel;
      action.onclick = () => {
        options.onAction();
        el.remove();
        const cur = _toastActive.get(key);
        if (cur && cur.el === el) _toastActive.delete(key);
      };
      el.appendChild(action);
    }

    const bar = document.createElement("span");
    bar.className = "toast-bar";
    el.appendChild(bar);

    wrap.appendChild(el);
    requestAnimationFrame(() => {
      el.classList.add("show");
      bar.style.transform = "scaleX(1)";
      void bar.offsetWidth;                        // 回流后开始倒计时动画
      bar.style.transition = "transform " + duration + "ms linear";
      bar.style.transform = "scaleX(0)";
    });

    const rec = { el, timer1: null, timer2: null };
    rec.timer1 = setTimeout(() => dismissToast(key), duration);
    _toastActive.set(key, rec);
    return el;
  }

  /* ---------- 视图切换（iOS 风格：进入动画可重复触发） ---------- */
  let currentView = "dashboard";
  // dashboard 完整开场只播一次，之后切回仅轻量入场
  let _dashboardIntroPlayed = false;
  // —— 毛玻璃抑制窗口（入场/视图切换/滚动共用，顶层作用域，init 与 switchView 均引用）——
  let _fxRestoreTimer = null;
  let bootEntrance = false; // 启动入场期间为 true：视图切换不抢跑毛玻璃恢复
  // 恢复（防抖）：500ms 内无新抑制请求才真正移除抑制类。
  // 注意：① 不能用 *{transition:...!important} 做渐显——它会覆盖全站所有元素
  // 的 transform 过渡（侧边栏滑块、入场动画全变瞬移）；
  // ② 移除操作必须同步执行，不能包在 requestAnimationFrame 里
  // （rAF 被节流/冻结时 entrance-fx 将永远残留，全站毛玻璃失效）。
  function restoreBackdropFX() {
    clearTimeout(_fxRestoreTimer);
    _fxRestoreTimer = setTimeout(function () {
      if (!document.documentElement.classList.contains("entrance-fx")) return;
      document.documentElement.classList.remove("entrance-fx");
    }, 500);
  }
  // —— 滚动期间抑制毛玻璃 ——
  // 固定悬浮的侧边栏/顶栏毛玻璃在滚动时会逐帧重采样滚动的背景，
  // 是「用一会儿就卡」的主要来源。滚动中关闭，停止 350ms 后平滑渐显。
  let _scrollingTimer = null;
  let _scrolling = false;
  function onViewScroll() {
    // 模态框内部滚动不应影响全局毛玻璃，否则设置页会出现背景忽清忽糊。
    if (document.body.classList.contains("modal-open")) return;
    if (!_scrolling) {
      _scrolling = true;
      document.documentElement.classList.add("entrance-fx");
    }
    clearTimeout(_scrollingTimer);
    _scrollingTimer = setTimeout(function () {
      _scrolling = false;
      restoreBackdropFX();
    }, 350);
  }
  function bindScrollFX() {
    const containers = $$(".view-container, .view, [class*='list']");
    containers.forEach(function (el) {
      el.addEventListener("scroll", onViewScroll, { passive: true });
    });
    window.addEventListener("scroll", onViewScroll, { passive: true });
  }
  // iframe 子应用（工具箱/粒子星云/棱镜艺境/折艺工坊/守御界/云门智界）内存管理。
  // 实测：逐个点过去堆内存 3.9MB → 21.9MB 且单调不回落，因为这些 iframe 加载后
  // 从不销毁。切走时置 about:blank 释放其 JS 堆，切回时还原 src。
  // 原始地址存 data-iframe-src，避免硬编码到 JS 里。
  const IFRAME_VIEWS = ["toolknit", "nexus", "prisma", "securify", "foldcraft", "particles", "aria"];
  let _iframeUnloadTimer = null;

  function primeIframeSrcs() {
    IFRAME_VIEWS.forEach(function (name) {
      const box = document.getElementById("view-" + name);
      if (!box) return;
      const frame = box.querySelector("iframe");
      if (frame && (frame.getAttribute("data-iframe-src") || frame.getAttribute("src"))) frame.dataset.iframeSrc = frame.getAttribute("data-iframe-src") || frame.getAttribute("src");
    });
  }
  function unloadIframe(name) {
    const box = document.getElementById("view-" + name);
    if (!box) return;
    const frame = box.querySelector("iframe");
    if (!frame) return;
    const cur = frame.getAttribute("src");
    if (cur && cur !== "about:blank") frame.setAttribute("src", "about:blank");
  }
  function loadIframe(name) {
    const box = document.getElementById("view-" + name);
    if (!box) return;
    const frame = box.querySelector("iframe");
    if (!frame) return;
    const want = frame.dataset.iframeSrc;
    if (want && frame.getAttribute("src") !== want) frame.setAttribute("src", want);
  }

  // 侧边栏「跑步训练 / 训练营」两个入口共用 data-view="running"，
  // 高亮要跟着当前 tab 走，否则会出现「两个都亮」或「点了训练营却亮跑步」的错位。
  function syncRunningNavHighlight(onCamp) {
    $$(".nav-item").forEach(n => {
      if (n.dataset.view !== "running") return;
      const on = !!n.dataset.camp === !!onCamp;
      n.classList.toggle("active", on);
      if (on) n.setAttribute("aria-current", "page");
      else n.removeAttribute("aria-current");
    });
  }

  function switchView(view) {
    if (view === currentView) { renderCurrent(); return; }
    const prev = $("#view-" + currentView);
    const prevName = currentView;
    currentView = view;
    $$(".view").forEach(v => v.classList.remove("active"));
    $$(".nav-item").forEach(n => {
      // ⚠️ 侧边栏有两个 data-view="running"（跑步训练 / 训练营快捷入口），
      // 旧写法按 data-view 相等匹配会让两个同时高亮、且都打上 aria-current="page"
      // （无障碍规范同一时刻只允许一个）。训练营带 data-camp，不参与导航高亮。
      const active = n.dataset.view === view && !n.dataset.camp;
      n.classList.toggle("active", active);
      if (active) n.setAttribute("aria-current", "page");
      else n.removeAttribute("aria-current");
    });
    $$(".mobile-tab").forEach(tab => {
      const target = tab.dataset.mobileView;
      const active = target === view || (target === "more" && !["dashboard", "courses", "notes", "focus"].includes(view));
      tab.classList.toggle("active", active);
      if (active) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    });
    // 离开 iframe 视图：延迟卸载，等入场动画落定再释放，避免中途白屏闪烁
    clearTimeout(_iframeUnloadTimer);
    if (IFRAME_VIEWS.indexOf(prevName) >= 0 && prevName !== view) {
      _iframeUnloadTimer = setTimeout(function () { unloadIframe(prevName); }, 500);
    }
    // 进入 iframe 视图：还原 src（首次由 loading="lazy" 自行加载）
    if (IFRAME_VIEWS.indexOf(view) >= 0) loadIframe(view);

    // AI 球体按需启动：首次进入 AI 视图才加载 WebGL，避免拖慢开屏后的整体交互
    if (view === "ai" && window.__bootAiOrb) window.__bootAiOrb();
    const v = $("#view-" + view);
    if (v) {
      v.classList.add("active");
      // 视图切换同样触发「集中首光栅」：新视图内全部毛玻璃卡片在 display:none→block
      // 瞬间同时光栅化，核显会卡顿（诊断显示每次切视图 2s+ / 帧率掉到个位数）。
      // 复用入场窗口：切视图期间抑制毛玻璃，动画 + 首屏光栅落定后平滑渐显。
      // （启动入场期间由 boot 流程统一管理恢复，这里不抢跑）
      document.documentElement.classList.add("entrance-fx");
      if (!bootEntrance) setTimeout(restoreBackdropFX, 900);
      // dashboard 完整开场仅首次播放，后续切回用轻量入场，避免数字反复重滚
      if (view === "dashboard" && window.Anim) {
        if (!_dashboardIntroPlayed) { Anim.dashboardIntro(v); _dashboardIntroPlayed = true; }
        else Anim.viewEnter(v);
      }
      else window.Anim && Anim.viewEnter(v);
    }
    const titles = { aria: t("title.aria"), dashboard: t("title.dashboard"), courses: t("title.courses"), notes: t("title.notes"), focus: t("title.focus"), growth: t("title.growth"), lit: t("title.lit"), news: t("title.news"), ai: t("title.ai"), weather: t("title.weather"), prisma: t("title.prisma"), nexus: t("title.nexus"), foldcraft: t("title.foldcraft"), securify: t("title.securify"), particles: t("title.particles"), running: t("title.running"), voice: "AI 语音", toolknit: "工具箱", exams: "考试日程" };
    const subs = { dashboard: t("sub.dashboard"), courses: t("sub.courses"), notes: t("sub.notes"), focus: t("sub.focus"), growth: t("sub.growth"), lit: t("sub.lit"), news: t("sub.news"), ai: t("sub.ai"), weather: t("sub.weather"), prisma: t("sub.prisma"), nexus: t("sub.nexus"), foldcraft: t("sub.foldcraft"), securify: t("sub.securify"), particles: t("sub.particles"), running: t("sub.running"), voice: "文本转语音 · VoxCPM", toolknit: "常用小工具合集", exams: "考试与日程管理" };
    $("#pageTitle").textContent = titles[view] || "";
    const sub = $("#pageSub");
    if (sub) sub.textContent = subs[view] || "";
    $("#view-container") && $("#view-container").scrollTo(0, 0);
    document.querySelector(".view-container").scrollTop = 0;
    // 清理旧视图的滚动 reveal（切走后不再保留 trigger）
    if (_revealCleanup) { _revealCleanup(); _revealCleanup = null; }
    // 视图内容构建拆到下一帧：入场动画（0.42s）期间填充内容视觉无感，
    // 但主线程立即释放，点击响应与首帧不再被整视图 innerHTML 构建卡住。
    requestAnimationFrame(function () {
      renderCurrent();
      // 视图从 display:none 变为 block 后重算 ScrollTrigger 位置（须在内容填充后）
      window.Anim && Anim.refreshScroll();
    });
    // 侧边栏滑块跟随到目标项
    window.Anim && Anim.navPillTo(view, true);
    // 切换后 600ms 再瞬时校准一次：badge 数字/滚动条变化会让项宽高微调，
    // 滑块按校准后几何对齐，避免高亮块与激活项出现几像素错位
    setTimeout(function () { window.Anim && Anim.navPillTo(view, false); }, 600);
  }

  function renderCurrent() {
    if (currentView === "dashboard") renderDashboard();
    else if (currentView === "courses") renderCourses();
    else if (currentView === "notes") renderNotes();
    else if (currentView === "focus") renderFocus();
    else if (currentView === "growth") renderGrowth();
    else if (currentView === "lit") renderLit();
    else if (currentView === "news") renderNews();
    else if (currentView === "weather") { if (window.Weather) Weather.renderCities(); }
    else if (currentView === "exams") renderExams();
    else if (currentView === "ai") renderAIStatus();
    else if (currentView === "running") {
      if (window.Running) Running.render();
      if (window.Synapse) Synapse.render();
    }
    else if (currentView === "voice") { if (window.VoxVoice) VoxVoice.render(); }
  }

  /* ---------- 长列表滚动分批浮入（ScrollTrigger） ---------- */
  let _revealCleanup = null;
  function revealCards(container, selector) {
    if (_revealCleanup) { _revealCleanup(); _revealCleanup = null; }
    if (window.Anim) _revealCleanup = Anim.scrollReveal(container, selector);
  }

  /* ============================================================
     仪表盘
     ============================================================ */
  /* ============================================================
     每日一言（励志 / 热梗 / 毒鸡汤）
     ============================================================ */
  function renderQuote() {
    const box = $("#dailyQuote");
    const textEl = $("#quoteText");
    const catEl = $("#quoteCat");
    if (!box || !textEl) return;
    const q = window.getDailyQuote ? getDailyQuote() : null;
    if (!q) { box.style.display = "none"; return; }
    box.style.display = "";
    textEl.textContent = q.text;
    if (catEl) catEl.textContent = t("quote.cat." + q.cat);
    // 换句淡入：anime 逐字浮现接管主文本（避免与 GSAP 整体淡入叠加成双重透明度）
    if (window.AnimeFX && AnimeFX.hasAnime) {
      AnimeFX.quoteReveal(textEl);
      if (window.Anim && catEl) Anim.quoteIn(catEl);
    } else if (window.Anim) {
      Anim.quoteIn(textEl);
      if (catEl) Anim.quoteIn(catEl);
    }
  }

  /* ============================================================
     今日热点（hero 卡片内入口，取自每日新闻数据）
     ============================================================ */
  async function renderHeroNews() {
    const box = $("#heroNews");
    if (!box) return;
    const data = await loadNews(false);
    if (!data || !data.news || !data.news.length) { box.style.display = "none"; return; }
    const items = data.news.slice(0, 3);
    box.style.display = "";
    box.innerHTML = `
      <div class="hero-news-head">
        <span class="hero-news-label">${t("hero.news")}</span>
        <span class="hero-news-actions">
          <button class="text-btn" id="btnHeroNewsRefresh">↻ ${t("hero.refresh")}</button>
          <button class="text-btn" data-goto="news">${t("hero.newsAll")} →</button>
        </span>
      </div>
      <div class="hero-news-list">
        ${items.map((n, i) => `
          <a class="hero-news-item" href="${esc(n.link)}" title="${esc(n.title)}">
            <span class="hero-news-rank">${i + 1}</span>
            <span class="hero-news-text">${esc(n.title)}</span>
            <span class="hero-news-src">${esc(n.source || "")}</span>
          </a>`).join("")}
      </div>`;
    // ⚠️ 去掉 target="_blank"：pywebview 壳里 <a target=_blank> 行为不可控，
    // 可能原地导航把整个应用顶掉。统一拦截点击走 openExternal。
    box.querySelectorAll(".hero-news-item").forEach(a => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        openExternal(a.getAttribute("href"));
      });
    });
    const go = box.querySelector("[data-goto='news']");
    if (go) go.onclick = () => switchView("news");
    // 刷新：重新拉取新闻数据并更新热点与新闻页
    const refreshBtn = box.querySelector("#btnHeroNewsRefresh");
    if (refreshBtn) refreshBtn.onclick = async () => {
      refreshBtn.disabled = true;
      refreshBtn.textContent = "…";
      await loadNews(true);
      await renderHeroNews();
      if (currentView === "news") renderNews();
      refreshBtn.disabled = false;
      refreshBtn.textContent = "↻ " + t("hero.refresh");
      toast(t("hero.refreshed"), "ok", { key: "hero-news-refreshed", duration: 2000 });
    };
  }

  function getNextCourse(courses) {
    const now = new Date();
    const today = now.getDay() || 7;
    const currentMin = now.getHours() * 60 + now.getMinutes();
    return courses.map(course => {
      const start = String(course.start || "00:00").split(":").map(Number);
      const end = String(course.end || course.start || "00:00").split(":").map(Number);
      const startMin = (start[0] || 0) * 60 + (start[1] || 0);
      const endMin = (end[0] || 0) * 60 + (end[1] || 0);
      let daysAhead = ((Number(course.day) || 1) - today + 7) % 7;
      let ongoing = false;
      if (daysAhead === 0 && currentMin > startMin) {
        if (currentMin <= endMin) ongoing = true;
        else daysAhead = 7;
      }
      return { course, ongoing, distance: daysAhead * 1440 + Math.max(0, startMin - currentMin) };
    }).sort((a, b) => (a.ongoing ? -1 : b.ongoing ? 1 : a.distance - b.distance))[0] || null;
  }

  function renderHeroPriority() {
    const box = $("#heroPriority");
    if (!box) return;
    const tasks = Store.getAll("tasks").filter(task => task.status !== "done").slice().sort((a, b) => {
      const dueA = a.due ? new Date(a.due).getTime() : Infinity;
      const dueB = b.due ? new Date(b.due).getTime() : Infinity;
      const weight = { high: 0, mid: 1, low: 2 };
      return dueA - dueB || (weight[a.priority] ?? 3) - (weight[b.priority] ?? 3);
    });
    const task = tasks[0];
    const next = getNextCourse(Store.getAll("courses"));
    const icon = name => window.XingyuIcons ? XingyuIcons.svg(name) : "";
    const taskMeta = task ? (task.due ? `${Math.max(0, daysUntil(task.due))} 天后到期` : "无截止日期") : "当前没有待办";
    const courseMeta = next ? (next.ongoing ? "正在进行" : next.distance < 1440 ? "今天" : `${Math.floor(next.distance / 1440)} 天后`) : "暂无课程";
    box.innerHTML = `
      <button class="priority-item" type="button" data-priority-act="task" ${task ? "" : "disabled"}>
        ${icon("courses")}<span class="priority-copy"><small>首要任务 · ${esc(taskMeta)}</small><b>${esc(task ? task.title : "添加第一项任务")}</b></span>
      </button>
      <button class="priority-item" type="button" data-priority-act="course" ${next ? "" : "disabled"}>
        ${icon("dashboard")}<span class="priority-copy"><small>下一课程 · ${esc(courseMeta)}</small><b>${esc(next ? `${next.course.name} ${next.course.start || ""}` : "导入课程表")}</b></span>
      </button>
      <button class="priority-item" type="button" data-priority-act="focus">
        ${icon("focus")}<span class="priority-copy"><small>现在开始</small><b>${esc(Store.getProfile().goal || "专注 25 分钟")}</b></span>
      </button>`;
    const taskBtn = box.querySelector('[data-priority-act="task"]');
    if (taskBtn && task) taskBtn.onclick = () => openTaskForm(task.id);
    const courseBtn = box.querySelector('[data-priority-act="course"]');
    if (courseBtn && next) courseBtn.onclick = () => switchView("courses");
    box.querySelector('[data-priority-act="focus"]').onclick = () => switchView("focus");
  }

  function renderDashboard() {
    // 启动引导窗口（__splashCovered=true，开屏仍完全不透明遮蔽主界面）内同步渲染重活，
    // 让图表/热点/首要安排全部在用户不可见时完成，避免拖进开屏淡出后的可见窗口
    // （这是“开屏结束侧边栏 2 秒卡顿”的根因之一：requestIdleCallback 把重活推到了可见时段）。
    const syncHeavy = !!(window.__splashActive || window.__splashCovered || window.__bootPreparing);
    const _idleRender = fn => {
      if (syncHeavy) { try { fn(); } catch (e) {} return; }
      if (window.requestIdleCallback) window.requestIdleCallback(() => { try { fn(); } catch (e) {} }, { timeout: 900 });
      else setTimeout(() => { try { fn(); } catch (e) {} }, 90);
    };
    renderQuote();
    // 热点新闻与“首要安排”卡片含稍重的 DOM 构建，启动期间同步、普通切换时放空闲帧
    _idleRender(() => { renderHeroNews(); });
    _idleRender(() => renderHeroPriority());
    // 问候语（按时段细化，附一句温暖副语）
    const name = Store.getProfile().name || "同学";
    const h = new Date().getHours();
    let greet = "晚上好", sub = "今天也要保持专注，稳步向前。";
    if (h < 6) { greet = "夜深了"; sub = "早点休息，身体是革命的本钱。"; }
    else if (h < 9) { greet = "早上好"; sub = "新的一天，从一个计划开始。"; }
    else if (h < 12) { greet = "上午好"; sub = "上午的专注时间最宝贵，冲！"; }
    else if (h < 14) { greet = "中午好"; sub = "吃饱了才有力气学习，午休片刻。"; }
    else if (h < 18) { greet = "下午好"; sub = "犯困就走两步，回来继续。"; }
    $("#heroGreeting").textContent = `${greet}，${name}`;
    const profileSlogan = Store.getProfile().slogan;
    $("#heroQuote").textContent = profileSlogan ? `"${profileSlogan}"` : sub;
    // 日期 + 星期（跟随界面语言）
    const lang = document.documentElement.dataset.lang || "zh";
    const locale = lang === "en" ? "en-US" : lang === "zh-Hant" ? "zh-TW" : "zh-CN";
    const heroDate = $("#heroDate");
    if (heroDate) heroDate.textContent = new Date().toLocaleDateString(locale, { month: "long", day: "numeric", weekday: "long" });

    // 统计卡
    const tasks = Store.getAll("tasks");
    const todos = tasks.filter(t => t.status !== "done");
    const dueToday = todos.filter(t => daysUntil(t.due) === 0);
    const notes = Store.getAll("notes");
    const pomos = Store.getAll("pomodoros").filter(p => p.startAt && localDateKey(p.startAt) === todayISO());
    const pomoMin = pomos.reduce((s, p) => s + (p.minutes || 0), 0);
    $("#heroStats").innerHTML = `
      <div class="hstat"><b data-count="${todos.length}">0</b><span>${t("hero.todo")}</span></div>
      <div class="hstat"><b data-count="${dueToday.length}">0</b><span>${t("hero.due")}</span></div>
      <div class="hstat"><b data-count="${notes.length}">0</b><span>${t("hero.notes")}</span></div>
      <div class="hstat"><b data-count="${pomoMin}">0</b><span>${t("hero.focusMin")}</span></div>`;
    // 数字滚动动画（GSAP 缓动；无 GSAP 时直接显示目标值）
    $$("#heroStats [data-count]").forEach(el => {
      if (syncHeavy || !window.Anim) el.textContent = el.dataset.count;
      else Anim.countUp(el, +el.dataset.count);
    });

    // 倒计时
    const todoWithDue = todos.filter(t => t.due).sort((a, b) => new Date(a.due) - new Date(b.due)).slice(0, 5);
    const cdBox = $("#countdownList");
    if (!todoWithDue.length) {
      cdBox.innerHTML = `<div class="empty-state"><p>暂无进行中的倒计时，去添加任务吧</p></div>`;
    } else {
      cdBox.innerHTML = todoWithDue.map(t => {
        const days = daysUntil(t.due);
        const urgent = days !== null && days <= 3;
        return `<div class="cd-item ${urgent ? "urgent" : ""}">
          <div class="cd-num"><b>${days === null ? "—" : Math.max(days, 0)}</b><span>${days === null ? "" : "天"}</span></div>
          <div class="cd-info"><b>${esc(t.title)}</b><span>${fmtDate(t.due)} · ${PRIORITY_MAP[t.priority]}优先级</span></div>
          ${urgent ? '<span class="tag-chip pri-high" style="margin-left:auto">紧急</span>' : ""}
        </div>`;
      }).join("");
    }

    // 任务完成统计（环形图）——图表较重，放到空闲帧渲染，先让文本内容出场
    const done = tasks.filter(t => t.status === "done").length;
    const total = tasks.length;
    _idleRender(() => Charts.donut($("#taskStatsChart"), {
      segments: [
        { value: done, color: "var(--ink-2)" },
        { value: total - done, color: "var(--fill-2)" }
      ],
      size: 170, thickness: 22,
      centerLabel: total ? Math.round(done / total * 100) + "%" : "0%",
      centerSub: "完成率"
    }));
    $("#taskStatsLegend").innerHTML = `
      <span><span class="legend-dot" style="background:var(--ink-2)"></span>已完成 ${done}</span>
      <span><span class="legend-dot" style="background:var(--fill-3)"></span>未完成 ${total - done}</span>`;

    // 专注趋势（同样放到空闲帧）
    _idleRender(() => renderFocusTrend($("#focusTrendChart"), 7));

    // 今日待办
    const todayTasks = todos.filter(t => daysUntil(t.due) === 0).slice(0, 6);
    const ttBox = $("#todayTasks");
    if (!todayTasks.length) {
      ttBox.innerHTML = `<div class="empty-state"><p>今天没有到期任务，轻松的一天</p></div>`;
    } else {
      ttBox.innerHTML = todayTasks.map(t => `
        <div class="todo-item">
          <span class="todo-dot" style="background:${t.priority === "high" ? "var(--ink)" : t.priority === "mid" ? "var(--ink-2)" : "var(--ink-3)"}"></span>
          <span class="todo-pri-${t.priority}">${esc(t.title)}</span>
          <span class="todo-date">${fmtDate(t.due)}</span>
        </div>`).join("");
    }

    // 最近笔记
    const recentNotes = notes.slice().sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")).slice(0, 5);
    const rnBox = $("#recentNotes");
    if (!recentNotes.length) {
      rnBox.innerHTML = `<div class="empty-state"><p>还没有笔记，去记录第一条吧</p></div>`;
    } else {
      rnBox.innerHTML = recentNotes.map(n => `
        <div class="note-mini" data-note-id="${n.id}" style="cursor:pointer">
          <span style="color:var(--accent)">◉</span>
          <span>${esc(n.title)}</span>
          <span class="tag-chip">${esc(n.subject || "未分类")}</span>
        </div>`).join("");
      $$("#recentNotes .note-mini").forEach(el => {
        el.onclick = () => { switchView("notes"); setTimeout(() => openNote(el.dataset.noteId), 50); };
      });
    }
  }

  function renderFocusTrend(container, days = 7) {
    const pomos = Store.getAll("pomodoros");
    const labels = [], values = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const mins = pomos.filter(p => p.startAt && localDateKey(p.startAt) === key).reduce((s, p) => s + (p.minutes || 0), 0);
      labels.push(d.getDate() + "日");
      values.push(mins);
    }
    if (values.every(v => v === 0)) {
      container.innerHTML = `<div class="empty-state"><div class="big">⏱</div><p>最近没有专注记录，去「专注学习」开启第一个番茄钟吧</p></div>`;
    } else {
      Charts.bars(container, { labels, values, height: 200, unit: "分", color: "var(--ink)" });
    }
  }

  /* ============================================================
     课程作业
     ============================================================ */
  function renderCourses() {
    renderWeekGrid();
    renderCourseList();
    renderTaskList();
  }

  function renderWeekGrid() {
    const courses = Store.getAll("courses");
    const todayIdx = (new Date().getDay() + 6) % 7; // 周一=0
    const weekDays = WEEKDAYS.slice(1).concat([WEEKDAYS[0]]); // 周一到周日
    const dayNum = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
    const grid = $("#weekGrid");
    let html = "";
    for (let d = 0; d < 7; d++) {
      const dayCourses = courses.filter(c => c.day === d + 1).sort((a, b) => a.start.localeCompare(b.start));
      html += `<div class="week-day ${d === dayNum ? "today" : ""}">
        <h4>${weekDays[d]} ${d === dayNum ? '<span class="today-badge">今天</span>' : ""}</h4>
        ${dayCourses.length ? dayCourses.map(c => `
          <div class="day-course" style="border-left:3px solid ${c.color}">
            <b>${esc(c.name)}</b>
            <span>${c.start}-${c.end} · ${esc(c.location || "未填地点")}</span>
          </div>`).join("") : `<div class="empty-hint">暂无课程</div>`}
      </div>`;
    }
    grid.innerHTML = html;
    $("#weekLabel").textContent = "本周课程表（周一至周日）";
  }

  function renderCourseList() {
    const courses = Store.getAll("courses");
    const box = $("#courseList");
    if (!courses.length) {
      box.innerHTML = `<div class="empty-state"><p>还没有课程，点击右上角「+ 添加课程」</p></div>`;
      return;
    }
    box.innerHTML = courses.map(c => `
      <div class="course-row">
        <div class="course-color" style="background:${c.color}"></div>
        <div class="course-info">
          <b>${esc(c.name)}</b>
          <span>${esc(c.teacher || "待定")} · ${WEEKDAYS[c.day]} ${c.start}-${c.end} · ${esc(c.location || "未填地点")}</span>
        </div>
        <div class="row-actions">
          <button class="mini-btn" data-act="edit-course" data-id="${c.id}" title="编辑">✎</button>
          <button class="mini-btn del" data-act="del-course" data-id="${c.id}" title="删除">✕</button>
        </div>
      </div>`).join("");
    bindRowActions();
  }

  function renderTaskList() {
    const tasks = Store.getAll("tasks");
    const fs = $("#taskFilterStatus").value;
    const fp = $("#taskFilterPriority").value;
    const filtered = tasks.filter(t => (fs === "all" || t.status === fs) && (fp === "all" || t.priority === fp));
    const sorted = filtered.slice().sort((a, b) => {
      const st = { todo: 0, doing: 1, done: 2 };
      if (st[a.status] !== st[b.status]) return st[a.status] - st[b.status];
      return (a.due || "9999").localeCompare(b.due || "9999");
    });
    const box = $("#taskList");
    if (!sorted.length) {
      box.innerHTML = `<div class="empty-state"><p>没有符合条件的任务</p></div>`;
      return;
    }
    box.innerHTML = sorted.map(t => {
      const days = t.due ? daysUntil(t.due) : null;
      const overdue = days !== null && days < 0 && t.status !== "done";
      const dueTxt = t.due ? (overdue ? `已逾期 ${-days} 天` : days === 0 ? "今天到期" : `剩 ${days} 天`) : "无期限";
      return `<div class="task-row ${t.status === "done" ? "task-done" : ""}">
        <button class="mini-btn check" data-act="toggle-task" data-id="${t.id}" title="切换状态">${t.status === "done" ? "↩" : "✓"}</button>
        <div class="course-info">
          <b style="${t.status === "done" ? "text-decoration:line-through;color:var(--text-faint)" : ""}">${esc(t.title)}</b>
          <span>${Store.getCourseName(t.courseId) || "无课程"} · ${dueTxt} · 约${t.estimate || 60}分钟</span>
        </div>
        <span class="tag-chip pri-${t.priority}">${PRIORITY_MAP[t.priority]}</span>
        <span class="tag-chip st-${t.status}">${STATUS_MAP[t.status]}</span>
        <div class="row-actions">
          <button class="mini-btn" data-act="edit-task" data-id="${t.id}" title="编辑">✎</button>
          <button class="mini-btn del" data-act="del-task" data-id="${t.id}" title="删除">✕</button>
        </div>
      </div>`;
    }).join("");
    bindRowActions();
  }

  function bindRowActions() {
    $$("[data-act]").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const act = btn.dataset.act, id = btn.dataset.id;
        if (act === "del-course") { Store.remove("courses", id); renderCourses(); renderDashboard(); }
        else if (act === "del-task") { Store.remove("tasks", id); renderCourses(); }
        else if (act === "edit-course") { openCourseForm(id); }
        else if (act === "edit-task") { openTaskForm(id); }
        else if (act === "toggle-task") {
          const t = Store.getAll("tasks").find(x => x.id === id);
          if (t) { Store.update("tasks", id, { status: t.status === "done" ? "todo" : "done" }); renderCourses(); }
        }
      };
    });
  }

  /* ---------- 课程表单 ---------- */
  function hideFormDelete() {
    const b = $("#btnFormDelete");
    if (b) b.style.display = "none";
  }
  function openCourseForm(id) {
    hideFormDelete();
    const c = id ? Store.getAll("courses").find(x => x.id === id) : null;
    const colors = ["#111111", "#000000", "#444444", "#555555", "#333333", "#111111", "#666666", "#888888"];
    const colorOptions = colors.map(cl => `<span class="color-dot" data-c="${cl}" style="background:${cl}"></span>`).join("");
    $("#formTitle").textContent = id ? "编辑课程" : "添加课程";
    $("#formBody").innerHTML = `
      <div class="form-grid">
        <label class="field"><span>课程名称 *</span><input id="f-c-name" value="${esc(c?.name || "")}" placeholder="如：高等数学"></label>
        <label class="field"><span>授课老师</span><input id="f-c-teacher" value="${esc(c?.teacher || "")}" placeholder="如：李老师"></label>
        <label class="field"><span>上课日 *</span><select id="f-c-day">
          ${[1,2,3,4,5,6,7].map(d => `<option value="${d}" ${c?.day === d ? "selected" : ""}>${WEEKDAYS[d]}</option>`).join("")}
        </select></label>
        <label class="field"><span>时间段 *</span><div style="display:flex;gap:8px;align-items:center">
          <input type="time" id="f-c-start" value="${c?.start || "08:00"}">
          <span style="color:var(--text-faint)">至</span>
          <input type="time" id="f-c-end" value="${c?.end || "09:40"}">
        </div></label>
        <label class="field"><span>地点</span><input id="f-c-loc" value="${esc(c?.location || "")}" placeholder="如：教学楼A-301"></label>
        <label class="field"><span>颜色</span><div class="color-picker" id="f-c-colors">${colorOptions}</div></label>
      </div>`;
    let picked = c?.color || "#111111";
    $$("#f-c-colors .color-dot").forEach(d => {
      if (d.dataset.c === picked) d.classList.add("picked");
      d.onclick = () => {
        $$("#f-c-colors .color-dot").forEach(x => x.classList.remove("picked"));
        d.classList.add("picked");
        picked = d.dataset.c;
      };
    });
    $("#btnFormSave").onclick = () => {
      const name = $("#f-c-name").value.trim();
      if (!name) { toast("请填写课程名称", "err"); return; }
      const payload = { name, teacher: $("#f-c-teacher").value.trim(), day: +$("#f-c-day").value, start: $("#f-c-start").value, end: $("#f-c-end").value, location: $("#f-c-loc").value.trim(), color: picked };
      if (id) Store.update("courses", id, payload);
      else Store.add("courses", payload);
      closeModal("formModal");
      toast("课程已保存", "ok");
      renderCourses();
    };
    showModal("formModal");
  }

  /* ---------- 任务表单 ---------- */
  function openTaskForm(id) {
    hideFormDelete();
    const t = id ? Store.getAll("tasks").find(x => x.id === id) : null;
    const courses = Store.getAll("courses");
    $("#formTitle").textContent = id ? "编辑任务" : "添加任务";
    $("#formBody").innerHTML = `
      <div class="form-grid">
        <label class="field full"><span>任务标题 *</span><input id="f-t-title" value="${esc(t?.title || "")}" placeholder="如：高数第三章课后习题"></label>
        <label class="field"><span>所属课程</span><select id="f-t-course">
          <option value="">无</option>
          ${courses.map(c => `<option value="${c.id}" ${t?.courseId === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}
        </select></label>
        <label class="field"><span>优先级</span><select id="f-t-pri">
          <option value="high" ${t?.priority === "high" ? "selected" : ""}>高</option>
          <option value="mid" ${!t || t.priority === "mid" ? "selected" : ""}>中</option>
          <option value="low" ${t?.priority === "low" ? "selected" : ""}>低</option>
        </select></label>
        <label class="field"><span>截止日期</span><input type="date" id="f-t-due" value="${t?.due ? fmtDateFull(t.due) : ""}"></label>
        <label class="field"><span>预计时长(分钟)</span><input type="number" id="f-t-est" value="${t?.estimate || 60}" min="5" step="5"></label>
        <label class="field"><span>状态</span><select id="f-t-status">
          <option value="todo" ${t?.status === "todo" || !t ? "selected" : ""}>待完成</option>
          <option value="doing" ${t?.status === "doing" ? "selected" : ""}>进行中</option>
          <option value="done" ${t?.status === "done" ? "selected" : ""}>已完成</option>
        </select></label>
      </div>`;
    $("#btnFormSave").onclick = () => {
      const title = $("#f-t-title").value.trim();
      if (!title) { toast("请填写任务标题", "err"); return; }
      const dueVal = $("#f-t-due").value;
      const payload = {
        title,
        courseId: $("#f-t-course").value,
        priority: $("#f-t-pri").value,
        due: dueVal ? new Date(dueVal + "T23:59:00").toISOString() : "",
        estimate: +$("#f-t-est").value || 60,
        status: $("#f-t-status").value
      };
      if (id) Store.update("tasks", id, payload);
      else Store.add("tasks", payload);
      closeModal("formModal");
      toast("任务已保存", "ok");
      renderCourses();
    };
    showModal("formModal");
  }

  /* ============================================================
     学习笔记库
     ============================================================ */
  function renderNotes() {
    renderNoteGrid();
    renderCardGrid();
  }

  function renderNoteGrid() {
    const notes = Store.getAll("notes").slice().sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    const grid = $("#noteGrid");
    if (!notes.length) {
      grid.innerHTML = `<div class="empty-state"><p>还没有笔记，点击「+ 新建笔记」开始记录</p></div>`;
      return;
    }
    grid.innerHTML = notes.map(n => `
      <div class="note-card" data-note-id="${n.id}">
        <h4>${esc(n.title)}</h4>
        <p>${esc(n.content).slice(0, 120)}</p>
        <div class="note-foot">
          <span class="tag-chip">${esc(n.subject || "未分类")}</span>
          ${n.tags && n.tags.length ? n.tags.slice(0, 2).map(t => `<span class="tag-chip" style="opacity:.7">#${esc(t)}</span>`).join("") : ""}
          <span class="note-date" style="margin-left:auto">${fmtDate(n.updatedAt)}</span>
        </div>
      </div>`).join("");
    $$(".note-card").forEach(card => {
      card.onclick = () => openNote(card.dataset.noteId);
    });
    // 滚动分批浮入
    revealCards($("#view-notes"), ".note-card");
  }

  function renderCardGrid() {
    const cards = Store.getAll("cards");
    const grid = $("#cardGrid");
    if (!cards.length) {
      grid.innerHTML = `<div class="empty-state"><p>还没有知识卡片，点「AI 生成卡片」或手动添加</p></div>`;
      return;
    }
    grid.innerHTML = cards.map(c => `
      <div class="flash-card" data-card-id="${c.id}">
        <div class="q">${esc(c.question)}</div>
        <div class="a">${esc(c.answer).replace(/\n/g, "<br>")}</div>
        <div class="hint-flip">点击翻转查看答案 · ${esc(c.subject || "")}</div>
        <button class="mini-btn del" data-act="del-card" data-id="${c.id}" style="position:absolute;top:10px;right:10px" title="删除">✕</button>
      </div>`).join("");
    $$(".flash-card").forEach(card => {
      card.onclick = (e) => {
        if (e.target.closest("[data-act]")) return;
        card.classList.toggle("flipped");
      };
    });
    $$("[data-act='del-card']").forEach(btn => {
      btn.onclick = (e) => { e.stopPropagation(); Store.remove("cards", btn.dataset.id); renderCardGrid(); };
    });
  }

  function openNote(id) {
    const n = id ? Store.getAll("notes").find(x => x.id === id) : null;
    const delBtn = $("#btnFormDelete");
    if (delBtn) delBtn.style.display = "none";
    if (n && delBtn) {
      delBtn.style.display = "inline-block";
      delBtn.onclick = () => {
        if (confirm("确定删除这篇笔记吗？")) {
          Store.remove("notes", n.id);
          closeModal("formModal");
          renderNotes();
        }
      };
    }
    $("#formTitle").textContent = n ? "编辑笔记" : "新建笔记";
    $("#formBody").innerHTML = `
      <label class="field"><span>标题 *</span><input id="f-n-title" value="${esc(n?.title || "")}" placeholder="如：高数第三章笔记"></label>
      <div class="form-grid">
        <label class="field"><span>科目</span><input id="f-n-subject" value="${esc(n?.subject || "")}" placeholder="如：高等数学"></label>
        <label class="field"><span>标签（逗号分隔）</span><input id="f-n-tags" value="${esc((n?.tags || []).join(","))}" placeholder="如：高数,极限"></label>
      </div>
      <label class="field"><span>内容 *</span><textarea id="f-n-content" placeholder="记录你的学习内容...">${esc(n?.content || "")}</textarea></label>
      <p class="hint">小技巧：内容写好后，可以在 AI 助手输入 /organize 让 AI 帮你整理成结构化笔记。</p>`;
    $("#btnFormSave").onclick = () => {
      const title = $("#f-n-title").value.trim();
      const content = $("#f-n-content").value.trim();
      if (!title || !content) { toast("标题和内容不能为空", "err"); return; }
      const now = new Date().toISOString();
      const tags = $("#f-n-tags").value.split(/[,，]/).map(s => s.trim()).filter(Boolean);
      const payload = { title, subject: $("#f-n-subject").value.trim(), tags, content, updatedAt: now };
      if (n) { payload.createdAt = n.createdAt; Store.update("notes", n.id, payload); }
      else { payload.createdAt = now; Store.add("notes", payload); }
      closeModal("formModal");
      toast("笔记已保存", "ok");
      renderNotes();
    };
    showModal("formModal");
  }

  /* ============================================================
     专注学习
     ============================================================ */
  let pomoTimer = null;
  let pomoState = { running: false, paused: false, mode: "work", remain: 25 * 60, total: 25 * 60, startedAt: null, segmentRemain: null, recordedMinutes: 0 };

  function renderFocus() {
    renderFocusStats();
    renderFocusHistory();
  }

  function renderFocusStats() {
    const pomos = Store.getAll("pomodoros");
    const today = pomos.filter(p => p.startAt && localDateKey(p.startAt) === todayISO());
    const todayCount = today.filter(p => p.type === "focus" && p.completed !== false).length;
    const todayMin = today.reduce((s, p) => s + (p.minutes || 0), 0);
    const weekMin = pomos.filter(p => {
      if (!p.startAt) return false;
      const d = new Date(p.startAt);
      d.setHours(0, 0, 0, 0);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const diff = (now - d) / 86400000;
      return diff >= 0 && diff < 7;
    }).reduce((s, p) => s + (p.minutes || 0), 0);
    const totalMin = pomos.reduce((s, p) => s + (p.minutes || 0), 0);
    $("#pomoTodayCount").textContent = todayCount;
    $("#pomoTodayMin").textContent = todayMin;
    $("#focusStatsRow").innerHTML = `
      <div class="fstat"><b>${todayCount}</b><span>今日番茄</span></div>
      <div class="fstat"><b>${todayMin}</b><span>今日分钟</span></div>
      <div class="fstat"><b>${Math.round(weekMin / 60 * 10) / 10}</b><span>本周小时</span></div>`;
    renderFocusWeekChart();
  }

  function renderFocusWeekChart() {
    const pomos = Store.getAll("pomodoros");
    const labels = [], values = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const mins = pomos.filter(p => p.startAt && localDateKey(p.startAt) === key).reduce((s, p) => s + (p.minutes || 0), 0);
      labels.push(d.getDate() + "日");
      values.push(mins);
    }
    Charts.line($("#focusWeekChart"), { labels, values, height: 190, color: "var(--ink)" });
  }

  function renderFocusHistory() {
    const pomos = Store.getAll("pomodoros").slice().sort((a, b) => (b.startAt || "").localeCompare(a.startAt || "")).slice(0, 10);
    const box = $("#focusHistory");
    if (!pomos.length) {
      box.innerHTML = `<div class="empty-state"><p>还没有专注记录，点击「开始专注」</p></div>`;
      return;
    }
    box.innerHTML = pomos.map(p => {
      const d = new Date(p.startAt);
      const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      const label = p.type === "break" ? "休息" : (p.completed === false ? "部分专注" : (p.source === "supervisor" ? "督学专注" : "番茄钟"));
      return `<div class="history-item">
        <span class="history-dot"></span>
        <span>${label}</span>
        <b style="color:var(--accent)">${p.minutes} 分钟</b>
        <span class="history-meta">${fmtDate(p.startAt)} ${time}</span>
      </div>`;
    }).join("");
    // 滚动分批浮入
    revealCards($("#view-focus"), ".history-item");
  }

  function renderSupervisorHistory() {
    const sessions = Store.getAll("supervisorSessions").slice().sort((a,b) => (b.startAt || "").localeCompare(a.startAt || ""));
    const today = sessions.filter(s => s.startAt && localDateKey(s.startAt) === todayISO());
    const todayMin = today.reduce((sum,s) => sum + (s.minutes || 0), 0);
    const totalMin = sessions.reduce((sum,s) => sum + (s.minutes || 0), 0);
    const totalViolations = sessions.reduce((sum,s) => sum + (s.violations || 0), 0);
    const statsRow = $("#supervisorStatsRow");
    const history = $("#supervisorHistory");
    if (!statsRow || !history) return;
    statsRow.innerHTML = `
      <div class="fstat"><b>${todayMin}</b><span>今日督学分钟</span></div>
      <div class="fstat"><b>${sessions.length}</b><span>累计会话</span></div>
      <div class="fstat"><b>${totalViolations}</b><span>累计违纪</span></div>`;
    if (!sessions.length) {
      history.innerHTML = `<div class="empty-state"><p>还没有督学记录，启动自研版后自动保存。</p></div>`;
      return;
    }
    history.innerHTML = sessions.slice(0,8).map(s => {
      const d = new Date(s.startAt);
      const time = `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
      const label = s.completed ? "督学完成" : "督学部分";
      const warn = (s.violations || 0) + (s.warnings || 0);
      return `<div class="history-item">
        <span class="history-dot"></span>
        <span>${label}</span>
        <b style="color:var(--accent)">${s.minutes} 分钟</b>
        <span class="history-meta">${fmtDate(s.startAt)} ${time} · 异常 ${warn}</span>
      </div>`;
    }).join("");
  }

  function startPomo() {
    if (pomoState.running) { pausePomo(); return; }
    if (pomoState.paused) { resumePomo(); return; }

    pomoState.running = true;
    pomoState.paused = false;
    pomoState.mode = "work";
    pomoState.total = (+$("#pomoWork").value || 25) * 60;
    pomoState.remain = pomoState.total;
    pomoState.startedAt = new Date().toISOString();
    pomoState.segmentRemain = pomoState.total;
    pomoState.recordedMinutes = 0;
    updatePomoUI();
    setPomoRunningUI("专注中 ");
    clearInterval(pomoTimer); pomoTimer = null;   // 防孤儿计时器
    pomoTimer = setInterval(tickPomo, 1000);
    openFocusScene();
  }

  function resumePomo() {
    // 防孤儿计时器：先清旧再建新（任何路径下都保证单计时器）
    clearInterval(pomoTimer); pomoTimer = null;
    pomoState.running = true;
    pomoState.paused = false;
    pomoState.segmentRemain = pomoState.remain;
    setPomoRunningUI(pomoState.mode === "work" ? "专注中 " : "休息中 ");
    pomoTimer = setInterval(tickPomo, 1000);
  }

  function setPomoRunningUI(modeText) {
    $("#btnPomoStart").textContent = "暂停";
    $("#btnPomoStart").classList.add("btn-danger");
    $(".pomodoro-card").classList.add("working");
    $("#pomoMode").textContent = modeText;
    if (window.AnimeFX) AnimeFX.pomoPulse();
  }

  /* ============================================================
     沉浸式专注场景（点击「开始专注」后全屏展示，可切换三套电影感场景）
     ============================================================ */
  // 退出控件同步钩子：真正的实现在 init 作用域内（要用到 toggleFullscreen 等局部函数），
  // 这里只留一个可调用入口。全局同一时刻只保留一个退出按钮，由它按状态切换文案与行为，
  // 避免沉浸场景下出现两个按钮在右下角重叠、且文案互相矛盾的情况。
  let syncExitFabHook = null;

  function openFocusScene(customSrc) {
    const overlay = $("#focusOverlay");
    const frame = $("#focusFrame");
    if (!overlay || !frame) return;
    // 进入沉浸式专注：停止主应用励志语音，避免与场景内音频重叠
    if (window.Motivation && window.Motivation.stop) window.Motivation.stop();
    const minutes = Math.max(1, Math.round(pomoState.total / 60) || 25);
    overlay.style.display = "block";
    frame.src = customSrc || ("focus/index.html?minutes=" + minutes);
    // 场景加载完成后把键盘焦点交给 iframe，确保 Esc 第一时间可用。
    // ⚠️ 并向 iframe 注入捕获期 Esc 桥（同源可注入）：iframe 自己的 JS 是打包产物，
    // 从 onload 到它挂好 keydown 有一个时序窗——窗口内按 Esc 会两边都收不到
    // （焦点在 iframe → 父页面兜底监听收不到；iframe JS 未就绪 → 里面也没人处理）。
    // 审计实测复现过一次「Esc 关不掉」。桥是捕获期 + 幂等关闭，双触发无副作用。
    frame.onload = () => {
      try {
        const w = frame.contentWindow;
        if (w && !w.__xyEscBridge) {
          w.__xyEscBridge = true;
          w.addEventListener("keydown", (ev) => {
            if (ev && (ev.key === "Escape" || ev.keyCode === 27)) {
              ev.preventDefault();
              try { closeFocusScene(); } catch (e) {}
            }
          }, true);
        }
        try { w && w.focus(); } catch (e) {}
      } catch (e) {}
    };
    // 唯一的悬浮退出按钮：切到「退出专注 (Esc)」文案，点击只关闭沉浸场景
    if (syncExitFabHook) syncExitFabHook();
  }

  function closeFocusScene() {
    const overlay = $("#focusOverlay");
    const frame = $("#focusFrame");
    if (overlay) overlay.style.display = "none";
    if (frame) { frame.onload = null; frame.src = "about:blank"; }
    // 重算退出按钮：若仍处于网页全屏 / 原生全屏，恢复成「退出全屏」
    if (syncExitFabHook) syncExitFabHook();
    try { window.focus(); } catch (e) {}
  }

  // 父页面 Esc 兜底：即使键盘焦点没有进入 iframe，也能退出沉浸场景
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    const overlay = $("#focusOverlay");
    if (overlay && overlay.style.display !== "none") {
      e.preventDefault();
      closeFocusScene();
    }
  });

  // 沉浸式场景内播放励志语音时，通知主应用停止自身音频，避免双声重叠
  window.addEventListener("message", function (ev) {
    if (ev.data && ev.data.type === "xingyu-motivation-state" && ev.data.playing) {
      if (window.Motivation && window.Motivation.stop) window.Motivation.stop();
    }
  });


  // AI 督学官：独立入口，与普通番茄钟分开
  $("#btnOpenRedWatch").onclick = () => { openExternal("https://redwatch.top/app/"); };
  $("#btnOpenSelfSupervisor").onclick = () => {
    const minutes = Math.max(1, Math.round((+$("#pomoWork").value || 25)));
    openFocusScene("focus-supervisor/index.html?minutes=" + minutes);
  };

  // 接收自研督学官 iframe 的记录/关闭消息
  window.addEventListener("message", (ev) => {
    const data = ev.data || {};
    if (data.type === "xingyu-focus-supervisor-record") {
      const minutes = Math.max(0, Math.round(+data.minutes || 0));
      if (minutes < 1) return;
      const record = {
        startAt: data.startAt || new Date().toISOString(),
        minutes,
        type: "focus",
        completed: data.completed !== false,
        source: "supervisor",
        violations: data.violations || 0
      };
      Store.add("pomodoros", record);
      Store.add("supervisorSessions", {
        startAt: record.startAt,
        minutes,
        completed: record.completed,
        violations: data.violations || 0,
        warnings: data.warnings || 0,
        presenceRate: data.presenceRate || 0,
        postureScore: data.postureScore || 0,
        events: Array.isArray(data.events) ? data.events.slice(-160) : []
      });
      renderFocusStats();
      renderFocusHistory();
      renderSupervisorHistory();
      if (currentView === "dashboard") renderDashboard();
    }
    if (data.type === "xingyu-focus-supervisor-close") {
      closeFocusScene();
    }
  });

  function recordPartialPomo() {
    if (!pomoState.running || pomoState.mode !== "work") return;
    const segmentRemain = Number.isFinite(pomoState.segmentRemain) ? pomoState.segmentRemain : pomoState.total;
    const elapsedSeconds = Math.max(0, segmentRemain - pomoState.remain);
    const minutes = Math.floor(elapsedSeconds / 60);
    if (minutes < 1) return;
    Store.add("pomodoros", {
      startAt: new Date().toISOString(),
      minutes,
      type: "focus",
      completed: false
    });
    pomoState.recordedMinutes += minutes;
    pomoState.segmentRemain = pomoState.remain;
    renderFocusStats();
    renderFocusHistory();
    toast(`已记录 ${minutes} 分钟部分专注`, "ok");
  }

  function pausePomo() {
    if (!pomoState.running) return;
    // ⚠️ 记录部分专注失败不能挡住暂停本身：旧写法 recordPartialPomo() 若抛错，
    // 后面的 clearInterval 永远执行不到 → 「已暂停」但计时还在走（孤儿计时器，
    // 深审计 A4/复测实测复现过）。记录包 try，清计时器无条件先做。
    try { recordPartialPomo(); } catch (e) { try { console.warn("记录部分专注失败:", e); } catch (_e) {} }
    pomoState.running = false;
    pomoState.paused = true;
    clearInterval(pomoTimer); pomoTimer = null;
    $("#btnPomoStart").textContent = "继续";
    $("#btnPomoStart").classList.remove("btn-danger");
    $(".pomodoro-card").classList.remove("working");
    $("#pomoMode").textContent = "已暂停";
    if (window.AnimeFX) AnimeFX.pomoPulse();
  }

  function tickPomo() {
    pomoState.remain--;
    if (pomoState.remain <= 0) {
      completePomo();
      return;
    }
    updatePomoUI();
  }

  function completePomo() {
    clearInterval(pomoTimer);
    pomoState.running = false;
    pomoState.paused = false;
    const totalMinutes = Math.max(1, Math.round(pomoState.total / 60));
    if (pomoState.mode === "work") {
      const minutes = Math.max(1, totalMinutes - pomoState.recordedMinutes);
      Store.add("pomodoros", {
        startAt: pomoState.startedAt || new Date().toISOString(),
        minutes,
        type: "focus",
        completed: true
      });
      toast("专注完成！休息一下吧", "ok");
      // 自动切换到休息
      pomoState.mode = "break";
      pomoState.total = (+$("#pomoBreak").value || 5) * 60;
      pomoState.remain = pomoState.total;
      pomoState.startedAt = new Date().toISOString();
      pomoState.segmentRemain = pomoState.total;
      pomoState.recordedMinutes = 0;
      $("#pomoMode").textContent = "休息中 ";
      $("#btnPomoStart").textContent = "跳过休息";
      $("#btnPomoStart").classList.remove("btn-danger");
      pomoState.running = true;
      pomoTimer = setInterval(tickPomo, 1000);
    } else {
      Store.add("pomodoros", {
        startAt: pomoState.startedAt || new Date().toISOString(),
        minutes: totalMinutes,
        type: "break",
        completed: true
      });
      $("#pomoMode").textContent = "休息结束，继续加油！";
      $("#btnPomoStart").textContent = "开始专注";
      $("#btnPomoStart").classList.remove("btn-danger");
      pomoState.startedAt = null;
      pomoState.segmentRemain = null;
      pomoState.recordedMinutes = 0;
    }
    updatePomoUI();
    renderFocusStats();
    renderFocusHistory();
    if (currentView === "dashboard") renderDashboard();
  }

  function updatePomoUI() {
    const m = Math.floor(pomoState.remain / 60);
    const s = pomoState.remain % 60;
    $("#pomoTime").textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    const progress = pomoState.total ? 1 - pomoState.remain / pomoState.total : 0;
    // 平滑进度（anime.js 插值，消除 conic-gradient 每秒跳变感；未加载时回退原逻辑）
    if (window.AnimeFX) AnimeFX.pomoSmooth(progress * 100);
    else document.querySelector(".pomo-ring").style.setProperty("--progress", (progress * 100).toFixed(1));
  }

  /* ============================================================
     成长档案
     ============================================================ */
  function renderGrowth() {
    renderProfile();
    renderGrades();
    renderSkills();
    renderProjects();
    renderResume();
  }

  function renderProfile() {
    const p = Store.getProfile();
    $("#userName").textContent = p.name || "同学";
    const av = p.avatar || "";
    $("#userAvatar").textContent = av || (p.name || "同学").charAt(0);
    if (av) $("#userAvatar").setAttribute("data-emoji", "1");
    else $("#userAvatar").removeAttribute("data-emoji");
    // 个人主页卡片
    const infoItems = [
      p.school && { k: "学校", v: p.school },
      p.major && { k: "专业", v: p.major },
      p.grade && { k: "年级", v: p.grade }
    ].filter(Boolean);
    const hasEmail = p.email;
    $("#profileBox").innerHTML = `
      <div class="profile-hero">
        <div class="profile-avatar-big">${esc(p.avatar || (p.name || "同学").charAt(0))}</div>
        <div class="profile-hero-info">
          <div class="profile-name">${esc(p.name || "同学")}</div>
          <div class="profile-slogan">${esc(p.slogan || "还没有个性签名～点击编辑写一句吧 ")}</div>
        </div>
      </div>
      ${p.goal ? `<div class="profile-goal"><b>近期目标：</b>${esc(p.goal)}</div>` : `<div class="profile-goal dim">还没有设置近期目标，写下一个想完成的小目标吧</div>`}
      <div class="profile-grid">
        ${infoItems.length ? infoItems.map(i => `<div class="profile-item"><span>${i.k}</span><b>${esc(i.v)}</b></div>`).join("") : `<div class="profile-item" style="grid-column:span 2"><span>学校信息</span><b>未填写</b></div>`}
      </div>
      ${hasEmail ? `<div class="profile-email">${esc(hasEmail)}</div>` : ""}`;
  }

  function renderGrades() {
    const grades = Store.getAll("grades");
    const credits = grades.reduce((s, g) => s + (+g.credit || 0), 0);
    let totalPoints = 0;
    grades.forEach(g => {
      const score = +g.score || 0;
      // 4.0 制转换
      let gp = 0;
      if (score >= 90) gp = 4.0;
      else if (score >= 85) gp = 3.7;
      else if (score >= 82) gp = 3.3;
      else if (score >= 78) gp = 3.0;
      else if (score >= 75) gp = 2.7;
      else if (score >= 72) gp = 2.3;
      else if (score >= 68) gp = 2.0;
      else if (score >= 64) gp = 1.5;
      else if (score >= 60) gp = 1.0;
      totalPoints += gp * (+g.credit || 0);
    });
    const gpa = credits ? (totalPoints / credits) : 0;
    const avg = grades.length ? grades.reduce((s, g) => s + (+g.score || 0), 0) / grades.length : 0;
    $("#gpaSummary").innerHTML = `
      <div class="gpa-box"><b>${gpa.toFixed(2)}</b><span>GPA（4.0制）</span></div>
      <div class="gpa-box"><b>${avg.toFixed(1)}</b><span>平均分</span></div>
      <div class="gpa-box"><b>${grades.length}</b><span>成绩记录</span></div>
      <div class="gpa-box"><b>${credits}</b><span>总学分</span></div>`;
    const box = $("#gradeList");
    if (!grades.length) {
      box.innerHTML = `<div class="empty-state"><p>还没有成绩记录</p></div>`;
    } else {
      box.innerHTML = grades.map(g => `
        <div class="grade-row">
          <div class="grade-info"><b>${esc(g.subject)} · ${esc(g.name)}</b><br><span>${esc(g.semester || "")} · ${g.credit}学分</span></div>
          <span class="grade-score" style="color:${g.score >= 90 ? "var(--success)" : g.score >= 60 ? "var(--warning)" : "var(--danger)"}">${g.score}</span>
          <div class="row-actions">
            <button class="mini-btn" data-act="edit-grade" data-id="${g.id}">✎</button>
            <button class="mini-btn del" data-act="del-grade" data-id="${g.id}">✕</button>
          </div>
        </div>`).join("");
    }
    bindGradeActions();
  }

  function bindGradeActions() {
    $$("[data-act='del-grade']").forEach(b => b.onclick = () => { Store.remove("grades", b.dataset.id); renderGrowth(); });
    $$("[data-act='edit-grade']").forEach(b => b.onclick = () => openGradeForm(b.dataset.id));
  }

  function openGradeForm(id) {
    hideFormDelete();
    const g = id ? Store.getAll("grades").find(x => x.id === id) : null;
    $("#formTitle").textContent = id ? "编辑成绩" : "添加成绩";
    $("#formBody").innerHTML = `
      <div class="form-grid">
        <label class="field"><span>科目 *</span><input id="f-g-subject" value="${esc(g?.subject || "")}" placeholder="如：高等数学"></label>
        <label class="field"><span>考试名称 *</span><input id="f-g-name" value="${esc(g?.name || "")}" placeholder="如：期中考试"></label>
        <label class="field"><span>分数 *</span><input type="number" id="f-g-score" value="${g?.score ?? ""}" min="0" max="100"></label>
        <label class="field"><span>学分 *</span><input type="number" id="f-g-credit" value="${g?.credit ?? 3}" min="0.5" step="0.5"></label>
        <label class="field full"><span>学期</span><input id="f-g-sem" value="${esc(g?.semester || "")}" placeholder="如：2026春"></label>
      </div>`;
    $("#btnFormSave").onclick = () => {
      const subject = $("#f-g-subject").value.trim();
      const name = $("#f-g-name").value.trim();
      const score = +$("#f-g-score").value;
      if (!subject || !name || !score) { toast("请完整填写科目、名称与分数", "err"); return; }
      const payload = { subject, name, score, credit: +$("#f-g-credit").value || 3, semester: $("#f-g-sem").value.trim() };
      if (g) Store.update("grades", g.id, payload);
      else Store.add("grades", payload);
      closeModal("formModal");
      toast("成绩已保存", "ok");
      renderGrowth();
    };
    showModal("formModal");
  }

  function renderSkills() {
    const skills = Store.getAll("skills");
    const box = $("#skillList");
    if (!skills.length) {
      box.innerHTML = `<div class="empty-state"><p>还没有技能记录</p></div>`;
      return;
    }
    box.innerHTML = skills.map(s => `
      <div class="skill-row">
        <span class="skill-name">${esc(s.name)}</span>
        <div class="skill-bar-wrap">
          <div class="skill-bar"><i style="width:${s.level}%"></i></div>
        </div>
        <span class="skill-val">${s.level}%</span>
        <div class="row-actions">
          <button class="mini-btn" data-act="edit-skill" data-id="${s.id}">✎</button>
          <button class="mini-btn del" data-act="del-skill" data-id="${s.id}">✕</button>
        </div>
      </div>`).join("");
    $$("[data-act='del-skill']").forEach(b => b.onclick = () => { Store.remove("skills", b.dataset.id); renderGrowth(); });
    $$("[data-act='edit-skill']").forEach(b => b.onclick = () => openSkillForm(b.dataset.id));
  }

  function openSkillForm(id) {
    hideFormDelete();
    const s = id ? Store.getAll("skills").find(x => x.id === id) : null;
    $("#formTitle").textContent = id ? "编辑技能" : "添加技能";
    $("#formBody").innerHTML = `
      <label class="field"><span>技能名称 *</span><input id="f-s-name" value="${esc(s?.name || "")}" placeholder="如：Python"></label>
      <label class="field"><span>熟练度（0-100）</span><input type="range" id="f-s-level" min="0" max="100" value="${s?.level ?? 50}" style="accent-color:var(--accent)">
        <span id="f-s-level-val" style="color:var(--accent);font-size:13px">${s?.level ?? 50}%</span></label>`;
    $("#f-s-level").oninput = () => $("#f-s-level-val").textContent = $("#f-s-level").value + "%";
    $("#btnFormSave").onclick = () => {
      const name = $("#f-s-name").value.trim();
      if (!name) { toast("请填写技能名称", "err"); return; }
      const payload = { name, level: +$("#f-s-level").value };
      if (s) Store.update("skills", s.id, payload);
      else Store.add("skills", payload);
      closeModal("formModal");
      toast("技能已保存", "ok");
      renderGrowth();
    };
    showModal("formModal");
  }

  function renderProjects() {
    const projects = Store.getAll("projects");
    const box = $("#projectList");
    if (!projects.length) {
      box.innerHTML = `<div class="empty-state"><p>还没有项目经历</p></div>`;
      return;
    }
    box.innerHTML = projects.map(p => `
      <div class="project-row">
        <div style="flex:1">
          <b>${esc(p.name)}</b> <span style="color:var(--text-faint);font-size:12px">· ${esc(p.role || "")} · ${esc(p.start || "")} ~ ${esc(p.end || "")}</span>
          <div style="font-size:12.5px;color:var(--text-dim);margin-top:4px">${esc(p.desc || "")}</div>
        </div>
        <div class="row-actions">
          <button class="mini-btn" data-act="edit-project" data-id="${p.id}">✎</button>
          <button class="mini-btn del" data-act="del-project" data-id="${p.id}">✕</button>
        </div>
      </div>`).join("");
    $$("[data-act='del-project']").forEach(b => b.onclick = () => { Store.remove("projects", b.dataset.id); renderGrowth(); });
    $$("[data-act='edit-project']").forEach(b => b.onclick = () => openProjectForm(b.dataset.id));
  }

  function openProjectForm(id) {
    hideFormDelete();
    const p = id ? Store.getAll("projects").find(x => x.id === id) : null;
    $("#formTitle").textContent = id ? "编辑项目" : "添加项目";
    $("#formBody").innerHTML = `
      <label class="field"><span>项目名称 *</span><input id="f-p-name" value="${esc(p?.name || "")}" placeholder="如：校园二手交易小程序"></label>
      <div class="form-grid">
        <label class="field"><span>担任角色</span><input id="f-p-role" value="${esc(p?.role || "")}" placeholder="如：开发"></label>
        <label class="field"><span>项目链接</span><input id="f-p-link" value="${esc(p?.link || "")}" placeholder="https://..."></label>
        <label class="field"><span>开始时间</span><input id="f-p-start" value="${esc(p?.start || "")}" placeholder="如：2026-03"></label>
        <label class="field"><span>结束时间</span><input id="f-p-end" value="${esc(p?.end || "")}" placeholder="如：2026-05"></label>
      </div>
      <label class="field"><span>项目描述</span><textarea id="f-p-desc" placeholder="项目做了什么，你负责什么，成果如何...">${esc(p?.desc || "")}</textarea></label>`;
    $("#btnFormSave").onclick = () => {
      const name = $("#f-p-name").value.trim();
      if (!name) { toast("请填写项目名称", "err"); return; }
      const payload = { name, role: $("#f-p-role").value.trim(), link: $("#f-p-link").value.trim(), start: $("#f-p-start").value.trim(), end: $("#f-p-end").value.trim(), desc: $("#f-p-desc").value.trim() };
      if (p) Store.update("projects", p.id, payload);
      else Store.add("projects", payload);
      closeModal("formModal");
      toast("项目已保存", "ok");
      renderGrowth();
    };
    showModal("formModal");
  }

  function renderResume() {
    const p = Store.getProfile();
    const skills = Store.getAll("skills");
    const projects = Store.getAll("projects");
    const grades = Store.getAll("grades");
    const box = $("#resumePreview");
    let html = `<h2>${esc(p.name || "你的姓名")}</h2>
      <div class="rp-sub">${[p.school, p.major, p.grade].filter(Boolean).map(esc).join(" · ")}${p.email ? " · " + esc(p.email) : ""}</div>`;
    if (skills.length) {
      html += `<h4>技能</h4><ul>${skills.map(s => `<li>${esc(s.name)}（熟练度 ${s.level}%）</li>`).join("")}</ul>`;
    }
    if (projects.length) {
      html += `<h4>项目经历</h4>`;
      projects.forEach(pr => {
        html += `<div class="rp-item" style="margin-bottom:10px"><b>${esc(pr.name)}</b> ${pr.role ? "— " + esc(pr.role) : ""} ${pr.start || pr.end ? `<span style="color:#718096;font-size:12px">（${esc(pr.start)} ~ ${esc(pr.end)}）</span>` : ""}<br>
          <span style="font-size:13px">${esc(pr.desc || "")}</span></div>`;
      });
    }
    if (grades.length) {
      const avg = grades.reduce((s, g) => s + (+g.score || 0), 0) / grades.length;
      html += `<h4>学业</h4><ul><li>平均分：${avg.toFixed(1)}，共 ${grades.length} 门成绩记录</li></ul>`;
    }
    box.innerHTML = html || `<div class="empty-state"><p>完善资料后这里会生成简历预览</p></div>`;
  }

  /* ============================================================
     热点新闻
     ============================================================ */
  let newsCache = null;
  let newsFilter = "all";

  async function loadNews(force) {
    if (newsCache && !force) return newsCache;
    try {
      const resp = await fetch("data/news-data.json?t=" + Date.now());
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      newsCache = await resp.json();
      return newsCache;
    } catch (e) {
      return null;
    }
  }

  function warmLaunchAssets() {
    if (warmLaunchAssets.done) return;
    warmLaunchAssets.done = true;
    // 新闻 JSON 解析是启动期少数可观测长任务之一；等主界面稳定后再让出空闲时间执行。
    const warm = () => setTimeout(() => { try { loadNews(true).catch(() => {}); } catch (e) {} }, 2600);
    if (window.__xingyuMainReady) warm();
    else window.addEventListener("xingyu-main-ready", warm, { once: true });
  }

  async function renderNews() {
    const box = $("#newsList");
    box.innerHTML = `<div class="empty-state"><div class="big"><span class="spinner" style="border-color:rgba(77,214,255,.3);border-top-color:var(--blue)"></span></div><p>正在加载今日热点...</p></div>`;
    const data = await loadNews(false);
    if (!data || !data.news || !data.news.length) {
      box.innerHTML = `<div class="empty-state">
        
        <p>暂无新闻数据。请先在本地运行抓取脚本生成数据：<br><code style="color:var(--teal)">python scripts/fetch_news.py</code></p>
        <p style="margin-top:10px"><button class="btn btn-ghost" onclick="location.reload()">刷新重试</button></p>
      </div>`;
      $("#newsDate").textContent = "今日热点";
      $("#newsUpdated").textContent = "";
      return;
    }
    $("#newsDate").textContent = "" + (data.date || "今日热点");
    const upd = data.updatedAt ? new Date(data.updatedAt) : null;
    $("#newsUpdated").textContent = upd ? `更新于 ${String(upd.getHours()).padStart(2,"0")}:${String(upd.getMinutes()).padStart(2,"0")}` : "";

    // 过滤逻辑：全部 / 科技AI / 土木行业 / 国内 / 国际
    let filtered;
    if (newsFilter === "all") {
      filtered = data.news;
    } else if (newsFilter === "科技AI") {
      // topic 优先：已归为「土木行业」的条目即使 tech=true 也不混入科技 AI
      // （实测中国公路网/交通运输部各有 1 条被标 tech，会串到科技 AI 分类里）
      filtered = data.news.filter(n => n.topic === "科技AI" || (n.tech && n.topic !== "土木行业"));
    } else if (newsFilter === "土木行业") {
      filtered = data.news.filter(n => n.topic === "土木行业");
    } else {
      filtered = data.news.filter(n => n.category === newsFilter);
    }
    if (!filtered.length) {
      box.innerHTML = `<div class="empty-state"><p>该分类暂无新闻</p></div>`;
      return;
    }
    // 分组：全部/国内/国际 按地区分；科技AI/土木行业 不分地区直接列表
    let groups;
    if (newsFilter === "科技AI") {
      groups = [{ name: "科技AI", items: filtered }];
    } else if (newsFilter === "土木行业") {
      groups = [{ name: "土木·行业", items: filtered }];
    } else if (newsFilter === "all") {
      groups = [{ name: "国内", items: filtered.filter(n => n.category === "国内") },
                { name: "国际", items: filtered.filter(n => n.category === "国际") }];
    } else {
      groups = [{ name: newsFilter, items: filtered }];
    }
    let html = "";
    groups.forEach(g => {
      const items = g.items;
      if (!items.length) return;
      html += `<div class="news-group"><div class="news-group-title">${g.name}热点 <span class="news-count">${items.length}</span></div>`;
      html += items.map((n, i) => `
        <div class="news-item" data-link="${esc(n.link)}">
          <span class="news-rank ${i < 3 ? "top" : ""}">${i + 1}</span>
          <span class="news-title">${esc(n.title)}</span>
          <span class="news-source">${n.region} ${esc(n.source)}</span>
          <button class="mini-btn news-copy" title="复制链接"></button>
        </div>`).join("");
      html += `</div>`;
    });
    box.innerHTML = html;

    // 点击新闻跳转原文：统一走 openExternal（桌面壳用系统浏览器开；
    // ⚠️ 旧代码 window.open 失败后 location.href 直开，会把整个应用导航到
    // 外部新闻站，UI 全部消失、无法退出 —— 2026-09-04 用户报障真根因）
    $$("#newsList .news-item").forEach(el => {
      el.onclick = (e) => {
        if (e.target.closest(".news-copy")) return;
        const link = el.dataset.link;
        if (!link) return;
        openExternal(link);
      };
    });
    // 复制链接
    $$("#newsList .news-copy").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const link = btn.closest(".news-item").dataset.link;
        navigator.clipboard.writeText(link).then(() => toast("链接已复制", "ok")).catch(() => toast("复制失败", "err"));
      };
    });
    // 滚动分批浮入
    revealCards($("#view-news"), "#newsList .news-item");
  }

  /* ============================================================
     文献资料
     ============================================================ */
  let litEditId = null;

  function renderLit() {
    if (window.Knowledge) {
      Knowledge.renderBooks();
      Knowledge.renderKnowledge();
      Knowledge.renderJournals();
    }
    renderLitList();
  }

  function getLitTags() {
    const tags = new Set();
    Store.getAll("literature").forEach(l => (l.tags || []).forEach(t => tags.add(t)));
    return Array.from(tags);
  }

  function renderLitList() {
    const box = $("#litList");
    const search = ($("#litSearch").value || "").trim().toLowerCase();
    const tagFilter = $("#litFilterTag").value;
    const favFilter = $("#litFilterFav").value;

    let items = Store.getAll("literature");
    if (search) {
      items = items.filter(l =>
        (l.title || "").toLowerCase().includes(search) ||
        (l.authors || "").toLowerCase().includes(search) ||
        (l.journal || "").toLowerCase().includes(search) ||
        (l.tags || []).some(t => t.toLowerCase().includes(search))
      );
    }
    if (tagFilter) items = items.filter(l => (l.tags || []).includes(tagFilter));
    if (favFilter === "fav") items = items.filter(l => l.favorite);

    if (!items.length) {
      box.innerHTML = `<div class="empty-state"><p>暂无文献。点击「+ 添加文献」或「导入文献」开始积累。</p></div>`;
      return;
    }
    // 收藏排前面，再按时间倒序
    items = items.slice().sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || (b.createdAt || "").localeCompare(a.createdAt || ""));
    box.innerHTML = items.map(l => `
      <div class="lit-item ${l.favorite ? "fav" : ""}" data-id="${l.id}">
        <div class="lit-main">
          <div class="lit-title">${l.favorite ? "" : ""}${esc(l.title)}</div>
          <div class="lit-meta">${esc(l.authors || "未知作者")} · ${esc(l.journal || "未知期刊")}${l.year ? " · " + l.year : ""}${l.doi ? ` · <span class="lit-doi" data-doi="${esc(l.doi)}" title="点击复制DOI">DOI</span>` : ""}</div>
          ${l.notes ? `<div class="lit-notes">${esc(l.notes)}</div>` : ""}
          ${l.tags && l.tags.length ? `<div class="lit-tags">${l.tags.map(t => `<span class="lit-tag">${esc(t)}</span>`).join("")}</div>` : ""}
        </div>
        <div class="row-actions">
          <button class="mini-btn lit-fav" title="${l.favorite ? "取消收藏" : "收藏"}">${l.favorite ? "" : ""}</button>
          <button class="mini-btn lit-edit" title="编辑">✎</button>
          <button class="mini-btn del lit-del" title="删除">✕</button>
        </div>
      </div>`).join("");

    // 绑定操作
    box.querySelectorAll(".lit-fav").forEach(b => b.onclick = () => {
      const id = b.closest(".lit-item").dataset.id;
      const item = Store.getAll("literature").find(x => x.id === id);
      if (item) { Store.update("literature", id, { favorite: !item.favorite }); renderLitList(); }
    });
    box.querySelectorAll(".lit-edit").forEach(b => b.onclick = () => openLitForm(b.closest(".lit-item").dataset.id));
    box.querySelectorAll(".lit-del").forEach(b => b.onclick = () => {
      const id = b.closest(".lit-item").dataset.id;
      if (confirm("确定删除这篇文献吗？")) { Store.remove("literature", id); renderLitList(); }
    });
    box.querySelectorAll(".lit-doi").forEach(s => s.onclick = () => {
      navigator.clipboard.writeText(s.dataset.doi).then(() => toast("DOI 已复制", "ok"));
    });
    // 滚动分批浮入
    revealCards($("#view-lit"), ".lit-item");
  }

  function openLitForm(editId) {
    hideFormDelete();
    litEditId = editId || null;
    const l = editId ? Store.getAll("literature").find(x => x.id === editId) : null;
    $("#formTitle").textContent = editId ? "编辑文献" : "添加文献";
    $("#formBody").innerHTML = `
      <label class="field"><span>标题 *</span><input id="f-lit-title" value="${esc(l?.title || "")}" placeholder="文献标题"></label>
      <div class="form-grid">
        <label class="field"><span>作者</span><input id="f-lit-authors" value="${esc(l?.authors || "")}" placeholder="张三, 李四"></label>
        <label class="field"><span>期刊/来源</span><input id="f-lit-journal" value="${esc(l?.journal || "")}" placeholder="中国公路学报"></label>
        <label class="field"><span>年份</span><input id="f-lit-year" value="${esc(l?.year || "")}" placeholder="2025"></label>
        <label class="field"><span>DOI</span><input id="f-lit-doi" value="${esc(l?.doi || "")}" placeholder="10.xxxx/xxxxx"></label>
      </div>
      <label class="field"><span>标签（逗号分隔）</span><input id="f-lit-tags" value="${esc((l?.tags || []).join(","))}" placeholder="桥梁工程, 抗震"></label>
      <label class="field"><span>备注/摘要</span><textarea id="f-lit-notes" rows="4" placeholder="你的阅读笔记或文献摘要...">${esc(l?.notes || "")}</textarea></label>
      <label class="field" style="flex-direction:row;align-items:center;gap:10px">
        <input type="checkbox" id="f-lit-fav" ${l?.favorite ? "checked" : ""} style="width:18px;height:18px;accent-color:var(--blue)">
        <span style="font-size:13.5px">收藏此文献</span>
      </label>`;
    $("#btnFormSave").onclick = () => {
      const title = $("#f-lit-title").value.trim();
      if (!title) { toast("请填写文献标题", "err"); return; }
      const data = {
        title,
        authors: $("#f-lit-authors").value.trim(),
        journal: $("#f-lit-journal").value.trim(),
        year: $("#f-lit-year").value.trim(),
        doi: $("#f-lit-doi").value.trim(),
        tags: $("#f-lit-tags").value.split(/[,，]/).map(t => t.trim()).filter(Boolean),
        notes: $("#f-lit-notes").value.trim(),
        favorite: $("#f-lit-fav").checked,
      };
      if (litEditId) {
        Store.update("literature", litEditId, data);
        toast("文献已更新", "ok");
      } else {
        Store.add("literature", { ...data, createdAt: new Date().toISOString() });
        toast("文献已添加", "ok");
      }
      closeModal("formModal");
      renderLitList();
    };
    showModal("formModal");
  }

  function openLitImportModal() {
    // 简化版导入：粘贴多条文献，每行一条，格式：标题 | 作者 | 期刊 | 年份 | DOI
    $("#formTitle").textContent = "导入文献";
    $("#formBody").innerHTML = `
      <p class="hint">粘贴文献列表，每行一条，格式：<code>标题 | 作者 | 期刊 | 年份 | DOI</code>（DOI 可省略）</p>
      <textarea id="f-lit-import" rows="10" placeholder="例如：\n桥梁抗震设计方法研究 | 张三, 李四 | 中国公路学报 | 2025 | 10.19721/j.cnki.1001-7372.2025.01.001\n装配式桥梁施工技术 | 王五 | 桥梁建设 | 2024"></textarea>
      <p class="hint">也可以直接粘贴从知网/万方导出的题录文本，AI 会尝试解析。</p>`;
    $("#btnFormSave").onclick = async () => {
      const text = $("#f-lit-import").value.trim();
      if (!text) { toast("请先粘贴文献内容", "err"); return; }
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      let added = 0;
      lines.forEach(line => {
        const parts = line.split("|").map(p => p.trim());
        if (parts.length < 1 || !parts[0]) return;
        Store.add("literature", {
          title: parts[0],
          authors: parts[1] || "",
          journal: parts[2] || "",
          year: parts[3] || "",
          doi: parts[4] || "",
          tags: [], notes: "", favorite: false,
          createdAt: new Date().toISOString()
        });
        added++;
      });
      closeModal("formModal");
      toast(`已导入 ${added} 条文献`, "ok");
      renderLitList();
    };
    showModal("formModal");
  }

  /* ============================================================
     AI 助手
     ============================================================ */
  function renderAIStatus() {
    const ok = AI.isConfigured();
    const el = $("#aiStatus");
    el.textContent = ok ? "● 模型已配置" : "● 未配置模型（本地模式）";
    el.className = "ai-status " + (ok ? "ok" : "");
    const context = $("#aiContext");
    if (context) {
      const taskCount = Store.getAll("tasks").filter(item => item.status !== "done").length;
      const noteCount = Store.getAll("notes").length;
      context.textContent = `参考 ${taskCount} 项任务 · ${noteCount} 篇笔记`;
    }
  }

  function addChatMsg(text, who = "ai") {
    const box = $("#chatBox");
    const div = document.createElement("div");
    div.className = "chat-msg " + who;
    div.innerHTML = `<div class="chat-avatar">${who === "ai" ? "AI" : "你"}</div>
      <div class="chat-bubble">${esc(text).replace(/\n/g, "<br>")}</div>`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    return div;
  }

  function addChatActions(message, text) {
    const bubble = message && message.querySelector(".chat-bubble");
    if (!bubble || !text) return;
    const actions = document.createElement("div");
    actions.className = "chat-actions";
    const icon = name => window.XingyuIcons ? XingyuIcons.svg(name) : "";
    actions.innerHTML = `
      <button class="chat-action" type="button" data-chat-action="copy">${icon("copy")}复制</button>
      <button class="chat-action" type="button" data-chat-action="save">${icon("save")}保存为笔记</button>`;
    actions.querySelector('[data-chat-action="copy"]').onclick = () => {
      navigator.clipboard.writeText(text).then(() => toast("已复制 AI 回复", "ok")).catch(() => toast("复制失败", "err"));
    };
    actions.querySelector('[data-chat-action="save"]').onclick = () => {
      const now = new Date().toISOString();
      const title = text.split(/\n/).map(line => line.replace(/^[#*\-\d.\s]+/, "").trim()).find(Boolean) || "AI 学习笔记";
      Store.add("notes", {
        title: title.slice(0, 40),
        subject: "AI 助手",
        tags: ["AI"],
        content: text,
        createdAt: now,
        updatedAt: now
      });
      toast("已保存到学习笔记库", "ok");
      renderAIStatus();
    };
    bubble.appendChild(actions);
  }

  const CMD_MAP = {
    "/plan": "plan", "/学习规划": "plan", "/规划": "plan",
    "/priority": "priority", "/智能排序": "priority", "/排序": "priority",
    "/cards": "cards", "/知识卡片": "cards", "/卡片": "cards", "/复习": "cards",
    "/organize": "organize", "/笔记整理": "organize", "/整理": "organize"
  };
  let chatBusy = false;
  async function sendChat(text) {
    const trimmed = text.trim();
    if (!trimmed || chatBusy) return;
    chatBusy = true;
    $("#btnChatSend").disabled = true;
    $("#btnChatStop").style.display = "";
    addChatMsg(trimmed, "user");
    $("#chatInput").value = "";
    const loading = addChatMsg("思考中…", "ai");
    loading.classList.add("chat-loading");
    const isCmd = trimmed.startsWith("/");
    try {
      let reply;
      if (isCmd) {
        const [cmd, ...rest] = trimmed.split(/\s+/);
        const restText = rest.join(" ");
        const skill = CMD_MAP[cmd.toLowerCase()];
        if (skill === "plan") reply = (await AI.runSkill("plan")).text;
        else if (skill === "priority") reply = (await AI.runSkill("priority")).text;
        else if (skill === "cards") reply = (await AI.runSkill("cards")).text;
        else if (skill === "organize") reply = (await AI.runSkill("organize", restText)).text;
        else reply = "未知命令。可用命令：/学习规划 /智能排序 /知识卡片 /笔记整理";
      } else {
        reply = await AI.ask(trimmed);
      }
      loading.querySelector(".chat-bubble").innerHTML = esc(reply).replace(/\n/g, "<br>");
      addChatActions(loading, reply);
    } catch (e) {
      loading.querySelector(".chat-bubble").innerHTML = e.message === "已停止生成"
        ? `<span style="color:var(--ink-3)">已停止生成</span>`
        : `<span style="color:var(--danger)">${esc(e.message)}</span>`;
    } finally {
      chatBusy = false;
      loading.classList.remove("chat-loading");
      $("#btnChatSend").disabled = false;
      $("#btnChatStop").style.display = "none";
    }
  }

  /* ============================================================
     弹窗管理（iOS Sheet 风格：进入/退出同路径，可打断）
     ============================================================ */
  let modalRestoreTarget = null;

  function openModals() {
    return Array.from(document.querySelectorAll(".modal-mask.show:not(.closing)"));
  }

  function syncModalState() {
    const hasOpen = openModals().length > 0;
    document.body.classList.toggle("modal-open", hasOpen);
  }

  function focusableIn(root) {
    if (!root) return [];
    return Array.from(root.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(el => !el.hidden && el.getClientRects().length > 0);
  }

  function showModal(id) {
    const m = $("#" + id);
    if (!m) return;
    if (!openModals().length) modalRestoreTarget = document.activeElement;
    m.classList.remove("closing");
    m.classList.add("show");
    m.setAttribute("aria-hidden", "false");
    syncModalState();
    const sheet = m.querySelector(".modal");
    // GSAP 弹窗动画；无 GSAP 时回退 CSS
    if (window.Anim) Anim.sheetIn(m, sheet);
    else if (sheet) {
      sheet.classList.remove("sheet-in");
      void sheet.offsetWidth;
      sheet.classList.add("sheet-in");
    }
    requestAnimationFrame(() => {
      const focusables = focusableIn(sheet);
      const preferred = sheet && sheet.querySelector("input:not([type='hidden']), textarea, select, button");
      (preferred || focusables[0] || sheet || m).focus({ preventScroll: true });
    });
  }

  function closeModal(id) {
    const m = $("#" + id);
    if (!m || !m.classList.contains("show")) return;
    m.classList.add("closing");
    const sheet = m.querySelector(".modal");
    const finish = () => {
      if (!m.classList.contains("closing")) return;
      m.classList.remove("show", "closing");
      m.setAttribute("aria-hidden", "true");
      if (sheet) sheet.classList.remove("sheet-in");
      syncModalState();
      if (!openModals().length && modalRestoreTarget && typeof modalRestoreTarget.focus === "function") {
        modalRestoreTarget.focus({ preventScroll: true });
        modalRestoreTarget = null;
      }
    };
    if (window.Anim) {
      Anim.sheetOut(m, sheet, finish);
    } else {
      setTimeout(finish, 220);
    }
    // 保险丝：无论 GSAP 回调链是否异常，800ms 后强制完成关闭，
    // 防止遮罩残留 closing/show 状态挡住整个界面（侧边栏点不了的另一种隐患）
    setTimeout(finish, 800);
  }

  function setupModalAccessibility() {
    $$(".modal-mask").forEach((mask, index) => {
      mask.setAttribute("aria-hidden", mask.classList.contains("show") ? "false" : "true");
      const dialog = mask.querySelector(".modal");
      if (!dialog) return;
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      dialog.setAttribute("tabindex", "-1");
      const title = dialog.querySelector(".modal-head h3");
      if (title) {
        if (!title.id) title.id = `dialog-title-${index + 1}`;
        dialog.setAttribute("aria-labelledby", title.id);
      }
      const close = dialog.querySelector(".modal-close");
      if (close && !close.getAttribute("aria-label")) close.setAttribute("aria-label", "关闭弹窗");
    });
    const lock = $("#lockMask");
    const lockBox = lock && lock.querySelector(".lock-box");
    if (lock && lockBox) {
      lock.setAttribute("role", "dialog");
      lock.setAttribute("aria-modal", "true");
      lock.setAttribute("aria-labelledby", "lockTitle");
      const title = lock.querySelector(".lock-title");
      if (title) title.id = "lockTitle";
    }
  }

  const TRASH_LABELS = {
    courses: "课程", tasks: "任务", notes: "笔记", cards: "知识卡片",
    grades: "成绩", skills: "技能", projects: "项目", literature: "文献",
    pomodoros: "专注记录"
  };

  function trashItemTitle(entry) {
    const item = entry && entry.item || {};
    return item.title || item.name || item.subject || item.question || "未命名内容";
  }

  function refreshAfterDataChange() {
    renderCurrent();
    renderProfile();
    renderDashboard();
    renderAIStatus();
    updateTrashCount();
  }

  function updateTrashCount() {
    const count = Store.getTrash ? Store.getTrash().length : 0;
    const el = $("#trashCount");
    if (el) el.textContent = String(count);
  }

  function undoTrashEntry(entry) {
    if (!entry || !Store.restoreTrash(entry.id)) return;
    refreshAfterDataChange();
    toast("内容已恢复", "ok");
  }

  function renderTrash() {
    const box = $("#trashList");
    if (!box) return;
    const items = Store.getTrash ? Store.getTrash() : [];
    updateTrashCount();
    if (!items.length) {
      box.innerHTML = `<div class="empty-state"><p>回收站是空的</p></div>`;
      return;
    }
    const icon = window.XingyuIcons ? XingyuIcons.svg("trash") : "";
    box.innerHTML = items.map(entry => `
      <div class="trash-item">
        ${icon}
        <div class="trash-item-main">
          <b>${esc(trashItemTitle(entry))}</b>
          <span>${esc(TRASH_LABELS[entry.entityKey] || entry.entityKey)} · ${fmtDate(entry.deletedAt)}</span>
        </div>
        <button class="btn btn-ghost" type="button" data-trash-restore="${esc(entry.id)}">恢复</button>
      </div>`).join("");
    box.querySelectorAll("[data-trash-restore]").forEach(button => {
      button.onclick = () => {
        const restored = Store.restoreTrash(button.dataset.trashRestore);
        if (restored) {
          renderTrash();
          refreshAfterDataChange();
          toast("内容已恢复", "ok");
        }
      };
    });
  }

  function openTrash() {
    renderTrash();
    showModal("trashModal");
  }

  let onboardReplay = false; // 重看模式：不清数据、隐藏演示数据选项
  function maybeShowOnboarding() {
    // 2026-09-03 v4：引导标记升版（zero_onboarded_v4）。
    // 老用户（已有存档）自动进入安全重看模式：预填资料、隐藏清数据选项，
    // 无论点哪个按钮都绝不动存档。真首跑走原始流程（含演示数据选择）。
    try {
      if (localStorage.getItem("zero_onboarded_v4") === "1") return;
      // 手机访问直接跳过完整引导（2026-09-04 深审计遗留项）：
      // 扫码/移动端每个新设备都是"首跑"，引导弹层会把整个移动端界面挡死；
      // 且姓名/目标/演示数据这些引导内容是桌面向的。标记已引导，资料可在设置里补。
      const __qp = new URLSearchParams(location.search);
      const __isMobileVisit = __qp.get("mobile") === "1" || __qp.get("src") === "qr" ||
        (window.matchMedia && window.matchMedia("(max-width: 900px) and (pointer: coarse)").matches);
      if (__isMobileVisit) {
        localStorage.setItem("zero_onboarded_v4", "1");
        return;
      }
      const info = Store.getStorageInfo();
      const demoRow = $("#onboardKeepDemo");
      if (info && !info.firstRun) { replayOnboarding(); return; }
      if (demoRow) demoRow.closest(".lock-toggle").style.display = "";
    } catch (e) {}
    showModal("onboardingModal");
  }

  function replayOnboarding() {
    onboardReplay = true;
    try {
      const demoRow = $("#onboardKeepDemo");
      if (demoRow) demoRow.closest(".lock-toggle").style.display = "none"; // 重看绝不提供清数据选项
      const p = Store.getProfile();
      $("#onboardName").value = p.name || "";
      $("#onboardGoal").value = p.goal || "";
    } catch (e) {}
    showModal("onboardingModal");
  }

  function finishOnboarding() {
    const name = $("#onboardName").value.trim() || "同学";
    const goal = $("#onboardGoal").value.trim();
    // 首跑且未勾"保留演示数据"才清空；重看模式不动任何数据
    if (!onboardReplay && !$("#onboardKeepDemo").checked) Store.clearAll();
    onboardReplay = false;
    Store.setProfile({ name, goal });
    localStorage.setItem("zero_onboarded_v3", "1");
    localStorage.setItem("zero_onboarded_v4", "1");
    closeModal("onboardingModal");
    refreshAfterDataChange();
    toast(`欢迎你，${name}`, "ok");
  }

  /* ============================================================
     设置
     ============================================================ */
  function updateSyncStatus() {
    const el = $("#syncStatus");
    if (!el) return;
    if (!Sync.isEnabled()) { el.textContent = "未启用云同步。"; return; }
    if (!Sync.getToken()) { el.textContent = "已启用，但尚未填写 GitHub Token。"; return; }
    el.textContent = "同步已启用：数据改动后自动同步，也可点「立即同步」手动触发。";
  }
  function openSettings() {
    const s = Store.getSettings();
    $("#setBaseUrl").value = s.baseUrl || "";
    $("#setApiKey").value = s.apiKey || "";
    $("#setModel").value = s.model || "";
    const setUseProxy = $("#setUseProxy");
    if (setUseProxy) setUseProxy.checked = !!(s.useLocalAiProxy);
    $("#setNickname").value = s.nickname || "";
    const syncEn = $("#syncEnabled");
    if (syncEn) syncEn.checked = Sync.isEnabled();
    $("#setSyncToken").value = Sync.getToken();
    updateSyncStatus();
    $("#setPin").value = "";
    $("#setPin2").value = "";
    const lockEnabled = localStorage.getItem("zero_lock_enabled") === "1";
    const le = $("#lockEnabled");
    if (le) {
      le.checked = lockEnabled;
      toggleLockFields(lockEnabled);
    }
    $("#lockOnLeave").checked = localStorage.getItem("zero_lock_leave") === "1";
    syncThemeUI();
    if (window.XingyuIconThemes) XingyuIconThemes.sync();
    if (window.XingyuSettingsUI) XingyuSettingsUI.sync();
    const splashEn = $("#splashSoundEnabled");
    if (splashEn) splashEn.checked = window.SplashSound ? SplashSound.isEnabled() : true;
    toggleSplashSoundConfig();
    renderSplashSoundSettings();
    const devMode = $("#devModeEnabled");
    if (devMode) {
      devMode.checked = !!(Store.getSettings().developerMode);
      const hint = $("#devModeHint");
      if (hint) hint.textContent = devMode.checked ? "已开启：保存并重启平台后，按 F12 即可打开调试台。" : "已关闭。开启并保存后，重启平台生效。";
    }
    const lanTokenEl = $("#lanTokenText");
    if (lanTokenEl) {
      lanTokenEl.textContent = "加载中…";
      const copyBtn = $("#btnCopyLanToken");
      fetch("/api/lan-token", { cache: "no-store" })
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(data => {
          lanTokenEl.textContent = data.token || "未生成";
          if (copyBtn) copyBtn.disabled = false;
        })
        .catch(status => {
          // 手机/其他已解锁设备不应该读取令牌；这里给出明确状态，而不是“加载失败”。
          lanTokenEl.textContent = status === 403 ? "此设备已解锁；令牌仅本机显示" : "仅本机可查看";
          if (copyBtn) copyBtn.disabled = true;
        });
    }
    refreshGpuStatus();
    showModal("settingsModal");
  }

  /* ============================================================
     问题反馈与诊断（自动性能监测）
     ============================================================ */
  function refreshGpuStatus() {
    const el = $("#gpuStatusText");
    if (!el) return;
    try {
      const c = document.createElement("canvas");
      const gl = c.getContext("webgl") || c.getContext("experimental-webgl");
      const dbg = gl && gl.getExtension && gl.getExtension("WEBGL_debug_renderer_info");
      let r = "";
      if (dbg && gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) {
        r = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL));
      } else if (gl) {
        r = String(gl.getParameter(gl.RENDERER));
      }
      r = r.replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
      const useDiscrete = /nvidia|amd|radeon|rtx|gtx|geforce|arc/i.test(r);
      el.textContent = r
        ? (r + (useDiscrete ? " · 独立显卡/外接 GPU 加速中 ✓" : " · 当前调用层面见上"))
        : "此窗口未暴露 WebGL 渲染器信息（仍已请求独立/外接 GPU 优先）";
    } catch (e) {
      el.textContent = "无法读取 GPU 状态";
    }
  }
  function _fbEsc(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function renderFeedbackSummary() {
    const box = $("#fbSummary");
    if (!box) return;
    if (!window.XYPerf) { box.textContent = "监测模块未加载。"; return; }
    const rep = XYPerf.generateReport($("#fbComment") ? $("#fbComment").value.trim() : "");
    let html = "";
    if (!rep.issues.length) {
      html += '<span class="fb-ok">✓ 自动巡检未发现明显异常</span>\n';
    } else {
      rep.issues.forEach(i => {
        const cls = i.level === "error" ? "fb-err" : "fb-warn";
        html += '<span class="' + cls + '">' + (i.level === "error" ? "✕ " : "⚠ ") + _fbEsc(i.msg) + "</span>\n";
      });
    }
    html += "\n" + _fbEsc(XYPerf.textSummary(rep));
    box.innerHTML = html;
  }
  function openFeedback() {
    if (!window.XYPerf) { toast("监测模块未加载", "err"); return; }
    const st = $("#fbStatus"); if (st) st.textContent = "";
    renderFeedbackSummary();
    showModal("feedbackModal");
  }
  function saveFeedback() {
    if (!window.XYPerf) { toast("监测模块未加载", "err"); return; }
    const st = $("#fbStatus"); if (st) st.textContent = "正在保存…";
    const comment = $("#fbComment") ? $("#fbComment").value.trim() : "";
    XYPerf.saveReport(comment).then(res => {
      const ok = !!(res && res.ok);
      if (st) st.textContent = ok ? "已保存到 data/feedback/" + (res.file || "") : "保存失败";
      toast(ok ? "反馈已保存" : "反馈保存失败", ok ? "ok" : "err");
    }).catch(() => {
      if (st) st.textContent = "保存失败：本地服务不可用";
      toast("反馈保存失败", "err");
    });
  }
  function copyFeedbackReport() {
    if (!window.XYPerf) return;
    const text = XYPerf.textSummary(XYPerf.generateReport($("#fbComment") ? $("#fbComment").value.trim() : ""));
    const done = () => toast("报告已复制", "ok");
    const fail = () => toast("复制失败，请改用导出", "err");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => {
        try {
          const ta = document.createElement("textarea");
          ta.value = text; document.body.appendChild(ta); ta.select();
          document.execCommand("copy"); ta.remove(); done();
        } catch (e) { fail(); }
      });
    } else {
      try {
        const ta = document.createElement("textarea");
        ta.value = text; document.body.appendChild(ta); ta.select();
        document.execCommand("copy"); ta.remove(); done();
      } catch (e) { fail(); }
    }
  }
  function exportFeedbackReport() {
    if (!window.XYPerf) return;
    const rep = XYPerf.generateReport($("#fbComment") ? $("#fbComment").value.trim() : "");
    const blob = new Blob([JSON.stringify(rep, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "xingyu-perf-report.json";
    a.click();
    toast("报告已导出", "ok");
  }

  // 访问密码总开关：切换密码字段显隐
  function toggleLockFields(on) {
    const fields = $("#lockFields");
    const hint = $("#lockEnabledHint");
    if (fields) fields.style.display = on ? "" : "none";
    if (hint) hint.style.display = on ? "" : "none";
  }

  /* ============================================================
     开屏声音设置
     ============================================================ */
  function toggleSplashSoundConfig() {
    const on = $("#splashSoundEnabled") ? $("#splashSoundEnabled").checked : true;
    const cfg = $("#splashSoundConfig");
    if (cfg) cfg.style.display = on ? "" : "none";
  }
  function renderSplashSoundSettings() {
    const sel = $("#setSplashSound");
    if (!sel || !window.SplashSound) return;
    const current = SplashSound.getSelection();
    SplashSound.listSources().then(list => {
      sel.innerHTML = "";
      list.forEach(o => {
        const op = document.createElement("option");
        op.value = o.id;
        op.textContent = o.name;
        if (o.id === current) op.selected = true;
        sel.appendChild(op);
      });
      renderSplashCustomList();
    }).catch(() => {});
  }
  function renderSplashCustomList() {
    const box = $("#splashCustomList");
    if (!box || !window.SplashSound) return;
    SplashSound.listCustom().then(list => {
      if (!list.length) { box.innerHTML = ""; return; }
      box.innerHTML = "";
      list.forEach(c => {
        const row = document.createElement("div");
        row.className = "splash-custom-item";
        const name = document.createElement("span");
        name.textContent = c.name || "未命名";
        row.appendChild(name);
        const del = document.createElement("button");
        del.type = "button";
        del.className = "btn btn-ghost btn-sm";
        del.textContent = "删除";
        del.onclick = () => { SplashSound.removeCustom(c.id).then(() => renderSplashSoundSettings()); };
        row.appendChild(del);
        box.appendChild(row);
      });
    }).catch(() => {});
  }
  function previewSplashSound() {
    if (!window.SplashSound) return;
    SplashSound.getCurrentSource().then(src => {
      if (!src) { toast("当前开屏声音为「无声音」", "err"); return; }
      if (window.__splashPreview) { try { window.__splashPreview.pause(); } catch (e) {} }
      const a = new Audio();
      a.src = src.url;
      a.volume = 0.9;
      a.play().then(() => { window.__splashPreview = a; }).catch(() => { toast("浏览器阻止了自动试听，请再次点击", "err"); });
    });
  }

  /* ============================================================
     访问密码锁
     ============================================================ */
  const PIN_HASH_KEY = "zero_pin_hash_v2";
  const LEGACY_PIN_KEY = "zero_pin";

  function hasPin() {
    try { return !!(localStorage.getItem(PIN_HASH_KEY) || localStorage.getItem(LEGACY_PIN_KEY)); }
    catch (e) { return false; }
  }

  async function hashPin(pin) {
    if (window.crypto && crypto.subtle && window.TextEncoder) {
      const bytes = new TextEncoder().encode(pin);
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      return "sha256:" + Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
    }
    return "fallback:" + btoa(unescape(encodeURIComponent(pin)));
  }

  async function setPin(pin) {
    try {
      if (pin) localStorage.setItem(PIN_HASH_KEY, await hashPin(pin));
      else localStorage.removeItem(PIN_HASH_KEY);
      localStorage.removeItem(LEGACY_PIN_KEY);
      return true;
    } catch (e) {
      toast("访问密码保存失败，请检查浏览器存储权限", "err");
      return false;
    }
  }

  async function verifyPin(pin) {
    try {
      const stored = localStorage.getItem(PIN_HASH_KEY);
      if (stored) return stored === await hashPin(pin);
      const legacy = localStorage.getItem(LEGACY_PIN_KEY);
      if (!legacy) return false;
      const plain = atob(legacy);
      if (plain !== pin) return false;
      await setPin(pin);
      return true;
    } catch (e) {
      return false;
    }
  }

  function lockNow() {
    const mask = $("#lockMask");
    if (mask) {
      mask.classList.add("show");
      mask.style.display = "flex";
      mask.setAttribute("aria-hidden", "false");
      if (window.Anim) Anim.lockIn(mask);
    }
    const pinInput = $("#lockPin");
    if (pinInput) { pinInput.value = ""; pinInput.focus(); }
    const hint = $("#lockHint");
    if (hint) hint.textContent = "";
  }
  async function unlock() {
    const val = $("#lockPin").value;
    const hint = $("#lockHint");
    const btn = $("#btnUnlock");
    if (btn) btn.disabled = true;
    if (val && await verifyPin(val)) {
      const mask = $("#lockMask");
      if (window.Anim) {
        Anim.lockOut(mask, () => {
          mask.classList.remove("show");
          mask.style.display = "none";
          mask.setAttribute("aria-hidden", "true");
        });
      } else {
        mask.classList.remove("show");
        mask.style.display = "none";
        mask.setAttribute("aria-hidden", "true");
      }
    } else if (hint) {
      hint.textContent = t("lock.wrong");
    }
    if (btn) btn.disabled = false;
    const pinInput = $("#lockPin");
    if (pinInput) { pinInput.value = ""; pinInput.focus(); }
  }
  function applyLockPrefs() {
    // 启动锁：总开关开启且设置了密码才锁定
    if (localStorage.getItem("zero_lock_enabled") === "1" && hasPin()) lockNow();
  }

  /* ============================================================
     主题（纯黑 / 纯白 / 自定义颜色）
     ============================================================ */
  const CUSTOM_DEFAULTS = { paper: "#000000", card: "#101010", drawer: "#080808", ink: "#ffffff", accent: "#ffffff", rule: "#232323" };
  const CUSTOM_MAP = { paper: "--paper", card: "--paper-card", drawer: "--drawer", ink: "--ink", accent: "--accent", rule: "--rule" };
  const CUSTOM_VARS = ["--paper","--paper-2","--paper-3","--paper-card","--paper-hover","--paper-sunk",
    "--ink","--ink-2","--ink-3","--ink-faint","--accent","--rule","--rule-2","--rule-thin",
    "--drawer","--drawer-2","--drawer-3","--drawer-text","--drawer-deep","--fill","--fill-2","--fill-3"];

  function hexToRgb(hex) {
    const h = hex.replace("#", "");
    const v = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
    const n = parseInt(v, 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  function shade(hex, amt) {
    const [r, g, b] = hexToRgb(hex);
    const t = amt < 0 ? 0 : 255;
    const p = Math.abs(amt);
    const mix = (c) => Math.round(c + (t - c) * p);
    return "#" + [mix(r), mix(g), mix(b)].map(c => c.toString(16).padStart(2, "0")).join("");
  }
  function rgbaOf(hex, a) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  }
  function getCustomColors() {
    try { return Object.assign({}, CUSTOM_DEFAULTS, JSON.parse(localStorage.getItem("zero_custom_colors") || "{}")); }
    catch (e) { return { ...CUSTOM_DEFAULTS }; }
  }
  function applyCustomColors(colors) {
    const s = document.documentElement.style;
    const { paper, card, drawer, ink, accent, rule } = colors;
    s.setProperty("--paper", paper);
    s.setProperty("--paper-card", card);
    s.setProperty("--drawer", drawer);
    s.setProperty("--ink", ink);
    s.setProperty("--accent", accent);
    s.setProperty("--rule", rule);
    // 派生灰阶（让自定义配色整体协调）
    s.setProperty("--paper-2", shade(paper, 0.04));
    s.setProperty("--paper-3", shade(paper, 0.08));
    s.setProperty("--paper-hover", shade(paper, 0.06));
    s.setProperty("--paper-sunk", shade(paper, 0.1));
    s.setProperty("--ink-2", shade(ink, -0.35));
    s.setProperty("--ink-3", shade(ink, -0.55));
    s.setProperty("--ink-faint", shade(ink, -0.7));
    s.setProperty("--rule-2", shade(paper, 0.03));
    s.setProperty("--rule-thin", rgbaOf(ink, 0.12));
    s.setProperty("--drawer-2", shade(drawer, 0.04));
    s.setProperty("--drawer-3", shade(drawer, 0.09));
    s.setProperty("--drawer-text", shade(ink, -0.15));
    s.setProperty("--drawer-deep", shade(ink, -0.55));
    s.setProperty("--fill", rgbaOf(ink, 0.06));
    s.setProperty("--fill-2", rgbaOf(ink, 0.1));
    s.setProperty("--fill-3", rgbaOf(ink, 0.16));
  }
  function clearCustomColors() {
    CUSTOM_VARS.forEach(v => document.documentElement.style.removeProperty(v));
  }
  function systemTheme() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  function syncThemeUI() {
    const curMode = document.documentElement.dataset.themeMode || localStorage.getItem("zero_theme") || "system";
    const curTheme = document.documentElement.dataset.theme || systemTheme();
    const advanced = !["system", "dark", "light", "ocean", "custom"].includes(curMode);
    if (advanced) document.body.classList.add("show-advanced-themes");
    const moreBtn = $("#btnToggleAdvancedThemes");
    if (moreBtn) moreBtn.textContent = document.body.classList.contains("show-advanced-themes") ? "收起更多主题" : "显示更多主题";
    $$(".theme-opt").forEach(b => b.classList.toggle("active", b.dataset.themePick === curMode));
    const panel = $("#themeCustom");
    if (panel) panel.style.display = curTheme === "custom" ? "grid" : "none";
    const colors = getCustomColors();
    Object.keys(CUSTOM_MAP).forEach(k => {
      const inp = document.querySelector(`#themeCustom input[data-cvar="${k}"]`);
      if (inp) inp.value = colors[k];
    });
    const sw = $("#swCustom");
    if (sw) sw.style.background = colors.accent;
    // 字体 / 语言高亮
    const FONT_MIGRATE = { sans: "default", serif: "song", mono: "hei" };
    let curFont = document.documentElement.dataset.font || "default";
    curFont = FONT_MIGRATE[curFont] || curFont;
    $$("[data-font-pick]").forEach(b => b.classList.toggle("active", b.dataset.fontPick === curFont));
    const curLang = document.documentElement.dataset.lang || "zh";
    $$("[data-lang-pick]").forEach(b => b.classList.toggle("active", b.dataset.langPick === curLang));
    const curBg = document.documentElement.dataset.bg || "none";
    $$("[data-bg-pick]").forEach(b => b.classList.toggle("active", b.dataset.bgPick === curBg));
    const curBgVis = document.documentElement.dataset.bgVis || "clear";
    $$(".theme-opt[data-bg-vis]").forEach(b => b.classList.toggle("active", b.dataset.bgVis === curBgVis));
  }
  function applyTheme(mode) {
    const theme = mode === "system" ? systemTheme() : mode;
    if (mode === "custom") {
      applyCustomColors(getCustomColors());
    } else {
      clearCustomColors();
    }
    document.documentElement.dataset.themeMode = mode;
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("zero_theme", mode);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#f5f5f7" : "#000000");
    syncThemeUI();
  }

  /* ============================================================
     i18n（中 / 英）与字体
     ============================================================ */
  const I18N = {
    zh: {
      "logo.sub": "个人学习工作台",
      "nav.group.work": "工作台",
      "nav.group.study": "学习资料",
      "nav.group.growth": "自我成长",
      "nav.dashboard": "今日",
      "nav.courses": "课程作业",
      "nav.focus": "专注学习",
      "nav.notes": "学习笔记库",
      "nav.lit": "文献资料",
      "nav.news": "热点新闻",
      "nav.growth": "成长档案",
      "nav.ai": "AI 助手",
      "nav.weather": "天气",
      "nav.running": "跑步训练",
      "nav.prisma": "棱镜艺境", "nav.nexus": "云门智界", "nav.foldcraft": "折艺工坊", "nav.securify": "守御界", "nav.particles": "粒子星云",
      "role": "个人工作台",
      "mobile.today": "今日", "mobile.courses": "课程", "mobile.notes": "笔记", "mobile.focus": "专注", "mobile.more": "更多",
      "settings": "设置",
      "search.ph": "搜索笔记 / 任务 / 课程...",
      "title.dashboard": "今日", "title.courses": "课程作业", "title.notes": "学习笔记库",
      "title.focus": "专注学习", "title.growth": "成长档案", "title.lit": "文献资料",
      "title.news": "热点新闻", "title.ai": "AI 助手", "title.weather": "天气", "title.aria": "A.R.I.A", "sub.aria": "横向移动鼠标，驱动 A.R.I.A 的时间线", "title.running": "跑步训练",
      "title.prisma": "棱镜艺境", "title.nexus": "云门智界", "title.foldcraft": "折艺工坊", "title.securify": "守御界", "title.particles": "粒子星云",
      "sub.dashboard": "学习进度一览，今天也要保持专注",
      "sub.courses": "课程、课表与作业任务管理",
      "sub.notes": "沉淀知识，构建你的笔记库",
      "sub.focus": "番茄钟与专注统计",
      "sub.growth": "成绩、技能与成长轨迹",
      "sub.lit": "专业文献库与期刊导航",
      "sub.news": "每日国内外热点速递",
      "sub.ai": "你的智能学习伙伴",
      "sub.weather": "全国城市实时天气与未来一周预报", "weather.searchPh": "搜索城市（如：上海 / 长沙）", "weather.search": "搜索", "weather.refresh": "刷新", "weather.loading": "正在获取实时天气…",
      "sub.running": "跑步与马拉松训练记录（可导入华为运动健康数据）",
      "sub.prisma": "创意视觉工作室展示页", "sub.nexus": "下一代智能基础设施展示页", "sub.foldcraft": "视觉叙事创意工作室展示页", "sub.securify": "数据安全 SaaS 展示页", "sub.particles": "粒子聚合 · 鼠标交互浏览",
      "hero.todo": "待办任务", "hero.due": "今日到期", "hero.notes": "笔记", "hero.focusMin": "今日专注(分)", "hero.news": "今日热点", "hero.newsAll": "查看全部", "hero.refresh": "刷新", "hero.refreshed": "已刷新",
      "settings.title": "设置",
      "settings.theme": "界面主题", "settings.font": "界面字体", "settings.lang": "界面语言", "settings.bg": "界面背景", "bg.none": "无", "bg.guilinMist": "桂林·雾山", "bg.guilinAerial": "桂林·航拍", "bg.jiuzhaigou": "九寨沟", "bg.zhangjiajie": "张家界", "bg.hint": "以中国山河摄影作背景，文字始终清晰可读。", "settings.bgVis": "背景可见度", "bgVis.soft": "隐约", "bgVis.clear": "清晰", "bgVis.vivid": "极清晰",
      "settings.ai": "AI 模型配置（OpenAI 兼容接口）",
      "settings.nick": "个人昵称", "settings.data": "数据管理", "settings.lock": "访问密码",
      "lock.title": "平台已锁定", "lock.unlock": "解锁", "lock.enabled": "启用访问密码", "lock.enabledHint": "已开启：打开平台需输入密码。关闭此开关将清除已保存的密码。", "lock.needPin": "请先设置访问密码", "lock.pinNew": "新密码", "lock.pinConfirm": "确认密码", "lock.onLeave": "离开页面时自动锁定", "lock.hint": "设置密码后，打开平台需输入密码才能进入；密码仅保存在本机浏览器。", "lock.wrong": "密码错误", "lock.mismatch": "两次输入的密码不一致", "lock.saved": "访问密码已设置", "lock.cleared": "访问密码已清除", "settings.saved": "设置已保存",
      "theme.dark": "纯黑", "theme.light": "纯白", "theme.ocean": "墨蓝", "theme.forest": "青竹", "theme.sepia": "纸墨", "theme.custom": "自定义", "theme.purple": "暮紫", "theme.wine": "酒红", "theme.dusk": "晚霞", "theme.mist": "云灰", "theme.mint": "薄荷", "theme.honey": "蜜糖", "theme.guishan": "桂山", "theme.danxia": "丹霞", "theme.qingzang": "青藏", "theme.caoyuan": "草原", "theme.damo": "大漠",
      "font.default": "默认", "font.kai": "楷书", "font.song": "宋体", "font.fangsong": "仿宋", "font.hei": "黑体",
      "lang.zh": "简体", "lang.zhHant": "繁体", "lang.en": "English",
      "btn.addCourse": "+ 添加课程", "btn.addTask": "+ 添加任务", "btn.import": "导入课表", "btn.aiSort": "AI 智能排序",
      "btn.save": "保存", "btn.cancel": "取消", "btn.export": "导出数据(JSON)", "btn.importData": "导入数据", "btn.clear": "清空全部数据",
      "qr.title": "扫码访问", "qr.copy": "复制永久链接", "qr.hint": "手机扫码即可永久访问你的个人工作台。",
      "quote.title": "每日一言", "quote.next": "换一句", "quote.cat.motivation": "励志", "quote.cat.memes": "热梗", "quote.cat.poison": "毒鸡汤"
    },
    "zh-Hant": {
      "logo.sub": "個人學習工作台",
      "nav.group.work": "工作台",
      "nav.group.study": "學習資料",
      "nav.group.growth": "自我成長",
      "nav.dashboard": "今日",
      "nav.courses": "課程作業",
      "nav.focus": "專注學習",
      "nav.notes": "學習筆記庫",
      "nav.lit": "文獻資料",
      "nav.news": "熱點新聞",
      "nav.growth": "成長檔案",
      "nav.ai": "AI 助手",
      "nav.weather": "天氣",
      "nav.running": "跑步訓練",
      "nav.prisma": "稜鏡藝境", "nav.nexus": "雲門智界", "nav.foldcraft": "摺藝工坊", "nav.securify": "守禦界", "nav.particles": "粒子星雲",
      "role": "個人工作台",
      "mobile.today": "今日", "mobile.courses": "課程", "mobile.notes": "筆記", "mobile.focus": "專注", "mobile.more": "更多",
      "settings": "設定",
      "search.ph": "搜尋筆記 / 任務 / 課程...",
      "title.dashboard": "今日", "title.courses": "課程作業", "title.notes": "學習筆記庫",
      "title.focus": "專注學習", "title.growth": "成長檔案", "title.lit": "文獻資料",
      "title.news": "熱點新聞", "title.ai": "AI 助手", "title.weather": "天氣", "title.aria": "A.R.I.A", "sub.aria": "橫向移動滑鼠，驅動 A.R.I.A 的時間線", "title.running": "跑步訓練",
      "title.prisma": "稜鏡藝境", "title.nexus": "雲門智界", "title.foldcraft": "摺藝工坊", "title.securify": "守禦界", "title.particles": "粒子星雲",
      "sub.dashboard": "學習進度一覽，今天也要保持專注",
      "sub.courses": "課程、課表與作業任務管理",
      "sub.notes": "沉澱知識，構建你的筆記庫",
      "sub.focus": "番茄鐘與專注統計",
      "sub.growth": "成績、技能與成長軌跡",
      "sub.lit": "專業文獻庫與期刊導航",
      "sub.news": "每日國內外熱點速遞",
      "sub.ai": "你的智能學習夥伴",
      "sub.weather": "全國城市即時天氣與未來一週預報", "weather.searchPh": "搜索城市（如：上海 / 長沙）", "weather.search": "搜索", "weather.refresh": "刷新", "weather.loading": "正在獲取實時天氣…",
      "sub.running": "跑步與馬拉松訓練記錄（可匯入華為運動健康數據）",
      "sub.prisma": "創意視覺工作室展示頁", "sub.nexus": "下一代智能基礎設施展示頁", "sub.foldcraft": "視覺敘事創意工作室展示頁", "sub.securify": "數據安全 SaaS 展示頁", "sub.particles": "粒子聚合 · 滑鼠互動瀏覽",
      "hero.todo": "待辦任務", "hero.due": "今日到期", "hero.notes": "筆記", "hero.focusMin": "今日專注(分)", "hero.news": "今日熱點", "hero.newsAll": "查看全部", "hero.refresh": "刷新", "hero.refreshed": "已刷新",
      "settings.title": "設定",
      "settings.theme": "界面主題", "settings.font": "界面字體", "settings.lang": "界面語言", "settings.bg": "界面背景", "bg.none": "無", "bg.guilinMist": "桂林·霧山", "bg.guilinAerial": "桂林·航拍", "bg.jiuzhaigou": "九寨溝", "bg.zhangjiajie": "張家界", "bg.hint": "以中國山河攝影作背景，文字始終清晰可讀。", "settings.bgVis": "背景可見度", "bgVis.soft": "隱約", "bgVis.clear": "清晰", "bgVis.vivid": "極清晰",
      "settings.ai": "AI 模型配置（OpenAI 兼容接口）",
      "settings.nick": "個人暱稱", "settings.data": "數據管理", "settings.lock": "訪問密碼",
      "lock.title": "平台已鎖定", "lock.unlock": "解鎖", "lock.enabled": "啟用訪問密碼", "lock.enabledHint": "已開啟：打開平台需輸入密碼。關閉此開關將清除已保存的密碼。", "lock.needPin": "請先設置訪問密碼", "lock.pinNew": "新密碼", "lock.pinConfirm": "確認密碼", "lock.onLeave": "離開頁面時自動鎖定", "lock.hint": "設置密碼後，打開平台需輸入密碼才能進入；密碼僅保存在本機瀏覽器。", "lock.wrong": "密碼錯誤", "lock.mismatch": "兩次輸入的密碼不一致", "lock.saved": "訪問密碼已設置", "lock.cleared": "訪問密碼已清除", "settings.saved": "設置已保存",
      "theme.dark": "純黑", "theme.light": "純白", "theme.ocean": "墨藍", "theme.forest": "青竹", "theme.sepia": "紙墨", "theme.custom": "自定義", "theme.purple": "暮紫", "theme.wine": "酒紅", "theme.dusk": "晚霞", "theme.mist": "雲灰", "theme.mint": "薄荷", "theme.honey": "蜜糖", "theme.guishan": "桂山", "theme.danxia": "丹霞", "theme.qingzang": "青藏", "theme.caoyuan": "草原", "theme.damo": "大漠",
      "font.default": "默認", "font.kai": "楷書", "font.song": "宋體", "font.fangsong": "仿宋", "font.hei": "黑體",
      "lang.zh": "簡體", "lang.zhHant": "繁體", "lang.en": "English",
      "btn.addCourse": "+ 添加課程", "btn.addTask": "+ 添加任務", "btn.import": "導入課表", "btn.aiSort": "AI 智能排序",
      "btn.save": "保存", "btn.cancel": "取消", "btn.export": "導出數據(JSON)", "btn.importData": "導入數據", "btn.clear": "清空全部數據",
      "qr.title": "掃碼訪問", "qr.copy": "複製永久連結", "qr.hint": "手機掃碼即可永久訪問你的個人工作台。",
      "quote.title": "每日一言", "quote.next": "換一句", "quote.cat.motivation": "勵志", "quote.cat.memes": "熱梗", "quote.cat.poison": "毒雞湯"
    },
    en: {
      "logo.sub": "Personal Study Desk",
      "nav.group.work": "Work",
      "nav.group.study": "Study",
      "nav.group.growth": "Growth",
      "nav.dashboard": "Today",
      "nav.courses": "Courses",
      "nav.focus": "Focus",
      "nav.notes": "Notes",
      "nav.lit": "Library",
      "nav.news": "News",
      "nav.growth": "Profile",
      "nav.ai": "AI Assistant",
      "nav.weather": "Weather",
      "nav.running": "Running",
      "nav.prisma": "Prisma", "nav.nexus": "Nexus", "nav.foldcraft": "Foldcraft", "nav.securify": "Securify", "nav.particles": "Particle Nebula",
      "role": "Personal workspace",
      "mobile.today": "Today", "mobile.courses": "Courses", "mobile.notes": "Notes", "mobile.focus": "Focus", "mobile.more": "More",
      "settings": "Settings",
      "search.ph": "Search notes / tasks / courses...",
      "title.dashboard": "Today", "title.courses": "Courses", "title.notes": "Notes",
      "title.focus": "Focus", "title.growth": "Profile", "title.lit": "Library",
      "title.news": "News", "title.ai": "AI Assistant", "title.weather": "Weather", "title.aria": "A.R.I.A", "sub.aria": "Move your mouse to scrub A.R.I.A's timeline", "title.running": "Running",
      "title.prisma": "Prisma", "title.nexus": "Nexus", "title.foldcraft": "Foldcraft", "title.securify": "Securify", "title.particles": "Particle Nebula",
      "sub.dashboard": "Your study at a glance — stay focused today",
      "sub.courses": "Courses, timetable & assignments",
      "sub.notes": "Build your knowledge base",
      "sub.focus": "Pomodoro & focus stats",
      "sub.growth": "Grades, skills & growth",
      "sub.lit": "References & journal navigation",
      "sub.news": "Daily headline digest",
      "sub.ai": "Your smart study partner",
      "sub.weather": "Live weather for Chinese cities with a 7-day forecast", "weather.searchPh": "Search city (e.g. Shanghai)", "weather.search": "Search", "weather.refresh": "Refresh", "weather.loading": "Fetching live weather…",
      "sub.running": "Running & marathon training (import Huawei Health data)",
      "sub.prisma": "Creative visual studio showcase", "sub.nexus": "Next-layer AI infrastructure showcase", "sub.foldcraft": "Visual storytelling studio showcase", "sub.securify": "Data-security SaaS showcase", "sub.particles": "Particle morph with mouse interaction",
      "hero.todo": "Open tasks", "hero.due": "Due today", "hero.notes": "Notes", "hero.focusMin": "Focus (min)", "hero.news": "Top News", "hero.newsAll": "View All", "hero.refresh": "Refresh", "hero.refreshed": "Updated",
      "settings.title": "Settings",
      "settings.theme": "Theme", "settings.font": "Font", "settings.lang": "Language", "settings.bg": "Background", "bg.none": "None", "bg.guilinMist": "Guilin Mist", "bg.guilinAerial": "Guilin Aerial", "bg.jiuzhaigou": "Jiuzhaigou", "bg.zhangjiajie": "Zhangjiajie", "bg.hint": "China landscape photography as backdrop; text stays readable.", "settings.bgVis": "Background visibility", "bgVis.soft": "Subtle", "bgVis.clear": "Clear", "bgVis.vivid": "Very clear",
      "settings.ai": "AI Model (OpenAI-compatible)",
      "settings.nick": "Nickname", "settings.data": "Data", "settings.lock": "Access PIN",
      "lock.title": "Locked", "lock.unlock": "Unlock", "lock.enabled": "Enable access PIN", "lock.enabledHint": "On: the platform asks for the PIN on open. Turning this off clears the saved PIN.", "lock.needPin": "Please set an access PIN first", "lock.pinNew": "New PIN", "lock.pinConfirm": "Confirm PIN", "lock.onLeave": "Lock when leaving the page", "lock.hint": "Once set, the platform asks for the PIN on open. The PIN stays only in this browser.", "lock.wrong": "Wrong PIN", "lock.mismatch": "PINs do not match", "lock.saved": "Access PIN saved", "lock.cleared": "Access PIN cleared", "settings.saved": "Settings saved",
      "theme.dark": "Black", "theme.light": "White", "theme.ocean": "Ocean", "theme.forest": "Forest", "theme.sepia": "Sepia", "theme.custom": "Custom", "theme.purple": "Purple", "theme.wine": "Wine", "theme.dusk": "Dusk", "theme.mist": "Mist", "theme.mint": "Mint", "theme.honey": "Honey", "theme.guishan": "Guishan", "theme.danxia": "Danxia", "theme.qingzang": "Qingzang", "theme.caoyuan": "Grassland", "theme.damo": "Desert",
      "font.default": "Default", "font.kai": "Kai", "font.song": "Song", "font.fangsong": "FangSong", "font.hei": "Hei",
      "lang.zh": "Simplified", "lang.zhHant": "Traditional", "lang.en": "English",
      "btn.addCourse": "+ Add Course", "btn.addTask": "+ Add Task", "btn.import": "Import", "btn.aiSort": "AI Sort",
      "btn.save": "Save", "btn.cancel": "Cancel", "btn.export": "Export (JSON)", "btn.importData": "Import", "btn.clear": "Clear All",
      "qr.title": "Scan to Visit", "qr.copy": "Copy Link", "qr.hint": "Scan to open your workspace on your phone.",
      "quote.title": "Daily Quote", "quote.next": "Next", "quote.cat.motivation": "Inspire", "quote.cat.memes": "Meme", "quote.cat.poison": "Savage"
    }
  };
  function t(key) {
    const lang = document.documentElement.dataset.lang || "zh";
    const d = I18N[lang] || I18N.zh;
    return d[key] != null ? d[key] : (I18N.zh[key] != null ? I18N.zh[key] : key);
  }
  function applyI18n() {
    $$("[data-i18n]").forEach(el => {
      const k = el.dataset.i18n;
      if (k) el.textContent = t(k);
    });
    $$("[data-i18n-ph]").forEach(el => {
      const k = el.dataset.i18nPh;
      if (k) el.placeholder = t(k);
    });
  }
  function applyFont(font) {
    const FONT_MIGRATE = { sans: "default", serif: "song", mono: "hei" };
    font = FONT_MIGRATE[font] || font;
    document.documentElement.dataset.font = font;
    localStorage.setItem("zero_font", font);
    $$("[data-font-pick]").forEach(b => b.classList.toggle("active", b.dataset.fontPick === font));
  }
  function applyBg(bg) {
    document.documentElement.dataset.bg = bg;
    localStorage.setItem("zero_bg", bg);
    $$("[data-bg-pick]").forEach(b => b.classList.toggle("active", b.dataset.bgPick === bg));
  }
  function applyBgVis(vis) {
    if (!["soft", "clear", "vivid"].includes(vis)) vis = "clear";
    document.documentElement.dataset.bgVis = vis;
    localStorage.setItem("zero_bg_vis", vis);
    $$(".theme-opt[data-bg-vis]").forEach(b => b.classList.toggle("active", b.dataset.bgVis === vis));
  }
  function applyLang(lang) {
    document.documentElement.dataset.lang = lang;
    localStorage.setItem("zero_lang", lang);
    $$("[data-lang-pick]").forEach(b => b.classList.toggle("active", b.dataset.langPick === lang));
    applyI18n();
    // 天气视图按新语言重渲染（用缓存数据，不重新请求）
    if (currentView === "weather" && window.Weather) Weather.reRender();
    // 重渲染依赖文案的界面
    if (typeof switchView === "function") { switchView(currentView); } else { renderCurrent(); }
  }

  async function saveSettings() {
    // 访问密码：总开关关闭 → 清除密码；开启 → 校验并保存
    // ⚠️ 旧写法在「勾了开关但没填设置密码」时直接 return 整个 saveSettings，
    //    导致 API Key / 主题 / 同步 token 等所有其他设置被连带静默丢弃，
    //    用户只看到一闪而过的 toast，以为都保存了（深审计 2026-09-05 发现）。
    //    现在：锁没配好只影响锁本身，其余设置照常保存；并把开关回置为关，
    //    避免界面显示"已开启"但实际未启用（状态不同步，是更大的坑）。
    let lockPendingReason = "";
    const lockEnabled = $("#lockEnabled") ? $("#lockEnabled").checked : false;
    if (lockEnabled) {
      const pin = $("#setPin").value;
      const pin2 = $("#setPin2").value;
      if (pin || pin2) {
        // 两次输入不一致是真错误，仍中止保存交由用户修正
        if (pin !== pin2) { toast(t("lock.mismatch"), "err"); return; }
        if (!(await setPin(pin))) return;
        toast(pin ? t("lock.saved") : "", "ok");
      }
      if (!hasPin()) {
        lockPendingReason = t("lock.needPin");
        localStorage.removeItem("zero_lock_enabled");
        localStorage.removeItem("zero_lock_leave");
        const le = $("#lockEnabled");
        if (le) { le.checked = false; try { toggleLockFields(false); } catch (e) {} }
      } else {
        localStorage.setItem("zero_lock_enabled", "1");
        localStorage.setItem("zero_lock_leave", $("#lockOnLeave").checked ? "1" : "0");
      }
    } else {
      // 关闭：清除密码与所有锁定偏好
      await setPin("");
      localStorage.removeItem("zero_lock_enabled");
      localStorage.removeItem("zero_lock_leave");
    }
    const devModeOn = !!($("#devModeEnabled") && $("#devModeEnabled").checked);
    Store.setSettings({
      baseUrl: $("#setBaseUrl").value.trim(),
      apiKey: $("#setApiKey").value.trim(),
      model: $("#setModel").value.trim(),
      nickname: $("#setNickname").value.trim(),
      developerMode: devModeOn,
      useLocalAiProxy: !!($("#setUseProxy") && $("#setUseProxy").checked)
    });
    // 通知原生层写入/删除开发者模式标记（重启后 F12 调试台才生效）
    try {
      if (window.__xyCtrl) fetch(window.__xyCtrl + "/dev-mode?on=" + (devModeOn ? 1 : 0), { mode: "cors" }).catch(() => {});
    } catch (e) {}
    const nick = $("#setNickname").value.trim();
    if (nick) Store.setProfile({ name: nick });
    closeModal("settingsModal");
    // 锁没配好：明确告知"其余已保存、锁未启用"，别让用户以为全丢了或全存了
    if (lockPendingReason) toast(lockPendingReason + "，访问密码暂未启用；其余设置已保存。", "err", { duration: 5000 });
    else toast(t("settings.saved"), "ok");
    renderAIStatus();
    renderProfile();
    if (currentView === "dashboard") renderDashboard();
  }

  /* ============================================================
     全局搜索
     ============================================================ */
  function setupSearch() {
    const input = $("#globalSearch");
    const box = $("#searchResults");
    if (!input || !box) return;
    let results = [];
    let activeIndex = -1;

    const collect = q => {
      const out = [];
      const add = (items, type, view, act, text) => items.forEach(item => {
        const haystack = text(item).toLowerCase();
        if (haystack.includes(q)) out.push({ type, view, act, id: item.id, title: item.title || item.name || item.subject || "未命名" });
      });
      add(Store.getAll("notes"), "笔记", "notes", "note", n => `${n.title || ""} ${n.subject || ""} ${n.content || ""} ${(n.tags || []).join(" ")}`);
      add(Store.getAll("tasks"), "任务", "courses", "task", t => `${t.title || ""} ${Store.getCourseName(t.courseId)}`);
      add(Store.getAll("courses"), "课程", "courses", "course", c => `${c.name || ""} ${c.teacher || ""} ${c.location || ""}`);
      add(Store.getAll("literature"), "文献", "lit", "lit", l => `${l.title || ""} ${l.authors || ""} ${(l.tags || []).join(" ")}`);
      add(Store.getAll("projects"), "项目", "growth", "project", p => `${p.name || ""} ${p.role || ""} ${p.desc || ""}`);
      return out.slice(0, 8);
    };

    const hide = () => {
      box.hidden = true;
      box.innerHTML = "";
      results = [];
      activeIndex = -1;
      input.removeAttribute("aria-activedescendant");
    };

    const select = item => {
      if (!item) return;
      hide();
      input.value = "";
      switchView(item.view);
      if (item.act === "note") setTimeout(() => openNote(item.id), 100);
      else if (item.act === "task") setTimeout(() => openTaskForm(item.id), 100);
      else if (item.act === "course") setTimeout(() => openCourseForm(item.id), 100);
      else if (item.act === "lit") setTimeout(() => openLitForm(item.id), 100);
      else toast(`已跳转到「${item.type}」`, "ok");
    };

    const setActive = index => {
      if (!results.length) return;
      activeIndex = (index + results.length) % results.length;
      box.querySelectorAll(".search-result").forEach((el, i) => el.classList.toggle("active", i === activeIndex));
      const active = box.querySelector(`#search-result-${activeIndex}`);
      if (active) {
        input.setAttribute("aria-activedescendant", active.id);
        active.scrollIntoView({ block: "nearest" });
      }
    };

    const render = () => {
      const q = input.value.trim().toLowerCase();
      if (!q) { hide(); return; }
      results = collect(q);
      box.hidden = false;
      box.innerHTML = results.length
        ? results.map((r, i) => `<button type="button" class="search-result" id="search-result-${i}" role="option" data-index="${i}"><span>${esc(r.title)}</span><small>${r.type}</small></button>`).join("")
        : `<div class="search-empty">未找到匹配内容</div>`;
      activeIndex = results.length ? 0 : -1;
      if (results.length) setActive(0);
      box.querySelectorAll(".search-result").forEach(el => {
        el.onmousedown = e => e.preventDefault();
        el.onclick = () => select(results[Number(el.dataset.index)]);
      });
    };

    input.addEventListener("input", render);
    input.addEventListener("focus", () => { if (input.value.trim()) render(); });
    input.addEventListener("blur", () => setTimeout(hide, 120));
    input.addEventListener("keydown", e => {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive(activeIndex + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive(activeIndex - 1); }
      else if (e.key === "Enter" && activeIndex >= 0) { e.preventDefault(); select(results[activeIndex]); }
      else if (e.key === "Escape") { hide(); input.blur(); }
    });
  }

  /* ============================================================
     时钟 + 节日
     ============================================================ */
  function tickClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, "0");
    const m = String(now.getMinutes()).padStart(2, "0");
    $("#clockTime").textContent = `${h}:${m}`;
    const week = WEEKDAYS[now.getDay()];
    $("#clockDate").textContent = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${week}`;

    // 节日 + 农历
    const festEl = $("#clockFest");
    if (festEl && window.Lunar) {
      const info = Lunar.getTodayInfo(now);
      let parts = [];
      if (info.main) {
        parts.push(`<span class="fest-today">${info.main.emoji} ${info.main.name}</span>`);
      }
      parts.push(`<span class="fest-lunar">${info.lunarText}</span>`);
      if (info.next && info.next.days > 0) {
        parts.push(`<span class="fest-next">距${info.next.festival.name}还有${info.next.days}天</span>`);
      }
      festEl.innerHTML = parts.join(" · ");
    } else if (festEl) {
      festEl.textContent = "";
    }
  }

  /* ============================================================
     二维码
     ============================================================ */
  const DEFAULT_SITE = window.XINGYU_SITE_URL || "https://lele332.github.io/xingyu-platform/";
  let lanUrl = "";

  function makeQrHint(text) {
    const h = document.createElement("div");
    h.className = "qr-lan-hint";
    h.textContent = text;
    return h;
  }

  function makeQrImg(src, alt, fallback) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = alt;
    img.className = "qr-static";
    img.onerror = () => img.replaceWith(makeQrHint(fallback));
    return img;
  }

  // 服务 bind 在回环地址时，二维码里那个局域网 IP 是连不上的
  // （server.py:29 BIND_HOST 默认 127.0.0.1）。与其让用户扫了白等，
  // 不如直接告知并给出开法。
  function isLoopbackBind(b) {
    const s = String(b || "").trim().toLowerCase();
    return !s || s === "localhost" || s === "::1" || /^127\./.test(s);
  }

  function makeQrBlocked(bind) {
    const box = document.createElement("div");
    box.className = "qr-blocked";
    const t = document.createElement("div");
    t.className = "qr-blocked-title";
    t.textContent = "当前仅本机可访问";
    const p = document.createElement("div");
    p.className = "qr-blocked-body";
    p.textContent = "手机扫这个码会连不上。请用桌面「星屿」快捷方式重启一次，即可开启局域网访问。";
    const c = document.createElement("div");
    c.className = "qr-blocked-code";
    c.textContent = "bind=" + (bind || "127.0.0.1");
    box.appendChild(t);
    box.appendChild(p);
    box.appendChild(c);
    return box;
  }

  function makeQrCard(title, desc, node, note) {
    const col = document.createElement("div");
    col.className = "qr-col";
    const label = document.createElement("div");
    label.className = "qr-label";
    label.textContent = title;
    const sub = document.createElement("div");
    sub.className = "qr-sub";
    sub.textContent = desc;
    col.appendChild(label);
    col.appendChild(node);
    col.appendChild(sub);
    if (note) col.appendChild(note);
    return col;
  }

  function renderQR() {
    const box = $("#qrCodeBox");
    const note = $("#qrNote");
    box.innerHTML = "";
    note.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "qr-grid";

    // 左：永久访问
    grid.appendChild(makeQrCard(
      "永久访问 · 功能较少",
      "任何网络可用，不依赖电脑开机。",
      makeQrImg("xingyu-qrcode.png", "永久二维码", "永久二维码加载失败")
    ));

    // 右：同一 WiFi，手机适配版，走本机完整配置。
    const lanNode = makeQrImg("/qrcode.png?text=" + encodeURIComponent("等待生成"), "手机适配版二维码", "局域网二维码生成失败");
    const lanNote = document.createElement("div");
    lanNote.className = "qr-url";
    lanNote.textContent = "正在生成手机适配版…";
    const lanCol = makeQrCard(
      "同一 WiFi · 配置拉满",
      "手机适配版 · 功能拉满。",
      lanNode,
      lanNote
    );
    grid.appendChild(lanCol);

    fetch("/api/lan-info", { cache: "no-store" })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(info => {
        // bind 还在回环 = 局域网根本没开，扫了也是白扫，直接换成提示。
        if (isLoopbackBind(info.bind)) {
          lanNode.replaceWith(makeQrBlocked(info.bind));
          lanNote.textContent = "服务只监听 " + (info.bind || "127.0.0.1") + "，重启星屿后自动开启局域网。";
          lanUrl = "";
          return;
        }
        const ip = info.ip || (Array.isArray(info.ips) ? info.ips[0] : "");
        if ((!ip || !info.token) && !info.url) throw new Error("no lan info");
        lanUrl = info.url || `http://${ip}:${info.port || 8620}/access?token=${encodeURIComponent(info.token)}`;
        lanNode.src = `/qrcode.png?text=${encodeURIComponent(lanUrl)}&_t=${Date.now()}`;
        lanNote.textContent = lanUrl;
      })
      .catch(() => {
        // 新服务启动时会重写这个兜底图；旧服务进程则提供最后一张已知二维码。
        lanUrl = "";
        lanNode.src = `assets/lan-access-qr.png?_t=${Date.now()}`;
        lanNote.textContent = "已用兜底二维码。重启星屿后这里会重新生成最新地址。";
      });

    box.appendChild(grid);
    note.textContent = "左边适合在外面扫码；右边适合家里/宿舍同一 WiFi，手机上也是完整功能。";
  }

  function openQR() {
    showModal("qrcodeModal");
    renderQR();
  }

  function copyText(url, okText) {
    if (!url) { toast("链接还没准备好", "err"); return; }
    navigator.clipboard.writeText(url)
      .then(() => toast(okText, "ok"))
      .catch(() => toast("复制失败，请手动复制：" + url, "err"));
  }

  function copyPerm() { copyText(DEFAULT_SITE, "永久链接已复制"); }
  function copyLan() { copyText(lanUrl, "局域网链接已复制"); }

  /* ============================================================
     导入课表
     ============================================================ */
  const COURSE_COLORS = ["var(--course-1)", "var(--course-2)", "var(--course-3)", "var(--course-4)", "var(--course-5)", "var(--course-6)", "var(--course-7)", "var(--course-8)"];
  let pendingImportCourses = [];

  function openImportModal() {
    pendingImportCourses = [];
    // 重置界面
    $("#imgPreview").innerHTML = "";
    $("#scheduleImgFile").value = "";
    $("#scheduleText").value = "";
    $("#importResult").style.display = "none";
    $("#btnRecognizeImg").disabled = true;
    // 默认选中"粘贴文本"更通用；若已配置 AI 且有视觉模型则默认截图
    $$(".import-tab").forEach(t => t.classList.toggle("active", t.dataset.itab === "text"));
    $$(".import-panel").forEach(p => p.classList.toggle("active", p.id === "itab-text"));
    showModal("importModal");
  }

  function showImportResult(courses) {
    pendingImportCourses = courses;
    const box = $("#importResultList");
    const resultBox = $("#importResult");
    if (!courses.length) {
      resultBox.style.display = "block";
      box.innerHTML = `<div class="empty-state"><p>未能识别出课程，请检查图片清晰度 / 文本格式后重试，或手动添加课程。</p></div>`;
      $("#importResultCount").textContent = "0 门";
      return;
    }
    resultBox.style.display = "block";
    $("#importResultCount").textContent = `${courses.length} 门课程`;
    box.innerHTML = courses.map((c, i) => `
      <div class="import-course">
        <span class="import-cd" style="background:${COURSE_COLORS[i % COURSE_COLORS.length]}">${WEEKDAYS[c.day] || "?"}</span>
        <div class="import-ci">
          <b>${esc(c.name)}</b>
          <span>${c.start || "?"}-${c.end || "?"} · ${esc(c.location || "未填地点")}${c.teacher ? " · " + esc(c.teacher) : ""}</span>
        </div>
      </div>`).join("");
  }

  async function recognizeImg() {
    const btn = $("#btnRecognizeImg");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span>识别中...`;
    try {
      const base64 = await readImageFile($("#scheduleImgFile").files[0]);
      const courses = await AI.recognizeScheduleImage(base64);
      showImportResult(courses);
      if (!courses.length) toast("未识别到课程", "err");
    } catch (e) {
      toast(e.message || "识别失败", "err");
    } finally {
      btn.disabled = false;
      btn.textContent = "AI 识别课表";
    }
  }

  function handleScheduleImg() {
    const file = $("#scheduleImgFile").files[0];
    if (!file) return;
    const preview = $("#imgPreview");
    preview.innerHTML = "";
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.style.maxWidth = "100%";
    img.style.maxHeight = "260px";
    img.style.borderRadius = "10px";
    preview.appendChild(img);
    $("#btnRecognizeImg").disabled = false;
    toast("图片已选择，点击「AI 识别课表」", "ok");
  }

  function readImageFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error("请先选择图片"));
      if (!/^image\//i.test(file.type || "")) return reject(new Error("请选择 JPG、PNG 等图片文件"));
      if (file.size > 10 * 1024 * 1024) return reject(new Error("图片不能超过 10MB，请压缩后重试"));
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("图片读取失败"));
      reader.readAsDataURL(file);
    });
  }

  function confirmImport() {
    if (!pendingImportCourses.length) { toast("没有可导入的课程", "err"); return; }
    const existing = Store.getAll("courses");
    const existingNames = new Set(existing.map(c => c.name));
    let added = 0, skipped = 0;
    pendingImportCourses.forEach((c, i) => {
      if (!c.name || !c.day) { skipped++; return; }
      if (existingNames.has(c.name)) { skipped++; return; }
      Store.add("courses", { ...c, color: COURSE_COLORS[i % COURSE_COLORS.length] });
      existingNames.add(c.name);
      added++;
    });
    closeModal("importModal");
    toast(added ? `已导入 ${added} 门课程${skipped ? `，跳过 ${skipped} 门（重复或无效）` : ""}` : "没有新课程可导入（可能已存在）", added ? "ok" : "err");
    renderCourses();
  }

  /* ============================================================
     导入成绩
     ============================================================ */
  let pendingImportGrades = [];

  function openGradesImportModal() {
    pendingImportGrades = [];
    $("#gradesText").value = "";
    $("#gradesImgFile").value = "";
    $("#gradesImgPreview").innerHTML = "";
    $("#gradesImportResult").style.display = "none";
    $("#btnRecognizeGrades").disabled = true;
    $$(".import-tab").forEach(t => t.classList.toggle("active", t.dataset.itab === "gtext"));
    $$(".import-panel").forEach(p => p.classList.toggle("active", p.id === "itab-gtext"));
    showModal("importGradesModal");
  }

  function showGradesImportResult(grades) {
    pendingImportGrades = grades;
    const box = $("#gradesResultList");
    const resultBox = $("#gradesImportResult");
    if (!grades.length) {
      resultBox.style.display = "block";
      box.innerHTML = `<div class="empty-state"><p>未能解析出成绩，请检查文本格式后重试，或手动添加成绩。</p></div>`;
      $("#gradesResultCount").textContent = "0 条";
      return;
    }
    resultBox.style.display = "block";
    $("#gradesResultCount").textContent = `${grades.length} 条成绩`;
    box.innerHTML = grades.map(g => `
      <div class="import-course">
        <span class="import-cd" style="background:${g.score >= 90 ? "var(--course-2)" : g.score >= 60 ? "var(--course-5)" : "var(--course-1)"}">${g.score}</span>
        <div class="import-ci">
          <b>${esc(g.subject)}</b>
          <span>${esc(g.name)} · ${g.credit}学分${g.semester ? " · " + esc(g.semester) : ""}</span>
        </div>
      </div>`).join("");
  }

  function confirmGradesImport() {
    if (!pendingImportGrades.length) { toast("没有可导入的成绩", "err"); return; }
    const existing = Store.getAll("grades");
    let added = 0, skipped = 0;
    pendingImportGrades.forEach(g => {
      const dup = existing.find(x => x.subject === g.subject && x.name === g.name && x.semester === g.semester);
      if (dup) { skipped++; return; }
      Store.add("grades", g);
      existing.push(g);
      added++;
    });
    closeModal("importGradesModal");
    toast(added ? `已导入 ${added} 条成绩${skipped ? `，跳过 ${skipped} 条重复` : ""}` : "没有新成绩可导入（可能已存在）", added ? "ok" : "err");
    renderGrowth();
  }

  async function parseGradesBtn() {
    const text = $("#gradesText").value.trim();
    if (!text) { toast("请先粘贴成绩文本", "err"); return; }
    const btn = $("#btnParseGrades");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span>解析中...`;
    try {
      const grades = await AI.parseGradesText(text);
      showGradesImportResult(grades);
      if (!grades.length) toast("未能解析出成绩，请检查格式", "err");
    } catch (e) {
      toast(e.message || "解析失败", "err");
    } finally {
      btn.disabled = false;
      btn.textContent = "解析成绩";
    }
  }

  function handleGradesImg() {
    const file = $("#gradesImgFile").files[0];
    if (!file) return;
    const preview = $("#gradesImgPreview");
    preview.innerHTML = "";
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.style.maxWidth = "100%";
    img.style.maxHeight = "260px";
    img.style.borderRadius = "10px";
    preview.appendChild(img);
    $("#btnRecognizeGrades").disabled = false;
    toast("图片已选择，点击「AI 识别成绩」", "ok");
  }

  async function recognizeGradesBtn() {
    const btn = $("#btnRecognizeGrades");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span>识别中...`;
    try {
      const base64 = await readImageFile($("#gradesImgFile").files[0]);
      const grades = await AI.recognizeGradesImage(base64);
      showGradesImportResult(grades);
      if (!grades.length) toast("未识别到成绩", "err");
    } catch (e) {
      toast(e.message || "识别失败", "err");
    } finally {
      btn.disabled = false;
      btn.textContent = "AI 识别成绩";
    }
  }

  /* ============================================================
     导入笔记
     ============================================================ */
  let pendingImportNotes = [];

  function openNotesImportModal() {
    pendingImportNotes = [];
    $("#notesText").value = "";
    $("#notesImgFile").value = "";
    $("#notesImgPreview").innerHTML = "";
    $("#notesImportResult").style.display = "none";
    $("#btnRecognizeNotes").disabled = true;
    $$(".import-tab").forEach(t => t.classList.toggle("active", t.dataset.itab === "ntext"));
    $$(".import-panel").forEach(p => p.classList.toggle("active", p.id === "itab-ntext"));
    showModal("importNotesModal");
  }

  function showNotesImportResult(notes) {
    pendingImportNotes = notes;
    const box = $("#notesResultList");
    const resultBox = $("#notesImportResult");
    if (!notes.length) {
      resultBox.style.display = "block";
      box.innerHTML = `<div class="empty-state"><p>未能识别出笔记，请检查文本/图片后重试，或手动新建笔记。</p></div>`;
      $("#notesResultCount").textContent = "0 条";
      return;
    }
    resultBox.style.display = "block";
    $("#notesResultCount").textContent = `${notes.length} 条笔记`;
    box.innerHTML = notes.map((n, i) => `
      <div class="import-course">
        <span class="import-cd" style="background:${COURSE_COLORS[i % COURSE_COLORS.length]}"></span>
        <div class="import-ci">
          <b>${esc(n.title)}</b>
          <span>${esc(n.subject || "未分类")}${n.tags.length ? " · " + n.tags.map(t => "#" + esc(t)).join(" ") : ""}</span>
          <div style="font-size:12px;color:var(--text-dim);margin-top:4px;max-height:48px;overflow:hidden">${esc(n.content).slice(0, 120)}</div>
        </div>
      </div>`).join("");
  }

  function confirmNotesImport() {
    if (!pendingImportNotes.length) { toast("没有可导入的笔记", "err"); return; }
    const existing = Store.getAll("notes");
    const existingTitles = new Set(existing.map(n => n.title));
    let added = 0, skipped = 0;
    const now = new Date().toISOString();
    pendingImportNotes.forEach(n => {
      if (!n.title) { skipped++; return; }
      if (existingTitles.has(n.title)) { skipped++; return; }
      Store.add("notes", { ...n, createdAt: now, updatedAt: now });
      existingTitles.add(n.title);
      added++;
    });
    closeModal("importNotesModal");
    toast(added ? `已导入 ${added} 条笔记${skipped ? `，跳过 ${skipped} 条重复` : ""}` : "没有新笔记可导入（可能已存在）", added ? "ok" : "err");
    renderNotes();
  }

  async function parseNotesBtn() {
    const text = $("#notesText").value.trim();
    if (!text) { toast("请先粘贴笔记内容", "err"); return; }
    const btn = $("#btnParseNotes");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span>识别中...`;
    try {
      const notes = await AI.parseNotesText(text);
      showNotesImportResult(notes);
      if (!notes.length) toast("未能识别出笔记，请检查格式", "err");
    } catch (e) {
      toast(e.message || "识别失败", "err");
    } finally {
      btn.disabled = false;
      btn.textContent = "识别并整理";
    }
  }

  function handleNotesImg() {
    const file = $("#notesImgFile").files[0];
    if (!file) return;
    const preview = $("#notesImgPreview");
    preview.innerHTML = "";
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.style.maxWidth = "100%";
    img.style.maxHeight = "260px";
    img.style.borderRadius = "10px";
    preview.appendChild(img);
    $("#btnRecognizeNotes").disabled = false;
    toast("图片已选择，点击「AI 识别笔记」", "ok");
  }

  async function recognizeNotesBtn() {
    const btn = $("#btnRecognizeNotes");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span>识别中...`;
    try {
      const base64 = await readImageFile($("#notesImgFile").files[0]);
      const notes = await AI.recognizeNotesImage(base64);
      showNotesImportResult(notes);
      if (!notes.length) toast("未识别到笔记内容", "err");
    } catch (e) {
      toast(e.message || "识别失败", "err");
    } finally {
      btn.disabled = false;
      btn.textContent = "AI 识别笔记";
    }
  }

  /* ============================================================
     事件绑定
     ============================================================ */
﻿/* ---------- 考试日程 ---------- */
  const EXAM_TYPES = { exam: "考试", homework: "作业截止", event: "重要日程", important: "重要日子" };
  let calYear = 0, calMonth = 0, calSelDate = "";

  function examParts(dateStr) {
    const p = String(dateStr || "").split("-");
    return { y: +p[0] || 0, m: +p[1] || 0, d: +p[2] || 0 };
  }

  function examStatusOf(e) {
    if (e.status === "done") return "done";
    const d = daysUntil(e.date);
    if (d === null) return "upcoming";
    if (d < 0) return "past";
    if (d === 0) return "today";
    return "upcoming";
  }

  function renderExams() {
    renderExamSummary();
    renderExamList();
    renderExamCalendar();
    renderExamDayEvents();
  }

  function examFiltered() {
    const type = $("#examFilterType").value;
    const status = $("#examFilterStatus").value;
    return Store.getAll("exams")
      .filter(e => (!type || e.type === type) && (!status || (status === "done" ? e.status === "done" : e.status !== "done")))
      .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  }

  function renderExamSummary() {
    const all = Store.getAll("exams");
    const done = all.filter(e => e.status === "done").length;
    const upcoming = all.filter(e => e.status !== "done" && daysUntil(e.date) >= 0).length;
    const next = all.filter(e => e.status !== "done" && daysUntil(e.date) >= 0)
      .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))[0];
    const box = $("#examSummary");
    if (!next) {
      box.innerHTML = `
        <div class="exam-next none">
          <div class="exam-next-label">下一个关键时刻</div>
          <div class="exam-next-title">暂无进行中的日程</div>
          <div class="exam-stats">
            <span><b>${done}</b> 已完成</span>
            <span><b>${upcoming}</b> 未开始</span>
            <span><b>${all.length}</b> 全部</span>
          </div>
        </div>`;
      return;
    }
    const d = daysUntil(next.date);
    const total = 30;
    const prog = Math.max(0, Math.min(1, (total - d) / total));
    const C = 326.73;
    const off = (C * (1 - prog)).toFixed(1);
    box.innerHTML = `
      <div class="exam-next">
        <div class="exam-next-head">
          <span class="exam-next-badge">${EXAM_TYPES[next.type] || "日程"}</span>
          <span class="exam-next-label">下一个关键时刻</span>
        </div>
        <div class="exam-ring-wrap">
          <svg class="exam-ring" viewBox="0 0 120 120" aria-hidden="true">
            <circle class="ring-bg" cx="60" cy="60" r="52"></circle>
            <circle class="ring-fg" cx="60" cy="60" r="52" style="stroke-dasharray:${C};stroke-dashoffset:${C}"></circle>
          </svg>
          <div class="exam-ring-center">
            <b data-cd="${d}">${d === 0 ? "今天" : d}</b>
            <span>${d === 0 ? "就是今天，加油！" : (d === 1 ? "还有 1 天就要到了" : "天后到来")}</span>
          </div>
        </div>
        <div class="exam-next-title">${esc(next.title)}</div>
        <div class="exam-next-date">${fmtDateFull(next.date)}${next.time ? " · " + esc(next.time) : ""}</div>
        <div class="exam-next-progress"><i style="width:${(prog * 100).toFixed(0)}%"></i></div>
        <div class="exam-stats">
          <span><b>${done}</b> 已完成</span>
          <span><b>${upcoming}</b> 未开始</span>
          <span><b>${all.length}</b> 全部</span>
        </div>
      </div>`;
    requestAnimationFrame(() => {
      const fg = box.querySelector(".ring-fg");
      if (fg) fg.style.strokeDashoffset = off;
    });
    animateExamCount(box.querySelector(".exam-ring-center b"), d);
  }

  function animateExamCount(el, target) {
    if (!el || target === 0) { if (el) el.textContent = "今天"; return; }
    const start = 0;
    const dur = 700;
    const t0 = performance.now();
    function step(now) {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(start + (target - start) * eased);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function renderExamList() {
    const list = examFiltered();
    const box = $("#examList");
    if (!list.length) {
      box.innerHTML = `<div class="empty-state"><div class="big">&#128197;</div><p>还没有日程，点击右上角「添加考试/日程」开始规划</p></div>`;
      return;
    }
    box.innerHTML = list.map(e => {
      const st = examStatusOf(e);
      const d = daysUntil(e.date);
      const badge = st === "done" ? `<span class="exam-badge done">已完成</span>`
        : st === "past" ? `<span class="exam-badge past">已过</span>`
        : st === "today" ? `<span class="exam-badge today">今天</span>`
        : `<span class="exam-badge up">还有 ${d} 天</span>`;
      const pt = examParts(e.date);
      return `
        <div class="exam-item ${st === "done" ? "is-done" : ""}">
          <div class="exam-date"><b>${pt.m}月</b><span>${pt.d}日</span></div>
          <div class="exam-info">
            <b>${esc(e.title)}</b>
            <span class="exam-meta">${EXAM_TYPES[e.type] || "日程"}${e.time ? " · " + esc(e.time) : ""}${e.note ? " · " + esc(e.note) : ""}</span>
          </div>
          ${badge}
          <div class="row-actions">
            <button class="mini-btn check" data-exam-done="${e.id}" title="标记完成">&#10003;</button>
            <button class="mini-btn" data-exam-edit="${e.id}" title="编辑">&#9998;</button>
            <button class="mini-btn del" data-exam-del="${e.id}" title="删除">&#10005;</button>
          </div>
        </div>`;
    }).join("");
    $$("[data-exam-done]").forEach(b => b.onclick = () => toggleExamDone(b.dataset.examDone));
    $$("[data-exam-edit]").forEach(b => b.onclick = () => openExamForm(b.dataset.examEdit));
    $$("[data-exam-del]").forEach(b => b.onclick = () => deleteExam(b.dataset.examDel));
  }

  function toggleExamDone(id) {
    const e = Store.getAll("exams").find(x => x.id === id);
    if (!e) return;
    Store.update("exams", id, { status: e.status === "done" ? "upcoming" : "done" });
    renderExams();
  }

  function deleteExam(id) {
    if (!confirm("确定删除这条日程吗？")) return;
    Store.remove("exams", id);
    toast("已删除", "ok");
    renderExams();
  }

  /* ---------- 考试日历 ---------- */
  function initExamCal() {
    const t = new Date();
    calYear = t.getFullYear();
    calMonth = t.getMonth();
    calSelDate = todayISO();
  }

  function renderExamCalSummary(exams) {
    const box = $("#examCalSummary");
    if (!box) return;
    const monthEvents = exams.filter(e => e.status !== "done");
    const nextInWindow = Store.getAll("exams")
      .filter(e => e.status !== "done" && daysUntil(e.date) >= 0)
      .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))[0];
    const days = nextInWindow ? daysUntil(nextInWindow.date) : null;
    let html = `<div class="exam-cal-chip">本月日程 <b>${monthEvents.length}</b></div>`;
    html += `<div class="exam-cal-chip">未来日程 <b>${Store.getAll("exams").filter(e => e.status !== "done" && daysUntil(e.date) >= 0).length}</b></div>`;
    html += nextInWindow
      ? `<div class="exam-cal-chip accent">距「${esc(nextInWindow.title)}」${days === 0 ? "今天" : days + " 天"}</div>`
      : `<div class="exam-cal-chip">暂无进行中日程</div>`;
    box.innerHTML = html;
  }

  function calGoToday() {
    const t = new Date();
    calYear = t.getFullYear();
    calMonth = t.getMonth();
    calSelDate = todayISO();
    renderExamCalendar();
    renderExamDayEvents();
  }

  function renderExamCalendar() {
    if (!calYear) initExamCal();
    $("#examCalLabel").textContent = `${calYear}年 ${calMonth + 1}月`;
    const first = new Date(calYear, calMonth, 1);
    const startDow = first.getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const exams = Store.getAll("exams").filter(e => {
      const pt = examParts(e.date);
      return pt.y === calYear && pt.m === calMonth + 1;
    });
    renderExamCalSummary(exams);
    let html = `<div class="exam-cal-row head">${["日","一","二","三","四","五","六"].map(w => `<span class="exam-cal-cell dow">${w}</span>`).join("")}</div>`;
    html += `<div class="exam-cal-row">`;
    for (let i = 0; i < startDow; i++) html += `<span class="exam-cal-cell blank"></span>`;
    for (let day = 1; day <= daysInMonth; day++) {
      const key = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const has = exams.some(e => e.date === key);
      const isToday = key === todayISO();
      const sel = key === calSelDate;
      html += `<button class="exam-cal-cell day ${isToday ? "today" : ""} ${sel ? "sel" : ""}" data-exam-date="${key}"><span>${day}</span>${has ? `<i class="cal-dot"></i>` : ""}</button>`;
    }
    html += `</div>`;
    $("#examCalendar").innerHTML = html;
    $$("#examCalendar .exam-cal-cell.day").forEach(c => c.onclick = () => {
      calSelDate = c.dataset.examDate;
      renderExamCalendar();
      renderExamDayEvents();
    });
  }

  function renderExamDayEvents() {
    const box = $("#examDayEvents");
    if (!box) return;
    const list = Store.getAll("exams").filter(e => e.date === calSelDate);
    if (!list.length) {
      box.innerHTML = `<div class="exam-day-empty"><span>${calSelDate}</span> 暂无日程</div>`;
      return;
    }
    box.innerHTML = `<div class="exam-day-title">${calSelDate} 的日程</div>` + list.map(e => {
      const st = examStatusOf(e);
      const dd = daysUntil(e.date);
      const badge = st === "done" ? "已完成" : st === "today" ? "今天" : (dd && dd > 0 ? `还有 ${dd} 天` : "待办");
      return `<div class="exam-day-item ${st === "done" ? "is-done" : ""}">
        <span class="exam-day-type">${EXAM_TYPES[e.type] || "日程"}</span>
        <b>${esc(e.title)}</b>
        ${e.time ? `<span class="exam-meta">${esc(e.time)}</span>` : ""}
        <span class="exam-badge ${st === "done" ? "done" : (st === "today" || (dd === 0)) ? "today" : "up"}">${badge}</span>
      </div>`;
    }).join("");
  }

  function examCalShift(delta) {
    calMonth += delta;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderExamCalendar();
    renderExamDayEvents();
  }

  /* ---------- 考试表单 ---------- */
  function openExamForm(id) {
    hideFormDelete();
    const e = id ? Store.getAll("exams").find(x => x.id === id) : null;
    $("#formTitle").textContent = id ? "编辑日程" : "添加考试/日程";
    const defDate = e ? e.date : localDateKey(new Date(Date.now() + 7 * 86400000));
    $("#formBody").innerHTML = `
      <div class="form-grid">
        <label class="field full"><span>标题 *</span><input id="f-e-title" value="${esc(e?.title || "")}" placeholder="如：高等数学 期末考试"></label>
        <label class="field"><span>类型</span><select id="f-e-type">
          ${Object.entries(EXAM_TYPES).map(([k, v]) => `<option value="${k}" ${e?.type === k ? "selected" : ""}>${v}</option>`).join("")}
        </select></label>
        <label class="field"><span>日期 *</span><input type="date" id="f-e-date" value="${defDate}"></label>
        <label class="field"><span>时间</span><input type="time" id="f-e-time" value="${e?.time || ""}"></label>
        <label class="field full"><span>备注</span><input id="f-e-note" value="${esc(e?.note || "")}" placeholder="选填，如：带好证件、考场 1102"></label>
      </div>`;
    $("#btnFormSave").onclick = () => {
      const title = $("#f-e-title").value.trim();
      const date = $("#f-e-date").value;
      if (!title) { toast("请填写标题", "err"); return; }
      if (!date) { toast("请选择日期", "err"); return; }
      const payload = { title, type: $("#f-e-type").value, date, time: $("#f-e-time").value, note: $("#f-e-note").value.trim() };
      if (e) Store.update("exams", id, payload);
      else Store.add("exams", payload);
      closeModal("formModal");
      toast("日程已保存", "ok");
      renderExams();
    };
    showModal("formModal");
  }

  function bindEvents() {
    document.addEventListener("keydown", e => {
      const modals = openModals();
      const modal = modals[modals.length - 1];
      if (e.key === "Escape" && modal) {
        e.preventDefault();
        closeModal(modal.id);
        return;
      }
      if (e.key === "Tab" && modal) {
        const focusables = focusableIn(modal.querySelector(".modal"));
        if (!focusables.length) {
          e.preventDefault();
          modal.querySelector(".modal")?.focus();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const search = $("#globalSearch");
        if (search && getComputedStyle(search).display !== "none") {
          search.focus();
          search.select();
        }
      }
    });
    // 导航
    $$(".nav-item").forEach(n => n.onclick = () => {
      if (window.Anim) Anim.navPulse(n);
      switchView(n.dataset.view);
      // 侧边栏「训练营」：切到跑步视图后自动激活「训练营」标签
      if (n.dataset.camp) {
        setTimeout(function () {
          var campBtn = document.querySelector('.tab-btn[data-tab="run-camp"]');
          if (campBtn) {
            campBtn.click();   // onclick 里会调 syncRunningNavHighlight(true)
          } else {
            syncRunningNavHighlight(true);
          }
        }, 30);
      } else if (n.dataset.view === "running") {
        // 反向：从「训练营」tab 状态点回「跑步训练」入口，要回到训练总览，
        // 否则会出现「高亮跑步训练、内容还停在训练营」的错位。
        // ⚠️ 不能省：已在 running 视图时 switchView 会提前 return，高亮不会自动更新
        setTimeout(function () {
          var campActive = document.querySelector('.tab-btn[data-tab="run-camp"].active');
          if (campActive) {
            var ov = document.querySelector('.tab-btn[data-tab="run-overview"]');
            if (ov) { ov.click(); return; }   // onclick 里会 syncRunningNavHighlight(false)
          }
          syncRunningNavHighlight(false);
        }, 30);
      }
    });
    $$(".mobile-tab").forEach(tab => tab.onclick = () => {
      const view = tab.dataset.mobileView;
      if (view === "more") {
        $("#sidebar").classList.add("open");
        $("#sidebarMask").classList.add("show");
        return;
      }
      switchView(view);
    });
    $$("[data-goto]").forEach(b => b.onclick = () => switchView(b.dataset.goto));
    $$("[data-close]").forEach(b => b.onclick = () => closeModal(b.dataset.close));
    $(".modal-mask") && $$(".modal-mask").forEach(m => m.onclick = (e) => { if (e.target === m) closeModal(m.id); });

    // 导入课表
    $$(".import-tab").forEach(t => t.onclick = () => {
      $$(".import-tab").forEach(x => x.classList.remove("active"));
      t.classList.add("active");
      $$(".import-panel").forEach(p => p.classList.remove("active"));
      $("#itab-" + t.dataset.itab).classList.add("active");
    });
    $("#dropZone").onclick = () => $("#scheduleImgFile").click();
    $("#dropZone").ondragover = (e) => { e.preventDefault(); $("#dropZone").classList.add("drag-over"); };
    $("#dropZone").ondragleave = () => $("#dropZone").classList.remove("drag-over");
    $("#dropZone").ondrop = (e) => {
      e.preventDefault();
      $("#dropZone").classList.remove("drag-over");
      if (e.dataTransfer.files.length) { $("#scheduleImgFile").files = e.dataTransfer.files; handleScheduleImg(); }
    };
    $("#scheduleImgFile").onchange = handleScheduleImg;
    $("#btnRecognizeImg").onclick = recognizeImg;
    $("#btnParseText").onclick = async () => {
      const text = $("#scheduleText").value.trim();
      if (!text) { toast("请先粘贴课表文本", "err"); return; }
      const btn = $("#btnParseText");
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span>解析中...`;
      try {
        const courses = await AI.parseScheduleText(text);
        showImportResult(courses);
        if (!courses.length) toast("未能解析出课程，请检查格式", "err");
      } catch (e) {
        toast(e.message || "解析失败", "err");
      } finally {
        btn.disabled = false;
        btn.textContent = "解析课表";
      }
    };
    $("#btnCancelImport").onclick = () => { pendingImportCourses = []; closeModal("importModal"); };
    $("#btnConfirmImport").onclick = confirmImport;

    // 菜单（移动端）
    $("#btnMenu").onclick = () => {
      $("#sidebar").classList.add("open");
      $("#sidebarMask").classList.add("show");
    };
    // 点遮罩关闭侧边栏
    $("#sidebarMask").onclick = () => {
      $("#sidebar").classList.remove("open");
      $("#sidebarMask").classList.remove("show");
    };
    // 点菜单项后自动收起侧边栏（移动端）
    $$(".nav-item").forEach(n => {
      n.addEventListener("click", () => {
        if (window.innerWidth <= 900) {
          $("#sidebar").classList.remove("open");
          $("#sidebarMask").classList.remove("show");
        }
      });
    });

    // 课程页
    $("#btnAddCourse").onclick = () => openCourseForm();
    $("#btnAddTask").onclick = () => openTaskForm();
    $("#btnImportSchedule").onclick = openImportModal;
    $("#btnSmartSort").onclick = () => {
      if (AI.isConfigured()) {
        // 已配置 AI：跳转聊天区执行智能排序
        toast("已跳转 AI 助手执行智能排序", "ok");
        switchView("ai");
        setTimeout(() => { $("#chatInput").value = "/智能排序"; sendChat("/智能排序"); }, 300);
      } else {
        // 本地规则：直接重排视图
        const tasks = Store.getAll("tasks");
        const scored = tasks.filter(t => t.status !== "done").map(t => {
          let s = 0;
          if (t.priority === "high") s += 100; else if (t.priority === "mid") s += 50;
          if (t.due) { const d = (new Date(t.due) - Date.now()) / 86400000; if (d < 1) s += 200; else if (d < 3) s += 120; else if (d < 7) s += 60; }
          return { t, s };
        }).sort((a, b) => b.s - a.s);
        toast("已按 DDL + 优先级智能排序（本地规则）", "ok");
        // 一次性 join 赋值：循环里 innerHTML += 每次都会整体重新解析，任务多时 O(n²)
        const rows = scored.map((item, i) => {
          const t = item.t;
          const days = t.due ? daysUntil(t.due) : null;
          return `<div class="task-row">
            <span class="tag-chip" style="min-width:26px;justify-content:center">${i + 1}</span>
            <div class="course-info"><b>${esc(t.title)}</b><span>${esc(Store.getCourseName(t.courseId) || "无课程")} · ${days === null ? "无期限" : days < 0 ? "已逾期" : `剩 ${days} 天`}</span></div>
            <span class="tag-chip pri-${esc(t.priority)}">${esc(PRIORITY_MAP[t.priority])}</span>
          </div>`;
        });
        $("#taskList").innerHTML = rows.join("");
      }
    };

    // 标签切换
    $$(".tab-btn").forEach(btn => {
      btn.onclick = () => {
        $$(".tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const tab = btn.dataset.tab;
        $$(".tab-panel").forEach(p => p.classList.remove("active"));
        $("#tab-" + tab) && $("#tab-" + tab).classList.add("active");
        // 跑步视图：切到 AI 教练 tab 时刷新数据
        if (tab === "run-coach" && window.Synapse) Synapse.render();
        // 跑步视图下侧边栏高亮跟随 tab（训练营 tab -> 高亮「训练营」入口）
        if (currentView === "running" && /^run-/.test(tab)) {
          syncRunningNavHighlight(tab === "run-camp");
        }
      };
    });

    // 笔记页
    // 考试日程
    $("#btnAddExam").onclick = () => openExamForm();
    $("#btnCalPrev").onclick = () => examCalShift(-1);
    $("#btnCalNext").onclick = () => examCalShift(1);
    $("#btnCalToday").onclick = calGoToday;
    $("#examFilterType").onchange = renderExamList;
    $("#examFilterStatus").onchange = renderExamList;

    $("#btnAddNote").onclick = () => openNote();
    $("#btnImportNotes").onclick = openNotesImportModal;
    $("#btnParseNotes").onclick = parseNotesBtn;
    $("#btnRecognizeNotes").onclick = recognizeNotesBtn;
    $("#dropZoneN").onclick = () => $("#notesImgFile").click();
    $("#dropZoneN").ondragover = (e) => { e.preventDefault(); $("#dropZoneN").classList.add("drag-over"); };
    $("#dropZoneN").ondragleave = () => $("#dropZoneN").classList.remove("drag-over");
    $("#dropZoneN").ondrop = (e) => {
      e.preventDefault();
      $("#dropZoneN").classList.remove("drag-over");
      if (e.dataTransfer.files.length) { $("#notesImgFile").files = e.dataTransfer.files; handleNotesImg(); }
    };
    $("#notesImgFile").onchange = handleNotesImg;
    $("#btnCancelNotesImport").onclick = () => { pendingImportNotes = []; closeModal("importNotesModal"); };
    $("#btnConfirmNotesImport").onclick = confirmNotesImport;
    $("#btnAiOrganize").onclick = () => {
      switchView("ai");
      setTimeout(() => {
        $("#chatInput").value = "/笔记整理";
        sendChat("/organize");
      }, 300);
    };
    $("#btnGenCards").onclick = () => {
      switchView("ai");
      setTimeout(() => {
        $("#chatInput").value = "/知识卡片";
        sendChat("/cards");
      }, 300);
    };

    // 专注
    $("#btnPomoStart").onclick = startPomo;
    $("#btnPomoReset").onclick = () => {
      clearInterval(pomoTimer);
      recordPartialPomo();
      pomoState.running = false;
      pomoState.paused = false;
      pomoState.mode = "work";
      pomoState.total = (+$("#pomoWork").value || 25) * 60;
      pomoState.remain = pomoState.total;
      pomoState.startedAt = null;
      pomoState.segmentRemain = null;
      pomoState.recordedMinutes = 0;
      $("#btnPomoStart").textContent = "开始专注";
      $("#btnPomoStart").classList.remove("btn-danger");
      $(".pomodoro-card").classList.remove("working");
      $("#pomoMode").textContent = "准备开始";
      updatePomoUI();
      if (window.AnimeFX) AnimeFX.pomoPulse();
    };

    // 成长档案
    $("#btnEditProfile").onclick = () => openProfileForm();
    $("#btnAddGrade").onclick = () => openGradeForm();
    $("#btnImportGrades").onclick = openGradesImportModal;
    $("#btnParseGrades").onclick = parseGradesBtn;
    $("#btnRecognizeGrades").onclick = recognizeGradesBtn;
    $("#dropZoneG").onclick = () => $("#gradesImgFile").click();
    $("#dropZoneG").ondragover = (e) => { e.preventDefault(); $("#dropZoneG").classList.add("drag-over"); };
    $("#dropZoneG").ondragleave = () => $("#dropZoneG").classList.remove("drag-over");
    $("#dropZoneG").ondrop = (e) => {
      e.preventDefault();
      $("#dropZoneG").classList.remove("drag-over");
      if (e.dataTransfer.files.length) { $("#gradesImgFile").files = e.dataTransfer.files; handleGradesImg(); }
    };
    $("#gradesImgFile").onchange = handleGradesImg;
    $("#btnCancelGradesImport").onclick = () => { pendingImportGrades = []; closeModal("importGradesModal"); };
    $("#btnConfirmGradesImport").onclick = confirmGradesImport;
    $("#btnAddSkill").onclick = () => openSkillForm();
    $("#btnAddProject").onclick = () => openProjectForm();
    $("#btnExportResume").onclick = () => {
      const content = $("#resumePreview").innerHTML;
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(`<!DOCTYPE html><html><head><title>简历预览</title>
          <style>body{font-family:sans-serif;max-width:800px;margin:40px auto;padding:0 20px}@media print{body{margin:0}}</style>
          </head><body>${content}<script>window.print()<\/script></body></html>`);
        win.document.close();
      }
    };

    // AI
    $("#btnChatSend").onclick = () => sendChat($("#chatInput").value);
    $("#btnChatStop").onclick = () => AI.cancelCurrent && AI.cancelCurrent();
    $("#chatInput").addEventListener("keydown", e => { if (e.key === "Enter") sendChat($("#chatInput").value); });
    $$(".chip[data-cmd]").forEach(c => c.onclick = () => { $("#chatInput").value = c.dataset.cmd + " "; $("#chatInput").focus(); });
    const editOrbBtn = $("#btnEditOrb");
    if (editOrbBtn) {
      editOrbBtn.onclick = () => {
        try { openExternal("ai-orb-editor.html"); }
        catch (e) { toast("请手动打开 ai-orb-editor.html", "err"); }
      };
    }

    // 设置
    $("#btnSettings").onclick = openSettings;
    $("#btnSaveSettings").onclick = saveSettings;
    const devSwitch = $("#devModeEnabled");
    if (devSwitch) devSwitch.onchange = () => {
      const hint = $("#devModeHint");
      if (hint) hint.textContent = devSwitch.checked ? "已开启：保存并重启平台后，按 F12 即可打开调试台。" : "已关闭。开启并保存后，重启平台生效。";
    };
    const btnFeedback = $("#btnOpenFeedback");
    if (btnFeedback) btnFeedback.onclick = openFeedback;
    const btnFbSave = $("#btnFbSave");
    if (btnFbSave) btnFbSave.onclick = saveFeedback;
    const btnFbCopy = $("#btnFbCopy");
    if (btnFbCopy) btnFbCopy.onclick = copyFeedbackReport;
    const btnFbExport = $("#btnFbExport");
    if (btnFbExport) btnFbExport.onclick = exportFeedbackReport;
    const btnDevTools = $("#btnOpenDevTools");
    if (btnDevTools) btnDevTools.onclick = () => {
      const done = (ok) => toast(ok ? "调试台已打开" : "调试台只在原生窗口中可用", ok ? "ok" : "err");
      try {
        if (!window.__xyCtrl) { done(false); return; }
        fetch(window.__xyCtrl + "/devtools", { mode: "cors" }).then(r => r.text()).then(t => done(t === "ok")).catch(() => done(false));
      } catch (e) { done(false); }
    };
    $("#btnToggleAdvancedThemes").onclick = () => {
      const shown = document.body.classList.toggle("show-advanced-themes");
      $("#btnToggleAdvancedThemes").textContent = shown ? "收起更多主题" : "显示更多主题";
    };
    $$("[data-theme-pick]").forEach(b => b.onclick = () => applyTheme(b.dataset.themePick));
    $$("[data-font-pick]").forEach(b => b.onclick = () => applyFont(b.dataset.fontPick));
    $$("[data-lang-pick]").forEach(b => b.onclick = () => applyLang(b.dataset.langPick));
    $$("[data-bg-pick]").forEach(b => b.onclick = () => applyBg(b.dataset.bgPick));
    $$(".theme-opt[data-bg-vis]").forEach(b => b.onclick = () => applyBgVis(b.dataset.bgVis));
    const btnCopyLanToken = $("#btnCopyLanToken");
    if (btnCopyLanToken) btnCopyLanToken.onclick = async () => {
      const token = ($("#lanTokenText")?.textContent || "").trim();
      if (!token || token === "仅本机可查看") { toast("令牌还没加载", "err"); return; }
      try { await navigator.clipboard.writeText(token); toast("令牌已复制", "ok"); }
      catch { toast("复制失败，请手动选择", "err"); }
    };
    // 开屏声音
    const splashEn = $("#splashSoundEnabled");
    if (splashEn) splashEn.onchange = () => {
      const on = splashEn.checked;
      if (window.SplashSound) SplashSound.setEnabled(on);
      toggleSplashSoundConfig();
    };
    const setSplash = $("#setSplashSound");
    if (setSplash) setSplash.onchange = e => { if (window.SplashSound) SplashSound.setSelection(e.target.value); };
    const btnUpload = $("#btnUploadSplashSound");
    if (btnUpload) btnUpload.onclick = () => { const f = $("#splashSoundFile"); if (f) f.click(); };
    const splashFile = $("#splashSoundFile");
    if (splashFile) splashFile.onchange = e => {
      const files = Array.from(e.target.files || []);
      if (!files.length || !window.SplashSound) return;
      let p = Promise.resolve();
      files.forEach(f => { p = p.then(() => SplashSound.addCustom(f)); });
      p.then(() => { e.target.value = ""; renderSplashSoundSettings(); toast(files.length + " 个开屏声音已上传", "ok"); });
    };
    const btnPreview = $("#btnPreviewSplashSound");
    if (btnPreview) btnPreview.onclick = () => previewSplashSound();
    // 实时预览不落盘：拖动取色器时 input 事件每帧触发，localStorage 高频全量写浪费明显。
    // liveColors 在取色会话内共享，保证同时拖多个取色器时互不覆盖。
    let liveColors = null;
    $$("#themeCustom input[type=color]").forEach(inp => {
      inp.oninput = () => {
        if (!liveColors) liveColors = getCustomColors();
        liveColors[inp.dataset.cvar] = inp.value;
        applyCustomColors(liveColors);
        if (inp.dataset.cvar === "accent") {
          const sw = $("#swCustom");
          if (sw) sw.style.background = inp.value;
        }
        clearTimeout(inp._cvarSaveTimer);
        inp._cvarSaveTimer = setTimeout(() => {
          if (!liveColors) return;
          localStorage.setItem("zero_custom_colors", JSON.stringify(liveColors));
          liveColors = null;
        }, 200);
      };
    });
    $$("[data-preset]").forEach(p => p.onclick = () => {
      const preset = AI.PRESETS[p.dataset.preset];
      if (preset) { $("#setBaseUrl").value = preset.baseUrl; $("#setModel").value = preset.model; toast(`已填入 ${p.dataset.preset} 预设`, "ok"); }
    });
    $("#btnExportData").onclick = () => {
      const blob = new Blob([Store.exportAll()], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "xingyu-data.json";
      a.click();
      toast("数据已导出", "ok");
    };
    $("#btnImportData").onclick = () => $("#importFile").click();
    $("#importFile").onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        toast("导入文件不能超过 10MB", "err");
        e.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (Store.importAll(reader.result)) { toast("数据导入成功", "ok"); renderCurrent(); renderProfile(); }
        else toast("导入失败：JSON 格式不正确", "err");
      };
      reader.readAsText(file);
      e.target.value = "";
    };
    $("#btnClearData").onclick = () => {
      if (confirm("确定要清空全部数据吗？此操作不可恢复！")) {
        Store.clearAll();
        toast("已清空全部数据", "ok");
        renderCurrent(); renderProfile();
      }
    };
    $("#btnOpenTrash").onclick = openTrash;
    $("#btnEmptyTrash").onclick = () => {
      if (!Store.getTrash().length) return;
      if (confirm("确定永久清空回收站吗？此操作无法撤销。")) {
        Store.emptyTrash();
        renderTrash();
        updateTrashCount();
        toast("回收站已清空", "ok");
      }
    };
    $("#btnFinishOnboarding").onclick = finishOnboarding;
    $("#btnSkipOnboarding").onclick = () => {
      onboardReplay = false;
      localStorage.setItem("zero_onboarded_v3", "1");
      localStorage.setItem("zero_onboarded_v4", "1");
      closeModal("onboardingModal");
    };

    // 云同步
    if ($("#syncEnabled")) {
      $("#syncEnabled").onchange = () => {
        const on = $("#syncEnabled").checked;
        Sync.setEnabled(on);
        updateSyncStatus();
        if (on) Sync.sync().then(updateSyncStatus);
      };
    }
    $("#btnSyncNow").onclick = () => {
      const token = $("#setSyncToken").value.trim();
      Sync.setToken(token);
      Sync.setEnabled(true);
      $("#syncEnabled").checked = true;
      updateSyncStatus();
      Sync.sync().then(updateSyncStatus);
    };
    Sync.listeners.push(() => updateSyncStatus());
    // 二维码
    $("#btnQrcode").onclick = openQR;
    $("#btnCopyPerm").onclick = copyPerm;
    $("#btnCopyLan").onclick = copyLan;
    const btnRefreshQr = $("#btnRefreshQr");
    if (btnRefreshQr) btnRefreshQr.onclick = () => { toast("正在重新生成二维码…", "ok"); renderQR(); };
    $$(".qr-tab").forEach(b => b.onclick = () => renderQR(b.dataset.qrMode));

    // 强制刷新：彻底重载界面（本地服务 no-cache，会重新拉取最新 index.html / JS / CSS），
    // 感觉界面上有残留加载或卡顿时点一下即可拿到全新状态。
    const refreshBtn = $("#btnRefresh");
    if (refreshBtn) {
      refreshBtn.onclick = function () {
        toast("正在强制刷新界面…", "ok");
        setTimeout(function () {
          try { localStorage.setItem("zero_last_refresh", String(Date.now())); } catch (e) {}
          location.reload();
        }, 120);
      };
    }

    // 全屏切换。启动器改为最大化窗口，网页内使用 Fullscreen API，退出不再依赖 Edge 的原生全屏状态。
    const fsBtn = $("#btnFullscreen");
    const fsExpand = $("#fsIconExpand");
    const fsCompress = $("#fsIconCompress");
    function syncFsIcon() {
      const on = !!(document.fullscreenElement || document.webkitFullscreenElement);
      if (fsExpand) fsExpand.style.display = on ? "none" : "";
      if (fsCompress) fsCompress.style.display = on ? "" : "none";
      if (fsBtn) {
        fsBtn.title = on ? "退出全屏 (F11)" : "全屏 (F11)";
        fsBtn.setAttribute("aria-label", on ? "退出全屏" : "进入全屏");
      }
    }
    function toggleFullscreen() {
      try {
        let done = null;
        if (document.fullscreenElement || document.webkitFullscreenElement) {
          done = document.exitFullscreen
            ? document.exitFullscreen()
            : (document.webkitExitFullscreen ? document.webkitExitFullscreen() : null);
        } else {
          const el = document.documentElement;
          done = el.requestFullscreen
            ? el.requestFullscreen()
            : (el.webkitRequestFullscreen ? el.webkitRequestFullscreen() : null);
        }
        if (done && done.then) {
          done.then(() => setTimeout(syncFsIcon, 0)).catch(err => {
            syncFsIcon();
            toast("切换全屏失败：" + (err.message || err), "err");
          });
        } else {
          setTimeout(syncFsIcon, 0);
        }
      } catch (e) {
        toast("切换全屏失败：" + (e.message || e), "err");
      }
    }
    if (fsBtn) fsBtn.onclick = toggleFullscreen;
    document.addEventListener("fullscreenchange", syncFsIcon);
    document.addEventListener("webkitfullscreenchange", syncFsIcon);
    document.addEventListener("keydown", e => {
      if (e.key !== "F11" && e.code !== "F11") return;
      // Only intercept F11 when we are inside the page's Fullscreen API.
      // Native Edge fullscreen (--start-fullscreen) is exited by letting F11 stay native.
      if (!(document.fullscreenElement || document.webkitFullscreenElement)) return;
      e.preventDefault();
      e.stopPropagation();
      toggleFullscreen();
    }, true);
    syncFsIcon();

    // 右上角常驻关闭按钮：即使 Edge 原生全屏没有标题栏 X，也能从这里关窗口。
    const closeBtn = $("#btnCloseWindow");
    if (closeBtn) {
      closeBtn.onclick = function () {
        try { window.close(); } catch (e) {}
        try { window.open("", "_self"); window.close(); } catch (e) {}
        toast("若未关闭，请按 Alt+F4 或重新启动星屿。", "err");
      };
    }

    const globalExitFab = $("#globalExitFab");
    // 全局唯一的退出控件：按优先级「沉浸专注 > 网页全屏 > 原生全屏」自适应文案与行为。
    // 同一时刻只渲染这一个按钮，不再叠加场景内按钮，避免右下角重叠与文案互相矛盾。
    function syncGlobalExitFab() {
      if (!globalExitFab) return;
      const focusOverlay = $("#focusOverlay");
      const inFocus = !!(focusOverlay && focusOverlay.style.display !== "none");
      const inFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      const inNativeFs = !!window.__xyNativeFullscreen;
      if (inFocus) {
        globalExitFab.hidden = false;
        globalExitFab.textContent = "\u23CE 退出专注 (Esc)";
        globalExitFab.title = "退出沉浸式专注场景（快捷键 Esc）";
        globalExitFab.dataset.mode = "focus";
      } else if (inFs || inNativeFs) {
        globalExitFab.hidden = false;
        globalExitFab.textContent = "退出全屏";
        globalExitFab.title = "退出全屏（快捷键 F11）";
        globalExitFab.dataset.mode = "fullscreen";
      } else {
        globalExitFab.hidden = true;
        globalExitFab.dataset.mode = "";
      }
    }
    // 暴露给模块级 openFocusScene / closeFocusScene 调用
    syncExitFabHook = syncGlobalExitFab;
    function exitCurrentFullscreen() {
      const focusOverlay = $("#focusOverlay");
      const inFocus = !!(focusOverlay && focusOverlay.style.display !== "none");
      const inFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      const inNativeFs = !!window.__xyNativeFullscreen;
      if (inFocus) { closeFocusScene(); return; }
      if (inFs) { toggleFullscreen(); return; }
      if (inNativeFs && window.__xyCtrl) {
        try { fetch(window.__xyCtrl + "/exit-fullscreen"); } catch (e) {}
        return;
      }
      if (window.__xyCtrl) {
        try { fetch(window.__xyCtrl + "/exit-fullscreen"); } catch (e) {}
        return;
      }
      try { window.close(); } catch (e) {}
    }
    if (globalExitFab) globalExitFab.onclick = exitCurrentFullscreen;
    document.addEventListener("fullscreenchange", syncGlobalExitFab);
    document.addEventListener("webkitfullscreenchange", syncGlobalExitFab);
    syncGlobalExitFab();

    // 每日一言
    $("#btnNextQuote").onclick = () => { if (window.nextQuote) { nextQuote(); renderQuote(); } };

    // 访问密码
    $("#btnUnlock").onclick = unlock;
    $("#lockPin").addEventListener("keydown", e => { if (e.key === "Enter") unlock(); });
    // 总开关：切换密码字段显隐。首次开启时自动聚焦「新密码」并提示——
    // 否则用户勾了开关却不知道要去下面设密码，保存时才发现没配上。
    const lockEn = $("#lockEnabled");
    if (lockEn) lockEn.addEventListener("change", () => {
      toggleLockFields(lockEn.checked);
      if (lockEn.checked && !hasPin()) {
        const p = $("#setPin");
        try { p && p.focus(); } catch (e) {}
        toast(t("lock.needPin"), "ok", { duration: 3000 });
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && localStorage.getItem("zero_lock_enabled") === "1" && hasPin() && localStorage.getItem("zero_lock_leave") === "1") {
        lockNow();
      }
    });

    // 热点新闻
    $("#btnRefreshNews").onclick = async () => {
      toast("正在刷新新闻...", "ok", { key: "news-refreshing", duration: 1500 });
      newsCache = null;
      await renderNews();
      toast("新闻已更新", "ok", { key: "news-refreshed", duration: 2000 });
    };
    $$("[data-newstab]").forEach(btn => {
      btn.onclick = () => {
        $$("[data-newstab]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        newsFilter = btn.dataset.newstab;
        renderNews();
      };
    });

    // 文献资料
    $("#btnAddLit").onclick = () => openLitForm();
    $("#btnImportLit").onclick = openLitImportModal;
    $("#litSearch").addEventListener("input", renderLitList);
    $("#litFilterTag").onchange = renderLitList;
    $("#litFilterFav").onchange = renderLitList;

    // 全局搜索
    setupSearch();

    // 时钟
    tickClock();
    setInterval(tickClock, 10000);
  }

  function openProfileForm() {
    const p = Store.getProfile();
    const AVATARS = ["🚀", "🌟", "📚", "🎓", "🧠", "⚡", "🐱", "🐶", "🌙", "☀️", "🎮", "🎧", "💻", "🏀", "✈️", "🌊", "🍀", "🔥", "🎯", "💡"];
    $("#formTitle").textContent = "编辑个人资料";
    $("#formBody").innerHTML = `
      <label class="field"><span>昵称 *</span><input id="f-pf-name" value="${esc(p.name || "")}" placeholder="怎么称呼你"></label>
      <label class="field"><span>头像（选一个喜欢的）</span>
        <div class="avatar-picker" id="f-pf-avatar">${AVATARS.map(a => `<span class="avatar-opt ${p.avatar === a ? "picked" : ""}" data-a="${a}">${a}</span>`).join("")}</div>
      </label>
      <label class="field"><span>个性签名</span><input id="f-pf-slogan" value="${esc(p.slogan || "")}" placeholder="一句话介绍自己，如：保持好奇，持续学习"></label>
      <label class="field"><span>近期目标</span><input id="f-pf-goal" value="${esc(p.goal || "")}" placeholder="如：这学期绩点冲到 3.5、通过四级"></label>
      <div class="form-grid">
        <label class="field"><span>学校</span><input id="f-pf-school" value="${esc(p.school || "")}" placeholder="选填"></label>
        <label class="field"><span>专业</span><input id="f-pf-major" value="${esc(p.major || "")}" placeholder="选填"></label>
        <label class="field"><span>年级</span><input id="f-pf-grade" value="${esc(p.grade || "")}" placeholder="如：大二"></label>
        <label class="field"><span>邮箱（自己用的，选填）</span><input id="f-pf-email" value="${esc(p.email || "")}" placeholder="选填"></label>
      </div>
      <button type="button" class="btn btn-ghost" id="f-pf-replay" style="margin-top:12px">↺ 重看欢迎引导</button>`;
    // 头像选择
    let pickedAvatar = p.avatar || "";
    $$("#f-pf-avatar .avatar-opt").forEach(a => a.onclick = () => {
      $$("#f-pf-avatar .avatar-opt").forEach(x => x.classList.remove("picked"));
      a.classList.add("picked");
      pickedAvatar = a.dataset.a;
    });
    $("#btnFormSave").onclick = () => {
      const name = $("#f-pf-name").value.trim();
      if (!name) { toast("请填写昵称", "err"); return; }
      Store.setProfile({
        name,
        avatar: pickedAvatar,
        school: $("#f-pf-school").value.trim(),
        major: $("#f-pf-major").value.trim(),
        grade: $("#f-pf-grade").value.trim(),
        slogan: $("#f-pf-slogan").value.trim(),
        goal: $("#f-pf-goal").value.trim(),
        email: $("#f-pf-email").value.trim()
      });
      closeModal("formModal");
      toast("资料已保存", "ok");
      renderGrowth();
      renderDashboard();
    };
    $("#f-pf-replay").onclick = () => {
      closeModal("formModal");
      replayOnboarding();
    };
    showModal("formModal");
  }

  function updateNetworkStatus() {
    const el = $("#networkStatus");
    if (!el) return;
    const offline = navigator.onLine === false;
    el.hidden = !offline;
    el.textContent = offline ? "离线模式" : "";
    document.documentElement.dataset.online = offline ? "false" : "true";
  }

  /* ---------- 本地自动备份 ---------- */
  const AUTO_BACKUP_KEY = "xingyu_last_auto_backup";
  const AUTO_BACKUP_INTERVAL = 6 * 60 * 60 * 1000;

  function canUseLocalBackupServer() {
    return location.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(location.hostname);
  }

  async function autoBackupToServer(force = false) {
    if (!canUseLocalBackupServer()) return;
    const lastAt = Number(localStorage.getItem(AUTO_BACKUP_KEY) || 0);
    if (!force && lastAt && Date.now() - lastAt < AUTO_BACKUP_INTERVAL) return;
    const response = await fetch("/api/backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: Store.exportAll(), at: new Date().toISOString() })
    });
    if (!response.ok) throw new Error(`backup failed: ${response.status}`);
    localStorage.setItem(AUTO_BACKUP_KEY, String(Date.now()));
    const result = await response.json();
    console.info("[星屿] 本地自动备份完成", result.file);
  }

  function setupLocalBackup() {
    if (!canUseLocalBackupServer()) return;
    setTimeout(() => autoBackupToServer().catch(e => {
      console.warn("[星屿] 本地自动备份失败", e);
    }), 1200);
    setInterval(() => autoBackupToServer().catch(e => {
      console.warn("[星屿] 本地自动备份失败", e);
    }), 30 * 60 * 1000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        autoBackupToServer().catch(() => {});
      }
    });
  }

  async function restoreServerStateIfNeeded() {
    if (!(location.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(location.hostname))) return;
    const info = Store.getStorageInfo && Store.getStorageInfo();
    if (!info || !info.firstRun) return;
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (response.status === 204 || !response.ok) return;
      const payload = await response.json();
      const raw = payload && payload.data;
      if (!raw) return;
      if (Store.importAll(JSON.stringify(raw))) {
        console.info("[星屿] 已从本机实时状态恢复数据");
      }
    } catch (error) {
      console.warn("[星屿] 实时状态恢复失败", error);
    }
  }

  /* ---------- 启动 ---------- */
  async function init() {
    await restoreServerStateIfNeeded();
    window.XingyuIcons && XingyuIcons.decorateNavigation();
    setupModalAccessibility();
    warmLaunchAssets();
    Store.onDelete && Store.onDelete(entry => {
      updateTrashCount();
      toast(`${TRASH_LABELS[entry.entityKey] || "内容"}已移至回收站`, "ok", {
        actionLabel: "撤销",
        onAction: () => undoTrashEntry(entry),
        duration: 5600
      });
    });
    bindEvents();
    // 记录 iframe 子应用的原始地址，供切走卸载 / 切回还原
    primeIframeSrcs();
    // 滚动期间抑制毛玻璃（侧边栏/顶栏逐帧重采样背景是长时使用卡顿源）
    bindScrollFX();
    // 监听沉浸式专注场景的退出消息（iframe 内点击退出 / 按 Esc 时关闭）
    window.addEventListener("message", e => {
      if (e.data && e.data.type === "xingyu-focus-exit") closeFocusScene();
    });
    // 本地存储写失败（配额写满等）：必须让用户看见，否则数据会无声丢失
    window.addEventListener("xingyu:storage-error", e => {
      const msg = (e.detail && e.detail.message) || "本地空间不足";
      toast(msg, "warn", {
        actionLabel: "立即导出备份",
        onAction: () => {
          try {
            const blob = new Blob([Store.exportAll()], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "xingyu-data.json";
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 4000);
            toast("数据已导出，建议清理旧回收站条目", "ok");
          } catch (err) {
            toast("导出失败：" + (err && err.message), "err");
          }
        },
        duration: 12000
      });
    });
    window.Sync && Sync.init();
    applyI18n();
    // nav 事件绑定与滑块初始化（轻量、立即执行）
    window.Anim && Anim.initNav();
    window.Anim && Anim.initNavPill();
    window.Anim && Anim.initSidebarGesture($("#sidebar"), $("#sidebarMask"));
    // 天气模块（实时天气，懒加载数据）
    window.Weather && Weather.init();
    updateNetworkStatus();
    window.addEventListener("online", () => { updateNetworkStatus(); toast("网络已恢复", "ok"); });
    setupLocalBackup();
    window.addEventListener("offline", () => { updateNetworkStatus(); toast("当前离线，将继续使用本地数据", "err"); });
    const storageInfo = Store.getStorageInfo && Store.getStorageInfo();
    if (storageInfo && storageInfo.lastError) toast(storageInfo.lastError, "err");
    updateTrashCount();
    const systemMedia = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)");
    if (systemMedia) systemMedia.addEventListener("change", () => {
      if ((localStorage.getItem("zero_theme") || "system") === "system") applyTheme("system");
    });
    // 启动锁（设置了访问密码则锁定）
    applyLockPrefs();
    // 应用保存的昵称（仅当尚未设置个人昵称时）
    const nick = Store.getSettings().nickname;
    const p = Store.getProfile();
    if (nick && (!p.name || p.name === "同学")) Store.setProfile({ name: nick });
    // 迁移：清除旧默认火箭头像（新版默认无 emoji 头像，用昵称首字）
    if (p.avatar === "🚀") { Store.setProfile({ ...p, avatar: "" }); }
    // 启动预热：所有首屏 DOM 与数据在黑色开屏下准备完成，再允许开屏淡出。
    // 这样不会把 requestIdleCallback 的重活拖到用户已经看到主界面的窗口。
    var signalMainReady = function () {
      if (window.__xingyuMainReady) return;
      window.__xingyuMainReady = true;
      try { window.dispatchEvent(new Event("xingyu-main-ready")); } catch (e) {}
    };
    var bootHeavy = function () {
      if (bootHeavy.done) return; bootHeavy.done = true;
      window.__bootPreparing = true;
      bootEntrance = true;
      // 首屏准备期间关闭毛玻璃，避免隐藏页面同时创建大量合成层。
      document.documentElement.classList.add("entrance-fx");
      // 把启动重活拆成若干“画一帧再执行一小块”的节拍，避免一次性长任务冻结开屏动画。
      const tasks = [
        () => renderProfile(),
        () => switchView("dashboard"),
        () => renderAIStatus(),
        () => { _dashboardIntroPlayed = true; }
      ];
      let taskIndex = 0;
      const runNextTask = () => {
        if (taskIndex >= tasks.length) {
          window.__bootPreparing = false;
          setTimeout(signalMainReady, 0);
          return;
        }
        setTimeout(() => {
          try { tasks[taskIndex++](); } catch (e) {}
          runNextTask();
        }, 12);
      };
      runNextTask();
    };
    var bootAfterSplash = function () {
      if (bootAfterSplash.done) return; bootAfterSplash.done = true;
      bootHeavy();
      // 第一帧只揭示主界面；导航胶囊等修正延后一个稳定帧，避免揭示同帧长任务。
      setTimeout(function () {
        requestAnimationFrame(function () {
          try { window.Anim && Anim.initNavPill(); } catch (e) {}
          bootEntrance = false;
          restoreBackdropFX();
        });
      }, 100);
      setTimeout(maybeShowOnboarding, 620);
    };
    if (window.__splashActive) {
      // 结构关键点：dashboard 重渲染由 splash-prepare 触发，且分帧执行。
      // 原来的 canvas 开屏动画保持不变，只是不再跟首屏重活挤同一个主线程帧。
      window.addEventListener("splash-prepare", bootHeavy, { once: true });
      window.addEventListener("splash-done", bootAfterSplash, { once: true });
      setTimeout(bootHeavy, 6500);
    } else {
      bootAfterSplash();
    }
    console.log("星屿 · 个人学习工作台已启动");
  }

  // 暴露弹窗控制，供外部模块（如文献沉浸式阅读的来源选择）复用
  window.showModal = showModal;
  window.closeModal = closeModal;
  window.toast = toast;

  return { init };
})();

document.addEventListener("DOMContentLoaded", App.init);





