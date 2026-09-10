/* ============================================================
   perf.js - 星屿智能性能反馈 v4
   标准安静关闭三档；用滚动趋势识别持续问题，忙时顺延，同类问题长冷却。
   ============================================================ */
(function () {
  "use strict";
  var t0 = Date.now();
  var AUTO_COOLDOWN_MS = 15 * 60 * 1000;
  var SAME_ISSUE_COOLDOWN_MS = 2 * 60 * 60 * 1000;
  var LAST_AUTO_KEY = "xingyu_perf_auto_v3";
  var ISSUE_HISTORY_KEY = "xingyu_perf_issue_history_v1";
  var TREND_KEY = "xingyu_perf_trend_v1";
  var ALERT_KEY = "xingyu_perf_alert_mode";

  var alertMode = "standard";
  try { alertMode = localStorage.getItem(ALERT_KEY) || "standard"; } catch (e) {}
  if (!["standard", "quiet", "off"].includes(alertMode)) alertMode = "standard";

  var lastAutoAt = 0, issueHistory = {}, trend = { samples: [], autoReports: [] };
  try { lastAutoAt = Number(localStorage.getItem(LAST_AUTO_KEY) || 0) || 0; } catch (e) {}
  try { issueHistory = JSON.parse(localStorage.getItem(ISSUE_HISTORY_KEY) || "{}") || {}; } catch (e) { issueHistory = {}; }
  try { trend = JSON.parse(localStorage.getItem(TREND_KEY) || '{"samples":[],"autoReports":[]}') || { samples: [], autoReports: [] }; } catch (e) { trend = { samples: [], autoReports: [] }; }
  if (!Array.isArray(trend.samples)) trend.samples = [];
  trend.samples = trend.samples.filter(function (x) { return x && typeof x.at === "number"; }).slice(-120);
  trend.samples.forEach(function (x) {
    x.lowFps = !!x.lowFps; x.jank = !!x.jank; x.slowInteraction = !!x.slowInteraction;
    x.signatures = Array.isArray(x.signatures) ? x.signatures : [];
  });
  trend.autoReports = trend.autoReports.filter(function (x) { return x && typeof x.at === "number"; }).slice(-12);

  function phase() {
    return window.__splashCovered ? "boot-cover" : (window.__splashActive ? "splash" : "main");
  }
  function userFocusedTaskActive() {
    return !!(document.getElementById("focusOverlay") && document.getElementById("focusOverlay").style.display !== "none");
  }
  function userBusy() {
    if (document.hidden || userFocusedTaskActive() || !!document.fullscreenElement) return true;
    var media = document.querySelector("video:not([paused])");
    if (media && media.duration > 10) return true;
    var active = document.activeElement;
    return !!(active && (active.matches("input, textarea, select") || active.isContentEditable));
  }
  function saveTrend() {
    try { trend.samples = trend.samples.slice(-120); localStorage.setItem(TREND_KEY, JSON.stringify(trend)); } catch (e) {}
  }
  function countRecentSignatures(signature, span) {
    var now = Date.now();
    return trend.samples.filter(function (x) { return now - x.at <= span && x.signatures.indexOf(signature) >= 0; }).length;
  }
  function healthSummary() {
    var now = Date.now(), windows = [5, 15, 60], result = {};
    windows.forEach(function (m) {
      var rows = trend.samples.filter(function (x) { return now - x.at <= m * 60 * 1000; });
      result[m + "min"] = {
        samples: rows.length,
        lowFps: rows.filter(function (x) { return x.lowFps; }).length,
        jank: rows.filter(function (x) { return x.jank; }).length,
        slowInteraction: rows.filter(function (x) { return x.slowInteraction; }).length
      };
    });
    return result;
  }

  var S = {
    startedAtISO: new Date().toISOString(),
    errors: [], longTasks: [], fps: [], interactions: [],
    video: { waiting: 0, stalled: 0, errors: 0, droppedFrames: null, totalFrames: null, duration: null, endedAt: null },
    resources: [], ignored: { errors: 0, resources: 0 }, cls: 0,
    nav: null, memory: null, heaviestLongTask: 0
  };

  function isBenignError(item) {
    var text = [item.msg, item.source, item.stack].join(" ");
    return /AbortError|NotAllowedError|NotReadableError|SecurityError|ResizeObserver loop|_non_input_listener|chrome-extension:|moz-extension:|safari-extension:|extensions::|Failed to fetch.*net::ERR_ABORTED|The play\(\) request was interrupted|autoplay|permission|favicon|service.?worker.*registration/i.test(text);
  }
  function isCriticalResource(url, tag) {
    if (!url) return false;
    var u = String(url).toLowerCase();
    if (/favicon|\.map($|\?)|manifest\.webmanifest|service-worker|sw\.js|analytics|telemetry|gtag|adsystem|doubleclick|weather|news-data|\/api\/|\.woff2?($|\?)|\/model\.json($|\?)/.test(u)) return false;
    return /\.(html|css|js|moc3|moc|png|jpg|jpeg|webp|glb|vrm)($|\?)/.test(u) || /\.(model3\.json|model\.json)($|\?)/.test(u);
  }

  window.addEventListener("error", function (e) {
    if (e && e.target && e.target !== window && (e.target.src || e.target.href)) {
      var url = String(e.target.src || e.target.href).slice(0, 300), tag = e.target.tagName || "";
      if (!isCriticalResource(url, tag)) { S.ignored.resources++; return; }
      S.resources.push({ url: url.slice(0, 200), tag: tag, ts: Date.now() - t0 });
      return;
    }
    var item = {
      msg: String(e.message || "").slice(0, 300), source: String(e.filename || "").slice(0, 200),
      line: e.lineno || 0, col: e.colno || 0,
      stack: String((e.error && e.error.stack) || "").slice(0, 600), ts: Date.now() - t0
    };
    if (isBenignError(item)) { S.ignored.errors++; return; }
    S.errors.push(item);
  }, true);

  window.addEventListener("unhandledrejection", function (e) {
    var item = { msg: ("UnhandledRejection: " + String((e.reason && e.reason.message) || e.reason || "")).slice(0, 300), ts: Date.now() - t0 };
    if (isBenignError(item)) { S.ignored.errors++; return; }
    S.errors.push(item);
  });

  try {
    if (window.PerformanceObserver) {
      new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (en) {
          if (en.duration >= 80) {
            var dur = Math.round(en.duration);
            S.longTasks.push({ dur: dur, at: Math.round(en.startTime), phase: phase() });
            if (dur > S.heaviestLongTask) S.heaviestLongTask = dur;
            if (S.longTasks.length > 240) S.longTasks.shift();
          }
        });
      }).observe({ entryTypes: ["longtask"] });
    }
  } catch (e) {}

  try {
    if (window.PerformanceObserver) {
      new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (en) {
          if (en.interactionId && en.duration >= 250) {
            S.interactions.push({ dur: Math.round(en.duration), at: Math.round(en.startTime), name: en.name || "interaction" });
            if (S.interactions.length > 80) S.interactions.shift();
          }
        });
      }).observe({ type: "event", buffered: true });
    }
  } catch (e) {}

  try {
    if (window.PerformanceObserver) {
      new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (en) {
          if (en.value && !en.hadRecentInput) S.cls += en.value;
        });
      }).observe({ type: "layout-shift", buffered: true });
    }
  } catch (e) {}

  var frames = 0, secStart = performance.now();
  function loop(now) {
    if (window.__splashCovered || document.hidden) { frames = 0; secStart = now; requestAnimationFrame(loop); return; }
    frames++;
    if (now - secStart >= 1000) {
      var fps = Math.round(frames * 1000 / (now - secStart));
      S.fps.push({ fps: fps, at: Math.round(now), phase: phase() });
      if (S.fps.length > 240) S.fps.shift();
      frames = 0; secStart = now;
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  function captureEnv() {
    try {
      var n = performance.getEntriesByType("navigation")[0];
      if (n) S.nav = { ttfb: Math.round(n.responseStart), domContentLoaded: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd || 0) };
    } catch (e) {}
    try {
      if (performance.memory) S.memory = {
        usedMB: Math.round(performance.memory.usedJSHeapSize / 1048576),
        totalMB: Math.round(performance.memory.totalJSHeapSize / 1048576)
      };
    } catch (e) {}
  }
  if (document.readyState === "complete") captureEnv(); else window.addEventListener("load", captureEnv);

  function fpsStats(list) {
    if (!list || !list.length) return null;
    var arr = list.map(function (x) { return x.fps; });
    var sum = arr.reduce(function (a, b) { return a + b; }, 0);
    var minVal = Math.min.apply(null, arr), minAt = null;
    for (var i = 0; i < list.length; i++) if (list[i].fps === minVal) { minAt = list[i].at; break; }
    return { avg: Math.round(sum / arr.length), min: minVal, minAt: minAt, samples: arr.length };
  }
  function countRecent(list, ms) {
    if (!list.length) return 0;
    var latest = list[list.length - 1].at;
    return list.filter(function (x) { return latest - x.at <= ms; }).length;
  }
  function sustainedLowFps(list, lowAt, needLow, avgAt) {
    if (!list || list.length < needLow) return false;
    var lowCount = list.filter(function (x) { return x.fps <= lowAt; }).length;
    var recent = list.slice(-Math.max(needLow, 3));
    var recentAvg = recent.reduce(function (a, b) { return a + b.fps; }, 0) / recent.length;
    var allRecentLow = recent.every(function (x) { return x.fps <= lowAt + 5; });
    return (lowCount >= needLow && recentAvg <= avgAt) || (allRecentLow && recent.length >= needLow);
  }
  function slowInteractions() {
    var latest = S.interactions.length ? S.interactions[S.interactions.length - 1].at : 0;
    return S.interactions.filter(function (x) { return x.dur >= 300 && latest - x.at <= 30000; });
  }

  function detectIssues() {
    var issues = [];
    var v = S.video;
    if ((v.waiting + v.stalled) >= 2) issues.push({ level: "warn", key: "video_buffer", msg: "开屏视频出现 " + (v.waiting + v.stalled) + " 次缓冲/等待", auto: false });
    if (typeof v.droppedFrames === "number" && v.totalFrames > 0) {
      var ratio = v.droppedFrames / v.totalFrames;
      if (ratio > 0.08) issues.push({ level: "warn", key: "video_dropped", msg: "开屏视频丢帧率 " + (ratio * 100).toFixed(1) + "%（" + v.droppedFrames + "/" + v.totalFrames + " 帧）", auto: false });
    }

    var splashTasks = S.longTasks.filter(function (t) { return t.phase === "splash" && t.dur >= 220; });
    var worstSplash = Math.max.apply(null, [0].concat(splashTasks.map(function (t) { return t.dur; })));
    if (splashTasks.length >= 2 || worstSplash >= 600) {
      issues.push({ level: "warn", key: "splash_jank", msg: "开屏期间主线程明显阻塞 " + splashTasks.length + " 次，最长 " + worstSplash + "ms", auto: false });
    }

    var sf = fpsStats(S.fps.filter(function (x) { return x.phase === "splash"; }));
    if (sf && sf.samples >= 4 && sf.avg < 35 && sf.min <= 20) issues.push({ level: "warn", key: "splash_fps", msg: "开屏帧率持续偏低（平均 " + sf.avg + " / 最低 " + sf.min + " fps）", auto: false });

    var mainTasks = S.longTasks.filter(function (t) { return t.phase === "main"; });
    var heavyTasks = mainTasks.filter(function (t) { return t.dur >= 180; });
    var recentHeavy = countRecent(heavyTasks, 30000);
    var worstMain = Math.max.apply(null, [0].concat(mainTasks.map(function (t) { return t.dur; })));
    if (recentHeavy >= 3 || worstMain >= 450) {
      issues.push({ level: "warn", key: "main_jank", msg: "主界面长任务持续偏高（30 秒内 " + recentHeavy + " 次 ≥180ms，最长 " + worstMain + "ms）", auto: recentHeavy >= 4 || worstMain >= 650, severity: recentHeavy >= 4 || worstMain >= 650 ? "standard" : "" });
    }

    var mainList = S.fps.filter(function (x) { return x.phase === "main"; });
    var mf = fpsStats(mainList);
    if (mf && sustainedLowFps(mainList, 35, 5, 45)) {
      issues.push({ level: "warn", key: "main_fps", msg: "主界面帧率持续偏低（平均 " + mf.avg + " / 最低 " + mf.min + " fps）", auto: mf.avg < 35 && mf.min <= 25, severity: mf.avg < 30 && mf.min <= 20 ? "high" : "standard" });
    }

    var slow = slowInteractions();
    if (slow.length >= 2) {
      issues.push({ level: "warn", key: "interaction", msg: "交互响应连续偏慢（30 秒内 " + slow.length + " 次 ≥300ms，最长 " + Math.max.apply(null, slow.map(function (x) { return x.dur; })) + "ms）", auto: slow.length >= 3, severity: slow.length >= 4 ? "high" : "standard" });
    }

    if (S.cls > 0.25) issues.push({ level: "warn", key: "cls", msg: "页面累积位移偏高（CLS " + S.cls.toFixed(2) + "）", auto: false });
    if (S.errors.length > 0) issues.push({ level: "error", key: "js_error", msg: "捕获 " + S.errors.length + " 条非噪声 JS 错误", auto: true, severity: "high" });
    if (S.resources.length > 0) issues.push({ level: "warn", key: "resource", msg: "有 " + S.resources.length + " 个关键资源加载失败", auto: false });
    return issues;
  }

  function autoEligibleIssues(mode) {
    var target = mode || alertMode;
    if (target === "off") return [];
    return detectIssues().filter(function (i) {
      if (!i.auto) return false;
      if (target === "quiet") return i.severity === "high" || i.level === "error";
      return true;
    });
  }

  function generateReport(comment) {
    var splashFps = fpsStats(S.fps.filter(function (x) { return x.phase === "splash"; }));
    var mainFps = fpsStats(S.fps.filter(function (x) { return x.phase === "main"; }));
    return {
      app: "星屿", reporter: "perf-3",
      source: source === "auto" ? "auto" : "manual", alertMode: alertMode,
      generatedAt: new Date().toISOString(), userAgent: navigator.userAgent,
      screen: (window.screen ? screen.width + "x" + screen.height : "") + " @" + (window.devicePixelRatio || 1) + "x",
      viewport: window.innerWidth + "x" + window.innerHeight, language: navigator.language, online: navigator.onLine,
      issues: detectIssues(),
      metrics: {
        splashVideo: S.video,
        longTasks: { count: S.longTasks.length, over180ms: S.longTasks.filter(function (t) { return t.dur >= 180; }).length, heaviest: S.heaviestLongTask, list: S.longTasks.slice(-30) },
        interactions: { count: S.interactions.length, slow: S.interactions.filter(function (x) { return x.dur >= 300; }).slice(-10) },
        fps: { splash: splashFps, main: mainFps, recent: S.fps.slice(-10) },
        layoutShift: Math.round(S.cls * 1000) / 1000,
        trend: healthSummary(),
        navigation: S.nav, memory: S.memory,
        errors: S.errors.slice(0, 10), resourceFailures: S.resources.slice(0, 10),
        noiseFiltered: S.ignored
      },
      userComment: typeof comment === "string" ? comment : ""
    };
  }

  function textSummary(rep) {
    var L = [];
    L.push("星屿性能反馈报告 · " + rep.generatedAt);
    L.push("来源: " + (rep.source === "auto" ? "自动巡检" : "手动反馈") + " · 提醒档位: " + rep.alertMode);
    L.push("屏幕: " + rep.screen + "  视口: " + rep.viewport + "  在线: " + rep.online);
    if (rep.metrics.navigation) L.push("加载: TTFB " + rep.metrics.navigation.ttfb + "ms / DCL " + rep.metrics.navigation.domContentLoaded + "ms / Load " + rep.metrics.navigation.load + "ms");
    var v = rep.metrics.splashVideo;
    L.push("开屏视频: 缓冲 " + (v.waiting + v.stalled) + " 次 / 丢帧 " + (v.droppedFrames == null ? "-" : v.droppedFrames + "/" + v.totalFrames));
    var lt = rep.metrics.longTasks;
    L.push("长任务: " + lt.count + " 次（≥180ms " + lt.over180ms + " 次，最长 " + lt.heaviest + "ms）");
    L.push("慢交互: " + rep.metrics.interactions.slow.length + " 次 ≥300ms · CLS " + rep.metrics.layoutShift);
    if (rep.metrics.fps.splash) L.push("开屏帧率: 平均 " + rep.metrics.fps.splash.avg + " / 最低 " + rep.metrics.fps.splash.min);
    if (rep.metrics.fps.main) L.push("主界面帧率: 平均 " + rep.metrics.fps.main.avg + " / 最低 " + rep.metrics.fps.main.min);
    if (rep.metrics.memory) L.push("JS 内存: " + rep.metrics.memory.usedMB + "MB / " + rep.metrics.memory.totalMB + "MB");
    L.push("近期趋势: 5分钟 " + rep.metrics.trend["5min"].jank + " 次阻塞 / " + rep.metrics.trend["5min"].lowFps + " 次低帧 · 15分钟 " + rep.metrics.trend["15min"].jank + " 次阻塞 / " + rep.metrics.trend["15min"].lowFps + " 次低帧");
    L.push("已过滤噪声: JS " + rep.metrics.noiseFiltered.errors + " 条 / 资源 " + rep.metrics.noiseFiltered.resources + " 个");
    L.push("");
    if (rep.issues.length) {
      L.push("自动识别的问题:");
      rep.issues.forEach(function (i) { L.push("  [" + i.level + (i.auto ? "/可自动上报" : "/仅记录") + "] " + i.msg); });
    } else L.push("自动识别的问题: 未发现明显异常");
    if (rep.userComment) { L.push(""); L.push("用户补充: " + rep.userComment); }
    return L.join("\n");
  }

  var source = "manual";
  function saveReport(comment, reportSource) {
    source = reportSource === "auto" ? "auto" : "manual";
    var rep = generateReport(typeof comment === "string" ? comment : "");
    if (source === "auto") rep.autoTrigger = autoEligibleIssues().map(function (i) { return i.key; });
    return fetch("/api/feedback", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rep)
    }).then(function (r) { return r.json(); });
  }

  function setAlertMode(mode) {
    if (!["standard", "quiet", "off"].includes(mode)) mode = "standard";
    alertMode = mode;
    try { localStorage.setItem(ALERT_KEY, mode); } catch (e) {}
    document.querySelectorAll("[data-perf-alert]").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.perfAlert === mode);
    });
  }
  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-perf-alert]");
    if (btn) setAlertMode(btn.dataset.perfAlert);
  });

  function recordTrendSample(issues) {
    var now = Date.now();
    var lowFps = issues.some(function (i) { return i.key === "main_fps" || i.key === "splash_fps"; });
    var jank = issues.some(function (i) { return i.key === "main_jank" || i.key === "splash_jank"; });
    var slowInteraction = issues.some(function (i) { return i.key === "interaction"; });
    trend.samples.push({ at: now, lowFps: lowFps, jank: jank, slowInteraction: slowInteraction, signatures: issues.map(function (i) { return i.key; }) });
    trend.samples = trend.samples.filter(function (x) { return now - x.at <= 60 * 60 * 1000; });
    saveTrend();
  }
  function autoCheck() {
    if (alertMode === "off") return;
    if (userBusy()) return;
    var autoCooldown = alertMode === "quiet" ? AUTO_COOLDOWN_MS * 4 : AUTO_COOLDOWN_MS;
    if (Date.now() - lastAutoAt < autoCooldown) return;
    var issues = autoEligibleIssues();
    recordTrendSample(detectIssues());
    if (!issues.length) return;
    var signature = issues.map(function (i) { return i.key; }).sort().join("|");
    var now = Date.now();
    var hasError = issues.some(function (i) { return i.level === "error" || i.severity === "high"; });
    if (!hasError && countRecentSignatures(signature, 75 * 1000) < 2) return;
    if (issueHistory[signature] && now - issueHistory[signature] < SAME_ISSUE_COOLDOWN_MS) return;
    lastAutoAt = now; issueHistory[signature] = now;
    try {
      localStorage.setItem(LAST_AUTO_KEY, String(now));
      localStorage.setItem(ISSUE_HISTORY_KEY, JSON.stringify(issueHistory));
      trend.autoReports.push({ at: now, issues: issues.map(function (i) { return i.key; }) });
      trend.autoReports = trend.autoReports.slice(-12);
      saveTrend();
    } catch (e) {}
    saveReport("", "auto").then(function () {
      if (!window.toast) return;
      toast("发现持续性性能问题，已生成本地反馈报告", "warn", {
        actionLabel: "查看",
        onAction: function () { var b = document.getElementById("btnOpenFeedback"); if (b) b.click(); },
        duration: 8000
      });
    }).catch(function () {});
  }

  if (window.__splashActive) {
    window.addEventListener("splash-done", function () { setTimeout(autoCheck, 10000); }, { once: true });
    setTimeout(autoCheck, 24000);
  } else setTimeout(autoCheck, 10000);
  setInterval(autoCheck, 30000);

  window.XYPerf = {
    detectIssues: detectIssues, autoEligibleIssues: autoEligibleIssues,
    generateReport: generateReport, textSummary: textSummary, saveReport: saveReport,
    autoCheck: autoCheck, setAlertMode: setAlertMode, get alertMode() { return alertMode; },
    healthSummary: healthSummary, get trend() { return trend; }, raw: S
  };
  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-perf-alert]").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.perfAlert === alertMode);
    });
  });
})();
