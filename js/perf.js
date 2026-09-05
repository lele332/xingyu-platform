/* ============================================================
   perf.js - 星屿自动性能监测与问题反馈
   自动识别：开屏视频卡顿/丢帧、主线程长任务、帧率偏低、JS 错误、资源加载失败
   并可一键生成/保存反馈报告（POST /api/feedback 存到本地 data/feedback/）
   ============================================================ */
(function () {
  var t0 = Date.now();
  var phase = function () {
    if (window.__splashCovered) return "boot-cover"; // 开屏遮蔽下的启动引导（帧不可见）
    return window.__splashActive ? "splash" : "main";
  };

  var S = {
    startedAtISO: new Date().toISOString(),
    errors: [],
    longTasks: [],
    fps: [],
    video: { waiting: 0, stalled: 0, errors: 0, droppedFrames: null, totalFrames: null, duration: null, endedAt: null },
    resources: [],
    nav: null,
    memory: null,
    heaviestLongTask: 0
  };

  /* ---------- JS 错误 / 资源加载失败 ---------- */
  window.addEventListener("error", function (e) {
    if (e && e.target && e.target !== window && (e.target.src || e.target.href)) {
      S.resources.push({ url: String(e.target.src || e.target.href).slice(0, 200), tag: e.target.tagName || "", ts: Date.now() - t0 });
      return;
    }
    S.errors.push({
      msg: String(e.message || "").slice(0, 300),
      source: String(e.filename || "").slice(0, 200),
      line: e.lineno || 0, col: e.colno || 0,
      stack: String((e.error && e.error.stack) || "").slice(0, 600),
      ts: Date.now() - t0
    });
  }, true);
  window.addEventListener("unhandledrejection", function (e) {
    S.errors.push({ msg: ("UnhandledRejection: " + String((e.reason && e.reason.message) || e.reason || "")).slice(0, 300), ts: Date.now() - t0 });
  });

  /* ---------- 主线程长任务（>50ms 即记录） ---------- */
  try {
    if (window.PerformanceObserver) {
      new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (en) {
          if (en.duration >= 50) {
            S.longTasks.push({ dur: Math.round(en.duration), at: Math.round(en.startTime), phase: phase() });
            if (en.duration > S.heaviestLongTask) S.heaviestLongTask = Math.round(en.duration);
          }
        });
      }).observe({ entryTypes: ["longtask"] });
    }
  } catch (e) {}

  /* ---------- 帧率采样（每秒一个样本） ---------- */
  var frames = 0, secStart = performance.now();
  function loop(now) {
    // 开屏完全不透明遮住主界面期间（启动引导窗口），用户看不见任何帧：
    // 这些帧不计入帧率，避免把“不可见的启动重活”误报为“主界面卡顿”。
    if (window.__splashCovered) { frames = 0; secStart = now; requestAnimationFrame(loop); return; }
    frames++;
    if (now - secStart >= 1000) {
      var fps = Math.round(frames * 1000 / (now - secStart));
      S.fps.push({ fps: fps, at: Math.round(now), phase: phase() });
      if (S.fps.length > 180) S.fps.shift();
      frames = 0; secStart = now;
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /* ---------- 开屏视频健康度 ----------
     开屏已从视频改为 canvas 星尘动画（index.html 无 #splashVideo 元素），
     原 hookVideo 监听永远不生效，已移除（2026-08-29）。
     S.video 结构保留：报告中 splashVideo 指标恒为 0/null，避免报告格式变化。 */

  /* ---------- 页面加载 / 内存 ---------- */
  function captureEnv() {
    try {
      var n = performance.getEntriesByType("navigation")[0];
      if (n) S.nav = {
        ttfb: Math.round(n.responseStart),
        domContentLoaded: Math.round(n.domContentLoadedEventEnd),
        load: Math.round(n.loadEventEnd || 0)
      };
    } catch (e) {}
    try {
      if (performance.memory) S.memory = {
        usedMB: Math.round(performance.memory.usedJSHeapSize / 1048576),
        totalMB: Math.round(performance.memory.totalJSHeapSize / 1048576)
      };
    } catch (e) {}
  }
  if (document.readyState === "complete") captureEnv();
  else window.addEventListener("load", captureEnv);

  /* ---------- 统计与规则 ---------- */
  function fpsStats(list) {
    if (!list || !list.length) return null;
    var arr = list.map(function (x) { return x.fps; });
    var sum = arr.reduce(function (a, b) { return a + b; }, 0);
    var minVal = Math.min.apply(null, arr);
    var minAt = null;
    for (var i = 0; i < list.length; i++) if (list[i].fps === minVal) { minAt = list[i].at; break; }
    return { avg: Math.round(sum / arr.length), min: minVal, minAt: minAt, samples: arr.length };
  }
  function detectIssues() {
    var issues = [];
    var v = S.video;
    if ((v.waiting + v.stalled) > 0) issues.push({ level: "warn", key: "video_buffer", msg: "开屏视频出现 " + (v.waiting + v.stalled) + " 次缓冲/等待" });
    if (typeof v.droppedFrames === "number" && v.totalFrames > 0) {
      var ratio = v.droppedFrames / v.totalFrames;
      if (ratio > 0.03) issues.push({ level: "warn", key: "video_dropped", msg: "开屏视频丢帧率 " + (ratio * 100).toFixed(1) + "%（" + v.droppedFrames + "/" + v.totalFrames + " 帧）" });
    }
    var splashTasks = S.longTasks.filter(function (t) { return t.phase === "splash" && t.dur >= 100; });
    if (splashTasks.length >= 2) {
      var worst = Math.max.apply(null, splashTasks.map(function (t) { return t.dur; }));
      issues.push({ level: "warn", key: "splash_jank", msg: "开屏期间主线程长任务 " + splashTasks.length + " 次，最长 " + worst + "ms" });
    }
    var sf = fpsStats(S.fps.filter(function (x) { return x.phase === "splash"; }));
    if (sf && sf.samples >= 2 && (sf.min < 40 || sf.avg < 45)) issues.push({ level: "warn", key: "splash_fps", msg: "开屏期间帧率偏低（平均 " + sf.avg + " fps / 最低 " + sf.min + " fps）" });
    var mf = fpsStats(S.fps.filter(function (x) { return x.phase === "main"; }));
    if (mf && mf.samples >= 3 && (mf.min < 35 || mf.avg < 45)) issues.push({ level: "warn", key: "main_fps", msg: "主界面帧率偏低（平均 " + mf.avg + " fps / 最低 " + mf.min + " fps" + (mf.minAt != null ? "，发生在 " + (mf.minAt / 1000).toFixed(1) + "s" : "") + "）" });
    if (S.errors.length > 0) issues.push({ level: "error", key: "js_error", msg: "捕获 " + S.errors.length + " 条 JS 错误" });
    if (S.resources.length > 0) issues.push({ level: "warn", key: "resource", msg: "有 " + S.resources.length + " 个资源加载失败" });
    return issues;
  }

  function generateReport(comment) {
    var splashFps = fpsStats(S.fps.filter(function (x) { return x.phase === "splash"; }));
    var mainFps = fpsStats(S.fps.filter(function (x) { return x.phase === "main"; }));
    return {
      app: "星屿",
      reporter: "perf-1",
      generatedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      screen: (window.screen ? screen.width + "x" + screen.height : "") + " @" + (window.devicePixelRatio || 1) + "x",
      viewport: window.innerWidth + "x" + window.innerHeight,
      language: navigator.language,
      online: navigator.onLine,
      issues: detectIssues(),
      metrics: {
        splashVideo: S.video,
        longTasks: {
          count: S.longTasks.length,
          over100ms: S.longTasks.filter(function (t) { return t.dur >= 100; }).length,
          heaviest: S.heaviestLongTask,
          list: S.longTasks.slice(0, 30)
        },
        fps: { splash: splashFps, main: mainFps, recent: S.fps.slice(-10) },
        navigation: S.nav,
        memory: S.memory,
        errors: S.errors.slice(0, 10),
        resourceFailures: S.resources.slice(0, 10)
      },
      userComment: comment || ""
    };
  }

  function textSummary(rep) {
    var L = [];
    L.push("星屿性能反馈报告 · " + rep.generatedAt);
    L.push("屏幕: " + rep.screen + "  视口: " + rep.viewport + "  在线: " + rep.online);
    if (rep.metrics.navigation) L.push("加载: TTFB " + rep.metrics.navigation.ttfb + "ms / DCL " + rep.metrics.navigation.domContentLoaded + "ms / Load " + rep.metrics.navigation.load + "ms");
    var v = rep.metrics.splashVideo;
    L.push("开屏视频: 缓冲 " + (v.waiting + v.stalled) + " 次 / 丢帧 " + (v.droppedFrames == null ? "-" : v.droppedFrames + "/" + v.totalFrames) + " / 时长 " + (v.duration == null ? "-" : v.duration + "s"));
    var lt = rep.metrics.longTasks;
    L.push("长任务: " + lt.count + " 次（≥100ms " + lt.over100ms + " 次，最长 " + lt.heaviest + "ms）");
    if (rep.metrics.fps.splash) L.push("开屏帧率: 平均 " + rep.metrics.fps.splash.avg + " / 最低 " + rep.metrics.fps.splash.min + (rep.metrics.fps.splash.minAt != null ? "（@" + (rep.metrics.fps.splash.minAt / 1000).toFixed(1) + "s）" : ""));
    if (rep.metrics.fps.main) L.push("主界面帧率: 平均 " + rep.metrics.fps.main.avg + " / 最低 " + rep.metrics.fps.main.min + (rep.metrics.fps.main.minAt != null ? "（@" + (rep.metrics.fps.main.minAt / 1000).toFixed(1) + "s）" : ""));
    if (rep.metrics.memory) L.push("JS 内存: " + rep.metrics.memory.usedMB + "MB / " + rep.metrics.memory.totalMB + "MB");
    L.push("");
    if (rep.issues.length) {
      L.push("自动识别的问题:");
      rep.issues.forEach(function (i) { L.push("  [" + i.level + "] " + i.msg); });
    } else {
      L.push("自动识别的问题: 未发现明显异常");
    }
    if (rep.userComment) { L.push(""); L.push("用户补充: " + rep.userComment); }
    return L.join("\n");
  }

  function saveReport(comment) {
    var rep = generateReport(comment);
    return fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rep)
    }).then(function (r) { return r.json(); });
  }

  /* ---------- 自动巡检：开屏结束后检查一次，发现问题自动落报告并提示 ----------
     幂等保护：splash-done+4s 与 16s 两条触发路径只会让 autoCheck 生效一次，
     否则同一批问题会写出两份重复的 data/feedback/ 报告。 */
  var autoChecked = false;
  function autoCheck() {
    if (autoChecked) return;
    autoChecked = true;
    try {
      var issues = detectIssues();
      if (!issues.length) return;
      saveReport().then(function (res) {
        try {
          if (window.toast) toast("检测到 " + issues.length + " 个性能问题，已自动生成反馈报告", "warn", {
            actionLabel: "查看",
            onAction: function () { var b = document.getElementById("btnOpenFeedback"); if (b) b.click(); },
            duration: 8000
          });
        } catch (e) {}
      }).catch(function () {});
    } catch (e) {}
  }
  if (window.__splashActive) {
    window.addEventListener("splash-done", function () { setTimeout(autoCheck, 4000); }, { once: true });
    setTimeout(autoCheck, 16000);
  } else {
    setTimeout(autoCheck, 6000);
  }

  window.XYPerf = {
    detectIssues: detectIssues,
    generateReport: generateReport,
    textSummary: textSummary,
    saveReport: saveReport,
    autoCheck: autoCheck,
    raw: S
  };
})();
