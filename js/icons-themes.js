/* 星屿图标主题：经典 / SF 单色 / iOS 多色 / 液态玻璃 */
(function () {
  "use strict";
  const KEY = "zero_icon_style";
  const base = window.XingyuIcons || {};
  const P = base.__paths || {};
  const M = base.__motion || {};

  const svg = (cls, attrs, inner, stroke = "currentColor", width = 2) =>
    `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${attrs}>${inner}</svg>`;

  function classicSvg(name, cls) {
    const head = `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">`;
    return head + (P[name] || P.more) + (M[name] || "") + "</svg>";
  }

  function monoSvg(name, cls) {
    return svg(cls, 'data-icon-theme="mono" data-icon-motion="tilt" data-icon-treatment="system-line"', P[name] || P.more, "currentColor", 2);
  }

  function glassSvg(name, cls) {
    const tones = {
      dashboard: "blue", courses: "orange", focus: "blue", weather: "orange", notes: "orange",
      lit: "blue", news: "green", growth: "green", ai: "blue", voice: "green", exams: "blue",
      prisma: "blue", nexus: "orange", foldcraft: "blue", securify: "green", toolknit: "orange",
      running: "orange", particles: "blue", aria: "blue", more: "green"
    };
    const tone = tones[name] || "blue";
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" data-icon-theme="glass" data-icon-motion="drift" data-icon-treatment="liquid-glass">
      <rect class="icon-glass-tile" x="1.7" y="1.7" width="20.6" height="20.6" rx="7.2"/>
      <circle class="icon-glass-glow tone-${tone}" cx="18.4" cy="5.9" r="3.4" stroke="none"/>
      ${P[name] || P.more}
    </svg>`;
  }

  /* iOS 多色：封闭面用系统色填充，笔画只用高光/白，保持小尺寸识别度 */
  const MULTI = {
    dashboard: '<rect x="2.8" y="4.4" width="18.4" height="16.2" rx="3.4" fill="#0A84FF" stroke="none"/><path d="M8 2.5v3.8M16 2.5v3.8" stroke="#fff" stroke-width="1.9"/><path d="M2.8 9.4h18.4" stroke="#fff" opacity=".72" stroke-width="1.6"/><circle cx="12" cy="15" r="3.2" fill="#FF9F0A" stroke="none"/>',
    courses: '<path d="M12 3.9 21.5 8.8 12 13.7 2.5 8.8Z" fill="#0A84FF" stroke="none"/><path d="M5.6 11.4v4.3c0 2 2.9 3.5 6.4 3.5s6.4-1.5 6.4-3.5v-4.3" fill="#30D158" stroke="none"/><path d="M21 9.2v6" stroke="#FF9F0A" stroke-width="2"/><circle cx="21" cy="17.2" r="1.7" fill="#FF9F0A" stroke="none"/>',
    focus: '<circle cx="12" cy="13.8" r="8.4" fill="#0A84FF" stroke="none"/><path d="M12 13.8V9.3M12 13.8l3.1 2.4" stroke="#fff" stroke-width="2"/><path d="M9.7 2.4h4.6" stroke="#30D158" stroke-width="2"/>',
    weather: '<circle cx="8.1" cy="7.7" r="3.1" fill="#FF9F0A" stroke="none"/><path d="M9.2 13.1c-1.9 0-3.1 1-3 2.3.1 1.3 1.2 2.1 2.7 2.1h6.8c1.5 0 2.7-1 2.7-2.3 0-1.2-1-2.1-2.2-2.2-.3-1.6-1.7-2.8-3.4-2.7-1.7 0-3 1.2-3.6 2.8z" fill="#0A84FF" stroke="none"/><path d="M11.3 12.5c.8-.6 1.7-.9 2.6-.7" stroke="#fff" stroke-width="1.5"/>',
    notes: '<rect x="4" y="2.9" width="16" height="18.2" rx="3.2" fill="#FF9F0A" stroke="none"/><path d="M7.6 8h8.8M7.6 12h8.8M7.6 16h5.2" stroke="#fff" stroke-width="1.8"/>',
    lit: '<path d="M12 5.5c2-1.5 4-2.3 7-2.2.8 0 1.3.5 1.3 1.3v11.3c0 .8-.5 1.3-1.3 1.3-3 0-5 .8-7 2.3-2-1.5-4-2.3-7-2.3-.8 0-1.3-.5-1.3-1.3V4.6c0-.8.5-1.3 1.3-1.3 3-.1 5 .7 7 2.2z" fill="#0A84FF" stroke="none"/><path d="M12 5.5v13.8" stroke="#fff" opacity=".72" stroke-width="1.7"/>',
    news: '<rect x="3" y="4" width="16" height="16" rx="3" fill="#0A84FF" stroke="none"/><rect x="11.3" y="6.6" width="5.1" height="3.9" rx="1.2" fill="#FF9F0A" stroke="none"/><path d="M6 7.4h3.2M6 11h3.2M6 14.6h10.3M6 17.4h7.4" stroke="#fff" stroke-width="1.6"/>',
    growth: '<rect x="3.2" y="13.4" width="3.4" height="6" rx="1.2" fill="#FF9F0A" stroke="none"/><rect x="9.6" y="10.2" width="3.4" height="9.2" rx="1.2" fill="#30D158" stroke="none"/><rect x="16" y="6.9" width="3.4" height="12.5" rx="1.2" fill="#0A84FF" stroke="none"/><path d="M4.5 10.1 10 6.6l4.4 2.6 4.4-3.9" stroke="#fff" stroke-width="1.8"/>',
    ai: '<path d="M12 2.8l1.6 5.2 5.2 1.6-5.2 1.6L12 16.4l-1.6-5.2L5.2 9.6l5.2-1.6Z" fill="#0A84FF" stroke="none"/><circle cx="19.2" cy="19.2" r="2.4" fill="#30D158" stroke="none"/>',
    voice: '<rect x="1.4" y="10.2" width="1.7" height="3.6" rx=".85" fill="#0A84FF" stroke="none"/><rect x="5.4" y="8" width="1.7" height="8" rx=".85" fill="#30D158" stroke="none"/><rect x="9.4" y="6" width="1.7" height="12" rx=".85" fill="#FF9F0A" stroke="none"/><rect x="13.4" y="9" width="1.7" height="6" rx=".85" fill="#0A84FF" stroke="none"/><rect x="17.4" y="7.2" width="1.7" height="9.6" rx=".85" fill="#30D158" stroke="none"/><rect x="21.4" y="10.2" width="1.7" height="3.6" rx=".85" fill="#FF9F0A" stroke="none"/>',
    exams: '<rect x="3" y="3" width="18" height="18" rx="3" fill="#0A84FF" stroke="none"/><path d="M8 1.9v3M16 1.9v3" stroke="#fff" stroke-width="1.9"/><path d="M3 8.8h18" stroke="#fff" opacity=".72" stroke-width="1.5"/><path d="m8.8 13.7 2.2 2.2 4.2-4.2" stroke="#FF9F0A" stroke-width="2"/>',
    prisma: '<path d="M12 3 21 19H3Z" fill="#0A84FF" stroke="none"/><path d="M2 10.6h6.5M14.9 12.4l6.2-1.8M14.9 13.8h6.7M14.9 15.2l6.2 1.8" stroke="#FF9F0A" stroke-width="1.7"/>',
    nexus: '<rect x="9.1" y="2.6" width="5.8" height="5.8" rx="1.5" fill="#0A84FF" stroke="none"/><rect x="2.6" y="15.6" width="5.8" height="5.8" rx="1.5" fill="#30D158" stroke="none"/><rect x="15.6" y="15.6" width="5.8" height="5.8" rx="1.5" fill="#FF9F0A" stroke="none"/><path d="M5.5 15.4v-2.9a1.5 1.5 0 0 1 1.5-1.5h10a1.5 1.5 0 0 1 1.5 1.5v2.9M12 10.9V8.4" stroke="#fff" opacity=".82" stroke-width="1.6"/>',
    foldcraft: '<path d="M12 2.6 21.4 11 12 21.4 2.6 11Z" fill="#0A84FF" stroke="none"/><path d="M12 2.6V21.4M2.6 11 12 21.4 21.4 11" stroke="#fff" opacity=".72" stroke-width="1.6"/>',
    securify: '<path d="M12 2.6 20 5.8v6.4c0 4.7-3.3 7.8-8 9.2-4.7-1.4-8-4.5-8-9.2V5.8Z" fill="#0A84FF" stroke="none"/><path d="m8.9 12 2.1 2.1 4.1-4.1" stroke="#30D158" stroke-width="2"/>',
    toolknit: '<path d="M3.2 8.6h17.6v10.2a1.6 1.6 0 0 1-1.6 1.6H4.8a1.6 1.6 0 0 1-1.6-1.6Z" fill="#0A84FF" stroke="none"/><path d="M8.4 8.6V6.2a3.6 3.6 0 0 1 7.2 0v2.4" stroke="#30D158" stroke-width="2"/><circle cx="12" cy="14.4" r="2.3" fill="#FF9F0A" stroke="none"/><path d="M12 11.9v-2.1M12 18.8v-2.1M14.4 14.4h2.1M7.5 14.4h2.1" stroke="#fff" stroke-width="1.5"/>',
    running: '<circle cx="15.4" cy="4.4" r="1.9" fill="#FF9F0A" stroke="none"/><path d="M14.7 6.5 13.4 13.4" stroke="#0A84FF" stroke-width="2.2"/><path d="M14.7 7.4 11.9 9.4 10.6 8.2M13.4 13.4l-3.1 2.2-1.7 3M14.7 7.4 17.5 8.9l1.1-1.7M13.4 13.4l3.1 1.8.4 4" stroke="#30D158" stroke-width="2"/>',
    particles: '<ellipse cx="12" cy="12" rx="9.2" ry="3.6" stroke="#0A84FF" stroke-width="1.7"/><ellipse cx="12" cy="12" rx="9.2" ry="3.6" transform="rotate(60 12 12)" stroke="#30D158" stroke-width="1.7"/><ellipse cx="12" cy="12" rx="9.2" ry="3.6" transform="rotate(120 12 12)" stroke="#FF9F0A" stroke-width="1.7"/><circle cx="12" cy="12" r="2.4" fill="#fff" stroke="none"/>',
    aria: '<circle cx="12" cy="12" r="8.6" fill="#0A84FF" stroke="none"/><path d="M10 7.6 16.6 10.4 13.3 11.9 11.8 15.2Z" fill="#fff" stroke="none"/>',
    more: '<circle cx="5" cy="12" r="2" fill="#0A84FF" stroke="none"/><circle cx="12" cy="12" r="2" fill="#30D158" stroke="none"/><circle cx="19" cy="12" r="2" fill="#FF9F0A" stroke="none"/>'
  };

  function multiSvg(name, cls) {
    const body = MULTI[name] || MULTI.more;
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" data-icon-theme="multi" data-icon-motion="breathe" data-icon-treatment="filled">${body}</svg>`;
  }

  function render(name, cls, style) {
    if (style === "mono") return monoSvg(name, cls);
    if (style === "multi") return multiSvg(name, cls);
    if (style === "glass") return glassSvg(name, cls);
    return classicSvg(name, cls);
  }

  function apply(style, persist = true) {
    if (!["classic", "mono", "multi", "glass"].includes(style)) style = "classic";
    document.documentElement.dataset.iconTheme = style;
    if (persist) {
      try { localStorage.setItem(KEY, style); } catch (e) {}
    }
    requestAnimationFrame(() => {
      document.querySelectorAll(".nav-item[data-view]").forEach(item => {
        const old = item.querySelector(".xy-icon");
        if (old) old.remove();
        item.insertAdjacentHTML("afterbegin", render(item.dataset.view, "xy-icon motion-" + item.dataset.view, style));
      });
      document.querySelectorAll(".mobile-tab[data-mobile-view]").forEach(item => {
        const old = item.querySelector(".xy-icon");
        if (old) old.remove();
        item.insertAdjacentHTML("afterbegin", render(item.dataset.mobileView, "xy-icon motion-" + item.dataset.mobileView, style));
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
    const saved = localStorage.getItem(KEY) || "classic";
    document.documentElement.dataset.iconTheme = saved;
    apply(saved, false);
  }, 0);

  window.XingyuIconThemes = { apply, sync };
})();
