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
    // 苹果设计语言：expo.out（≈ cubic-bezier(.19,1,.22,1)）快速减速，默认 0.34s
    gsap.defaults({ duration: 0.34, ease: "expo.out", overwrite: "auto" });
  }

  function dur(full) { return reduceMotion ? 0 : (full || 0.42); }

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
        return;
      }
      var hero = scope.querySelector(".hero-card");
      var quote = scope.querySelector(".quote-card");
      var grid = gsap.utils.toArray(".dash-grid > .card", scope);
      var tl = gsap.timeline({ defaults: { ease: "power4.out" } });
      // 纯透明度淡入，不做 y/scale 位移：开屏后首个可见窗口主线程必须空闲，
      // transform 位移 + 毛玻璃卡片并发合成是可见卡顿的来源（此处 backdrop-filter
      // 已被入场窗口临时关闭，但位移仍需多张合成层，纯 opacity 更轻）。
      if (hero) {
        tl.fromTo(hero,
          { opacity: 0 },
          { opacity: 1, duration: 0.45, clearProps: "opacity" },
          0.05
        );
        tl.add(function () {
          gsap.utils.toArray("#heroStats [data-count]", scope).forEach(function (el) {
            Anim.countUp(el, +el.dataset.count);
          });
        }, ">-0.1");
      }
      if (quote) {
        tl.fromTo(quote,
          { opacity: 0 },
          { opacity: 1, duration: 0.34, clearProps: "opacity" },
          ">-0.15"
        );
      }
      if (grid.length) {
        tl.fromTo(grid,
          { opacity: 0 },
          { opacity: 1, duration: 0.4, stagger: 0.05, clearProps: "opacity" },
          ">-0.12"
        );
      }
      return tl;
    },

    /* ---------- 视图入场：苹果式淡入 + 轻微上移（expo 减速） ---------- */
    viewEnter: function (el) {
      if (!el) return;
      if (!hasGSAP) {
        el.classList.remove("view-in");
        void el.offsetWidth;
        el.classList.add("view-in");
        return;
      }
      gsap.fromTo(el,
        { autoAlpha: 0, y: 10, scale: 0.995 },
        {
          autoAlpha: 1, y: 0, scale: 1,
          duration: dur(0.38),
          ease: "expo.out",
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
        { autoAlpha: 1, duration: dur(0.18), clearProps: "opacity,visibility" }
      );
      // 苹果式弹窗：轻微 overshoot 弹性（back.out），底部上滑 + 缩放
      if (sheet) gsap.fromTo(sheet,
        { y: 22, scale: 0.96, autoAlpha: 0 },
        {
          y: 0, scale: 1, autoAlpha: 1,
          duration: dur(0.44), ease: "back.out(1.35)",
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
        y: 24, scale: 0.985, autoAlpha: 0,
        duration: dur(0.24), ease: "power3.in",
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
          duration: dur(0.4), ease: "expo.out",
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

    /* ---------- 侧边栏入场序列（已移除 2026-08-29） ----------
       原 preHideSidebar/sidebarIntro 在现行启动流程中无任何调用方
       （开屏流程直接由 bootHeavy + splash-done 驱动），属死代码。 */

    /* ---------- 移动滑块 pill：active 高亮块平滑滑动 ----------
       手写 rAF 补间实现：不依赖 GSAP ticker，也不依赖 CSS transition
       （GSAP 接触过的元素 + 全局 !important transition 会使其失效）。
       坐标用 getBoundingClientRect 相对 sidebar-nav 的差值：
       导航分多个 .nav-group，item.offsetTop 只在组内计数（跨组会算错成 0），
       rect 差值不分组，任何层级都准确。 */
    _pillCtx: null,
    _pillBase: null,
    _pillCur: null,   // 当前 transform 状态 {x,y,sx,sy}
    _pillTimer: null, // 补间动画句柄
    initNavPill: function () {
      var nav = document.querySelector(".sidebar-nav");
      if (!nav) return;
      if (!Anim._pillCtx) {
        var pill = nav.querySelector(".nav-pill");
        if (!pill) {
          pill = document.createElement("span");
          pill.className = "nav-pill";
          nav.insertBefore(pill, nav.firstChild);
        }
        // scale 从左上角缩放，与 left/top + width/height 语义一致
        pill.style.transformOrigin = "0 0";
        Anim._pillCtx = { nav: nav, pill: pill };
      }
      var active = nav.querySelector(".nav-item.active");
      if (active) Anim.navPillTo(active.dataset.view, false);
    },
    _pillApply: function (x, y, sx, sy) {
      var pill = Anim._pillCtx.pill;
      pill.style.transform = "translate(" + x + "px," + y + "px) scale(" + sx + "," + sy + ")";
      Anim._pillCur = { x: x, y: y, sx: sx, sy: sy };
    },
    navPillTo: function (view, animate) {
      if (!Anim._pillCtx) return;
      var p = Anim._pillCtx;
      var item = p.nav.querySelector('.nav-item[data-view="' + view + '"]');
      if (!item) return;
      // 相对 sidebar-nav 的准确坐标（不分组、含滚动位置）
      var nr = p.nav.getBoundingClientRect();
      var ir = item.getBoundingClientRect();
      var x = ir.left - nr.left, y = ir.top - nr.top, w = ir.width, h = ir.height;
      if (!Anim._pillBase) {
        Anim._pillBase = { x: x, y: y, w: w, h: h };
        Anim._pillBaseView = view;
        var st0 = p.pill.style;
        st0.left = x + "px"; st0.top = y + "px";
        st0.width = w + "px"; st0.height = h + "px";
        Anim._pillApply(0, 0, 1, 1);
        return;
      }
      // 基准项实时重捕：badge/滚动条/字体加载引起的布局漂移随时被吸收，
      // 滑块移动量始终相对基准项当前几何计算（不再有累积误差）
      var b = Anim._pillBase;
      if (Anim._pillBaseView) {
        var baseItem = p.nav.querySelector('.nav-item[data-view="' + Anim._pillBaseView + '"]');
        if (baseItem) {
          var br = baseItem.getBoundingClientRect();
          b = { x: br.left - nr.left, y: br.top - nr.top, w: br.width, h: br.height };
        }
      }
      var tx = x - b.x, ty = y - b.y;
      var tsx = b.w ? w / b.w : 1, tsy = b.h ? h / b.h : 1;
      if (animate === false || reduceMotion) {
        if (Anim._pillTimer) { clearTimeout(Anim._pillTimer); Anim._pillTimer = null; }
        Anim._pillApply(tx, ty, tsx, tsy);
        return;
      }
      // rAF 补间：easeOutQuart 0.34s（setTimeout 驱动，避免 rAF 节流时动画停摆）
      var from = Anim._pillCur || { x: 0, y: 0, sx: 1, sy: 1 };
      var t0 = performance.now(), dur = 340;
      if (Anim._pillTimer) { clearTimeout(Anim._pillTimer); Anim._pillTimer = null; }
      function step() {
        var now = performance.now();
        var pr = Math.min((now - t0) / dur, 1);
        var e = 1 - Math.pow(1 - pr, 4);
        Anim._pillApply(
          from.x + (tx - from.x) * e,
          from.y + (ty - from.y) * e,
          from.sx + (tsx - from.sx) * e,
          from.sy + (tsy - from.sy) * e
        );
        if (pr < 1) Anim._pillTimer = setTimeout(step, 16);
        else Anim._pillTimer = null;
      }
      Anim._pillTimer = setTimeout(step, 16);
    },

    /* ---------- 侧边栏 hover：文字右移 + 微反馈 ---------- */
    initNav: function () {
      if (!hasGSAP || reduceMotion) return;
      gsap.utils.toArray(".nav-item").forEach(function (item) {
        var label = item.querySelector(".nav-label");
        if (!label) return;
        var t = gsap.fromTo(label, { x: 0 }, { x: 4, duration: 0.25, ease: "power2.out", paused: true, clearProps: "transform" });
        item.addEventListener("mouseenter", function () { t.play(); });
        item.addEventListener("mouseleave", function () { t.reverse(); });
      });
    },

    /* ---------- 侧边栏点击：苹果弹性反馈（滑块滑动由 navPillTo 处理） ---------- */
    navPulse: function (item) {
      if (!item || !hasGSAP || reduceMotion) return;
      gsap.fromTo(item, { scale: 0.97 }, { scale: 1, duration: 0.3, ease: "back.out(2.2)", clearProps: "transform" });
    },

    /* ---------- 文本淡入（每日一言等）：苹果 expo 减速 ---------- */
    quoteIn: function (el) {
      if (!el || !hasGSAP || reduceMotion) return;
      gsap.fromTo(el,
        { autoAlpha: 0, y: 8 },
        { autoAlpha: 1, y: 0, duration: dur(0.36), ease: "expo.out", clearProps: "transform,opacity,visibility" }
      );
    },

    /* ---------- 滚动分批浮入（ScrollTrigger），返回清理函数 ---------- */
    scrollReveal: function (container, selector) {
      if (!hasGSAP || !window.ScrollTrigger) return function () {};
      var items = gsap.utils.toArray(selector, container);
      if (!items.length || reduceMotion) return function () {};
      var triggers = [];
      gsap.set(items, { autoAlpha: 0, y: 16 });
      items.forEach(function (el) {
        var st = ScrollTrigger.create({
          trigger: el,
          start: "top 94%",
          once: true,
          onEnter: function () {
            gsap.to(el, {
              autoAlpha: 1, y: 0,
              duration: 0.4, ease: "expo.out",
              clearProps: "transform,opacity,visibility"
            });
          }
        });
        triggers.push(st);
      });
      return function () {
        triggers.forEach(function (s) { s.kill(); });
        triggers = [];
        // 恢复所有元素可见（含未触发 onEnter 的），避免切走后残留隐藏状态
        gsap.set(items, { clearProps: "opacity,visibility,transform" });
      };
    },

    /* ---------- 移动端侧栏：1:1 跟手关闭 + 速度投影 ---------- */
    initSidebarGesture: function (sidebar, mask) {
      if (!sidebar || !mask || !window.PointerEvent) return;
      var active = false;
      var committed = false;
      var startX = 0;
      var startY = 0;
      var lastX = 0;
      var lastT = 0;
      var velocity = 0;

      function reset(close) {
        sidebar.style.removeProperty("transition");
        sidebar.style.removeProperty("transform");
        sidebar.style.removeProperty("will-change");
        mask.style.removeProperty("opacity");
        mask.style.removeProperty("transition");
        if (close) {
          sidebar.classList.remove("open");
          mask.classList.remove("show");
        }
        active = false;
        committed = false;
      }

      sidebar.addEventListener("pointerdown", function (e) {
        if (window.innerWidth > 900 || !sidebar.classList.contains("open")) return;
        active = true;
        committed = false;
        startX = lastX = e.clientX;
        startY = e.clientY;
        lastT = performance.now();
        velocity = 0;
      });

      sidebar.addEventListener("pointermove", function (e) {
        if (!active) return;
        var dx = e.clientX - startX;
        var dy = e.clientY - startY;
        if (!committed) {
          if (Math.abs(dx) < 9 && Math.abs(dy) < 9) return;
          if (Math.abs(dy) >= Math.abs(dx)) { reset(false); return; }
          committed = true;
          sidebar.setPointerCapture(e.pointerId);
          sidebar.style.transition = "none";
          sidebar.style.willChange = "transform";
        }
        e.preventDefault();
        var width = sidebar.getBoundingClientRect().width || 320;
        var x = Math.min(0, dx);
        var now = performance.now();
        var dt = Math.max(1, now - lastT);
        velocity = ((e.clientX - lastX) / dt) * 1000;
        lastX = e.clientX;
        lastT = now;
        sidebar.style.transform = "translateX(" + x + "px)";
        mask.style.opacity = String(Math.max(0, 1 + x / width));
      });

      function finish(e) {
        if (!active) return;
        try { sidebar.releasePointerCapture(e.pointerId); } catch (ignore) {}
        if (!committed) { reset(false); return; }
        var matrix = new DOMMatrixReadOnly(getComputedStyle(sidebar).transform);
        var current = matrix.m41;
        var projected = current + (velocity / 1000) * 0.998 / (1 - 0.998);
        var width = sidebar.getBoundingClientRect().width || 320;
        var close = projected < -width * 0.42 || velocity < -520;
        active = false;
        committed = false;
        sidebar.style.transition = "transform 340ms cubic-bezier(.22,1,.36,1)";
        mask.style.transition = "opacity 260ms ease-out";
        sidebar.style.transform = "translateX(" + (close ? -(width + 20) : 0) + "px)";
        mask.style.opacity = close ? "0" : "1";
        setTimeout(function () { reset(close); }, close ? 280 : 350);
      }

      sidebar.addEventListener("pointerup", finish);
      sidebar.addEventListener("pointercancel", finish);
    },

    refreshScroll: function () {
      if (hasGSAP && window.ScrollTrigger) ScrollTrigger.refresh();
    }
  };

  window.Anim = Anim;
})();
