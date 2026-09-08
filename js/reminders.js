/* ============================================================
   reminders.js — 任务截止 & 考试到期桌面通知
   使用 Notification API + 分钟级轮询，零构建。
   用户在设置里开启后，浏览器会请求通知权限。
   ============================================================ */
(function () {
  "use strict";

  var CHECK_INTERVAL = 60 * 1000; // 每分钟检查
  var NOTIFIED_KEY = "xingyu_notified_";
  var lastCheck = 0;

  function isStandalone() {
    return window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
  }

  function getSetting(key) {
    try {
      var s = JSON.parse(localStorage.getItem("xingyu_platform_v1") || "{}");
      return s.settings && s.settings[key];
    } catch (e) { return undefined; }
  }

  function setSetting(key, value) {
    try {
      var raw = localStorage.getItem("xingyu_platform_v1");
      if (!raw) return;
      var s = JSON.parse(raw);
      if (!s.settings) s.settings = {};
      s.settings[key] = value;
      localStorage.setItem("xingyu_platform_v1", JSON.stringify(s));
    } catch (e) {}
  }

  function isEnabled() {
    return getSetting("remindersEnabled") === true;
  }

  function hasPermission() {
    return "Notification" in window && Notification.permission === "granted";
  }

  function alreadyNotified(id, dateStr) {
    return localStorage.getItem(NOTIFIED_KEY + id) === dateStr;
  }

  function markNotified(id, dateStr) {
    try { localStorage.setItem(NOTIFIED_KEY + id, dateStr); } catch (e) {}
  }

  function showNotification(title, body, tag) {
    if (!hasPermission()) return;
    try {
      var n = new Notification(title, {
        body: body,
        tag: tag || "xingyu",
        icon: "assets/xingyu-app-icon-192.png",
        badge: "assets/xingyu-app-icon-192.png",
        requireInteraction: false,
        silent: false
      });
      n.onclick = function () { window.focus(); n.close(); };
      // 自动关闭 10s
      setTimeout(function () { n.close(); }, 10000);
    } catch (e) {}
  }

  function checkTasks() {
    if (!isEnabled() || !hasPermission()) return;
    var now = Date.now();
    if (now - lastCheck < CHECK_INTERVAL) return;
    lastCheck = now;
    try {
      var s = JSON.parse(localStorage.getItem("xingyu_platform_v1") || "{}");
      var today = new Date();
      var todayStr = today.toISOString().slice(0, 10);
      var hour = today.getHours();
      // 只在 7:00-23:00 之间检查
      if (hour < 7 || hour >= 23) return;

      // 任务截止
      var tasks = Array.isArray(s.tasks) ? s.tasks : [];
      tasks.forEach(function (t) {
        if (!t || !t.due || t.status === "done") return;
        var dueDate = t.due.slice(0, 10);
        if (dueDate !== todayStr) return;
        if (alreadyNotified("task_" + t.id, todayStr)) return;
        showNotification("⏰ 任务今天截止", t.title || "未命名任务", "task_" + t.id);
        markNotified("task_" + t.id, todayStr);
      });

      // 考试/日程
      var exams = Array.isArray(s.exams) ? s.exams : [];
      exams.forEach(function (e) {
        if (!e || !e.date || e.status === "done") return;
        if (e.date !== todayStr) return;
        if (alreadyNotified("exam_" + e.id, todayStr)) return;
        var typeLabel = { exam: "📝 考试", homework: "📋 作业", event: "📅 日程", important: "⭐ 重要日子" }[e.type] || "📅 日程";
        showNotification(typeLabel + " 今天", e.title || "未命名日程", "exam_" + e.id);
        markNotified("exam_" + e.id, todayStr);
      });

      // FSRS 复习到期
      var cards = Array.isArray(s.cards) ? s.cards : [];
      var dueCount = 0;
      cards.forEach(function (c) {
        if (!c || !c.srs) return;
        if (new Date(c.srs.due).getTime() <= now) dueCount++;
      });
      if (dueCount > 0 && !alreadyNotified("srs_daily", todayStr)) {
        showNotification("📚 今日复习", "你有 " + dueCount + " 张知识卡片待复习", "srs_daily");
        markNotified("srs_daily", todayStr);
      }
    } catch (e) {}
  }

  // 导出供设置页调用
  window.XingyuReminders = {
    enable: function () {
      if (!("Notification" in window)) { alert("此浏览器不支持通知"); return false; }
      Notification.requestPermission().then(function (perm) {
        if (perm === "granted") {
          setSetting("remindersEnabled", true);
          showNotification("✅ 提醒已开启", "任务截止、考试到期和复习提醒都会通知你", "test");
        }
      });
      return true;
    },
    disable: function () { setSetting("remindersEnabled", false); },
    isEnabled: isEnabled,
    hasPermission: hasPermission,
    check: checkTasks,
    test: function () { showNotification("🔔 测试通知", "这是一条测试提醒", "test"); }
  };

  // 启动检查
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setInterval(checkTasks, CHECK_INTERVAL); setTimeout(checkTasks, 3000); });
  } else {
    setInterval(checkTasks, CHECK_INTERVAL);
    setTimeout(checkTasks, 3000);
  }
})();
