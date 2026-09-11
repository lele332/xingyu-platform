/* ============================================================
   relax.js — 解压舱：呼吸 / 气泡 / 流沙 / 光影
   ============================================================ */
(function () {
  "use strict";
  let inited = false;

  function active() {
    const view = document.getElementById("view-relax");
    return !!view && view.classList.contains("active");
  }

  function fitCanvas(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: rect.width, h: rect.height, ctx };
  }

  /* 呼吸 */
  function initBreath() {
    const ring = document.getElementById("breathRing");
    const label = document.getElementById("breathLabel");
    const btn = document.getElementById("btnBreathToggle");
    if (!ring || !label || !btn) return;
    const phases = [
      { name: "吸气", en: "Inhale", time: 4000, scale: 1.35 },
      { name: "屏息", en: "Hold", time: 7000, scale: 1.35 },
      { name: "呼气", en: "Exhale", time: 8000, scale: 1.0 },
      { name: "停留", en: "Rest", time: 2000, scale: 1.0 }
    ];
    let phase = 0, running = false, timer = null, timeout = null;
    function setPhase() {
      const p = phases[phase];
      label.textContent = document.documentElement.dataset.lang === "en" ? p.en : p.name;
      ring.style.transform = `scale(${p.scale})`;
      ring.style.transition = `transform ${p.time}ms cubic-bezier(.4,0,.2,1), box-shadow 700ms ease`;
      timeout = setTimeout(() => { phase = (phase + 1) % phases.length; setPhase(); }, p.time);
    }
    function toggle() {
      running = !running;
      btn.textContent = document.documentElement.dataset.lang === "en" ? (running ? "Pause" : "Start") : (running ? "暂停" : "开始");
      if (running) setPhase();
      else {
        clearTimeout(timeout); label.textContent = document.documentElement.dataset.lang === "en" ? "Paused" : "已暂停";
        ring.style.transform = "scale(1)";
      }
    }
    btn.addEventListener("click", toggle);
  }

  /* 气泡 */
  function initBubbles() {
    const canvas = document.getElementById("bubbleCanvas");
    const scoreEl = document.getElementById("bubbleScore");
    if (!canvas) return;
    let state = fitCanvas(canvas) || { w: 0, h: 0, ctx: canvas.getContext("2d") };
    let bubbles = [], score = 0;
    function spawn() {
      bubbles.push({ x: 30 + Math.random() * (state.w - 60), y: state.h + 20, r: 14 + Math.random() * 22, vy: 22 + Math.random() * 34, hue: 190 + Math.random() * 70 });
    }
    canvas.addEventListener("pointerdown", function (e) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      bubbles = bubbles.filter(b => {
        if (Math.hypot(b.x - x, b.y - y) < b.r + 8) { score++; if (scoreEl) scoreEl.textContent = score; return false; }
        return true;
      });
    });
    let last = performance.now();
    function loop(now) {
      requestAnimationFrame(loop);
      const dt = Math.min(.033, (now - last) / 1000); last = now;
      if (!active()) return;
      if (Math.random() < .06 && bubbles.length < 28) spawn();
      const { ctx, w, h } = state;
      ctx.clearRect(0, 0, w, h);
      bubbles.forEach(b => {
        b.y -= b.vy * dt;
        b.x += Math.sin(now * .001 + b.hue) * 8 * dt;
        const grad = ctx.createRadialGradient(b.x - b.r * .3, b.y - b.r * .4, 1, b.x, b.y, b.r);
        grad.addColorStop(0, "rgba(255,255,255,.75)");
        grad.addColorStop(.55, `hsla(${b.hue},85%,70%,.42)`);
        grad.addColorStop(1, `hsla(${b.hue},85%,60%,.08)`);
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.34)"; ctx.stroke();
      });
      bubbles = bubbles.filter(b => b.y > -60);
    }
    requestAnimationFrame(loop);
    window.addEventListener("resize", () => { state = fitCanvas(canvas) || state; });
  }

  /* 流沙 */
  function initSand() {
    const canvas = document.getElementById("sandCanvas");
    const btn = document.getElementById("btnSandClear");
    if (!canvas) return;
    let state = fitCanvas(canvas) || { w: 0, h: 0, ctx: canvas.getContext("2d") };
    let drawing = false, last = null;
    function fade() { const { ctx, w, h } = state; ctx.fillStyle = "rgba(255,255,255,.018)"; ctx.fillRect(0, 0, w, h); }
    function point(e) {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    canvas.addEventListener("pointerdown", e => { drawing = true; last = point(e); });
    canvas.addEventListener("pointermove", e => {
      if (!drawing) return;
      const p = point(e); const { ctx } = state;
      ctx.strokeStyle = "rgba(80,110,255,.55)"; ctx.lineWidth = 4; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      last = p;
    });
    window.addEventListener("pointerup", () => drawing = false);
    btn && btn.addEventListener("click", () => { state.ctx.clearRect(0, 0, state.w, state.h); });
    (function loop() { requestAnimationFrame(loop); if (active()) fade(); })();
    window.addEventListener("resize", () => { state = fitCanvas(canvas) || state; });
  }

  /* 光影 */
  function initFlow() {
    const canvas = document.getElementById("flowCanvas");
    if (!canvas) return;
    let state = fitCanvas(canvas) || { w: 0, h: 0, ctx: canvas.getContext("2d") };
    let mouse = { x: .5, y: .5 };
    canvas.addEventListener("pointermove", e => {
      const r = canvas.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) / r.width; mouse.y = (e.clientY - r.top) / r.height;
    });
    (function loop(now) {
      requestAnimationFrame(loop);
      if (!active()) return;
      const { ctx, w, h } = state; const t = now * .00045;
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < 5; i++) {
        const phase = t + i * .58;
        const x = w * (.18 + .64 * (0.5 + 0.5 * Math.sin(phase + mouse.x * 3)));
        const y = h * (.22 + .56 * (0.5 + 0.5 * Math.cos(phase * .82 + mouse.y * 3)));
        const radius = 40 + i * 26 + Math.sin(phase) * 16;
        const grad = ctx.createRadialGradient(x, y, 1, x, y, radius);
        grad.addColorStop(0, `hsla(${180 + i * 22},90%,72%,.20)`);
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
      }
    })(performance.now());
    window.addEventListener("resize", () => { state = fitCanvas(canvas) || state; });
  }

  /* 星河流转：低耗星尘 + 可点击流星 */
  function initDrift() {
    const canvas = document.getElementById("driftCanvas");
    if (!canvas) return;
    let state = fitCanvas(canvas) || { w: 0, h: 0, ctx: canvas.getContext("2d") };
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let stars = [], trails = [];
    function seed() {
      const count = Math.min(180, Math.max(60, Math.round(state.w * state.h / 6500)));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * state.w,
        y: Math.random() * state.h,
        r: .6 + Math.random() * 1.6,
        a: .25 + Math.random() * .55,
        vx: reduced ? 0 : 4 + Math.random() * 10,
        tw: Math.random() * Math.PI * 2
      }));
    }
    seed();
    canvas.addEventListener("pointerdown", (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      trails.push({ x, y, vx: 260 + Math.random() * 220, vy: 80 + Math.random() * 120, life: 1 });
    });
    (function loop(now) {
      requestAnimationFrame(loop);
      if (!active()) return;
      const { ctx, w, h } = state;
      const dt = reduced ? 0 : Math.min(.032, 1 / 60);
      ctx.clearRect(0, 0, w, h);
      for (const st of stars) {
        st.x += st.vx * dt; st.tw += dt * 2.2;
        if (st.x > w + 4) st.x = -4;
        ctx.globalAlpha = st.a * (.72 + .28 * Math.sin(st.tw));
        ctx.fillStyle = "#dbeeff";
        ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2); ctx.fill();
      }
      for (const tr of trails) {
        tr.x += tr.vx * dt; tr.y += tr.vy * dt; tr.life -= dt * .7;
        const grad = ctx.createLinearGradient(tr.x, tr.y, tr.x - tr.vx * .12, tr.y - tr.vy * .12);
        grad.addColorStop(0, `rgba(255,255,255,${Math.max(0, tr.life)})`);
        grad.addColorStop(1, "rgba(180,220,255,0)");
        ctx.globalAlpha = 1;
        ctx.strokeStyle = grad; ctx.lineWidth = 2; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(tr.x, tr.y); ctx.lineTo(tr.x - tr.vx * .12, tr.y - tr.vy * .12); ctx.stroke();
      }
      trails = trails.filter(t => t.life > 0);
      ctx.globalAlpha = 1;
    })(performance.now());
    window.addEventListener("resize", () => { state = fitCanvas(canvas) || state; seed(); });
  }

  /* 泡泡纸：可拖动连压，减压手感 */
  let buildWrap = () => {};
  function initWrap() {
    const stage = document.getElementById("wrapStage");
    const btn = document.getElementById("btnWrapReset");
    if (!stage) return;
    let dragging = false;
    buildWrap = function build() {
      const cols = stage.clientWidth > 520 ? 9 : 6;
      const rows = 5;
      stage.innerHTML = "";
      for (let i = 0; i < cols * rows; i++) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "wrap-bubble";
        b.style.setProperty("--delay", `${Math.random() * .12}s`);
        stage.appendChild(b);
      }
    };
    stage.addEventListener("pointerdown", e => {
      dragging = true;
      const b = e.target.closest(".wrap-bubble");
      if (b) pop(b);
    });
    stage.addEventListener("pointermove", e => {
      if (!dragging) return;
      const b = document.elementFromPoint(e.clientX, e.clientY)?.closest(".wrap-bubble");
      if (b) pop(b);
    });
    window.addEventListener("pointerup", () => dragging = false);
    stage.addEventListener("pointerleave", () => dragging = false);
    function pop(b) {
      if (!b || b.classList.contains("popped")) return;
      b.classList.add("popped");
      b.disabled = true;
      if (navigator.vibrate) navigator.vibrate(8);
      if (!stage.querySelector(".wrap-bubble:not(.popped)")) setTimeout(buildWrap, 520);
    }
    btn && btn.addEventListener("click", buildWrap);
    window.addEventListener("resize", () => buildWrap());
    buildWrap();
  }

  /* 放灯：可点击释放祈福灯，柔和漂浮 */
  function initLantern() {
    const canvas = document.getElementById("lanternCanvas");
    if (!canvas) return;
    let state = fitCanvas(canvas) || { w: 0, h: 0, ctx: canvas.getContext("2d") };
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let lanterns = [];
    canvas.addEventListener("pointerdown", e => {
      const rect = canvas.getBoundingClientRect();
      spawn(e.clientX - rect.left, rect.height - 16);
    });
    function spawn(x, y) {
      lanterns.push({
        x: x ?? state.w * (.2 + Math.random() * .6),
        y: y ?? state.h + 20,
        vx: reduced ? 0 : 8 + Math.random() * 14,
        vy: reduced ? 0 : 34 + Math.random() * 28,
        sway: Math.random() * Math.PI * 2,
        hue: 22 + Math.random() * 18,
        r: 13 + Math.random() * 9
      });
    }
    for (let i = 0; i < 6; i++) spawn(undefined, state.h + Math.random() * 160);
    (function loop(now) {
      requestAnimationFrame(loop);
      if (!active()) return;
      const { ctx, w, h } = state;
      const dt = reduced ? 0 : Math.min(.032, 1 / 60);
      ctx.clearRect(0, 0, w, h);
      for (const l of lanterns) {
        l.sway += dt * 1.6;
        l.x += (l.vx + Math.sin(l.sway) * 8) * dt;
        l.y -= l.vy * dt;
        const glow = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, l.r * 2.6);
        glow.addColorStop(0, `hsla(${l.hue}, 100%, 74%, .95)`);
        glow.addColorStop(.42, `hsla(${l.hue}, 90%, 62%, .38)`);
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(l.x, l.y, l.r * 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `hsla(${l.hue}, 85%, 70%, .95)`;
        ctx.beginPath(); ctx.ellipse(l.x, l.y, l.r * .68, l.r, 0, 0, Math.PI * 2); ctx.fill();
      }
      lanterns = lanterns.filter(l => l.y > -70);
      if (lanterns.length < 7 && Math.random() < .02) spawn();
    })(performance.now());
    window.addEventListener("resize", () => { state = fitCanvas(canvas) || state; });
  }

  function init() {
    if (inited) return;
    inited = true;
    initBreath(); initBubbles(); initSand(); initFlow(); initDrift(); initWrap(); initLantern();
    document.querySelectorAll("[data-relax-tab]").forEach(btn => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.relaxTab;
        document.querySelectorAll("[data-relax-tab]").forEach(b => b.classList.toggle("active", b === btn));
        document.querySelectorAll("[data-relax-panel]").forEach(panel => {
          panel.style.display = panel.dataset.relaxPanel === tab ? "" : "none";
        });
        document.querySelectorAll("#view-relax canvas").forEach(c => fitCanvas(c));
        if (tab === "wrap") {
          const stage = document.getElementById("wrapStage");
          if (stage && !stage.children.length) buildWrap();
        }
      });
    });
    document.querySelectorAll("#view-relax canvas").forEach(c => fitCanvas(c));
  }

  window.addEventListener("DOMContentLoaded", init);
  if (document.readyState !== "loading") init();
  window.Relax = { render: init };
})();
