/* 设置中心：分组导航 + 图标主题状态同步 */
(function () {
  "use strict";
  const KEY = "zero_settings_tab";

  function activate(id, persist = true) {
    const tabs = document.querySelectorAll(".settings-tab");
    const panels = document.querySelectorAll(".settings-panel");
    if (!tabs.length || !panels.length) return;
    let found = false;
    tabs.forEach(tab => {
      const on = tab.dataset.settingsTab === id;
      tab.classList.toggle("active", on);
      if (on) found = true;
    });
    panels.forEach(panel => {
      panel.classList.toggle("active", panel.dataset.settingsPanel === id);
      panel.hidden = panel.dataset.settingsPanel !== id;
    });
    if (!found) activate(tabs[0].dataset.settingsTab, false);
    if (persist) {
      try { localStorage.setItem(KEY, id); } catch (e) {}
    }
  }

  function current() {
    const saved = localStorage.getItem(KEY) || "appearance";
    return document.querySelector(`[data-settings-tab="${saved}"]`) ? saved : "appearance";
  }

  function sync() {
    activate(current(), false);
    if (window.XingyuIconThemes) window.XingyuIconThemes.sync();
  }

  document.addEventListener("click", event => {
    const tab = event.target.closest("[data-settings-tab]");
    if (tab) activate(tab.dataset.settingsTab);
  });

  window.XingyuSettingsUI = { activate, sync };
})();
