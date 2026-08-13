/* ============================================================
   reminders.js — 主动提醒（Web Notification）
   - 考试临近（提前 7/3/1 天 + 当天）、任务到期（今天/明天）、卡片待复习
   - 仅在本机浏览器通知；权限由用户授予，可在设置中开关
   - 去重：同一内容当天只提醒一次（跨天自动失效）
   依赖：store.js（Store）、app-core.js（daysUntil / localDateKey / toast）
   ============================================================ */
const Reminders = (() => {
  const PREF_KEY = "zero_reminders_enabled";
  const NOTIFIED_KEY = "zero_reminders_notified";

  function isEnabled() {
    try { return localStorage.getItem(PREF_KEY) === "1"; } catch (e) { return false; }
  }
  function setEnabled(v) {
    try {
      if (v) localStorage.setItem(PREF_KEY, "1");
      else localStorage.removeItem(PREF_KEY);
    } catch (e) {}
  }

  function loadNotified() {
    try {
      const raw = localStorage.getItem(NOTIFIED_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function saveNotified(map) {
    try { localStorage.setItem(NOTIFIED_KEY, JSON.stringify(map)); } catch (e) {}
  }

  function canNotify() {
    return "Notification" in window && Notification.permission === "granted";
  }

  function notify(title, body, tag) {
    if (!canNotify()) return;
    try {
      new Notification(title, { body, tag, icon: "assets/xingyu-app-icon-192.png", silent: false });
    } catch (e) {}
  }

  // 请求通知权限（用户主动操作时调用，浏览器要求）
  function requestPermission() {
    if (!("Notification" in window)) return Promise.resolve("unsupported");
    if (Notification.permission === "granted") return Promise.resolve("granted");
    if (Notification.permission === "denied") return Promise.resolve("denied");
    return Notification.requestPermission().catch(() => "denied");
  }

  function check() {
    if (!isEnabled() || !canNotify()) return;
    const today = localDateKey();
    const notified = loadNotified();
    let changed = false;

    // 考试：提前 7 / 3 / 1 天 + 当天
    Store.getAll("exams").forEach(ex => {
      if (!ex.date) return;
      const days = daysUntil(ex.date);
      if (days === 7 || days === 3 || days === 1 || days === 0) {
        const key = "exam:" + ex.id + ":" + days;
        if (notified[key] === today) return;
        const name = ex.name || ex.subject || "考试";
        const when = days === 0 ? "就在今天" : "还有 " + days + " 天";
        notify("考试提醒", `${name} ${when}${ex.location ? " · " + ex.location : ""}`, "xingyu-exam-" + ex.id);
        notified[key] = today;
        changed = true;
      }
    });

    // 任务：今天 / 明天到期
    Store.getAll("tasks").forEach(t => {
      if (t.status === "done" || !t.due) return;
      const days = daysUntil(t.due);
      if (days === 1 || days === 0) {
        const key = "task:" + t.id + ":" + days;
        if (notified[key] === today) return;
        notify("任务提醒", `「${t.title}」${days === 0 ? "今天到期" : "明天到期"}`, "xingyu-task-" + t.id);
        notified[key] = today;
        changed = true;
      }
    });

    // 知识卡片：有到期待复习的卡片
    const dueCards = Store.getAll("cards").filter(c => {
      if (!c.due) return true; // 从未复习过 = 待复习
      return new Date(c.due).getTime() <= Date.now();
    });
    if (dueCards.length) {
      const key = "cards:" + today;
      if (notified[key] !== today) {
        notify("复习提醒", `有 ${dueCards.length} 张知识卡片待复习`, "xingyu-cards");
        notified[key] = today;
        changed = true;
      }
    }

    if (changed) {
      // 只保留"今天"的记录，跨天自动失效，避免无限累积
      const pruned = {};
      Object.keys(notified).forEach(k => { if (notified[k] === today) pruned[k] = today; });
      saveNotified(pruned);
    }
  }

  function init() {
    check();
    // 回到前台时再查一次（离开期间可能到了提醒日）
    document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
    // 页面常开时每小时兜底查一次
    setInterval(check, 60 * 60 * 1000);
  }

  return { init, check, isEnabled, setEnabled, requestPermission };
})();
