/* 星屿 · 超级课表桥接层（2026-09-13）
 * 目标：把独立课程表模块与 Store 双向同步，同时避免 localStorage 双份课程数据。
 */
(function () {
  "use strict";
  const frame = document.getElementById("superScheduleFrame");
  if (!frame) return;

  function safeCourses() {
    try {
      return (Store.getAll("courses") || []).map(function (c) {
        return Object.assign({}, c);
      });
    } catch (e) {
      console.warn("[星屿] 读取课程数据失败", e);
      return [];
    }
  }

  const THEME_TOKENS = [
    "--paper", "--paper-2", "--paper-3", "--paper-card", "--paper-hover", "--paper-sunk",
    "--ink", "--ink-2", "--ink-3", "--ink-faint",
    "--accent", "--accent-hover", "--success", "--warning", "--danger",
    "--rule", "--rule-2", "--rule-thin", "--fill", "--fill-2", "--fill-3",
    "--font", "--font-serif", "--font-mono", "--shadow-paper", "--shadow-hover",
    "--course-1", "--course-2", "--course-3", "--course-4",
    "--course-5", "--course-6", "--course-7", "--course-8"
  ];

  function colorIsLight(color) {
    const probe = document.createElement("div");
    probe.style.position = "absolute";
    probe.style.opacity = "0";
    probe.style.pointerEvents = "none";
    probe.style.color = color || "#000";
    document.body.appendChild(probe);
    const rgb = getComputedStyle(probe).color;
    probe.remove();
    const m = rgb.match(/rgba?\(([^)]+)\)/i);
    if (!m) return false;
    const [r, g, b] = m[1].split(",").map(Number);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 140;
  }

  function themeSnapshot() {
    const root = document.documentElement;
    const cs = getComputedStyle(root);
    const tokens = {};
    THEME_TOKENS.forEach(function (name) {
      tokens[name] = cs.getPropertyValue(name).trim();
    });
    const photo = document.querySelector(".bg-photo");
    const pcs = photo ? getComputedStyle(photo) : null;
    return {
      theme: root.dataset.theme || "dark",
      mode: root.dataset.themeMode || "dark",
      font: root.dataset.font || "default",
      bg: root.dataset.bg || "none",
      bgVis: root.dataset.bgVis || "clear",
      isLight: colorIsLight(tokens["--paper"]),
      tokens,
      bgImage: pcs ? pcs.backgroundImage : "none",
      bgSize: pcs ? pcs.backgroundSize : "cover",
      bgPosition: pcs ? pcs.backgroundPosition : "center 30%",
      bgOpacity: pcs ? Number(pcs.opacity) : 0.36
    };
  }

  let themeTimer = 0;
  function sendTheme() {
    if (!frame.contentWindow) return;
    try {
      frame.contentWindow.postMessage({
        type: "xingyu-schedule-theme",
        theme: themeSnapshot()
      }, location.origin);
    } catch (e) {
      console.warn("[星屿] 课程表主题同步失败", e);
    }
  }

  function queueTheme() {
    clearTimeout(themeTimer);
    themeTimer = setTimeout(sendTheme, 40);
  }

  function sendCourses() {
    try {
      frame.contentWindow.postMessage({
        type: "xingyu-schedule-data",
        courses: safeCourses()
      }, location.origin);
    } catch (e) {
      console.warn("[星屿] 课程表数据同步失败", e);
    }
  }

  function notifyUI() {
    document.dispatchEvent(new CustomEvent("xingyu-courses-changed"));
  }

  function showScheduleTab() {
    document.querySelector('.tab-btn[data-tab="courses-week"]')?.click();
  }

  window.addEventListener("message", function (event) {
    if (event.source !== frame.contentWindow) return;
    const data = event.data || {};
    if (data.type === "xingyu-schedule-ready") {
      sendTheme();
      sendCourses();
      return;
    }
    if (data.type === "xingyu-schedule-exit") {
      document.querySelector('.nav-item[data-view="dashboard"]')?.click();
      return;
    }
    if (data.type === "xingyu-schedule-save" && Array.isArray(data.courses)) {
      const rows = data.courses.filter(function (c) {
        return c && c.name && c.day && c.start && c.end;
      }).map(function (c) {
        return {
          id: String(c.id || Store.uid()),
          name: String(c.name),
          teacher: c.teacher || "",
          room: c.room || "",
          location: c.location || c.room || "",
          day: Number(c.day) || 1,
          start: String(c.start),
          end: String(c.end),
          color: c.color || "var(--course-1)",
          weeks: Array.isArray(c.weeks) ? c.weeks.slice() : undefined
        };
      });
      Store.replaceAll("courses", rows);
      notifyUI();
      sendCourses();
    }
  });

  const themeObserver = new MutationObserver(queueTheme);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "data-theme-mode", "data-font", "data-bg", "data-bg-vis", "style"]
  });

  frame.addEventListener("load", function () {
    setTimeout(function () {
      sendTheme();
      sendCourses();
    }, 60);
  });

  Store.onSave(function () {
    sendCourses();
  });

  window.XingyuScheduleBridge = {
    reload: sendCourses,
    openImport: function () {
      showScheduleTab();
      frame.contentWindow.postMessage({ type: "xingyu-schedule-action", action: "import" }, location.origin);
    },
    openManual: function () {
      showScheduleTab();
      frame.contentWindow.postMessage({ type: "xingyu-schedule-action", action: "manual" }, location.origin);
    }
  };

  const importBtn = document.getElementById("btnImportSchedule");
  if (importBtn) importBtn.onclick = function () { window.XingyuScheduleBridge.openImport(); };
  const addBtn = document.getElementById("btnAddCourse");
  if (addBtn) addBtn.onclick = function () { window.XingyuScheduleBridge.openManual(); };
})();
