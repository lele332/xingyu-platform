/* ============================================================
   星屿 · 全局体验层
   提供：即时反馈提示 / 高频操作直达 / 移动底部导航 / 渐进式扩展导航
   设计约束：不侵入既有业务逻辑；只增强全局壳层；尊重 reduced-motion。
   ============================================================ */
(function () {
  "use strict";

  const REGION_ID = "xyToastRegion";

  /* ---------- 侧边栏语义分组（2026-09-13 重构） ----------
     旧实现把 5 个核心项之外的 16 个入口全部塞进一个折叠的「扩展能力」里：
     分组语义丢了，用户找「跑步」要先猜它在“更多”里。
     现在按用户心智分成 6 组，顺序与默认开合在这里集中定义，
     index.html 里的 data-group 必须和这份表对齐。 */
  const GROUP_KEY = "xingyu_nav_groups";
  const LEGACY_MORE_KEY = "xingyu_nav_more_open";   // 旧「扩展能力」开关，启动时清掉
  const NAV_GROUPS = {
    study:   { open: true  },   // 学习：课程作业 / 考试日程 / 专注学习 / 笔记库 / 文献 / 成长档案
    ai:      { open: true  },   // AI 智能体：AI 助手 / AI 语音 / A.R.I.A
    health:  { open: true  },   // 运动健康：跑步训练 / 训练营 / 解压舱
    life:    { open: false },   // 生活：天气 / 热点新闻 / 工具箱
    gallery: { open: false }    // 灵感画廊：5 个展示模块（手机端整组隐藏）
  };
  const CARET_SVG = '<svg class="xy-group-caret" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>';

  function readGroupState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(GROUP_KEY) || "null");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) { return {}; }
  }
  function writeGroupState(state) {
    try { localStorage.setItem(GROUP_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function createToastRegion() {
    let region = document.getElementById(REGION_ID);
    if (!region) {
      region = document.createElement("div");
      region.id = REGION_ID;
      region.className = "xy-toast-region";
      region.setAttribute("aria-live", "polite");
      region.setAttribute("aria-atomic", "false");
      document.body.appendChild(region);
    }
    return region;
  }

  function toast(message, options = {}) {
    const region = createToastRegion();
    const item = document.createElement("div");
    item.className = "xy-toast" + (options.type ? " " + options.type : "");
    item.setAttribute("role", options.type === "error" ? "alert" : "status");

    const icon = document.createElement("span");
    icon.className = "xy-toast-icon";
    const text = document.createElement("span");
    text.textContent = message;
    item.append(icon, text);

    if (options.actionLabel) {
      const action = document.createElement("button");
      action.type = "button";
      action.className = "xy-toast-action";
      action.textContent = options.actionLabel;
      action.addEventListener("click", () => {
        close();
        if (typeof options.onAction === "function") options.onAction();
      });
      item.appendChild(action);
    }

    region.appendChild(item);
    let closed = false;
    function close() {
      if (closed) return;
      closed = true;
      item.classList.remove("show");
      setTimeout(() => item.remove(), 300);
    }

    requestAnimationFrame(() => item.classList.add("show"));
    const delay = Number(options.duration ?? (options.type === "error" ? 5200 : 2800));
    if (Number.isFinite(delay) && delay > 0) setTimeout(close, delay);
    return close;
  }

  window.XingyuUX = { toast };
  window.showToast = window.showToast || ((message, options) => window.XingyuUX.toast(message, typeof options === "string" ? { type: options } : options));

  function findNav(view, camp) {
    const selector = `.nav-item[data-view="${view}"]` + (camp ? `[data-camp="${camp}"]` : ":not([data-camp])");
    return document.querySelector(selector);
  }

  function groupOf(el) {
    return el && el.closest ? el.closest(".nav-group.xy-group") : null;
  }

  /* 折叠/展开之后要补算两件事：
     ① 侧边栏上下渐隐遮罩 —— app.js 的 updateNavScrollHints 只听 scroll/resize，
        这里派发一个 scroll 事件借它的手重算，不必把私有函数暴露成全局；
     ② 高亮滑块 .nav-pill —— anim.js 用 rect 差值定位，分组高度一变就会偏。
     都得等 grid-template-rows 过渡结束再算，动画期间位置一直在变。 */
  function syncAfterLayout(group) {
    const nav = group.closest(".sidebar-nav");
    if (!nav) return;
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      nav.dispatchEvent(new Event("scroll"));
      const active = nav.querySelector(".nav-item.active");
      if (active && window.Anim && typeof Anim.navPillTo === "function") {
        try { Anim.navPillTo(active.dataset.view, false); } catch (e) {}
      }
    };
    const body = group.querySelector(":scope > .xy-group-body");
    if (body) body.addEventListener("transitionend", settle, { once: true });
    setTimeout(settle, 480);   // 过渡被打断/不支持时的兜底
  }

  function setGroupOpen(group, open, persist) {
    if (!group) return;
    const key = group.dataset.group;
    const wasOpen = !group.classList.contains("xy-collapsed");
    open = !!open;
    group.classList.toggle("xy-collapsed", !open);
    const head = group.querySelector(":scope > .nav-group-head");
    if (head) head.setAttribute("aria-expanded", String(open));
    if (persist !== false && key) {
      const state = readGroupState();
      state[key] = open ? 1 : 0;
      writeGroupState(state);
    }
    if (wasOpen !== open) syncAfterLayout(group);
  }

  // 目标入口若在收起的组里，先展开再点，否则高亮会落在看不见的地方。
  function openGroupOf(el) {
    const group = groupOf(el);
    if (group) setGroupOpen(group, true);
  }

  function goTo(view, camp, extra) {
    const nav = findNav(view, camp);
    if (!nav) return false;
    openGroupOf(nav);
    nav.click();
    if (extra && typeof extra === "function") setTimeout(extra, 260);
    return true;
  }

  window.XingyuUX.goTo = goTo;

  /* 分组计数徽标要数「当前视口下真的看得见」的入口：
     移动端 CSS 会隐藏 aria / toolknit（桌面端全显示），
     徽标若按 DOM 数量写死，手机上就会出现「标 3 个、只列 2 个」的错位。
     只看 display，不看 visibility：折叠态是靠 .xy-group-body 的 visibility 做的，
     要是连它一起算，收起的组就会显示 0。 */
  function updateGroupCounts(nav) {
    if (!nav) return;
    nav.querySelectorAll(":scope > .nav-group").forEach(group => {
      const badge = group.querySelector(":scope > .nav-group-head > .xy-group-count");
      if (!badge) return;
      const visible = Array.from(group.querySelectorAll(".nav-item"))
        .filter(item => getComputedStyle(item).display !== "none").length;
      badge.textContent = String(visible);
      badge.style.display = visible ? "" : "none";
    });
  }

  function installSemanticNav() {
    const sidebarNav = document.querySelector("#sidebar .sidebar-nav");
    if (!sidebarNav || sidebarNav.dataset.xySemantic === "1") return;
    sidebarNav.dataset.xySemantic = "1";
    try { localStorage.removeItem(LEGACY_MORE_KEY); } catch (e) {}

    const stored = readGroupState();

    Array.from(sidebarNav.querySelectorAll(":scope > .nav-group.xy-group")).forEach(group => {
      const key = group.dataset.group;
      const label = group.querySelector(":scope > .nav-group-label");
      const items = Array.from(group.querySelectorAll(":scope > .nav-item"));
      // 没有分组标题 = 置顶组（今日），不参与折叠，保证一进平台就能看到。
      if (!label || !items.length) return;

      const conf = NAV_GROUPS[key] || { open: true };
      const open = stored[key] == null ? conf.open : (stored[key] === 1 || stored[key] === true);

      // 分组标题升级成可点的折叠头；label 元素本体保留（applyI18n 靠 data-i18n 找它，
      // 而它会整体覆盖 textContent，所以小箭头必须是兄弟节点、不能塞进 label 里）。
      const head = document.createElement("button");
      head.type = "button";
      head.className = "nav-group-head";
      head.setAttribute("aria-controls", "xyNavBody-" + key);
      head.setAttribute("aria-expanded", String(open));

      const count = document.createElement("span");
      count.className = "xy-group-count";
      count.setAttribute("aria-hidden", "true");
      count.textContent = String(items.length);

      group.insertBefore(head, label);
      head.append(label, count);
      head.insertAdjacentHTML("beforeend", CARET_SVG);

      const body = document.createElement("div");
      body.className = "xy-group-body";
      body.id = "xyNavBody-" + key;
      const inner = document.createElement("div");
      inner.className = "xy-group-inner";
      body.appendChild(inner);
      // 移动节点不会丢事件监听，app.js / anim.js 早先绑好的行为全部保留。
      items.forEach(item => inner.appendChild(item));
      group.appendChild(body);

      group.classList.toggle("xy-collapsed", !open);
      head.addEventListener("click", () => {
        setGroupOpen(group, group.classList.contains("xy-collapsed"));
      });
    });

    watchActiveGroup(sidebarNav);
    const active = sidebarNav.querySelector(".nav-item.active");
    if (active) openGroupOf(active);

    updateGroupCounts(sidebarNav);
    // 视口一变（转屏 / 拖窗口跨过 820px 断点）隐藏项就变，徽标得跟着重算
    let countTimer = null;
    window.addEventListener("resize", () => {
      clearTimeout(countTimer);
      countTimer = setTimeout(() => updateGroupCounts(sidebarNav), 160);
    });
    // 字体 / i18n 落定后再校准一次，避免首帧算在旧布局上
    setTimeout(() => updateGroupCounts(sidebarNav), 1200);
  }

  /* 程序化切视图（app.js switchView、app-shell.js 的深链、快捷操作 goTo）
     不经过我们的 click，用 MutationObserver 兜底：
     高亮项落在收起的组里就自动展开，用户不会以为“切了没反应”。 */
  function watchActiveGroup(nav) {
    if (typeof MutationObserver !== "function") return;
    let busy = false;
    new MutationObserver(() => {
      if (busy) return;
      const group = groupOf(nav.querySelector(".nav-item.active"));
      if (!group || !group.classList.contains("xy-collapsed")) return;
      busy = true;
      setGroupOpen(group, true);
      requestAnimationFrame(() => { busy = false; });
    }).observe(nav, { subtree: true, attributes: true, attributeFilter: ["class"] });
  }

  const QUICK_ACTIONS = [
    { action: "new-task", label: "新建任务", icon: "＋", className: "primary" },
    { action: "start-pomo", label: "开始专注", icon: "◎" },
    { action: "new-note", label: "新建笔记", icon: "✎" },
    { action: "ask-ai", label: "问小星", icon: "✦" }
  ];

  function installQuickActions() {
    const hero = document.querySelector("#view-dashboard .hero-card");
    if (!hero || hero.querySelector(".quick-actions")) return;
    const wrap = document.createElement("div");
    wrap.className = "quick-actions";
    wrap.setAttribute("aria-label", "高频操作");

    QUICK_ACTIONS.forEach(({ action, label, icon, className }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "quick-action" + (className ? " " + className : "");
      button.dataset.uxAction = action;
      button.innerHTML = `<span aria-hidden="true">${icon}</span><span>${label}</span>`;
      wrap.appendChild(button);
    });
    hero.after(wrap);
  }

  function triggerQuickAction(action) {
    if (action === "ask-ai") {
      goTo("ai");
      setTimeout(() => {
        const input = document.querySelector("#aiInput, #chatInput, #aiChatInput, textarea[placeholder*='问']");
        input?.focus();
      }, 320);
      return;
    }
    if (action === "new-task") {
      goTo("courses", null, () => {
        (document.getElementById("btnAddTask") || document.querySelector('[data-action="add-task"]'))?.click();
      });
      return;
    }
    if (action === "new-note") {
      goTo("notes", null, () => {
        (document.getElementById("btnNewNote") || document.querySelector('[data-action="new-note"]'))?.click();
      });
      return;
    }
    if (action === "start-pomo") {
      goTo("focus", null, () => {
        const start = document.getElementById("btnPomoStart");
        if (start && start.textContent.includes("开始")) start.click();
      });
    }
  }

  function installClickFeedback() {
    document.addEventListener("click", event => {
      const target = event.target.closest(".quick-action");
      if (!target) return;
      triggerQuickAction(target.dataset.uxAction);
      target.animate?.(
        [{ transform: "scale(1)" }, { transform: "scale(.97)" }, { transform: "scale(1)" }],
        { duration: 190, easing: "cubic-bezier(.32,.72,.16,1)" }
      );
    });
  }

  function boot() {
    installSemanticNav();
    installQuickActions();
    installClickFeedback();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
