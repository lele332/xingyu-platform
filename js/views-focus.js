/* ============================================================
   views-focus.js — 专注学习视图（番茄钟）
   pomoState / pomoDuration / savePomoSession / loadPomoSession
   ensureNotificationPermission / announcePomo / populatePomoTasks
   renderFocus / renderFocusStats / renderFocusWeekChart
   renderFocusHistory / startPomo / pausePomo / remainingFromClock
   tickPomo / completePomo / updatePomoUI
   ============================================================ */

  const POMO_STORAGE_KEY = "xingyu_pomo_session_v2";
  const POMO_PREFS_KEY = "xingyu_pomo_prefs_v1";
  const FOCUS_SCENE_KEY = "xingyu_focus_scene_v1";
  /* 沉浸场景：与灵感画廊 4 个落地页对应的氛围视频与主题色 */
  const FOCUS_SCENES = {
    nexus: {
      label: "云门智界",
      video: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260808_112712_da9d53df-6d27-4b12-bdf6-aa9dc2622bdf.mp4",
      accent: "#c9d8ef", accentRgb: "201, 216, 239"
    },
    prisma: {
      label: "棱镜艺境",
      video: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_170732_8a9ccda6-5cff-4628-b164-059c500a2b41.mp4",
      accent: "#e8dcc8", accentRgb: "232, 220, 200"
    },
    foldcraft: {
      label: "折艺工坊",
      video: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_204221_5339e40b-e73d-4ab0-9c65-79c18c66fd50.mp4",
      accent: "#efc9a8", accentRgb: "239, 201, 168"
    },
    securify: {
      label: "守御界",
      video: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_063509_7d167302-4fd4-480b-8260-18ab572333d4.mp4",
      accent: "#a8d4ef", accentRgb: "168, 212, 239"
    }
  };
  function loadFocusScene() {
    try { return localStorage.getItem(FOCUS_SCENE_KEY) || "nexus"; } catch (e) { return "nexus"; }
  }
  function playFocusVideo(video, attempt = 0) {
    if (!video) return;
    const p = video.play();
    if (!p) return;
    p.catch(() => {
      // play 被拒绝（数据未就绪/加载中）：等待 canplay 后再试，最多重试 2 次
      if (attempt >= 2) return;
      video.addEventListener("canplay", () => playFocusVideo(video, attempt + 1), { once: true });
    });
  }
  function applyFocusScene(key, { play = false } = {}) {
    const sc = FOCUS_SCENES[key];
    if (!sc) return;
    const mode = $("#focusMode");
    if (!mode) return;
    mode.dataset.scene = key;
    mode.style.setProperty("--focus-accent", sc.accent);
    mode.style.setProperty("--focus-accent-rgb", sc.accentRgb);
    const video = mode.querySelector(".focus-mode-video");
    if (video && video.dataset.src !== sc.video) {
      video.dataset.src = sc.video;
      video.src = sc.video;
      video.load();
      if (play) playFocusVideo(video);
    } else if (video && play && video.paused) {
      playFocusVideo(video);
    }
    $$(".focus-scene").forEach(b => {
      const active = b.dataset.scene === key;
      b.classList.toggle("active", active);
      b.setAttribute("aria-selected", String(active));
    });
    try { localStorage.setItem(FOCUS_SCENE_KEY, key); } catch (e) {}
  }
  function initFocusScenes() {
    $$(".focus-scene").forEach(b => {
      b.onclick = () => applyFocusScene(b.dataset.scene, { play: true });
    });
  }
  let pomoTimer = null;
  let pomoAudio = null;
  let focusModeRestoreTarget = null;
  let pomoState = {
    running: false, mode: "work", remain: 25 * 60, total: 25 * 60,
    endAt: 0, startedAt: 0, pausedAt: 0, completed: false, taskId: ""
  };

  function pomoDuration(mode) {
    const input = mode === "break" ? $("#pomoBreak") : $("#pomoWork");
    const max = mode === "break" ? 60 : 120;
    const fallback = mode === "break" ? 5 : 25;
    const value = Math.min(max, Math.max(1, Number(input && input.value) || fallback));
    if (input) input.value = value;
    return value * 60;
  }

  function loadPomoPrefs() {
    try {
      const prefs = JSON.parse(localStorage.getItem(POMO_PREFS_KEY) || "{}");
      if (prefs.work) $("#pomoWork").value = Math.min(120, Math.max(1, Number(prefs.work)));
      if (prefs.break) $("#pomoBreak").value = Math.min(60, Math.max(1, Number(prefs.break)));
      if (typeof prefs.sound === "boolean") $("#pomoSound").checked = prefs.sound;
      if (typeof prefs.notify === "boolean") $("#pomoNotify").checked = prefs.notify;
    } catch (e) {}
  }

  function savePomoPrefs() {
    try {
      localStorage.setItem(POMO_PREFS_KEY, JSON.stringify({
        work: Number($("#pomoWork")?.value) || 25,
        break: Number($("#pomoBreak")?.value) || 5,
        sound: Boolean($("#pomoSound")?.checked),
        notify: Boolean($("#pomoNotify")?.checked)
      }));
    } catch (e) {}
  }

  function syncPomoPresetUI() {
    const active = `${$("#pomoWork")?.value || 25}-${$("#pomoBreak")?.value || 5}`;
    $$(".pomo-presets [data-pomo-preset]").forEach(button => {
      button.classList.toggle("active", button.dataset.pomoPreset === active);
    });
  }

  function savePomoSession() {
    try {
      if (!pomoState.running && !pomoState.startedAt && pomoState.mode === "work") {
        localStorage.removeItem(POMO_STORAGE_KEY);
      } else {
        localStorage.setItem(POMO_STORAGE_KEY, JSON.stringify(pomoState));
      }
    } catch (e) {}
  }

  function loadPomoSession() {
    try {
      const raw = localStorage.getItem(POMO_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved || !Number.isFinite(saved.total) || !Number.isFinite(saved.remain)) return;
      pomoState = Object.assign(pomoState, saved);
      if (pomoState.running && pomoState.endAt) {
        if (pomoState.endAt <= Date.now()) {
          completePomo(true);
        } else {
          tickPomo();
          clearInterval(pomoTimer);
          pomoTimer = setInterval(tickPomo, 250);
        }
      }
    } catch (e) {
      try { localStorage.removeItem(POMO_STORAGE_KEY); } catch (ignore) {}
    }
  }

  function ensureNotificationPermission() {
    if (!$("#pomoNotify")?.checked || !("Notification" in window)) return;
    if (Notification.permission === "default") Notification.requestPermission().catch(() => {});
  }

  function announcePomo(title, body) {
    if ($("#pomoSound")?.checked) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          pomoAudio = pomoAudio || new AudioContext();
          const oscillator = pomoAudio.createOscillator();
          const gain = pomoAudio.createGain();
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(660, pomoAudio.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(880, pomoAudio.currentTime + 0.18);
          gain.gain.setValueAtTime(0.0001, pomoAudio.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.12, pomoAudio.currentTime + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, pomoAudio.currentTime + 0.5);
          oscillator.connect(gain).connect(pomoAudio.destination);
          oscillator.start();
          oscillator.stop(pomoAudio.currentTime + 0.52);
        }
      } catch (e) {}
    }
    if ($("#pomoNotify")?.checked && "Notification" in window && Notification.permission === "granted") {
      try { new Notification(title, { body, icon: "assets/xingyu-app-icon-192.png", tag: "xingyu-pomo" }); } catch (e) {}
    }
  }

  function populatePomoTasks() {
    const select = $("#pomoTask");
    if (!select) return;
    const tasks = Store.getAll("tasks").filter(task => task.status !== "done");
    select.innerHTML = `<option value="">不关联任务</option>` + tasks.map(task =>
      `<option value="${esc(task.id)}">${esc(task.title)}</option>`
    ).join("");
    select.value = pomoState.taskId || "";
  }

  function renderFocus() {
    loadPomoPrefs();
    initFocusScenes();
    populatePomoTasks();
    loadPomoSession();
    if (pomoState.startedAt && pomoState.total > 0) {
      const input = pomoState.mode === "break" ? $("#pomoBreak") : $("#pomoWork");
      if (input) input.value = Math.round(pomoState.total / 60);
    }
    syncPomoPresetUI();
    updatePomoUI();
    renderFocusStats();
    renderFocusHistory();
    if (pomoState.running) openFocusMode({ restore: true });
  }

  function restorePomoOnStartup() {
    loadPomoPrefs();
    populatePomoTasks();
    loadPomoSession();
    updatePomoUI();
    if (!pomoState.running) return;
    if (window.__splashActive) {
      window.addEventListener("splash-done", () => {
        if (pomoState.running) openFocusMode({ restore: true });
      }, { once: true });
    } else {
      openFocusMode({ restore: true });
    }
  }

  function renderFocusStats() {
    const pomos = Store.getAll("pomodoros");
    const today = pomos.filter(p => p.startAt && localDateKey(p.startAt) === todayISO());
    const todayCount = today.length;
    const todayMin = today.reduce((s, p) => s + (p.minutes || 0), 0);
    const weekMin = pomos.filter(p => {
      if (!p.startAt) return false;
      const d = new Date(p.startAt);
      d.setHours(0, 0, 0, 0);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const diff = (now - d) / 86400000;
      return diff >= 0 && diff < 7;
    }).reduce((s, p) => s + (p.minutes || 0), 0);
    const totalMin = pomos.reduce((s, p) => s + (p.minutes || 0), 0);
    $("#pomoTodayCount").textContent = todayCount;
    $("#pomoTodayMin").textContent = todayMin;
    $("#focusStatsRow").innerHTML = `
      <div class="fstat"><b>${todayCount}</b><span>今日番茄</span></div>
      <div class="fstat"><b>${todayMin}</b><span>今日分钟</span></div>
      <div class="fstat"><b>${Math.round(weekMin / 60 * 10) / 10}</b><span>本周小时</span></div>`;
    renderFocusWeekChart();
  }

  function renderFocusWeekChart() {
    const pomos = Store.getAll("pomodoros");
    const labels = [], values = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const mins = pomos.filter(p => p.startAt && localDateKey(p.startAt) === key).reduce((s, p) => s + (p.minutes || 0), 0);
      labels.push(d.getDate() + "日");
      values.push(mins);
    }
    Charts.line($("#focusWeekChart"), { labels, values, height: 190, color: "var(--ink)" });
  }

  function renderFocusHistory() {
    const pomos = Store.getAll("pomodoros").slice().sort((a, b) => (b.startAt || "").localeCompare(a.startAt || "")).slice(0, 10);
    const box = $("#focusHistory");
    if (!pomos.length) {
      box.innerHTML = `<div class="empty-state"><p>还没有专注记录，点击「开始专注」</p></div>`;
      return;
    }
    box.innerHTML = pomos.map(p => {
      const d = new Date(p.startAt);
      const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      return `<div class="history-item">
        <span class="history-dot"></span>
        <span>番茄钟 ${p.type === "break" ? "（休息）" : ""}</span>
        <b style="color:var(--accent)">${p.minutes} 分钟</b>
        <span class="history-meta">${fmtDate(p.startAt)} ${time}</span>
      </div>`;
    }).join("");
    // 滚动分批浮入
    revealCards($("#view-focus"), ".history-item");
  }

  function startPomo() {
    if (pomoState.running) { pausePomo(); return; }
    const isFreshWork = pomoState.mode === "work" && (!pomoState.startedAt || pomoState.remain <= 0 || pomoState.completed);
    if (isFreshWork) {
      pomoState.mode = "work";
      pomoState.total = pomoDuration("work");
      pomoState.remain = pomoState.total;
      pomoState.completed = false;
      pomoState.startedAt = Date.now();
    }
    pomoState.running = true;
    pomoState.pausedAt = 0;
    pomoState.endAt = Date.now() + pomoState.remain * 1000;
    ensureNotificationPermission();
    clearInterval(pomoTimer);
    pomoTimer = setInterval(tickPomo, 250);
    animatePomoState("pomo-starting");
    updatePomoUI();
    savePomoSession();
    openFocusMode();
  }

  function pausePomo() {
    pomoState.running = false;
    pomoState.remain = remainingFromClock();
    pomoState.pausedAt = Date.now();
    pomoState.endAt = 0;
    clearInterval(pomoTimer);
    animatePomoState("pomo-pausing");
    updatePomoUI();
    savePomoSession();
  }

  function openFocusMode(options = {}) {
    const mode = $("#focusMode");
    if (!mode || mode.classList.contains("is-open")) return;
    if (!options.restore) focusModeRestoreTarget = document.activeElement;
    mode.classList.add("is-open");
    mode.setAttribute("aria-hidden", "false");
    document.body.classList.add("focus-mode-open");
    applyFocusScene(loadFocusScene(), { play: true });
    updatePomoUI();
    requestAnimationFrame(() => $("#btnFocusModeToggle")?.focus({ preventScroll: true }));
  }

  function closeFocusMode({ pause = true } = {}) {
    const mode = $("#focusMode");
    if (!mode || !mode.classList.contains("is-open")) return;
    if (pause && pomoState.running) pausePomo();
    mode.classList.remove("is-open");
    mode.setAttribute("aria-hidden", "true");
    document.body.classList.remove("focus-mode-open");
    const ambientVideo = $("#focusMode").querySelector(".focus-mode-video");
    if (ambientVideo) ambientVideo.pause();
    const target = focusModeRestoreTarget;
    focusModeRestoreTarget = null;
    setTimeout(() => {
      if (target && typeof target.focus === "function") target.focus({ preventScroll: true });
      else $("#btnPomoStart")?.focus({ preventScroll: true });
    }, 220);
  }

  function endPomoSession() {
    clearInterval(pomoTimer);
    pomoState = {
      running: false,
      mode: "work",
      remain: pomoDuration("work"),
      total: pomoDuration("work"),
      endAt: 0,
      startedAt: 0,
      pausedAt: 0,
      completed: false,
      taskId: ""
    };
    try { localStorage.removeItem(POMO_STORAGE_KEY); } catch (e) {}
    if ($("#pomoTask")) $("#pomoTask").value = "";
    updatePomoUI();
    closeFocusMode({ pause: false });
    toast("本次专注已结束", "ok");
  }

  function isFocusModeOpen() {
    return Boolean($("#focusMode")?.classList.contains("is-open"));
  }

  function remainingFromClock() {
    if (!pomoState.running || !pomoState.endAt) return Math.max(0, pomoState.remain);
    return Math.max(0, (pomoState.endAt - Date.now()) / 1000);
  }

  function animatePomoState(className) {
    const card = document.querySelector(".pomodoro-card");
    if (!card || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    card.classList.remove(className);
    void card.offsetWidth;
    card.classList.add(className);
    setTimeout(() => card.classList.remove(className), 460);
  }

  function animatePomoComplete() {
    const ring = document.querySelector(".pomo-ring");
    if (!ring || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    ring.dataset.state = "complete";
    setTimeout(() => {
      if (ring.dataset.state === "complete") delete ring.dataset.state;
    }, 760);
  }

  function tickPomo() {
    if (!pomoState.running) return;
    pomoState.remain = remainingFromClock();
    if (pomoState.remain <= 0) {
      completePomo();
      return;
    }
    updatePomoUI();
  }

  function completePomo(restored = false) {
    clearInterval(pomoTimer);
    pomoState.running = false;
    pomoState.remain = 0;
    pomoState.endAt = 0;
    pomoState.completed = true;
    const minutes = Math.round(pomoState.total / 60);
    if (pomoState.mode === "work") {
      const alreadyRecorded = Store.getAll("pomodoros").some(item => item.sessionId === pomoState.startedAt);
      if (!alreadyRecorded) {
        Store.add("pomodoros", {
          sessionId: pomoState.startedAt,
          startAt: new Date(pomoState.startedAt || Date.now()).toISOString(),
          minutes,
          type: pomoState.mode,
          taskId: pomoState.taskId || ""
        });
      }
    }
    announcePomo(
      pomoState.mode === "work" ? "专注完成" : "休息结束",
      pomoState.mode === "work" ? "休息一下，再开始下一个阶段。" : "准备好继续专注了吗？"
    );
    animatePomoComplete();
    if (pomoState.mode === "work") {
      toast("专注完成！休息一下吧", "ok");
      // 自动切换到休息
      pomoState.mode = "break";
      pomoState.total = pomoDuration("break");
      pomoState.remain = pomoState.total;
      pomoState.startedAt = 0;
      pomoState.completed = false;
      pomoState.running = false;
    } else {
      toast("休息结束，继续加油！", "ok");
      pomoState.mode = "work";
      pomoState.total = pomoDuration("work");
      pomoState.remain = pomoState.total;
      pomoState.startedAt = 0;
      pomoState.completed = false;
    }
    updatePomoUI();
    savePomoSession();
    renderFocusStats();
    renderFocusHistory();
    if (currentView === "dashboard") renderDashboard();
    openFocusMode({ restore: true });
  }

  function updatePomoUI() {
    const remain = Math.max(0, pomoState.running ? remainingFromClock() : pomoState.remain);
    const m = Math.floor(remain / 60);
    const s = Math.floor(remain % 60);
    $("#pomoTime").textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    const progress = pomoState.total ? Math.min(1, Math.max(0, 1 - remain / pomoState.total)) : 0;
    const ring = document.querySelector(".pomo-ring");
    if (ring) {
      ring.style.setProperty("--progress", (progress * 100).toFixed(2));
      ring.dataset.mode = pomoState.mode;
      ring.dataset.running = pomoState.running ? "true" : "false";
      ring.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
      ring.setAttribute("aria-valuetext", `${Math.floor(remain / 60)} 分 ${Math.floor(remain % 60)} 秒剩余`);
    }
    $(".pomodoro-card")?.classList.toggle("working", pomoState.running);
    const progressLabel = $("#pomoProgress");
    if (progressLabel) progressLabel.textContent = `${Math.round(progress * 100)}%`;
    const modeText = pomoState.mode === "break"
      ? (pomoState.running ? "休息中" : "准备休息")
      : (pomoState.running ? "专注中" : pomoState.pausedAt ? "已暂停" : "准备开始");
    $("#pomoMode").textContent = modeText;
    const start = $("#btnPomoStart");
    if (start) {
      start.textContent = pomoState.running ? "暂停" : pomoState.pausedAt && remain > 0 ? "继续" : pomoState.mode === "break" ? "开始休息" : "开始专注";
      start.classList.toggle("btn-danger", pomoState.running);
    }
    const skip = $("#btnPomoSkip");
    if (skip) skip.style.display = pomoState.startedAt || pomoState.mode === "break" ? "" : "none";
    const meta = $("#pomoSessionMeta");
    if (meta) meta.textContent = pomoState.taskId ? `当前关联任务：${Store.getAll("tasks").find(task => task.id === pomoState.taskId)?.title || "已删除任务"}` : "每次完整专注结束后自动记录。";

    const focusMode = $("#focusMode");
    if (focusMode) {
      focusMode.style.setProperty("--focus-progress", (progress * 100).toFixed(3));
      focusMode.dataset.mode = pomoState.mode;
      focusMode.dataset.running = pomoState.running ? "true" : "false";
    }
    const focusDial = $("#focusModeDial");
    if (focusDial) {
      focusDial.dataset.mode = pomoState.mode;
      focusDial.dataset.running = pomoState.running ? "true" : "false";
    }
    if ($("#focusModeTime")) $("#focusModeTime").textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    if ($("#focusModeStatus")) $("#focusModeStatus").textContent = modeText;
    if ($("#focusModeTask")) {
      const task = Store.getAll("tasks").find(item => item.id === pomoState.taskId);
      $("#focusModeTask").textContent = task?.title || (pomoState.mode === "break" ? "让注意力慢慢归位" : "不关联任务");
    }
    const focusToggle = $("#btnFocusModeToggle");
    if (focusToggle) {
      focusToggle.textContent = pomoState.running ? "暂停" : pomoState.mode === "break" ? "开始休息" : pomoState.pausedAt ? "继续" : "开始专注";
    }
  }
