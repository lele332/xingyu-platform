/* ============================================================
   splashsound.js — 开屏声音
   内置励志语录 + 自定义上传（MP3/MP4 以 Blob 存入 IndexedDB）
   当前选择项存入 Store.settings.splashSound（localStorage 持久化）
   ============================================================ */
(function () {
  var DB_NAME = "xingyu_splashsound_v1";
  var STORE = "files";

  // 内置开屏声音（沿用励志语录音频）
  var BUILTIN = [
    { id: "intro-ambient", name: "星屿 · 东方晨曦（自然女声开屏）", file: "assets/intro-ambient-v4.wav" },
    { id: "default", name: "你是一个有毅力的人", file: "assets/motivational/quote-perseverance.mp3" },
    { id: "leijun-dare", name: "雷军：敢想敢干最重要", file: "assets/motivational/leijun-dare.mp3" },
    { id: "leijun-effort", name: "雷军：努力不是万能的", file: "assets/motivational/leijun-effort.mp3" },
    { id: "quote-crying", name: "哭着考完的往往是笑着上岸的", file: "assets/motivational/quote-crying.mp3" },
    { id: "quote-failure", name: "没有任何人喜欢挫折和失败", file: "assets/motivational/quote-failure.mp3" },
    { id: "quote-helmet", name: "这个世界上最好的贵人，是自己", file: "assets/motivational/quote-helmet.mp3" },
    { id: "quote-humanity", name: "这就是人类奇妙的地方", file: "assets/motivational/quote-humanity.mp3" },
    { id: "quote-mindset", name: "心态是最好的风水", file: "assets/motivational/quote-mindset.mp3" },
    { id: "quote-perseverance", name: "你是一个有毅力的人", file: "assets/motivational/quote-perseverance.mp3" },
    { id: "quote-win", name: "赢万难，迎万难", file: "assets/motivational/quote-win.mp3" },
    { id: "quote-worthiness", name: "世上总有一些美好值得我们全力以赴", file: "assets/motivational/quote-worthiness.mp3" }
  ];

  function openDB() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function (e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: "id" });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function getAllCustom() {
    return openDB().then(function (d) {
      return new Promise(function (resolve, reject) {
        var req = d.transaction(STORE, "readonly").objectStore(STORE).getAll();
        req.onsuccess = function () {
          resolve((req.result || []).map(function (r) { return { id: r.id, name: r.name, type: r.type, size: r.size }; }));
        };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function addCustom(file) {
    var id = "custom-" + Date.now() + "-" + Math.floor(Math.random() * 1e6);
    var rec = { id: id, name: file.name || ("sound-" + id), type: file.type || "", size: file.size, blob: file };
    return openDB().then(function (d) {
      return new Promise(function (resolve, reject) {
        var tx = d.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(rec);
        tx.oncomplete = function () { resolve(id); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function removeCustom(id) {
    return openDB().then(function (d) {
      return new Promise(function (resolve, reject) {
        var tx = d.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function getCustomBlob(id) {
    return openDB().then(function (d) {
      return new Promise(function (resolve, reject) {
        var req = d.transaction(STORE, "readonly").objectStore(STORE).get(id);
        req.onsuccess = function () { resolve(req.result ? req.result.blob : null); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function getSelection() {
    try {
      if (typeof Store !== "undefined" && Store.getSettings) {
        var v = Store.getSettings().splashSound;
        if (v) return v === "default" ? "intro-ambient" : v;
      }
    } catch (e) {}
    return "intro-ambient";
  }

  function isEnabled() {
    try {
      if (typeof Store !== "undefined" && Store.getSettings) {
        var v = Store.getSettings().splashSoundEnabled;
        if (typeof v === "boolean") return v;
      }
    } catch (e) {}
    return true;
  }
  function setEnabled(on) {
    try { if (typeof Store !== "undefined" && Store.setSettings) Store.setSettings({ splashSoundEnabled: !!on }); } catch (e) {}
  }
  function setSelection(id) {
    try { if (typeof Store !== "undefined" && Store.setSettings) Store.setSettings({ splashSound: id }); } catch (e) {}
  }

  function resolveSource(id) {
    if (!id || id === "none") return Promise.resolve(null);
    for (var i = 0; i < BUILTIN.length; i++) {
      if (BUILTIN[i].id === id) return Promise.resolve({ id: id, name: BUILTIN[i].name, url: BUILTIN[i].file });
    }
    if (id.indexOf("custom-") === 0) {
      return getCustomBlob(id).then(function (blob) {
        if (!blob) return null;
        return { id: id, name: "自定义", url: URL.createObjectURL(blob) };
      });
    }
    return Promise.resolve(null);
  }

  function getCurrentSource() { return resolveSource(getSelection()); }

  function listSources() {
    var out = [{ id: "none", name: "无声音" }];
    BUILTIN.forEach(function (b) { out.push({ id: b.id, name: b.name }); });
    return getAllCustom().then(function (custom) {
      custom.forEach(function (c) { out.push({ id: c.id, name: c.name + "（自定义）" }); });
      return out;
    });
  }

  window.SplashSound = {
    getSelection: getSelection,
    setSelection: setSelection,
    isEnabled: isEnabled,
    setEnabled: setEnabled,
    getCurrentSource: getCurrentSource,
    resolveSource: resolveSource,
    listSources: listSources,
    listCustom: getAllCustom,
    addCustom: addCustom,
    removeCustom: removeCustom,
    BUILTIN: BUILTIN
  };
})();