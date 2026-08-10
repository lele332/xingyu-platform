/* ============================================================
   anim.js — GSAP 动画层
   平台所有高级动画统一封装。GSAP 加载失败时自动回退到原有 CSS 动画。
   ============================================================ */
(function () {
  "use strict";

  var hasGSAP = typeof window.gsap !== "undefined";
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  if (hasGSAP) {
    if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
    gsap.defaults({ duration: 0.55, ease: "power3.out", overwrite: "auto" });
  }

  function dur(full) { return reduceMotion ? 0 : (full || 0.55); }

  /* ---------- 卡片 3D 倾斜：先清理旧的再绑定（DOM 重建后重绑） ---------- */
  var _tiltTweens = [];
  function killTilt() {
    _tiltTweens.forEach(function (t) { t.kill(); });
    _tiltTweens = [];
  }
  function tiltHandler(card, xT, yT) {
    return function (e) {
      var r = card.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width;
      var py = (e.clientY - r.top) / r.height;
      xT((px - 0.5) * 5);
      yT(-(py - 0.5) * 5);
      card.style.setProperty("--mx", (e.clientX - r.left) + "px");
      card.style.setProperty("--my", (e.clientY - r.top) + "px");
    };
  }

  var Anim = {
    hasGSAP: hasGSAP,
    reducedMotion: reduceMotion,

    /* ============================================================
       仪表盘开场序列（hero → 数字滚动 → 每日一言 → 卡片错落）
       ============================================================ */
    dashboardIntro: function (scope) {
      if (!scope) return;
      if (!hasGSAP || reduceMotion) {
        // 直接显示 + 数字到位
        var st = scope.querySelectorAll("#heroStats [data-count]");
        for (var i = 0; i < st.length; i++) st[i].textContent = st[i].dataset.count;
        Anim.initTilt(scope);
        return;
      }
      var hero = scope.querySelector(".hero-card");
      var quote = scope.querySelector(".quote-card");
      var grid = gsap.utils.toArray(".dash-grid > .card", scope);
      var tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      if (hero) {
        tl.fromTo(hero,
          { autoAlpha: 0, y: 32, scale: 0.97 },
          { autoAlpha: 1, y: 0, scale: 1, duration: 0.6, clearProps: "all" },
          0.05
        );
        tl.add(function () {
          gsap.utils.toArray("#heroStats [data-count]", scope).forEach(function (el) {
            Anim.countUp(el, +el.dataset.count);
          });
        }, ">-0.12");
      }
      if (quote) {
        tl.fromTo(quote,
          { autoAlpha: 0, y: 22 },
          { autoAlpha: 1, y: 0, duration: 0.45, clearProps: "all" },
          ">-0.18"
        );
      }
      if (grid.length) {
        tl.fromTo(grid,
          { autoAlpha: 0, y: 26 },
          { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.08, clearProps: "all" },
          ">-0.15"
        );
      }
      Anim.initTilt(scope);
      return tl;
    },

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
        { autoAlpha: 0, y: 10 },
        { autoAlpha: 1, y: 0, duration: dur(0.42), ease: "power3.out", clearProps: "transform,opacity,visibility" }
      );
    },

    /* ---------- 卡片 3D 倾斜 + 光晕（桌面 hover，GSAP quickTo） ---------- */
    initTilt: function (scope) {
      killTilt();
      if (!hasGSAP || reduceMotion || !finePointer) return;
      var cards = gsap.utils.toArray(".card, .hero-card, .quote-card", scope);
      if (!cards.length) return;
      document.documentElement.classList.add("tilt-on");
      cards.forEach(function (card) {
        var xT = gsap.quickTo(card, "rotationY", { duration: 0.35, ease: "power2.out", transformPerspective: 900 });
        var yT = gsap.quickTo(card, "rotationX", { duration: 0.35, ease: "power2.out" });
        var sT = gsap.quickTo(card, "scale", { duration: 0.2, ease: "power2.out" });
        _tiltTweens.push(xT, yT, sT);
        card.addEventListener("mousemove", tiltHandler(card, xT, yT));
        card.addEventListener("mouseenter", function () { sT(1.015); });
        card.addEventListener("mouseleave", function () { xT(0); yT(0); sT(1); });
      });
    },
    killTilt: killTilt,

    /* ---------- 按钮涟漪（事件委托，动态按钮也生效） ---------- */
    initRipple: function () {
      if (!hasGSAP || reduceMotion) return;
      document.addEventListener("click", function (e) {
        var btn = e.target.closest(".btn");
        if (!btn) return;
        var r = btn.getBoundingClientRect();
        var span = document.createElement("span");
        span.className = "ripple";
        var size = Math.max(r.width, r.height) * 1.2;
        span.style.width = span.style.height = size + "px";
        span.style.left = (e.clientX - r.left - size / 2) + "px";
        span.style.top = (e.clientY - r.top - size / 2) + "px";
        btn.appendChild(span);
        gsap.fromTo(span, { scale: 0, opacity: 0.4 }, {
          scale: 1, opacity: 0,
          duration: 0.55, ease: "power2.out",
          onComplete: function () { span.remove(); }
        });
      });
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
