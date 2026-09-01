/* 星屿侧边栏图标系统 —— 统一 24×24 网格 / stroke-width 2 / 圆头圆角

   构成：
   - 语义贴合且有官方对应的，直接取 lucide-static（MIT）的官方 path；
   - 通用图标「不够星屿」的（今日 / 天气 / 云门 / 折艺 / 守御 / 工具箱 /
     粒子 / 棱镜 / 跑步），按同一套网格与线宽自绘，造型与动效都贴模块语义。

   显示尺寸 19px：24 网格 + stroke2 的实际线宽（1.58px）与原 20 网格 +
   stroke1.65（1.57px）基本持平，切换后粗细观感不变。
   生成脚本：work/gen_icons_lucide.py（改图标请改脚本后重跑） */
(function () {
  "use strict";
  const paths = {
    dashboard: '<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18"/><path d="M8 2.6v3.4M16 2.6v3.4"/><circle class="mi-today" cx="12" cy="15" r="3.2" fill="currentColor" fill-opacity="0.2" stroke="none"/>',
    courses: '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" /> <path d="M22 10v6" /> <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />',
    focus: '<line x1="10" x2="14" y1="2" y2="2" /> <line class="mi-sweep" x1="12" x2="15" y1="14" y2="11" /> <circle cx="12" cy="14" r="8" />',
    weather: '<g class="mi-rays"><path d="M12 2v2" /> <path d="m4.93 4.93 1.41 1.41" /> <path d="M20 12h2" /> <path d="m19.07 4.93-1.41 1.41" /></g> <path d="M15.947 12.65a4 4 0 0 0-5.925-4.128" /> <path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z" />',
    notes: '<path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4" /> <path d="M2 6h4" /> <path d="M2 10h4" /> <path d="M2 14h4" /> <path d="M2 18h4" /> <path d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z" />',
    lit: '<path d="M12 5v16" /> <path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z" />',
    news: '<path d="M15 18h-5" /> <path d="M18 14h-8" /> <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2" /> <rect width="8" height="4" x="10" y="6" rx="1" />',
    growth: '<path d="M16 7h6v6" /> <path d="m22 7-8.5 8.5-5-5L2 17" />',
    ai: '<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" /> <path d="M20 2v4" /> <path d="M22 4h-4" /> <circle cx="4" cy="20" r="2" />',
    voice: '<rect class="syn-wave" data-i="1" x="1.3" y="10.3" width="1.5" height="3.4" rx="0.75" fill="currentColor" stroke="none"/><rect class="syn-wave" data-i="2" x="5.3" y="8"    width="1.5" height="8"   rx="0.75" fill="currentColor" stroke="none"/><rect class="syn-wave" data-i="3" x="9.3" y="6"    width="1.5" height="12"  rx="0.75" fill="currentColor" stroke="none"/><rect class="syn-wave" data-i="4" x="13.3" y="9"   width="1.5" height="6"   rx="0.75" fill="currentColor" stroke="none"/><rect class="syn-wave" data-i="5" x="17.3" y="7.2" width="1.5" height="9.6" rx="0.75" fill="currentColor" stroke="none"/><rect class="syn-wave" data-i="6" x="21.3" y="10.3" width="1.5" height="3.4" rx="0.75" fill="currentColor" stroke="none"/>',
    exams: '<path d="M8 2v3" /> <path d="M16 2v3" /> <rect x="3" y="3" width="18" height="18" rx="2" /> <path d="M3 9h18" /> <path d="m9 15 2 2 4-4" />',
    prisma: '<path d="M12 3.2 21.4 19.6H2.6Z"/>',
    nexus: '<rect x="15.6" y="15.6" width="5.8" height="5.8" rx="1.5"/><rect x="2.6" y="15.6" width="5.8" height="5.8" rx="1.5"/><rect x="9.1" y="2.6" width="5.8" height="5.8" rx="1.5"/><path d="M5.5 15.6v-3.1a1.5 1.5 0 0 1 1.5-1.5h10a1.5 1.5 0 0 1 1.5 1.5v3.1"/><path d="M12 11V8.4"/><circle class="mi-flow" cx="12" cy="11" r="1.6" fill="currentColor" stroke="none"/>',
    foldcraft: '<path d="M12 2.6 21.4 11 12 21.4 2.6 11Z"/><path d="M12 2.6V21.4"/><path d="M2.6 11 12 21.4 21.4 11"/>',
    securify: '<path d="M12 2.6 20 5.8v6.4c0 4.7-3.3 7.8-8 9.2-4.7-1.4-8-4.5-8-9.2V5.8Z"/><path class="mi-rim" pathLength="1" d="M12 2.6 20 5.8v6.4c0 4.7-3.3 7.8-8 9.2-4.7-1.4-8-4.5-8-9.2V5.8L12 2.6"/>',
    toolknit: '<path d="M3.2 8.6h17.6v10.2a1.6 1.6 0 0 1-1.6 1.6H4.8a1.6 1.6 0 0 1-1.6-1.6Z"/><path d="M8.4 8.6V6.2a3.6 3.6 0 0 1 7.2 0v2.4"/><g class="mi-gear"><circle cx="12" cy="14.2" r="2.3"/><path d="M12 11.9V9.6M12 18.8v-2.3M14.3 14.2h2.3M7.4 14.2h2.3"/></g>',
    aria: '<circle cx="12" cy="12" r="8.4"/><path d="M10.2 7.8 16.4 10.4 13.2 11.8 11.8 15Z" fill="currentColor" stroke="none"/>',
    aria: '<circle cx="12" cy="12" r="8.4"/><path d="M10.2 7.8 16.4 10.4 13.2 11.8 11.8 15Z" fill="currentColor" stroke="none"/>',
    aria: '<circle cx="12" cy="12" r="8.4"/><path d="M10.2 7.8 16.4 10.4 13.2 11.8 11.8 15Z" fill="currentColor" stroke="none"/>',
    aria: '<circle cx="12" cy="12" r="8.4"/><path d="M10.2 7.8 16.4 10.4 13.2 11.8 11.8 15Z" fill="currentColor" stroke="none"/>',
    aria: '<circle cx="12" cy="12" r="8.4"/><path d="M10.2 7.8 16.4 10.4 13.2 11.8 11.8 15Z" fill="currentColor" stroke="none"/>',
    more: '<circle cx="12" cy="12" r="1" /> <circle cx="19" cy="12" r="1" /> <circle cx="5" cy="12" r="1" />',
    running: '<g class="mi-runfig"><circle cx="15.4" cy="4.4" r="1.85"/><path d="M14.7 6.5 13.4 13.4"/><path class="mi-arm-back" d="M14.7 7.4 11.9 9.4 10.6 8.2"/><path class="mi-leg-back" d="M13.4 13.4 10.3 15.6 8.6 18.6"/><path class="mi-arm-front" d="M14.7 7.4 17.5 8.9 18.6 7.2"/><path class="mi-leg-front" d="M13.4 13.4 16.5 15.2 16.9 19.2"/></g>',
    particles: '<ellipse cx="12" cy="12" rx="9.4" ry="3.8"/><ellipse cx="12" cy="12" rx="9.4" ry="3.8" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9.4" ry="3.8" transform="rotate(120 12 12)"/><circle cx="12" cy="12" r="2.4" fill="currentColor" fill-opacity="0.28" stroke="none"/>',
    trash: '<path d="M10 11v6" /> <path d="M14 11v6" /> <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /> <path d="M3 6h18" /> <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />',
    restore: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /> <path d="M3 3v5h5" />',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2" /> <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />',
    save: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" /> <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" /> <path d="M7 3v4a1 1 0 0 0 1 1h7" />',
    stop: '<rect width="18" height="18" x="3" y="3" rx="2" />'
  };

  /* 导航专属动效层：只在 active / hover 时被 CSS 启动。 */
  const motion = {
    dashboard: '<circle class="mi-task" data-i="1" cx="6.4" cy="12.6" r="0.95" fill="currentColor" stroke="none"/><circle class="mi-task" data-i="2" cx="6.4" cy="16.2" r="0.95" fill="currentColor" stroke="none"/>',
    courses: '<circle class="mi-tassel" cx="22" cy="17.2" r="1.1" fill="currentColor" stroke="none"/>',
    focus: '<path class="mi-arc" pathLength="1" d="M12 6.2a7.8 7.8 0 0 1 5.5 2.3"/>',
    weather: '<path class="mi-wind" pathLength="1" d="M2.4 18.6h4.4M3.4 21h3.2"/>',
    exams: '<path class="mi-check" pathLength="1" d="m9 15 2 2 4-4"/>',
    notes: '<path class="mi-write" pathLength="1" d="M8.4 11.6h5.2M8.4 15.1h3.6"/>',
    lit: '<path class="mi-flip" fill="currentColor" fill-opacity="0.22" d="M12 5.2c2.4-.6 4.5-1.6 6.6-2.1 1.3-.3 2.1.4 2.1 1.7v11.4c0 1.3-.8 2-2.1 1.7-2.1-.5-4.2-1.5-6.6-2.1Z"/>',
    news: '<path class="mi-ticker" d="M9.2 18h6.4"/>',
    growth: '<path class="mi-trend" pathLength="1" d="m22 7-8.5 8.5-5-5L2 17"/>',
    ai: '<path class="mi-spark" d="M20 2.5l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5Z" fill="currentColor" stroke="none"/>',
    nexus: '<circle class="mi-node" data-i="1" cx="8.6" cy="12.5" r="1.05" fill="currentColor" stroke="none"/><circle class="mi-node" data-i="2" cx="15.4" cy="12.5" r="1.05" fill="currentColor" stroke="none"/>',
    foldcraft: '<path class="mi-fold" fill="currentColor" fill-opacity="0.22" d="M12 2.6 21.4 11 12 21.4Z"/>',
    securify: '<path class="mi-check" pathLength="1" d="m9 12 2 2 4-4"/>',
    toolknit: '<path class="mi-tool" d="M4.6 3.4l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6Z" fill="currentColor" stroke="none"/>',
    running: '<path class="mi-speed" pathLength="1" d="M1.8 9.4h2.9M1.2 12.4h3.6M1.8 15.4h2.9"/>',
    particles: '<circle class="mi-orbit" cx="21.4" cy="12" r="1.3" fill="currentColor" stroke="none"/>',
    prisma: '<path class="mi-beam" pathLength="1" d="M1.2 10.6h7.2"/><path class="mi-disp" pathLength="1" d="M14.8 12.3 21.6 10.5M14.8 13.6 22 13.6M14.8 14.9 21.6 16.7"/>',
    more: '<path class="mi-more" pathLength="1" d="M6 18.6h12"/>'
  };

  const SVG_HEAD = '<svg class="__CLS__" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';

  function svg(name, className = "xy-icon") {
    return SVG_HEAD.replace("__CLS__", className) + (paths[name] || paths.more) + "</svg>";
  }

  function navSvg(name) {
    const cls = "xy-icon motion-" + name;
    return SVG_HEAD.replace("__CLS__", cls) + (paths[name] || paths.more) + (motion[name] || "") + "</svg>";
  }

  function decorateNavigation(root = document) {
    root.querySelectorAll(".nav-item[data-view]").forEach(item => {
      if (!item.querySelector(".xy-icon")) item.insertAdjacentHTML("afterbegin", navSvg(item.dataset.view));
    });
    root.querySelectorAll(".mobile-tab[data-mobile-view]").forEach(item => {
      if (!item.querySelector(".xy-icon")) item.insertAdjacentHTML("afterbegin", navSvg(item.dataset.mobileView));
    });
  }

  window.XingyuIcons = { svg, navSvg, decorateNavigation, __paths: paths, __motion: motion };
})();
