/* 星屿统一线性图标系统：20×20 / 1.65px / round joins */
(function () {
  "use strict";
  const paths = {
    dashboard: '<rect x="3" y="3" width="5" height="5" rx="1.4"/><rect x="12" y="3" width="5" height="5" rx="1.4"/><rect x="3" y="12" width="5" height="5" rx="1.4"/><rect x="12" y="12" width="5" height="5" rx="1.4"/>',
    courses: '<path d="M3.5 5.5 10 2.8l6.5 2.7L10 8.2 3.5 5.5Z"/><path d="M5.5 7.2v5.3c0 1.3 2 2.6 4.5 2.6s4.5-1.3 4.5-2.6V7.2"/><path d="M16.5 5.5v6"/>',
    focus: '<circle cx="10" cy="10" r="6.8"/><path d="M10 6.2V10l2.6 1.7"/><path d="M6.2 2.6 4.5 1.5M13.8 2.6l1.7-1.1"/>',
    weather: '<path d="M6.5 14.8h8.1a3 3 0 0 0 .2-6 5 5 0 0 0-9.5 1.1A2.5 2.5 0 0 0 6.5 14.8Z"/><path d="M4 5.8 2.7 4.5M10 2.8V1M4.2 9H2"/>',
    notes: '<path d="M5 2.8h7l3 3v11.4H5Z"/><path d="M12 2.8v3h3M7.5 9h5M7.5 12h5M7.5 15h3"/>',
    lit: '<path d="M4 3.2h8.2a2 2 0 0 1 2 2v11.6H6a2 2 0 0 1-2-2Z"/><path d="M6 16.8a2 2 0 0 1 2-2h6.2M7.2 6.3h4.2M7.2 9h4.2"/>',
    news: '<rect x="2.8" y="3.2" width="14.4" height="13.6" rx="2"/><path d="M6 6.3h4.5M6 9.2h8M6 12.1h8M12.8 6.3H14"/>',
    growth: '<path d="M3.2 16.8V10h3.3v6.8M8.4 16.8V6.7h3.3v10.1M13.6 16.8V3.2h3.2v13.6"/><path d="m3.5 7.2 4-3 3 1.4 5.3-3.3"/>',
    ai: '<path d="M10 2.5 11.6 7 16 8.6 11.6 10.2 10 14.7 8.4 10.2 4 8.6 8.4 7Z"/><path d="m15.2 13 .7 2 .1.1 2 .7-2 .7-.1.1-.7 2-.7-2-2-.7 2-.7Z"/>',

    exams: '<rect x="3" y="4.6" width="14" height="12.6" rx="2"/><path d="M3 8.6h14M7 2.8v3.4M13 2.8v3.4M7.4 12h2.2M10.4 12h2.2M7.4 14.8h2.2M10.4 14.8h2.2"/>',
    prisma: '<path d="M6 3.2h8l4 5.2-8 8.4-8-8.4Z"/><path d="M2.8 8.4h14.4M6 3.2l4 5.2 4-5.2M6 8.4l4 8.4 4-8.4"/>',
    nexus: '<circle cx="10" cy="4.2" r="2"/><circle cx="3.8" cy="15" r="2"/><circle cx="16.2" cy="15" r="2"/><path d="M10 6.2v3.6M3.8 13v-2M16.2 13v-2M10 9.8 4.6 13M10 9.8l5.4 3.2"/>',
    foldcraft: '<path d="M4 14.2 10 3l6 11.2-6 2.2Z"/><path d="M4 14.2 10 16.4l6-2.2M10 3v13.4M7 6.6l3-3.6 3 3.6"/>',
    securify: '<path d="M10 3 16 5.5v5.2c0 3.4-2.4 5.6-6 6.3-3.6-.7-6-2.9-6-6.3V5.5Z"/><path d="M7.4 10.3l2 2 3.4-3.6"/>',
    toolknit: '<path d="M3.5 9h13v7a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 16Z"/><path d="M7 9V7a3 3 0 0 1 6 0v2M3.5 12.2h13M10 12.2v2.6"/>',
    more: '<circle cx="4" cy="10" r="1.25" fill="currentColor" stroke="none"/><circle cx="10" cy="10" r="1.25" fill="currentColor" stroke="none"/><circle cx="16" cy="10" r="1.25" fill="currentColor" stroke="none"/>',
    trash: '<path d="M3.5 5.2h13M7.2 5.2V3.3h5.6v1.9M5.2 5.2l.8 11.3h8l.8-11.3M8 8.2v5.4M12 8.2v5.4"/>',
    restore: '<path d="M4.2 7.2A6.7 6.7 0 1 1 4 12"/><path d="M4.2 3.5v3.7h3.7"/>',
    copy: '<rect x="6.5" y="6.5" width="10" height="10" rx="2"/><path d="M13.5 6.5v-1a2 2 0 0 0-2-2h-8v8a2 2 0 0 0 2 2h1"/>',
    save: '<path d="M4 3h10l2 2v12H4Z"/><path d="M7 3v5h6V3M7 17v-5h6v5"/>',
    stop: '<rect x="5" y="5" width="10" height="10" rx="2"/>'
  };

  function svg(name, className = "xy-icon") {
    return `<svg class="${className}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.more}</svg>`;
  }

  function decorateNavigation(root = document) {
    root.querySelectorAll(".nav-item[data-view]").forEach(item => {
      if (!item.querySelector(".xy-icon")) item.insertAdjacentHTML("afterbegin", svg(item.dataset.view));
    });
    root.querySelectorAll(".mobile-tab[data-mobile-view]").forEach(item => {
      if (!item.querySelector(".xy-icon")) item.insertAdjacentHTML("afterbegin", svg(item.dataset.mobileView));
    });
  }

  window.XingyuIcons = { svg, decorateNavigation };
})();
