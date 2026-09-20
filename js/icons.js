/* 星屿侧边栏图标系统 v2 —— 24px / 1.75px / 圆角系统线性图标。
   设计原则：语义先于装饰；同一光轴；小尺寸可识别；不用渐变、阴影和碎笔。 */
(function () {
  "use strict";

  const paths = {
    dashboard: '<path d="M4 5.5h16M4 12h16M4 18.5h16"/><circle cx="7" cy="5.5" r="1.4" fill="currentColor" stroke="none"/><circle cx="13" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="18" cy="18.5" r="1.4" fill="currentColor" stroke="none"/>',
    courses: '<path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16H7.5A2.5 2.5 0 0 0 5 21.5z"/><path d="M5 5.5v16M9 7h6M9 11h6"/><path d="m15 15 1.5 1.5L19 14"/>',
    focus: '<circle cx="12" cy="12" r="7.7"/><circle cx="12" cy="12" r="2.3" fill="currentColor" stroke="none"/>',
    weather: '<circle cx="11.7" cy="9.8" r="3.4"/><path d="M11.7 3.4v1.8M5.9 5.5l1.3 1.3M17.5 5.5l-1.3 1.3M3.4 9.8h1.8M18.2 9.8h1.8"/><path d="M8.6 20.3a3.3 3.3 0 1 1 .6-6.55 4.4 4.4 0 0 1 8.3 1.35 2.6 2.6 0 0 1-.4 5.2Z"/>',
    notes: '<path d="M7 3.5h9.5A2.5 2.5 0 0 1 19 6v14.5H7A3 3 0 0 1 4 17.5V6.5a3 3 0 0 1 3-3Z"/><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4.5"/><path d="M15.5 3.5v4l-1.7-1-1.7 1v-4"/>',
    lit: '<path d="M12 6.8c-2.1-1.6-4.6-2.2-7.5-2.1v13.6c2.9-.1 5.4.5 7.5 2.1 2.1-1.6 4.6-2.2 7.5-2.1V4.7c-2.9-.1-5.4.5-7.5 2.1Z"/><path d="M12 6.8v13.6"/>',
    news: '<path d="M16.5 20.5H6.8A2.8 2.8 0 0 1 4 17.7V6.8A2.8 2.8 0 0 1 6.8 4h9.4a2.8 2.8 0 0 1 2.8 2.8v11.9a1.8 1.8 0 0 0 1.8 1.8"/><path d="M8 8.4h7.5M8 12.1h7.5M8 15.8h4.4"/>',
    growth: '<path d="M4 18.5 9.5 13l3.5 3.5 7.5-7.5"/><path d="M15.8 9h4.7v4.7"/>',
    ai: '<path d="M12 3.8 13.8 9.7 19.7 11.5 13.8 13.3 12 19.2 10.2 13.3 4.3 11.5 10.2 9.7Z"/><path d="m18.8 17.2.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7Z" fill="currentColor" stroke="none"/>',
    voice: '<rect x="8.8" y="3" width="6.4" height="11.2" rx="3.2"/><path d="M5.5 12.2a6.5 6.5 0 0 0 13 0"/><path d="M12 18.7V21"/>',
    exams: '<rect x="4" y="4.5" width="16" height="16" rx="3.5"/><path d="M8 3v4M16 3v4M4 9.5h16"/><path d="M12 12.2v4.2M12 18.5h.01"/>',
    relax: '<path d="M20.4 4.1c0 8.5-4.4 12.7-9.7 12.7a5.1 5.1 0 0 1-5.1-5.1c0-5.3 4.6-7.6 14.8-7.6Z"/><path d="M4.2 20.5c1.6-4.3 4.4-7 8.2-8.6"/>',
    camp: '<path d="M5.6 21V3.6"/><path d="M5.6 4.7h12l-2.1 3.7 2.1 3.7H5.6"/><path d="M5.6 15.4h5.2"/>',
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
    kb: '<path d="M3 7.5 12 3l9 4.5-9 4.5z"/><path d="M6.5 10.5v5.2c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3v-5.2"/><path d="M21 8v7"/><circle cx="21" cy="17.5" r="1" fill="currentColor" stroke="none"/>',
    /* 桥梁结构实验室：斜拉桥剪影 —— 独塔 + 细长密索
       造型要素：① 中央独塔 + 塔顶横梁（锚固区）② 桥面横线贯穿 ③ **每侧 3 根索，共 6 根**，
       索长 3.5px → 16.1px 逐级加长（最长索已伸到图标边界 x=1.2），细长舒展
       ④ 两岸桥台
       🔴 迭代 13 次量化确定的三个必要条件（24px 网格 / stroke 1.75px）：
         ① **索彼此不交叉**：塔上锚点标高顺序 与 桥面落点远近顺序 必须**单调一致**（塔顶→落最远）。
            顺序一旦交叉，索互相穿越，间距立刻掉到 0.0x px。
         ② **锚固点错开标高**：索从塔上不同高度锚出（y=4.2/8.9/13.6 三级），间距由标高差保证。
            若都从塔顶同一点出发，几何上必然重合（实测 0.12~0.75px）。
         ③ **索数上限 6 根**：实测每侧 5 根（共 10 根）时数学间距 2.00px 虽达标，
            但倾角接近（45°~49°）使斜线铺满三角区，**视觉上糊成一整块实心三角** ——
            ⚠️ 「数学间距达标 ≠ 视觉分离」，这是纯数值验证的盲区，必须靠缩略图看。
       → 最终 3 根/侧：间距 4.20px（余量充足），索长梯度 3.5→16.1px（细长舒展）。
       ⚠️ 索两端都要核：塔端起于塔身、桥端必须落在桥面线 y=16.2 上（悬空会被一眼看穿） */
    bridgelab: '<path d="M12 4.2v11.6"/><path d="M10.4 4.2h3.2"/><path d="M1.2 16.2h21.6"/><path d="M12 4.2 1.2 16.2"/><path d="M12 8.9 4.2 16.2"/><path d="M12 13.6 9.6 16.2"/><path d="M12 4.2 22.8 16.2"/><path d="M12 8.9 19.8 16.2"/><path d="M12 13.6 14.4 16.2"/><path d="M1.2 20.6h5.4"/><path d="M17.4 20.6h5.4"/>',
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
      // data-icon 可覆写图标名：同一 data-view 的两个入口（跑步训练 / 训练营）需要区分开。
      if (!item.querySelector(".xy-icon")) item.insertAdjacentHTML("afterbegin", navSvg(item.dataset.icon || item.dataset.view));
    });
    root.querySelectorAll(".mobile-tab[data-mobile-view], .mobile-nav-item[data-view]").forEach(item => {
      const view = item.dataset.mobileView || item.dataset.view;
      if (!item.querySelector(".xy-icon")) item.insertAdjacentHTML("afterbegin", navSvg(view));
    });
  }

  window.XingyuIcons = { svg, navSvg, decorateNavigation, __paths: paths };
})();
