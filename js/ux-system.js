/* ============================================================
   星屿 · 全局体验层
   提供：即时反馈提示 / 高频操作直达 / 移动底部导航 / 渐进式扩展导航
   设计约束：不侵入既有业务逻辑；只增强全局壳层；尊重 reduced-motion。
   ============================================================ */
(function () {
  "use strict";

  const REGION_ID = "xyToastRegion";
  const MORE_KEY = "xingyu_nav_more_open";

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

  function openMoreIfNeeded(nav) {
    if (!nav) return;
    const group = nav.closest(".nav-group.xy-secondary");
    if (!group) return;
    group.classList.add("xy-open");
    const toggle = group.previousElementSibling;
    if (toggle && toggle.classList.contains("xy-more-toggle")) toggle.setAttribute("aria-expanded", "true");
    try { localStorage.setItem(MORE_KEY, "1"); } catch (e) {}
  }

  function goTo(view, camp, extra) {
    const nav = findNav(view, camp);
    if (!nav) return false;
    openMoreIfNeeded(nav);
    nav.click();
    if (extra && typeof extra === "function") setTimeout(extra, 260);
    return true;
  }

  window.XingyuUX.goTo = goTo;

  function installProgressiveNav() {
    const sidebarNav = document.querySelector("#sidebar .sidebar-nav");
    if (!sidebarNav || sidebarNav.dataset.xyProgressive === "1") return;
    sidebarNav.dataset.xyProgressive = "1";

    const coreViews = ["dashboard", "courses", "focus", "notes", "ai"];
    const allItems = Array.from(sidebarNav.querySelectorAll(".nav-item"));
    const coreItems = coreViews
      .map(view => allItems.find(item => item.dataset.view === view && !item.dataset.camp))
      .filter(Boolean);

    const secondaryGroup = document.createElement("div");
    secondaryGroup.id = "xyMoreNav";
    secondaryGroup.className = "nav-group xy-secondary";
    const secondaryInner = document.createElement("div");
    secondaryInner.className = "xy-secondary-inner";
    const secondaryLabel = document.createElement("div");
    secondaryLabel.className = "nav-group-label";
    secondaryLabel.textContent = "扩展能力";
    secondaryInner.appendChild(secondaryLabel);
    secondaryGroup.appendChild(secondaryInner);

    // 非 Core 能力全部移动到渐进区；原分组只在一级导航造成 21 个入口时才暴露复杂度。
    allItems.forEach(item => {
      if (!coreItems.includes(item)) secondaryInner.appendChild(item);
    });

    const firstGroup = sidebarNav.querySelector(":scope > .nav-group");
    if (firstGroup) {
      const coreSet = new Set(coreItems);
      Array.from(firstGroup.querySelectorAll(".nav-item")).forEach(item => {
        if (!coreSet.has(item)) item.remove();
      });
      coreItems.forEach(item => firstGroup.appendChild(item));
    }

    // 清空并移除旧分组，避免产生空标题。
    Array.from(sidebarNav.querySelectorAll(":scope > .nav-group")).forEach(group => {
      if (group === firstGroup) return;
      if (!group.querySelector(".nav-item")) group.remove();
      else secondaryInner.appendChild(group);
    });

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "xy-more-toggle";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", "xyMoreNav");
    toggle.innerHTML = `<span>更多能力</span><svg class="xy-more-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;
    toggle.addEventListener("click", () => {
      const open = !secondaryGroup.classList.contains("xy-open");
      secondaryGroup.classList.toggle("xy-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      try { localStorage.setItem(MORE_KEY, open ? "1" : "0"); } catch (e) {}
    });

    sidebarNav.appendChild(toggle);
    sidebarNav.appendChild(secondaryGroup);

    let storedOpen = false;
    try { storedOpen = localStorage.getItem(MORE_KEY) === "1"; } catch (e) {}
    const activeInMore = secondaryGroup.querySelector(".nav-item.active");
    if (activeInMore || storedOpen) {
      secondaryGroup.classList.add("xy-open");
      toggle.setAttribute("aria-expanded", "true");
    }
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
    installProgressiveNav();
    installQuickActions();
    installClickFeedback();
    const active = document.querySelector(".nav-item.active");
    if (active) openMoreIfNeeded(active);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
