/* ============================================================
   anim.js — GSAP 动画层
   平台所有高级动画统一封装。GSAP 加载失败时自动回退到原有 CSS 动画。
   ============================================================ */
(function () {
  "use strict";

  var hasGSAP = typeof window.gsap !== "undefined";
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (hasGSAP) {
    if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
    gsap.defaults({ duration: 0.55, ease: "power3.out", overwrite: "auto" });
  }

  function dur(full) { return reduceMotion ? 0 : (full || 0.55); }

  var Anim = {
    hasGSAP: hasGSAP,
    reducedMotion: reduceMotion,

    /* ---------- 视图入场：淡入 + 上移 + 轻微缩放 ---------- */
    viewEnter: function (el) {
      if (!el) return;
      if (!hasGSAP) {
        el.classList.remove("view-in");
        void el.offsetWidth;
        el.classList.add("view-in");
        return;
      }
      gsap.fromTo(el,
        { autoAlpha: 0, y: 24, scale: 0.985 },
        {
          autoAlpha: 1, y: 0, scale: 1,
          duration: dur(),
          ease: "power3.out",
          clearProps: "transform,opacity,visibility"
        }
      );
      // 仪表盘：网格卡片错落浮入（增强层次感）
      var cards = el.querySelectorAll(".dash-grid > .card");
      if (cards.length && !reduceMotion) {
        gsap.fromTo(cards,
          { autoAlpha: 0, y: 18 },
          {
            autoAlpha: 1, y: 0,
            duration: dur(0.5), stagger: 0.07, delay: 0.12,
            clearProps: "transform,opacity,visibility"
          }
        );
      }
    },

    /* ---------- 统计数字滚动 ---------- */
    countUp: function (el, target) {
      if (!el) return;
      if (!hasGSAP || reduceMotion) { el.textContent = target; return; }
      var state = { v: 0 };
      gsap.to(state, {
        v: target,
        duration: 0.9,
        ease: "power2.out",
        snap: { v: 1 },
        onUpdate: function () { el.textContent = Math.round(state.v); }
      });
    },

    /* ---------- 弹窗（Sheet）入场 / 退出 ---------- */
    sheetIn: function (mask, sheet) {
      if (!mask) return;
      if (!hasGSAP) {
        if (sheet) { sheet.classList.remove("sheet-in"); void sheet.offsetWidth; sheet.classList.add("sheet-in"); }
        return;
      }
      gsap.fromTo(mask,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: dur(0.22), clearProps: "opacity,visibility" }
      );
      if (sheet) gsap.fromTo(sheet,
        { y: 36, scale: 0.97, autoAlpha: 0 },
        {
          y: 0, scale: 1, autoAlpha: 1,
          duration: dur(0.38), ease: "power3.out",
          clearProps: "transform,opacity,visibility"
        }
      );
    },
    sheetOut: function (mask, sheet, onDone) {
      if (!mask) return;
      if (!hasGSAP) { onDone && onDone(); return; }
      gsap.to(mask, {
        autoAlpha: 0, duration: dur(0.18),
        onComplete: onDone,
        clearProps: "opacity,visibility"
      });
      if (sheet) gsap.to(sheet, {
        y: 20, scale: 0.98, autoAlpha: 0,
        duration: dur(0.18), ease: "power2.in",
        clearProps: "transform,opacity,visibility"
      });
    },

    /* ---------- 锁屏 ---------- */
    lockIn: function (mask) {
      if (!mask) return;
      if (!hasGSAP) return;
      gsap.fromTo(mask,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: dur(0.3), clearProps: "opacity,visibility" }
      );
      var box = mask.querySelector(".lock-box");
      if (box) gsap.fromTo(box,
        { scale: 0.92, autoAlpha: 0 },
        {
          scale: 1, autoAlpha: 1,
          duration: dur(0.42), ease: "back.out(1.6)",
          clearProps: "transform,opacity,visibility"
        }
      );
    },
    lockOut: function (mask, onDone) {
      if (!mask) return;
      if (!hasGSAP) { onDone && onDone(); return; }
      gsap.to(mask, {
        autoAlpha: 0, duration: dur(0.22),
        onComplete: onDone,
        clearProps: "opacity,visibility"
      });
    },

    /* ---------- 侧边栏点击：弹性反馈 ---------- */
    navPulse: function (item) {
      if (!item || !hasGSAP || reduceMotion) return;
      gsap.fromTo(item,
        { scale: 0.95 },
        { scale: 1, duration: 0.4, ease: "back.out(2.2)", clearProps: "transform" }
      );
    },

    /* ---------- 文本淡入（每日一言等） ---------- */
    quoteIn: function (el) {
      if (!el || !hasGSAP || reduceMotion) return;
      gsap.fromTo(el,
        { autoAlpha: 0, y: 8 },
        { autoAlpha: 1, y: 0, duration: dur(0.4), clearProps: "transform,opacity,visibility" }
      );
    },

    /* ---------- 滚动分批浮入（ScrollTrigger），返回清理函数 ---------- */
    scrollReveal: function (container, selector) {
      if (!hasGSAP || !window.ScrollTrigger) return function () {};
      var items = gsap.utils.toArray(selector, container);
      if (!items.length || reduceMotion) return function () {};
      var triggers = [];
      gsap.set(items, { autoAlpha: 0, y: 22 });
      items.forEach(function (el) {
        var st = ScrollTrigger.create({
          trigger: el,
          start: "top 94%",
          once: true,
          onEnter: function () {
            gsap.to(el, {
              autoAlpha: 1, y: 0,
              duration: 0.5, ease: "power3.out",
              clearProps: "transform,opacity,visibility"
            });
          }
        });
        triggers.push(st);
      });
      return function () {
        triggers.forEach(function (s) { s.kill(); });
        triggers = [];
      };
    },

    refreshScroll: function () {
      if (hasGSAP && window.ScrollTrigger) ScrollTrigger.refresh();
    }
  };

  window.Anim = Anim;
})();
