/* ============================================================
   react-bits FX · 星屿微交互增强层（纯原生 JS）
   移植自 react-bits (DavidHDev, MIT)
   10 个效果，每个可在「设置 → 动效增强」中单独开关
   状态持久在 localStorage.rb-fx-cfg
   全局 API：window.RBFx.set(key, on) / RBFx.config() / RBFx.dispose()
   ============================================================ */
(function () {
  'use strict';

  var gsap = window.gsap;
  var hasGSAP = !!gsap;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CFG_KEY = 'rb-fx-cfg';
  var CARD_SEL = '.card, .camp-feature, .hero-card, .orb-edit-card, .ai-chat-card';
  var NAV_SEL = '.sidebar li, .nav-pill, [data-view], .nav-item, .icon-btn';
  var HIT_SEL = 'button, a, .card, .nav-item, .sidebar li, [role="button"], input[type="submit"], label';

  /* ---------- 配置读写 ---------- */
  var config = {};
  function loadCfg() {
    try { return JSON.parse(localStorage.getItem(CFG_KEY) || '{}'); } catch (e) { return {}; }
  }
  function saveCfg() {
    try { localStorage.setItem(CFG_KEY, JSON.stringify(config)); } catch (e) {}
  }

  /* ---------- 通用工具 ---------- */
  var seen = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
  function each(root, sel, fn) {
    var list = root.querySelectorAll(sel);
    for (var i = 0; i < list.length; i++) fn(list[i], i);
  }

  /* ================= 效果 1：GlareHover 卡片光晕跟随 ================= */
  var glare = {
    key: 'glare', label: '卡片光晕', def: true,
    desc: '鼠标悬停卡片时，卡片上出现跟随指针的蓝色柔光',
    on: function () {
      each(document, CARD_SEL, function (card) {
        if (card.dataset.rbGlare || card.clientWidth < 80) return;
        card.dataset.rbGlare = '1';
        card.classList.add('rb-card');
        var g = document.createElement('div');
        g.className = 'rb-glare';
        card.appendChild(g);
        var raf = 0, nx = 50, ny = 50;
        function flush() {
          g.style.setProperty('--rb-mx', nx + '%');
          g.style.setProperty('--rb-my', ny + '%');
          raf = 0;
        }
        card._rbG = function (e) {
          var r = card.getBoundingClientRect();
          nx = ((e.clientX - r.left) / r.width) * 100;
          ny = ((e.clientY - r.top) / r.height) * 100;
          if (!raf) raf = requestAnimationFrame(flush);
        };
        card._rbGe = function () { g.classList.add('is-on'); };
        card._rbGl = function () { g.classList.remove('is-on'); };
        card.addEventListener('pointermove', card._rbG);
        card.addEventListener('pointerenter', card._rbGe);
        card.addEventListener('pointerleave', card._rbGl);
      });
    },
    off: function () {
      each(document, '[data-rb-glare]', function (card) {
        card.removeEventListener('pointermove', card._rbG);
        card.removeEventListener('pointerenter', card._rbGe);
        card.removeEventListener('pointerleave', card._rbGl);
        var g = card.querySelector('.rb-glare');
        if (g) g.remove();
        card.classList.remove('rb-card');
        delete card.dataset.rbGlare;
      });
    },

    demo: function (stage) {
      var g = document.createElement('div');
      g.className = 'rb-glare is-on';
      stage.appendChild(g);
      var t = 0;
      var id = setInterval(function () {
        t += 0.035;
        g.style.setProperty('--rb-mx', (50 + Math.sin(t) * 34) + '%');
        g.style.setProperty('--rb-my', (50 + Math.cos(t * 1.3) * 24) + '%');
      }, 28);
      return function () { clearInterval(id); };
    }
  };

  /* ================= 效果 2：ClickSpark 点击火花 =================
     位置修正：火花从「被点击的功能元素」的中心迸发，而非鼠标点 */
  var spark = {
    key: 'spark', label: '点击火花', def: true,
    desc: '点击按钮或卡片时，从该功能位置迸发蓝色粒子',
    canvas: null, ctx: null, parts: [], raf: 0, dpr: 1,
    on: function () {
      if (spark.canvas) return;
      var c = document.createElement('canvas');
      c.className = 'rb-spark-canvas';
      document.body.appendChild(c);
      spark.canvas = c;
      spark.ctx = c.getContext('2d');
      spark.dpr = Math.max(1, window.devicePixelRatio || 1);
      function size() {
        c.width = window.innerWidth * spark.dpr;
        c.height = window.innerHeight * spark.dpr;
        spark.ctx.setTransform(spark.dpr, 0, 0, spark.dpr, 0, 0);
      }
      size();
      spark._size = size;
      window.addEventListener('resize', size);
      spark._down = function (e) {
        var t = e.target.closest ? e.target.closest(HIT_SEL) : null;
        if (!t) return;
        // —— 关键修正：取被点击功能元素的中心，而不是鼠标坐标 ——
        var r = t.getBoundingClientRect();
        var cx = r.left + r.width / 2;
        var cy = r.top + r.height / 2;
        for (var i = 0; i < 14; i++) {
          var a = Math.random() * Math.PI * 2;
          var s = 2 + Math.random() * 4;
          spark.parts.push({
            x: cx, y: cy,
            vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1,
            life: 1, decay: 0.016 + Math.random() * 0.014,
            size: 1.4 + Math.random() * 2.2
          });
        }
        if (!spark.raf) spark.raf = requestAnimationFrame(spark._tick);
      };
      window.addEventListener('pointerdown', spark._down, { passive: true });
    },
    _tick: function () {
      var ctx = spark.ctx;
      if (!ctx) { spark.raf = 0; return; }
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      var ps = spark.parts;
      for (var i = ps.length - 1; i >= 0; i--) {
        var p = ps[i];
        p.x += p.vx; p.y += p.vy;
        p.vy += 0.13; p.vx *= 0.985; p.vy *= 0.985;
        p.life -= p.decay;
        if (p.life <= 0) { ps.splice(i, 1); continue; }
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = 'rgba(10,132,255,1)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      spark.raf = ps.length ? requestAnimationFrame(spark._tick) : 0;
    },
    off: function () {
      if (spark._down) window.removeEventListener('pointerdown', spark._down);
      if (spark._size) window.removeEventListener('resize', spark._size);
      if (spark.canvas) { spark.canvas.remove(); spark.canvas = null; spark.ctx = null; }
      spark.parts = [];
      if (spark.raf) cancelAnimationFrame(spark.raf);
      spark.raf = 0;
    },

    /* 演示：迷你画布上循环迸发真实的粒子（与线上效果同一套物理） */
    demo: function (stage) {
      var W = 280, H = 58;
      var c = document.createElement('canvas');
      c.className = 'rb-demo-canvas';
      c.width = W; c.height = H;
      stage.appendChild(c);
      var ctx = c.getContext('2d');
      var ps = [];

      // 中心的小圆点，模拟「被点击的功能」
      var dot = document.createElement('div');
      dot.style.cssText = 'position:absolute;left:' + (W / 2 - 3) + 'px;top:' + (H / 2 - 3) +
        'px;width:6px;height:6px;border-radius:50%;background:var(--apple-blue,#0a84ff);opacity:.55;';
      stage.appendChild(dot);

      function burst() {
        for (var i = 0; i < 16; i++) {
          var a = Math.random() * Math.PI * 2;
          var s = 1.2 + Math.random() * 2.6;
          ps.push({
            x: W / 2, y: H / 2,
            vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.6,
            life: 1, decay: 0.018 + Math.random() * 0.012,
            size: 1.2 + Math.random() * 1.8
          });
        }
      }
      burst();
      var bid = setInterval(burst, 1600);
      var raf;
      function tick() {
        ctx.clearRect(0, 0, W, H);
        for (var i = ps.length - 1; i >= 0; i--) {
          var p = ps[i];
          p.x += p.vx; p.y += p.vy;
          p.vy += 0.11; p.vx *= 0.985; p.vy *= 0.985;
          p.life -= p.decay;
          if (p.life <= 0) { ps.splice(i, 1); continue; }
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.fillStyle = 'rgba(10,132,255,1)';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        raf = requestAnimationFrame(tick);
      }
      tick();
      return function () { clearInterval(bid); cancelAnimationFrame(raf); };
    }
  };

  /* ================= 效果 3：Ripple 点击涟漪 ================= */
  var ripple = {
    key: 'ripple', label: '点击涟漪', def: false,
    desc: '点击处扩散一圈柔和圆环（比火花更安静）',
    _down: null,
    on: function () {
      if (ripple._down) return;
      ripple._down = function (e) {
        var t = e.target.closest ? e.target.closest(HIT_SEL) : null;
        if (!t) return;
        if (getComputedStyle(t).position === 'static') t.style.position = 'relative';
        t.classList.add('rb-ripple-host');
        var r = t.getBoundingClientRect();
        var size = Math.max(r.width, r.height) * 2.2;
        var s = document.createElement('span');
        s.className = 'rb-ripple';
        s.style.width = s.style.height = size + 'px';
        s.style.left = (e.clientX - r.left - size / 2) + 'px';
        s.style.top = (e.clientY - r.top - size / 2) + 'px';
        t.appendChild(s);
        setTimeout(function () { s.remove(); }, 620);
      };
      window.addEventListener('pointerdown', ripple._down, { passive: true });
    },
    off: function () {
      if (ripple._down) window.removeEventListener('pointerdown', ripple._down);
      ripple._down = null;
      each(document, '.rb-ripple', function (n) { n.remove(); });
    },

    demo: function (stage) {
      stage.classList.add('rb-ripple-host');
      var id = setInterval(function () {
        var s = document.createElement('span');
        s.className = 'rb-ripple';
        s.style.width = s.style.height = '130px';
        s.style.left = 'calc(50% - 65px)';
        s.style.top = 'calc(50% - 65px)';
        stage.appendChild(s);
        setTimeout(function () { s.remove(); }, 640);
      }, 1100);
      return function () {
        clearInterval(id);
        stage.classList.remove('rb-ripple-host');
        each(stage, '.rb-ripple', function (n) { n.remove(); });
      };
    }
  };

  /* ================= 效果 4：Magnet 图标磁吸 ================= */
  var magnet = {
    key: 'magnet', label: '图标磁吸', def: true,
    desc: '侧边栏 / 头部图标在指针靠近时被吸引，离开后弹性归位',
    on: function () {
      each(document, NAV_SEL, function (el) {
        if (el.dataset.rbMagnet) return;
        el.dataset.rbMagnet = '1';
        var inner = document.createElement('span');
        inner.className = 'rb-magnet-wrap';
        while (el.firstChild) inner.appendChild(el.firstChild);
        el.appendChild(inner);
        el._rbInner = inner;
        el._rbMv = function (e) {
          if (!hasGSAP) return;
          var b = el.getBoundingClientRect();
          var dx = e.clientX - (b.left + b.width / 2);
          var dy = e.clientY - (b.top + b.height / 2);
          if (Math.hypot(dx, dy) < 24) {
            gsap.to(inner, { x: dx * 0.35, y: dy * 0.35, duration: 0.4, ease: 'power3.out' });
          } else {
            gsap.to(inner, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
          }
        };
        el._rbLv = function () {
          if (hasGSAP) gsap.to(inner, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
        };
        el.addEventListener('pointermove', el._rbMv);
        el.addEventListener('pointerleave', el._rbLv);
      });
    },
    off: function () {
      each(document, '[data-rb-magnet]', function (el) {
        el.removeEventListener('pointermove', el._rbMv);
        el.removeEventListener('pointerleave', el._rbLv);
        if (el._rbInner) {
          while (el._rbInner.firstChild) el.appendChild(el._rbInner.firstChild);
          el._rbInner.remove();
        }
        delete el.dataset.rbMagnet;
      });
    },

    demo: function (stage) {
      var box = document.createElement('div');
      box.className = 'rb-demo-box';
      box.textContent = '图标';
      stage.appendChild(box);
      var t = 0;
      var id = setInterval(function () {
        t += 0.55;
        var dx = Math.sin(t) * 11, dy = Math.cos(t * 0.8) * 6;
        if (hasGSAP) gsap.to(box, { x: dx, y: dy, duration: 0.42, ease: 'power3.out' });
        else box.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      }, 480);
      return function () { clearInterval(id); };
    }
  };

  /* ================= 效果 5：Tilt 卡片 3D 倾斜 ================= */
  var tilt = {
    key: 'tilt', label: '卡片 3D 倾斜', def: false,
    desc: '鼠标在卡片上时，卡片跟随指针做轻微透视倾斜',
    on: function () {
      if (!hasGSAP) return;
      each(document, CARD_SEL, function (card) {
        if (card.dataset.rbTilt || card.clientWidth < 120) return;
        card.dataset.rbTilt = '1';
        card._rbTv = function (e) {
          var r = card.getBoundingClientRect();
          var px = (e.clientX - r.left) / r.width - 0.5;
          var py = (e.clientY - r.top) / r.height - 0.5;
          gsap.to(card, {
            rotateY: px * 9, rotateX: -py * 9, duration: 0.45,
            ease: 'power3.out', transformPerspective: 900
          });
        };
        card._rbTl = function () {
          gsap.to(card, { rotateX: 0, rotateY: 0, duration: 0.7, ease: 'power3.out' });
        };
        card.addEventListener('pointermove', card._rbTv);
        card.addEventListener('pointerleave', card._rbTl);
      });
    },
    off: function () {
      each(document, '[data-rb-tilt]', function (card) {
        card.removeEventListener('pointermove', card._rbTv);
        card.removeEventListener('pointerleave', card._rbTl);
        if (hasGSAP) gsap.set(card, { rotateX: 0, rotateY: 0 });
        delete card.dataset.rbTilt;
      });
    },

    demo: function (stage) {
      var box = document.createElement('div');
      box.className = 'rb-demo-box rb-demo-card';
      box.textContent = '卡片';
      stage.appendChild(box);
      var t = 0;
      var id = setInterval(function () {
        t += 0.6;
        if (hasGSAP) {
          gsap.to(box, {
            rotateY: Math.sin(t) * 16, rotateX: Math.cos(t * 0.7) * 10,
            duration: 0.55, ease: 'power3.out', transformPerspective: 420
          });
        }
      }, 620);
      return function () { clearInterval(id); };
    }
  };

  /* ================= 效果 6：GlowBorder 卡片边框流光 ================= */
  var glowBorder = {
    key: 'glowBorder', label: '卡片边框流光', def: false,
    desc: '悬停卡片时，边框上有一道蓝色流光环绕',
    on: function () {
      each(document, CARD_SEL, function (card) {
        if (card.dataset.rbGlow || card.clientWidth < 100) return;
        card.dataset.rbGlow = '1';
        card.classList.add('rb-glowborder');
        card._rbGe2 = function () { card.classList.add('rb-gb-on'); };
        card._rbGl2 = function () { card.classList.remove('rb-gb-on'); };
        card.addEventListener('pointerenter', card._rbGe2);
        card.addEventListener('pointerleave', card._rbGl2);
      });
    },
    off: function () {
      each(document, '[data-rb-glow]', function (card) {
        card.removeEventListener('pointerenter', card._rbGe2);
        card.removeEventListener('pointerleave', card._rbGl2);
        card.classList.remove('rb-glowborder', 'rb-gb-on');
        delete card.dataset.rbGlow;
      });
    },

    demo: function (stage) {
      var box = document.createElement('div');
      box.className = 'rb-demo-box rb-demo-card rb-glowborder rb-gb-on';
      box.textContent = '悬停我';
      stage.appendChild(box);
      return function () {};
    }
  };

  /* ================= 效果 7：BlobCursor 光标柔光 ================= */
  var blobCursor = {
    key: 'blobCursor', label: '光标柔光', def: false,
    desc: '指针位置跟随一团柔和的蓝色光斑',
    el: null,
    on: function () {
      if (blobCursor.el) return;
      var b = document.createElement('div');
      b.className = 'rb-blob';
      document.body.appendChild(b);
      blobCursor.el = b;
      blobCursor._mv = function (e) {
        if (hasGSAP) {
          gsap.to(b, { x: e.clientX, y: e.clientY, duration: 0.55, ease: 'power3.out' });
        } else {
          b.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)';
        }
      };
      window.addEventListener('pointermove', blobCursor._mv, { passive: true });
    },
    off: function () {
      if (blobCursor._mv) window.removeEventListener('pointermove', blobCursor._mv);
      if (blobCursor.el) { blobCursor.el.remove(); blobCursor.el = null; }
      blobCursor._mv = null;
    },

    demo: function (stage) {
      var b = document.createElement('div');
      b.className = 'rb-blob rb-blob-demo';
      stage.appendChild(b);
      var t = 0;
      var id = setInterval(function () {
        t += 0.16;
        var x = stage.clientWidth / 2 + Math.sin(t) * stage.clientWidth * 0.32;
        var y = stage.clientHeight / 2 + Math.cos(t * 1.2) * stage.clientHeight * 0.22;
        if (hasGSAP) gsap.to(b, { x: x, y: y, duration: 0.4, ease: 'power3.out' });
        else b.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      }, 300);
      return function () { clearInterval(id); };
    }
  };

  /* ================= 效果 8：Shine 文字光扫 ================= */
  var shine = {
    key: 'shine', label: '文字光扫', def: false,
    desc: '每日一言等文字上有一道光从左到右扫过',
    on: function () {
      each(document, '.quote-card .quote-text, .welcome-title, h1.shine, .shiny', function (n) {
        if (n.dataset.rbShine) return;
        var t = (n.textContent || '');
        if (t.length < 2 || t.length > 80) return;
        n.dataset.rbShine = '1';
        n.classList.add('rb-shine', 'is-on');
      });
    },
    off: function () {
      each(document, '[data-rb-shine]', function (n) {
        n.classList.remove('rb-shine', 'is-on');
        delete n.dataset.rbShine;
      });
    },

    demo: function (stage) {
      var t = document.createElement('div');
      t.className = 'rb-shine is-on rb-demo-text';
      t.textContent = '每日一言';
      stage.appendChild(t);
      return function () {};
    }
  };

  /* ================= 效果 9：GradientTitle 标题渐变流动 ================= */
  var gradTitle = {
    key: 'gradTitle', label: '标题渐变流动', def: false,
    desc: '页面主标题使用缓慢流动的彩色渐变',
    on: function () {
      each(document, 'h1.view-title, .view-title, h1', function (n) {
        if (n.dataset.rbGrad) return;
        var t = (n.textContent || '').trim();
        if (t.length < 1 || t.length > 12) return;
        if (n.closest('.modal, .modal-mask, #settingsModal')) return;
        n.dataset.rbGrad = '1';
        n.classList.add('rb-gradient-text');
      });
    },
    off: function () {
      each(document, '[data-rb-grad]', function (n) {
        n.classList.remove('rb-gradient-text');
        delete n.dataset.rbGrad;
      });
    },

    demo: function (stage) {
      var t = document.createElement('div');
      t.className = 'rb-gradient-text rb-demo-text';
      t.textContent = '今日';
      stage.appendChild(t);
      return function () {};
    }
  };

  /* ================= 效果 10：StaggerIn 卡片错落入场 ================= */
  var staggerIn = {
    key: 'staggerIn', label: '卡片错落入场', def: true,
    desc: '切换视图时，卡片依次淡入上浮',
    on: function () {
      if (!hasGSAP) return;
      each(document, CARD_SEL, function (card, i) {
        if (!card.isConnected) return;
        var r = card.getBoundingClientRect();
        if (!r.width) return;
        if (seen && seen.has(card)) return;
        if (seen) seen.add(card);
        gsap.fromTo(card,
          { opacity: 0, y: 18 },
          { opacity: 1, y: 0, duration: 0.5, delay: Math.min(i, 8) * 0.055, ease: 'power3.out' });
      });
    },
    off: function () {},

    demo: function (stage) {
      var row = document.createElement('div');
      row.className = 'rb-demo-row';
      stage.appendChild(row);
      var bars = [];
      for (var i = 0; i < 5; i++) {
        var b = document.createElement('div');
        b.className = 'rb-demo-bar';
        row.appendChild(b);
        bars.push(b);
      }
      function play() {
        if (!hasGSAP) return;
        gsap.fromTo(bars,
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.45, stagger: 0.09, ease: 'power3.out' });
      }
      play();
      var id = setInterval(play, 1900);
      return function () { clearInterval(id); };
    }
  };

  /* ---------- 注册表 ---------- */
  var EFFECTS = [glare, spark, ripple, magnet, tilt, glowBorder, blobCursor, shine, gradTitle, staggerIn];

  /* ---------- 应用 / 卸载 ---------- */
  function apply(key, on) {
    var fx = EFFECTS.filter(function (f) { return f.key === key; })[0];
    if (!fx) return;
    config[key] = !!on;
    try {
      if (on) fx.on(); else fx.off();
    } catch (e) {
      console.warn('[RBFx] ' + key + ' error:', e);
    }
  }

  function applyAll() {
    EFFECTS.forEach(function (f) { apply(f.key, config[f.key]); });
  }

  /* ---------- 演示动画管理 ----------
     每个演示返回一个 stop() 清理函数；
     只在设置面板可见时播放，关闭设置即全部停止，避免后台耗电。 */
  function startDemo(f) {
    if (!f._stage || !f.demo || f._stop) return;
    f._stage.innerHTML = '';
    try {
      f._stop = f.demo(f._stage) || function () {};
    } catch (e) {
      console.warn('[RBFx] demo ' + f.key + ' error:', e);
      f._stop = null;
    }
  }
  function stopDemo(f) {
    if (f._stop) { try { f._stop(); } catch (e) {} f._stop = null; }
    if (f._stage) f._stage.innerHTML = '';
  }
  function startAllDemos() {
    EFFECTS.forEach(function (f) { if (config[f.key]) startDemo(f); });
  }
  function stopAllDemos() {
    EFFECTS.forEach(stopDemo);
  }

  /* 监听设置面板的开合：可见时播放演示，隐藏时停止 */
  function watchSettingsModal() {
    var wasOpen = false;
    setInterval(function () {
      var m = document.getElementById('settingsModal');
      if (!m) return;
      var open = !!(m.offsetWidth || m.offsetHeight) &&
        getComputedStyle(m).display !== 'none';
      if (open === wasOpen) return;
      wasOpen = open;
      if (open) startAllDemos(); else stopAllDemos();
    }, 400);
  }

  /* ---------- 设置面板 UI（动态注入，不改 index.html） ---------- */
  function buildSettingsUI() {
    var saveBtn = document.getElementById('btnSaveSettings');
    if (!saveBtn) return false;
    var foot = saveBtn.closest('.modal-foot') || saveBtn.parentNode;
    var content = foot.previousElementSibling;
    if (!content) return false;
    if (document.getElementById('rbFxGroup')) return true;

    var group = document.createElement('div');
    group.className = 'setting-group';
    group.id = 'rbFxGroup';
    var h = document.createElement('h4');
    h.textContent = '动效增强';
    group.appendChild(h);

    EFFECTS.forEach(function (f) {
      var lab = document.createElement('label');
      lab.className = 'lock-toggle';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!config[f.key];
      cb.addEventListener('change', function () {
        apply(f.key, cb.checked);
        saveCfg();
        // 勾选即时播放 / 取消即时停止该效果的演示
        if (cb.checked) startDemo(f); else stopDemo(f);
      });
      var sp = document.createElement('span');
      sp.textContent = f.label;
      lab.appendChild(cb);
      lab.appendChild(sp);

      // 迷你演示舞台
      var demo = document.createElement('div');
      demo.className = 'rb-demo';
      var stage = document.createElement('div');
      stage.className = 'rb-demo-stage';
      demo.appendChild(stage);
      f._stage = stage;

      if (f.desc) {
        var tip = document.createElement('p');
        tip.className = 'hint';
        tip.style.margin = '2px 0 6px 26px';
        tip.textContent = f.desc;
        demo.appendChild(tip);
      }
      group.appendChild(lab);
      group.appendChild(demo);
      f._cb = cb;
    });

    var tip = document.createElement('p');
    tip.className = 'hint';
    tip.textContent = '移植自 react-bits（MIT）。关闭「减少动效」的系统设置会禁用全部效果。';
    group.appendChild(tip);

    var appearancePanel = document.querySelector('#settingsModal [data-settings-panel="appearance"]');
    if (appearancePanel) appearancePanel.appendChild(group); else content.appendChild(group);
    return true;
  }

  /* ---------- SPA：新内容自动挂载 ---------- */
  var mo = null;
  function startObserver() {
    if (mo) return;
    mo = new MutationObserver(function (muts) {
      var hit = false;
      muts.forEach(function (m) {
        m.addedNodes.forEach(function (n) {
          if (n.nodeType !== 1) return;
          if (n.matches && n.matches(CARD_SEL + ',' + NAV_SEL + ',.quote-card,h1,h2,h3')) hit = true;
          else if (n.querySelector && n.querySelector('.card,.sidebar li,.quote-card,h1')) hit = true;
        });
      });
      if (!hit) return;
      // 只跑「挂载型」效果，staggerIn 负责入场动画
      [glare, magnet, tilt, glowBorder, shine, gradTitle, staggerIn].forEach(function (f) {
        if (config[f.key]) { try { f.on(); } catch (e) {} }
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  /* ---------- Public API ---------- */
  var booted = false;
  var RBFx = {
    effects: EFFECTS,
    config: function () { return JSON.parse(JSON.stringify(config)); },
    get: function (k) { return !!config[k]; },
    set: function (k, v) {
      apply(k, v);
      saveCfg();
      var fx = EFFECTS.filter(function (f) { return f.key === k; })[0];
      if (fx && fx._cb) fx._cb.checked = !!v;
    },
    boot: function () {
      if (booted) return;
      booted = true;
      var saved = loadCfg();
      EFFECTS.forEach(function (f) {
        config[f.key] = (saved[f.key] === undefined) ? f.def : !!saved[f.key];
      });
      if (reduceMotion) {
        EFFECTS.forEach(function (f) { config[f.key] = false; });
      }
      if (!reduceMotion) applyAll();
      buildSettingsUI();
      watchSettingsModal();
      startObserver();
      console.info('[RBFx] ready —', Object.keys(config).filter(function (k) { return config[k]; }).join(', ') || '(all off)');
    },
    dispose: function () {
      stopAllDemos();
      EFFECTS.forEach(function (f) { try { f.off(); } catch (e) {} });
      EFFECTS.forEach(function (f) { config[f.key] = false; });
      saveCfg();
      EFFECTS.forEach(function (f) { if (f._cb) f._cb.checked = false; });
      if (mo) { mo.disconnect(); mo = null; }
      booted = false;
      console.info('[RBFx] all off');
    },
    status: function () { return booted ? 'on' : 'off'; }
  };
  window.RBFx = RBFx;

  function auto() {
    try { if (localStorage.getItem('rb-fx') === '0') return; } catch (e) {}
    var start = function () { setTimeout(function () { RBFx.boot(); }, 400); };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start);
    } else {
      start();
    }
  }
  auto();
})();
