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
    // intro-ambient 是默认项 = 系统启动音（两声钟鸣 + 薄低频底，约 1.6s）。
    // 这段音原本由 index.html 的 playBootTone() 用 Web Audio 实时合成，现已离线渲染为
    // assets/intro-boot.wav（脚本 work/gen_boot_tone.py，参数与合成版逐项一致），
    // 好处是设置面板的试听 / 切换都能像普通音源一样正常用。
    { id: "intro-ambient", name: "星屿 · 系统启动音（钟鸣 1.6s）", file: "assets/intro-boot.wav" },
    { id: "intro-tap", name: "星屿 · 轻提示音（短音效 1.4s）", file: "assets/intro-tap-v10.wav" },
    { id: "intro-starlight", name: "星屿 · 星光入场（纯音乐·旧版）", file: "assets/intro-starlight-v7.wav" },
    { id: "intro-ambient-v6", name: "星屿 · 晨曦序曲（空灵磬音·旧版）", file: "assets/intro-ambient-v6.wav" },
    { id: "intro-ambient-v5", name: "星屿 · 东方晨曦（纯民乐·旧版）", file: "assets/intro-ambient-v5.wav" },
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

  var STORE_KEY = "xingyu_platform_v1";

  // 读取设置的唯一入口。
  // 关键：开屏脚本在 <head> 里同步执行，而 Store 要等文档末尾的 defer 脚本才加载，
  // 那会儿 Store 还不存在。所以这里以「直接解析 localStorage」为主、Store 为辅：
  // Store 是唯一写入方，底层就是 localStorage[STORE_KEY].settings，两者结构一致。
  function readSettings() {
    try {
      if (typeof Store !== "undefined" && Store.getSettings) {
        var s = Store.getSettings();
        if (s && typeof s === "object") return s;
      }
    } catch (e) {}
    try {
      var raw = localStorage.getItem(STORE_KEY);
      var d = raw ? JSON.parse(raw) : null;
      return (d && d.settings) || {};
    } catch (e) {
      return {};
    }
  }

  function getSelection() {
    var v = readSettings().splashSound;
    if (v) return v === "default" ? "intro-ambient" : v;
    return "intro-ambient";
  }

  function isEnabled() {
    var v = readSettings().splashSoundEnabled;
    return typeof v === "boolean" ? v : true;
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
