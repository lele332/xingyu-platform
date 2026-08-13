/* ============================================================
   animefx.js — anime.js 补充动画层
   与 anim.js（GSAP 层）平行共存，负责 GSAP 未覆盖的细腻效果：
   文字逐字浮现 / 番茄钟平滑进度 / 天气卡片错峰 / 品牌标记动效。
   设计适配：
   - 主题适配：仅使用 transform / opacity，不写死颜色，17 套主题通用
   - 无障碍适配：prefers-reduced-motion 时全部跳过（元素保持原样可见）
   - 降级安全：anime.js 未加载时所有调用为空操作，绝不隐藏元素
   ============================================================ */
(function () {
  "use strict";

  var hasAnime = typeof window.anime !== "undefined" && typeof window.anime.animate === "function";
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* 保存正在播放的动画，便于中断（如快速连点“换一句”） */
  var _quoteAnim = null;
  var _quoteSplit = null;
  var _pomoAnim = null;
  var _pomoVal = null;

  var AnimeFX = {
    hasAnime: hasAnime,
    reducedMotion: reduceMotion,

    /* ============================================================
       每日一言：文字逐字浮现（anime.js text.splitText 拆字）
       ============================================================ */
    quoteReveal: function (el) {
      if (!el) return;
      // 还原上一次拆字，保证从干净文本开始
      if (_quoteSplit) {
        try { _quoteSplit.revert(); } catch (ignore) {}
        _quoteSplit = null;
      }
      if (!hasAnime || reduceMotion) return;
      var A = window.anime;
      // 中断上一次动画
      if (_quoteAnim) { try { _quoteAnim.pause(); } catch (ignore) {} }
      var split = A.text.splitText(el);
      if (!split || !split.chars || !split.chars.length) return;
      _quoteSplit = split;
      _quoteAnim = A.animate(split.chars, {
        opacity: [0, 1],
        y: [9, 0],
        duration: 380,
        delay: A.stagger(14, { start: 30 }),
        ease: "outExpo",
        complete: function () { _quoteAnim = null; }
      });
    },

    /* ============================================================
       番茄钟：进度平滑流动（SVG 描边圆环，走 GPU 合成）
       首次调用时注入 SVG（stroke-dasharray/offset），之后动画插值；
       anime 未加载或减动效时自动降级回 conic-gradient（--progress）
       ============================================================ */
    pomoInit: function () {
      var ring = document.querySelector(".pomo-ring");
      if (!ring || ring.dataset.fx) return;
      ring.dataset.fx = "1";
      var ns = "http://www.w3.org/2000/svg";
      var size = 220, stroke = 10, r = 88; // 220/2 - inset12 - stroke/2
      var svg = document.createElementNS(ns, "svg");
      svg.setAttribute("viewBox", "0 0 " + size + " " + size);
      svg.setAttribute("class", "pomo-svg");
      svg.setAttribute("aria-hidden", "true");
      var track = document.createElementNS(ns, "circle");
      track.setAttribute("cx", size / 2);
      track.setAttribute("cy", size / 2);
      track.setAttribute("r", r);
      track.setAttribute("fill", "none");
      track.setAttribute("stroke-width", stroke);
      track.style.stroke = "var(--paper-sunk)";
      var bar = document.createElementNS(ns, "circle");
      bar.setAttribute("cx", size / 2);
      bar.setAttribute("cy", size / 2);
      bar.setAttribute("r", r);
      bar.setAttribute("fill", "none");
      bar.setAttribute("stroke-width", stroke);
      bar.style.stroke = "var(--ink)";
      bar.style.strokeLinecap = "round";
      var C = 2 * Math.PI * r;
      bar.style.strokeDasharray = C.toFixed(1);
      bar.style.strokeDashoffset = C.toFixed(1);
      svg.appendChild(track);
      svg.appendChild(bar);
      ring.appendChild(svg);
      ring.classList.add("fx-svg");
      AnimeFX._pomoC = C;
      AnimeFX._pomoBar = bar;
      AnimeFX._pomoOffset = C;
    },

    /* 进度插值：target 为 0-100 的百分比 */
    pomoSmooth: function (target) {
      var ring = document.querySelector(".pomo-ring");
      if (!ring) return;
      // 降级路径：anime 未加载或减动效时回到 conic-gradient
      if (!hasAnime || reduceMotion) {
        ring.style.setProperty("--progress", target.toFixed(1));
        _pomoVal = target;
        return;
      }
      var A = window.anime;
      AnimeFX.pomoInit();
      if (!AnimeFX._pomoBar || !AnimeFX._pomoC) return;
      var C = AnimeFX._pomoC;
      var toOffset = C * (1 - target / 100);
      var fromOffset = (_pomoVal == null) ? C : C * (1 - _pomoVal / 100);
      if (Math.abs(toOffset - fromOffset) < 0.5) {
        AnimeFX._pomoBar.style.strokeDashoffset = toOffset;
        AnimeFX._pomoOffset = toOffset;
        _pomoVal = target;
        return;
      }
      if (_pomoAnim) { try { _pomoAnim.pause(); } catch (ignore) {} }
      var state = { v: fromOffset };
      _pomoAnim = A.animate(state, {
        v: toOffset,
        duration: 900,
        ease: "linear",
        onUpdate: function () {
          AnimeFX._pomoBar.style.strokeDashoffset = state.v;
          AnimeFX._pomoOffset = state.v;
          _pomoVal = target;
        },
        complete: function () { _pomoAnim = null; }
      });
    },

    /* 番茄钟：开始 / 暂停 / 重置时的圆环微反馈 */
    pomoPulse: function () {
      var ring = document.querySelector(".pomo-ring");
      if (!ring || !hasAnime || reduceMotion) return;
      window.anime.animate(ring, {
        scale: [0.985, 1],
        duration: 240,
        ease: "outExpo"
      });
    },

    /* ============================================================
       天气：7 天卡片 + 当前天气卡错峰上移
       （只动 y，配合 weather.js 已有的整体淡入 Anim.quoteIn，
         二者叠加形成“整体显现 + 内部逐卡浮现”的层次感）
       ============================================================ */
    weatherReveal: function (box) {
      if (!box || !hasAnime || reduceMotion) return;
      var items = [];
      var hero = box.querySelector(".weather-hero");
      var days = box.querySelectorAll(".w-day");
      if (hero) items.push(hero);
      for (var i = 0; i < days.length; i++) items.push(days[i]);
      if (!items.length) return;
      window.anime.animate(items, {
        y: [14, 0],
        duration: 340,
        delay: window.anime.stagger(40),
        ease: "outExpo"
      });
    },

    /* ============================================================
       品牌 ○ 标记：首载缩放浮现 + hover 微放大
       （○ 是正圆，rotate 无视觉意义，改用 scale + 主题色反馈）
       ============================================================ */
    logoIn: function () {
      var logo = document.querySelector(".logo-icon");
      if (!logo || logo.dataset.animefx) return;
      if (!hasAnime || reduceMotion) return;
      logo.dataset.animefx = "1";
      var A = window.anime;
      A.animate(logo, {
        scale: { from: 0.85, to: 1 },
        opacity: { from: 0, to: 1 },
        duration: 520,
        ease: "outExpo",
        complete: function () { logo.style.removeProperty("opacity"); }
      });
      logo.addEventListener("mouseenter", function () { AnimeFX._logoHover(logo, 1.08); });
      logo.addEventListener("mouseleave", function () { AnimeFX._logoHover(logo, 1); });
    },
    _logoHover: function (el, s) {
      if (!hasAnime || reduceMotion) return;
      window.anime.animate(el, { scale: s, duration: 260, ease: "outExpo" });
    }
  };

  window.AnimeFX = AnimeFX;
})();
