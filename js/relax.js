/* ============================================================
   relax.js — 解压舱 3.0：呼吸 / 气泡 / 流沙 / 光影 / 星河 / 泡泡纸 / 放灯
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
    if (!rect.width || !rect.height) return null;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: rect.width, h: rect.height, ctx };
  }

  function makeState(canvas) {
    return fitCanvas(canvas) || { w: 0, h: 0, ctx: canvas.getContext("2d") };
  }

  let audioCtx = null;
  let soundOn = localStorage.getItem("xingyu_relax_sound") !== "0";
  function playTone(base = 520, kind = "pop") {
    if (!soundOn) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const t = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = kind === "soft" ? "triangle" : "sine";
      osc.frequency.setValueAtTime(base + Math.random() * 180, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(100, base * .45), t + .12);
      gain.gain.setValueAtTime(.075, t);
      gain.gain.exponentialRampToValueAtTime(.001, t + .16);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t); osc.stop(t + .18);
    } catch (_) {}
  }

  function floatText(canvas, x, y, text, hue = 190) {
    const holder = canvas.parentElement;
    if (!holder) return;
    const el = document.createElement("div");
    el.className = "relax-float";
    el.textContent = text;
    el.style.left = `${canvas.offsetLeft + x}px`;
    el.style.top = `${canvas.offsetTop + y}px`;
    el.style.color = `hsl(${hue}, 96%, 78%)`;
    holder.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  function initBreath() {
    const ring = document.getElementById("breathRing");
    const label = document.getElementById("breathLabel");
    const btn = document.getElementById("btnBreathToggle");
    if (!ring || !label || !btn) return;
    const phases = [
      { name: "吸气", en: "Inhale", time: 4000, scale: 1.42 },
      { name: "屏息", en: "Hold", time: 7000, scale: 1.42 },
      { name: "呼气", en: "Exhale", time: 8000, scale: .92 },
      { name: "停留", en: "Rest", time: 2000, scale: .92 }
    ];
    let phase = 0, running = false, timeout = null;
    function setPhase() {
      const p = phases[phase];
      label.textContent = document.documentElement.dataset.lang === "en" ? p.en : p.name;
      ring.style.transform = `scale(${p.scale})`;
      ring.style.transition = `transform ${p.time}ms cubic-bezier(.33,.68,0,1), box-shadow 1000ms ease`;
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

  function initBubbles() {
    const canvas = document.getElementById("bubbleCanvas");
    if (!canvas) return;
    const scoreEl = document.getElementById("bubbleScore");
    const comboEl = document.getElementById("bubbleCombo");
    const bestEl = document.getElementById("bubbleBest");
    let state = makeState(canvas);
    let bubbles = [], sparks = [], ripples = [];
    let score = 0, combo = 0, best = Number(localStorage.getItem("xingyu_relax_best_bubble") || 0), comboUntil = 0;

    function hud() {
      if (scoreEl) scoreEl.textContent = score;
      if (comboEl) comboEl.textContent = combo;
      if (bestEl) bestEl.textContent = best;
    }

    function spawn() {
      const r = 13 + Math.random() * 26;
      bubbles.push({
        x: r + Math.random() * Math.max(1, state.w - r * 2),
        y: state.h + r + 14,
        r, vy: 26 + Math.random() * 38,
        hue: 180 + Math.random() * 95,
        phase: Math.random() * Math.PI * 2
      });
    }

    canvas.addEventListener("pointerdown", function (e) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      let hit = false;
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        if (Math.hypot(b.x - x, b.y - y) < b.r + 10) {
          bubbles.splice(i, 1);
          hit = true;
          const now = performance.now();
          combo = now < comboUntil ? combo + 1 : 1;
          comboUntil = now + 1300;
          const gained = 10 * combo;
          score += gained;
          if (score > best) {
            best = score;
            localStorage.setItem("xingyu_relax_best_bubble", String(best));
          }
          ripples.push({ x: b.x, y: b.y, r: b.r * .5, life: 1, hue: b.hue });
          for (let n = 0; n < 12; n++) {
            const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 160;
            sparks.push({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, hue: b.hue });
          }
          floatText(canvas, b.x, b.y, `+${gained}${combo > 1 ? ` · x${combo}` : ""}`, b.hue);
          playTone(520 + combo * 42);
          if (navigator.vibrate) navigator.vibrate(8);
          hud();
          break;
        }
      }
      if (!hit) { combo = 0; hud(); }
    });

    let last = performance.now();
    (function loop(now) {
      requestAnimationFrame(loop);
      const dt = Math.min(.033, (now - last) / 1000); last = now;
      if (!active()) return;
      if (now > comboUntil && combo) { combo = 0; hud(); }
      if (Math.random() < .085 && bubbles.length < 32) spawn();
      const { ctx, w, h } = state;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (const b of bubbles) {
        b.phase += dt * 1.6; b.y -= b.vy * dt;
        b.x += Math.sin(b.phase) * 14 * dt;
        const grad = ctx.createRadialGradient(b.x - b.r * .32, b.y - b.r * .38, 1, b.x, b.y, b.r);
        grad.addColorStop(0, "rgba(255,255,255,.86)");
        grad.addColorStop(.46, `hsla(${b.hue},96%,74%,.44)`);
        grad.addColorStop(1, `hsla(${b.hue},96%,60%,.03)`);
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.36)"; ctx.lineWidth = 1; ctx.stroke();
      }
      for (const s of sparks) {
        s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= .96; s.vy *= .96; s.life -= dt * 1.5;
        ctx.fillStyle = `hsla(${s.hue},96%,78%,${Math.max(0, s.life)})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, 2.2, 0, Math.PI * 2); ctx.fill();
      }
      for (const r of ripples) {
        r.r += dt * 110; r.life -= dt * 1.7;
        ctx.strokeStyle = `hsla(${r.hue},96%,78%,${Math.max(0, r.life)})`;
        ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
      bubbles = bubbles.filter(b => b.y > -70);
      sparks = sparks.filter(s => s.life > 0);
      ripples = ripples.filter(r => r.life > 0);
    })(performance.now());

    hud();
    window.addEventListener("resize", () => { state = makeState(canvas); });
  }

  function initSand() {
    const canvas = document.getElementById("sandCanvas");
    const btn = document.getElementById("btnSandClear");
    if (!canvas) return;
    let state = makeState(canvas), drawing = false, last = null;

    function point(e) {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    function stroke(a, b) {
      const { ctx } = state;
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const count = Math.max(2, Math.min(28, Math.round(dist / 2)));
      for (let i = 0; i < count; i++) {
        const p = i / (count - 1 || 1);
        const x = a.x + (b.x - a.x) * p + (Math.random() - .5) * 6;
        const y = a.y + (b.y - a.y) * p + (Math.random() - .5) * 6;
        const hue = 205 + Math.sin(y * .012 + x * .008) * 70;
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = `hsla(${hue},96%,70%,.07)`;
        ctx.beginPath(); ctx.arc(x, y, 3.4, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = `hsla(${hue},92%,82%,.72)`;
        ctx.beginPath(); ctx.arc(x, y, .8 + Math.random() * 1.6, 0, Math.PI * 2); ctx.fill();
      }
    }

    canvas.addEventListener("pointerdown", e => { drawing = true; last = point(e); stroke(last, { x: last.x + .1, y: last.y + .1 }); });
    canvas.addEventListener("pointermove", e => { if (!drawing) return; const p = point(e); stroke(last, p); last = p; });
    window.addEventListener("pointerup", () => drawing = false);
    btn && btn.addEventListener("click", () => { state.ctx.clearRect(0, 0, state.w, state.h); });
    window.addEventListener("resize", () => { state = makeState(canvas); });
  }

  function initFlow() {
    const canvas = document.getElementById("flowCanvas");
    if (!canvas) return;
    let state = makeState(canvas), mouse = { x: .5, y: .5 }, smooth = { x: .5, y: .5 };
    canvas.addEventListener("pointermove", e => {
      const r = canvas.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) / r.width; mouse.y = (e.clientY - r.top) / r.height;
    });
    (function loop(now) {
      requestAnimationFrame(loop);
      if (!active()) return;
      const { ctx, w, h } = state;
      smooth.x += (mouse.x - smooth.x) * .045;
      smooth.y += (mouse.y - smooth.y) * .045;
      const t = now * .00038;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 9; i++) {
        const phase = t + i * .42;
        const x = w * (.10 + .80 * (.5 + .5 * Math.sin(phase + smooth.x * 3.2)));
        const y = h * (.12 + .76 * (.5 + .5 * Math.cos(phase * .72 + smooth.y * 3.4)));
        const radius = 58 + i * 26 + Math.sin(phase) * 18;
        const grad = ctx.createRadialGradient(x, y, 1, x, y, radius);
        grad.addColorStop(0, `hsla(${172 + i * 16},96%,74%,.18)`);
        grad.addColorStop(.62, `hsla(${212 + i * 10},96%,68%,.06)`);
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    })(performance.now());
    window.addEventListener("resize", () => { state = makeState(canvas); });
  }

  function initDrift() {
    const canvas = document.getElementById("driftCanvas");
    if (!canvas) return;
    let state = makeState(canvas);
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let stars = [], trails = [], pointer = { x: .5, y: .5 };
    function seed() {
      const count = Math.min(300, Math.max(100, Math.round(state.w * state.h / 4800)));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * state.w, y: Math.random() * state.h,
        z: .22 + Math.random() * .78, r: .5 + Math.random() * 1.9,
        a: .22 + Math.random() * .6, tw: Math.random() * Math.PI * 2
      }));
    }
    seed();
    canvas.addEventListener("pointermove", e => {
      const r = canvas.getBoundingClientRect();
      pointer.x = (e.clientX - r.left) / r.width; pointer.y = (e.clientY - r.top) / r.height;
    });
    canvas.addEventListener("pointerdown", (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      trails.push({ x, y, vx: 330 + Math.random() * 260, vy: 100 + Math.random() * 150, life: 1, w: 1.8 + Math.random() * 1.6 });
      playTone(360, "soft");
    });
    (function loop(now) {
      requestAnimationFrame(loop);
      if (!active()) return;
      const { ctx, w, h } = state;
      const dt = reduced ? 0 : Math.min(.032, 1 / 60);
      const ox = (pointer.x - .5) * 14, oy = (pointer.y - .5) * 10;
      ctx.clearRect(0, 0, w, h);
      const neb = ctx.createRadialGradient(w * .74, h * .16, 0, w * .74, h * .16, Math.max(w, h) * .58);
      neb.addColorStop(0, "rgba(72,128,255,.10)"); neb.addColorStop(1, "transparent");
      ctx.fillStyle = neb; ctx.fillRect(0, 0, w, h);
      for (const st of stars) {
        st.tw += dt * 2.2;
        const x = st.x + ox * st.z, y = st.y + oy * st.z;
        ctx.globalAlpha = st.a * (.7 + .3 * Math.sin(st.tw));
        ctx.fillStyle = "#dbeeff";
        ctx.beginPath(); ctx.arc(x, y, st.r * st.z, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (const tr of trails) {
        if (!reduced) { tr.x += tr.vx * dt; tr.y += tr.vy * dt; tr.life -= dt * .66; }
        const tx = tr.x - tr.vx * .14, ty = tr.y - tr.vy * .14;
        const grad = ctx.createLinearGradient(tr.x, tr.y, tx, ty);
        grad.addColorStop(0, `rgba(255,255,255,${Math.max(0, tr.life)})`);
        grad.addColorStop(1, "rgba(150,205,255,0)");
        ctx.strokeStyle = grad; ctx.lineWidth = tr.w; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(tr.x, tr.y); ctx.lineTo(tx, ty); ctx.stroke();
      }
      trails = trails.filter(t => t.life > 0);
    })(performance.now());
    window.addEventListener("resize", () => { state = makeState(canvas); seed(); });
  }

  function initWrap() {
    const stage = document.getElementById("wrapStage");
    const btn = document.getElementById("btnWrapReset");
    if (!stage) return;
    let dragging = false;
    function build() {
      const cols = stage.clientWidth > 620 ? 11 : stage.clientWidth > 420 ? 9 : 6;
      const rows = stage.clientHeight > 520 ? 7 : 5;
      stage.innerHTML = "";
      for (let i = 0; i < cols * rows; i++) {
        const b = document.createElement("button");
        b.type = "button"; b.className = "wrap-bubble";
        b.style.setProperty("--delay", `${Math.random() * .2}s`);
        stage.appendChild(b);
      }
    }
    stage.addEventListener("pointerdown", e => { dragging = true; const b = e.target.closest(".wrap-bubble"); if (b) pop(b); });
    stage.addEventListener("pointermove", e => { if (!dragging) return; const b = document.elementFromPoint(e.clientX, e.clientY)?.closest(".wrap-bubble"); if (b) pop(b); });
    window.addEventListener("pointerup", () => dragging = false);
    stage.addEventListener("pointerleave", () => dragging = false);
    function pop(b) {
      if (!b || b.classList.contains("popped")) return;
      b.classList.add("popped"); b.disabled = true;
      playTone(760); if (navigator.vibrate) navigator.vibrate(7);
      if (!stage.querySelector(".wrap-bubble:not(.popped)")) setTimeout(build, 420);
    }
    btn && btn.addEventListener("click", build);
    window.addEventListener("resize", () => build());
    build();
  }

  function initLantern() {
    const canvas = document.getElementById("lanternCanvas");
    if (!canvas) return;
    let state = makeState(canvas);
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let lanterns = [], motes = [];
    for (let i = 0; i < 40; i++) motes.push({ x: Math.random() * state.w, y: Math.random() * state.h, r: .8 + Math.random() * 1.6, a: .1 + Math.random() * .25, sp: 6 + Math.random() * 14, phase: Math.random() * Math.PI * 2 });
    canvas.addEventListener("pointerdown", e => {
      const rect = canvas.getBoundingClientRect();
      spawn(e.clientX - rect.left, rect.height - 16); playTone(300, "soft");
    });
    function spawn(x, y) {
      lanterns.push({
        x: x ?? state.w * (.2 + Math.random() * .6), y: y ?? state.h + 20,
        vx: reduced ? 0 : 8 + Math.random() * 16, vy: reduced ? 0 : 36 + Math.random() * 30,
        sway: Math.random() * Math.PI * 2, hue: 22 + Math.random() * 18, r: 13 + Math.random() * 10
      });
    }
    for (let i = 0; i < 8; i++) spawn(undefined, state.h + Math.random() * 200);
    (function loop(now) {
      requestAnimationFrame(loop);
      if (!active()) return;
      const { ctx, w, h } = state;
      const dt = reduced ? 0 : Math.min(.032, 1 / 60);
      ctx.clearRect(0, 0, w, h);
      const sky = ctx.createLinearGradient(0, h, 0, 0);
      sky.addColorStop(0, "rgba(255,160,70,.06)"); sky.addColorStop(1, "rgba(88,144,255,.05)");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      for (const m of motes) {
        m.phase += dt * 1.4; m.y -= m.sp * dt; m.x += Math.sin(m.phase) * 6 * dt;
        if (m.y < -5) { m.y = h + 5; m.x = Math.random() * w; }
        ctx.globalAlpha = m.a; ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (const l of lanterns) {
        l.sway += dt * 1.5; l.x += (l.vx + Math.sin(l.sway) * 10) * dt; l.y -= l.vy * dt;
        const glow = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, l.r * 3.2);
        glow.addColorStop(0, `hsla(${l.hue},100%,78%,.98)`);
        glow.addColorStop(.36, `hsla(${l.hue},92%,62%,.38)`);
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(l.x, l.y, l.r * 3.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `hsla(${l.hue},88%,74%,.98)`;
        ctx.beginPath(); ctx.ellipse(l.x, l.y, l.r * .68, l.r, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.78)";
        ctx.beginPath(); ctx.ellipse(l.x - l.r * .16, l.y - l.r * .2, l.r * .16, l.r * .3, -.3, 0, Math.PI * 2); ctx.fill();
      }
      lanterns = lanterns.filter(l => l.y > -90);
      if (lanterns.length < 9 && Math.random() < .018) spawn();
    })(performance.now());
    window.addEventListener("resize", () => { state = makeState(canvas); });
  }

  function setActivePanel(tab) {
    document.querySelectorAll("[data-relax-tab]").forEach(b => b.classList.toggle("active", b.dataset.relaxTab === tab));
    document.querySelectorAll("[data-relax-panel]").forEach(panel => panel.classList.toggle("is-active", panel.dataset.relaxPanel === tab));
    requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
  }

  function initShell() {
    const soundBtn = document.getElementById("btnRelaxSound");
    const fullBtn = document.getElementById("btnRelaxFull");
    function renderSound() { if (soundBtn) soundBtn.textContent = soundOn ? "音效开" : "音效关"; }
    soundBtn?.addEventListener("click", () => {
      soundOn = !soundOn;
      localStorage.setItem("xingyu_relax_sound", soundOn ? "1" : "0");
      renderSound(); if (soundOn) playTone(660);
    });
    fullBtn?.addEventListener("click", () => {
      const card = document.querySelector(".relax-card.is-active");
      if (!card) return;
      if (document.fullscreenElement) document.exitFullscreen?.();
      else (card.requestFullscreen || card.webkitRequestFullscreen)?.call(card);
    });
    renderSound();
  }

  function init() {
    if (inited) return;
    inited = true;
    initShell();
    initBreath(); initBubbles(); initSand(); initFlow(); initDrift(); initWrap(); initLantern();
    document.querySelectorAll("[data-relax-tab]").forEach(btn => btn.addEventListener("click", () => setActivePanel(btn.dataset.relaxTab)));
    setActivePanel(document.querySelector("[data-relax-tab].active")?.dataset.relaxTab || "breath");
  }

  window.addEventListener("DOMContentLoaded", init);
  if (document.readyState !== "loading") init();
  window.Relax = { render: init };
})();
