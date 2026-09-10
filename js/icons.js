/* 星屿侧边栏图标系统 v2 —— 24px / 1.75px / 圆角系统线性图标。
   设计原则：语义先于装饰；同一光轴；小尺寸可识别；不用渐变、阴影和碎笔。 */
(function () {
  "use strict";

  const paths = {
    dashboard: '<rect x="3.75" y="5" width="16.5" height="15.5" rx="4.5"/><path d="M8 3v4M16 3v4M3.8 10h16.4"/><circle cx="12" cy="15.2" r="1.7" fill="currentColor" stroke="none"/>',
    courses: '<path d="M9 4.5H7.5A2.5 2.5 0 0 0 5 7v10.5A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5V7a2.5 2.5 0 0 0-2.5-2.5H15"/><rect x="9" y="2.8" width="6" height="3.4" rx="1.4"/><path d="m9.3 13.2 2 2 3.8-3.8"/>',
    focus: '<circle cx="12" cy="12" r="7.7"/><circle cx="12" cy="12" r="2.3" fill="currentColor" stroke="none"/>',
    weather: '<circle cx="11.7" cy="9.8" r="3.4"/><path d="M11.7 3.4v1.8M5.9 5.5l1.3 1.3M17.5 5.5l-1.3 1.3M3.4 9.8h1.8M18.2 9.8h1.8"/><path d="M8.6 20.3a3.3 3.3 0 1 1 .6-6.55 4.4 4.4 0 0 1 8.3 1.35 2.6 2.6 0 0 1-.4 5.2Z"/>',
    notes: '<path d="M7 3.5h10A2.5 2.5 0 0 1 19.5 6v12A2.5 2.5 0 0 1 17 20.5H7A2.5 2.5 0 0 1 4.5 18V6A2.5 2.5 0 0 1 7 3.5Z"/><path d="M8.3 8.4h7.4M8.3 12.1h7.4M8.3 15.8h4.5"/>',
    lit: '<path d="M12 6.8c-2.1-1.6-4.6-2.2-7.5-2.1v13.6c2.9-.1 5.4.5 7.5 2.1 2.1-1.6 4.6-2.2 7.5-2.1V4.7c-2.9-.1-5.4.5-7.5 2.1Z"/><path d="M12 6.8v13.6"/>',
    news: '<path d="M16.5 20.5H6.8A2.8 2.8 0 0 1 4 17.7V6.8A2.8 2.8 0 0 1 6.8 4h9.4a2.8 2.8 0 0 1 2.8 2.8v11.9a1.8 1.8 0 0 0 1.8 1.8"/><path d="M8 8.4h7.5M8 12.1h7.5M8 15.8h4.4"/>',
    growth: '<path d="M4 18.5 9.5 13l3.5 3.5 7.5-7.5"/><path d="M15.8 9h4.7v4.7"/>',
    ai: '<path d="M12 3.8 13.8 9.7 19.7 11.5 13.8 13.3 12 19.2 10.2 13.3 4.3 11.5 10.2 9.7Z"/><path d="m18.8 17.2.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7Z" fill="currentColor" stroke="none"/>',
    voice: '<rect x="8.8" y="3" width="6.4" height="11.2" rx="3.2"/><path d="M5.5 12.2a6.5 6.5 0 0 0 13 0"/><path d="M12 18.7V21"/>',
    exams: '<rect x="3.75" y="5" width="16.5" height="15.5" rx="4.5"/><path d="M8 3v4M16 3v4M3.8 10h16.4"/><path d="m9.3 15.2 1.9 1.9 3.5-3.8"/>',
    running: '<circle cx="15.6" cy="4.6" r="1.8"/><path d="m14.5 7.4-1.9 5.3 3.4 2.4-1.1 5"/><path d="m12.6 12.7-3.1 1.9-2.2 4.2"/><path d="m14.5 7.4 3.5.9 1.9-1.5"/>',
    prisma: '<path d="M12 3.5 20.5 19.5H3.5Z"/><path d="M12 3.5v16"/>',
    nexus: '<circle cx="12" cy="5.9" r="2"/><circle cx="5.9" cy="17.3" r="2"/><circle cx="18.1" cy="17.3" r="2"/><path d="M10.9 7.7 7.1 15.5M13.1 7.7 16.9 15.5M8 17.3h8"/>',
    foldcraft: '<path d="M12 3.2 20.5 7.8v8.4L12 20.8 3.5 16.2V7.8Z"/><path d="M3.5 7.8 12 12.4l8.5-4.6M12 12.4v8.4"/>',
    securify: '<path d="M12 3.2 19.5 6v6.2c0 4.3-3 7.3-7.5 8.6-4.5-1.3-7.5-4.3-7.5-8.6V6Z"/><path d="m9.2 12 2 2 3.6-3.8"/>',
    toolknit: '<path d="M14.7 6.2a3.8 3.8 0 1 0 3.1 4.5L21 13.9v4.6A1.5 1.5 0 0 1 19.5 20h-2a1.5 1.5 0 0 1-1.5-1.5v-1.3"/><path d="M8.5 20.5v-6.7"/><rect x="4.5" y="10.8" width="8" height="6" rx="2"/>',
    particles: '<circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="8.7" ry="3.5"/><ellipse cx="12" cy="12" rx="8.7" ry="3.5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="8.7" ry="3.5" transform="rotate(120 12 12)"/>',
    aria: '<rect x="4" y="8.2" width="16" height="10.3" rx="4"/><path d="M12 4.5v3.7"/><circle cx="12" cy="3.3" r="1.1"/><path d="M8.8 13.5h.01M15.2 13.5h.01"/>',
    more: '<circle cx="6" cy="12" r="1.25" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.25" fill="currentColor" stroke="none"/>',
    trash: '<path d="M10 11v6M14 11v6M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    restore: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    save: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
    stop: '<rect width="18" height="18" x="3" y="3" rx="4"/>'
  };

  const SVG_HEAD = '<svg class="__CLS__" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';

  function svg(name, className = "xy-icon") {
    return SVG_HEAD.replace("__CLS__", className) + (paths[name] || paths.more) + "</svg>";
  }

  function navSvg(name) {
    return svg(name, "xy-icon nav-icon");
  }

  function decorateNavigation(root = document) {
    root.querySelectorAll(".nav-item[data-view]").forEach(item => {
      if (!item.querySelector(".xy-icon")) item.insertAdjacentHTML("afterbegin", navSvg(item.dataset.view));
    });
    root.querySelectorAll(".mobile-tab[data-mobile-view], .mobile-nav-item[data-view]").forEach(item => {
      const view = item.dataset.mobileView || item.dataset.view;
      if (!item.querySelector(".xy-icon")) item.insertAdjacentHTML("afterbegin", navSvg(view));
    });
  }

  window.XingyuIcons = { svg, navSvg, decorateNavigation, __paths: paths };
})();
