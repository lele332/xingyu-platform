/* 星屿图标主题 v3：只保留两套稳定线性方案，避免多主题造成视觉漂移。 */
(function () {
  "use strict";
  const KEY = "zero_icon_style";
  const base = window.XingyuIcons || {};
  if (!base.svg) return;

  const THEMES = ["classic", "mono"];

  function render(name, cls, style) {
    if (style === "mono") {
      const inner = (base.__paths && (base.__paths[name] || base.__paths.more)) || "";
      return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" data-icon-theme="mono" data-icon-treatment="system-line">${inner}</svg>`;
    }
    return base.svg(name, cls);
  }

  function apply(style, persist = true) {
    if (!THEMES.includes(style)) style = "classic";
    document.documentElement.dataset.iconTheme = style;
    if (persist) {
      try { localStorage.setItem(KEY, style); } catch (e) {}
    }
    requestAnimationFrame(() => {
      document.querySelectorAll(".nav-item[data-view]").forEach(item => {
        const old = item.querySelector(".xy-icon");
        if (old) old.remove();
        item.insertAdjacentHTML("afterbegin", render(item.dataset.view, "xy-icon", style));
      });
      document.querySelectorAll(".mobile-tab[data-mobile-view], .mobile-nav-item[data-view]").forEach(item => {
        const view = item.dataset.mobileView || item.dataset.view;
        const old = item.querySelector(".xy-icon");
        if (old) old.remove();
        item.insertAdjacentHTML("afterbegin", render(view, "xy-icon", style));
      });
      document.querySelectorAll("[data-icon-preview]").forEach(node => {
        node.innerHTML = render("ai", "xy-icon", node.dataset.iconPreview);
      });
      sync();
    });
  }

  function sync() {
    const style = document.documentElement.dataset.iconTheme || localStorage.getItem(KEY) || "classic";
    document.querySelectorAll("[data-icon-theme-pick]").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.iconThemePick === style);
    });
  }

  document.addEventListener("click", event => {
    const btn = event.target.closest("[data-icon-theme-pick]");
    if (btn) apply(btn.dataset.iconThemePick);
  });

  setTimeout(() => {
    const stored = localStorage.getItem(KEY) || "classic";
    const saved = THEMES.includes(stored) ? stored : "classic";
    document.documentElement.dataset.iconTheme = saved;
    apply(saved, false);
  }, 0);

  window.XingyuIconThemes = { apply, sync };
})();
