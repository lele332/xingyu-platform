/* ============================================================
   app-shell.js — PWA App Shell 增强
   提供：App Badge（待办角标）、SW 更新提示、安装引导、
         键盘快捷键（Alt+1~9 切视图, Ctrl+K 搜索, Alt+T 任务, Alt+N 笔记, Alt+F 专注）
   零依赖，defer 加载，不影响核心启动。
   ============================================================ */
(function () {
  "use strict";

  /* ---------- App Badge：待办任务数 ---------- */
  function updateBadge() {
    if (!navigator.setAppBadge && !navigator.clearAppBadge) return;
    try {
      var s = JSON.parse(localStorage.getItem("xingyu_platform_v1") || "{}");
      var tasks = Array.isArray(s.tasks) ? s.tasks : [];
      var pending = tasks.filter(function (t) { return t && t.status !== "done"; }).length;
      if (pending > 0 && navigator.setAppBadge) navigator.setAppBadge(pending);
      else if (navigator.clearAppBadge) navigator.clearAppBadge();
    } catch (e) {}
  }

  // Store.save() 会派发 saveHooks，这里通过 MutationObserver 监听 localStorage 写入
  if (typeof window !== "undefined") {
    var _origSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      _origSetItem.call(this, key, value);
      if (key === "xingyu_platform_v1") updateBadge();
    };
    updateBadge();
  }

  /* ---------- SW 更新提示 ---------- */
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready.then(function (reg) {
      reg.addEventListener("updatefound", function () {
        var nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", function () {
          if (nw.state === "installed" && navigator.serviceWorker.controller) {
            // 有旧 SW 在控制 → 新版本已缓存
            showToastUpdate();
          }
        });
      });
    });

    function showToastUpdate() {
      if (document.getElementById("sw-update-toast")) return;
      var el = document.createElement("div");
      el.id = "sw-update-toast";
      el.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99999;"
        + "display:flex;align-items:center;gap:12px;padding:12px 20px;border-radius:14px;"
        + "background:rgba(6,12,22,.94);color:#eaf6ff;font:13px/1.5 system-ui,-apple-system,sans-serif;"
        + "border:1px solid rgba(120,220,255,.35);box-shadow:0 16px 48px rgba(0,0,0,.4);"
        + "backdrop-filter:blur(16px);cursor:pointer;transition:opacity .3s;";
      el.innerHTML = "<span>✨ 新版本已就绪</span><span style='opacity:.6'>点击刷新</span>";
      el.onclick = function () {
        navigator.serviceWorker.controller.postMessage({ action: "skipWaiting" });
        location.reload();
      };
      document.body.appendChild(el);
      setTimeout(function () { el.style.opacity = "0"; setTimeout(function () { el.remove(); }, 350); }, 8000);
    }

    navigator.serviceWorker.addEventListener("message", function (event) {
      if (event.data && event.data.action === "skipWaiting") {
        self.skipWaiting && self.skipWaiting();
      }
    });
  }

  /* ---------- 安装引导 ---------- */
  var _deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    _deferredPrompt = e;
    // 延迟显示，不打断首次使用
    setTimeout(function () {
      if (document.getElementById("pwa-install-banner")) return;
      if (window.matchMedia("(display-mode: standalone)").matches) return;
      var banner = document.createElement("div");
      banner.id = "pwa-install-banner";
      banner.style.cssText = "position:fixed;bottom:24px;right:24px;z-index:99998;"
        + "padding:14px 18px;border-radius:16px;background:rgba(6,12,22,.94);color:#eaf6ff;"
        + "font:13px/1.5 system-ui,-apple-system,sans-serif;border:1px solid rgba(120,220,255,.3);"
        + "box-shadow:0 16px 48px rgba(0,0,0,.35);backdrop-filter:blur(16px);"
        + "display:flex;align-items:center;gap:12px;max-width:300px;";
      banner.innerHTML = "<div><b>安装星屿</b><br><span style='opacity:.6;font-size:12px'>桌面图标 · 离线可用</span></div>"
        + "<button id='pwa-install-btn' style='margin-left:auto;padding:6px 14px;border-radius:10px;border:0;"
        + "background:rgba(80,200,255,.15);color:#7dd3fc;cursor:pointer;font-weight:600;font-size:12px'>安装</button>"
        + "<button id='pwa-install-dismiss' style='padding:6px;border-radius:10px;border:0;background:transparent;"
        + "color:rgba(255,255,255,.4);cursor:pointer;font-size:16px;line-height:1'>×</button>";
      document.body.appendChild(banner);
      banner.querySelector("#pwa-install-btn").onclick = function () {
        banner.remove();
        _deferredPrompt.prompt();
        _deferredPrompt = null;
      };
      banner.querySelector("#pwa-install-dismiss").onclick = function () { banner.remove(); };
      setTimeout(function () { if (banner.parentNode) banner.remove(); }, 10000);
    }, 6000);
  });

  /* ---------- 键盘快捷键 ---------- */
  var SHORTCUTS = [
    { keys: "Alt+1", action: "dashboard", label: "首页" },
    { keys: "Alt+2", action: "courses", label: "课程" },
    { keys: "Alt+3", action: "focus", label: "专注" },
    { keys: "Alt+4", action: "notes", label: "笔记" },
    { keys: "Alt+5", action: "lit", label: "文献" },
    { keys: "Alt+6", action: "weather", label: "天气" },
    { keys: "Alt+7", action: "news", label: "热点" },
    { keys: "Alt+8", action: "growth", label: "成长" },
    { keys: "Alt+9", action: "ai", label: "AI" },
    { keys: "Ctrl+K", action: "search", label: "全局搜索" },
    { keys: "Alt+N", action: "new-note", label: "新建笔记" },
    { keys: "Alt+T", action: "new-task", label: "新建任务" },
    { keys: "Alt+P", action: "start-pomo", label: "开始专注" },
    { keys: "Alt+,", action: "settings", label: "设置" }
  ];

  function isInputFocused() {
    var el = document.activeElement;
    if (!el) return false;
    var tag = el.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
  }

  document.addEventListener("keydown", function (e) {
    if (e.defaultPrevented) return;
    // Ctrl+K 搜索
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      var search = document.getElementById("globalSearch");
      if (search && getComputedStyle(search).display !== "none") { search.focus(); search.select(); }
      return;
    }
    // Alt+数字 切换视图
    if (e.altKey && !e.ctrlKey && !e.shiftKey) {
      var num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9) {
        e.preventDefault();
        var views = ["dashboard", "courses", "focus", "notes", "lit", "weather", "news", "growth", "ai"];
        var target = views[num - 1];
        if (target) {
          var nav = document.querySelector('.nav-item[data-view="' + target + '"]');
          if (nav) nav.click();
        }
        return;
      }
      if (isInputFocused()) return;
      var key = e.key.toLowerCase();
      if (key === "n") { e.preventDefault(); triggerAction("new-note"); return; }
      if (key === "t") { e.preventDefault(); triggerAction("new-task"); return; }
      if (key === "p") { e.preventDefault(); triggerAction("start-pomo"); return; }
      if (key === ",") { e.preventDefault(); triggerAction("settings"); return; }
    }
  });

  function triggerAction(action) {
    switch (action) {
      case "new-note": {
        var nav = document.querySelector('.nav-item[data-view="notes"]');
        if (nav) nav.click();
        setTimeout(function () {
          var btn = document.getElementById("btnNewNote") || document.querySelector('[data-action="new-note"]');
          if (btn) btn.click();
        }, 200);
        break;
      }
      case "new-task": {
        var nav = document.querySelector('.nav-item[data-view="courses"]');
        if (nav) nav.click();
        setTimeout(function () {
          var btn = document.getElementById("btnAddTask") || document.querySelector('[data-action="add-task"]');
          if (btn) btn.click();
        }, 200);
        break;
      }
      case "start-pomo": {
        var nav = document.querySelector('.nav-item[data-view="focus"]');
        if (nav) nav.click();
        setTimeout(function () {
          var btn = document.getElementById("btnPomoStart");
          if (btn && btn.textContent.includes("开始")) btn.click();
        }, 200);
        break;
      }
      case "settings": {
        var btn = document.getElementById("btnSettings");
        if (btn) btn.click();
        break;
      }
    }
  }

  /* ---------- 快捷键帮助面板 ---------- */
  function showShortcutsHelp() {
    var existing = document.getElementById("shortcuts-overlay");
    if (existing) { existing.remove(); return; }
    var overlay = document.createElement("div");
    overlay.id = "shortcuts-overlay";
    overlay.style.cssText = "position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;"
      + "background:rgba(0,0,0,.6);backdrop-filter:blur(8px);";
    var panel = document.createElement("div");
    panel.style.cssText = "background:rgba(15,20,30,.96);border:1px solid rgba(100,200,255,.2);border-radius:20px;"
      + "padding:28px;max-width:420px;width:92vw;max-height:80vh;overflow-y:auto;color:#eaf6ff;"
      + "font:13px/1.6 system-ui,-apple-system,sans-serif;box-shadow:0 24px 80px rgba(0,0,0,.5);";
    var html = "<h3 style='margin:0 0 16px;font-size:16px'>⌨️ 快捷键</h3><div style='display:grid;gap:8px'>";
    SHORTCUTS.forEach(function (sc) {
      html += "<div style='display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.06)'>"
        + "<span style='opacity:.7'>" + sc.label + "</span>"
        + "<kbd style='padding:2px 8px;border-radius:6px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);font-size:12px;font-family:inherit'>" + sc.keys + "</kbd></div>";
    });
    html += "</div><p style='margin-top:16px;font-size:12px;opacity:.5;text-align:center'>按 Esc 关闭</p>";
    panel.innerHTML = html;
    overlay.appendChild(panel);
    overlay.onclick = function (e) { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
    overlay.querySelector("h3").addEventListener("click", function () {});
    document.addEventListener("keydown", function onKey(e) {
      if (e.key === "Escape") { overlay.remove(); document.removeEventListener("keydown", onKey); }
    });
  }

  // Alt+/ 显示快捷键帮助
  document.addEventListener("keydown", function (e) {
    if (e.altKey && e.key === "/") { e.preventDefault(); showShortcutsHelp(); }
  });

  /* ---------- URL 参数：shortcut 快速跳转 ---------- */
  window.addEventListener("DOMContentLoaded", function () {
    try {
      var qp = new URLSearchParams(location.search);
      var view = qp.get("view");
      if (view) {
        var nav = document.querySelector('.nav-item[data-view="' + view + '"]');
        if (nav) setTimeout(function () { nav.click(); }, 500);
      }
      var shortcut = qp.get("shortcut");
      if (shortcut === "pomo") setTimeout(function () { triggerAction("start-pomo"); }, 800);
      if (shortcut === "new-note") setTimeout(function () { triggerAction("new-note"); }, 800);
      if (shortcut === "new-task") setTimeout(function () { triggerAction("new-task"); }, 800);
      if (qp.get("share") === "1") {
        var text = qp.get("text") || qp.get("title") || "";
        var url = qp.get("url") || "";
        if (text || url) {
          setTimeout(function () {
            triggerAction("new-note");
            setTimeout(function () {
              var ta = document.querySelector("#noteForm textarea") || document.querySelector("#noteContent");
              if (ta && text) {
                ta.value = text + (url ? "\n" + url : "");
                ta.dispatchEvent(new Event("input"));
              }
            }, 300);
          }, 1000);
        }
      }
    } catch (e) {}
  });
})();
