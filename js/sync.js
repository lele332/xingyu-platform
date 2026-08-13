/* ============================================================
   sync.js — 云同步（GitHub Gist 私有备份 + 桌面/手机双向同步）
   数据只在你的浏览器本地与私有 Gist 之间流动，无第三方服务器。
   依赖：store.js（需先加载）
   ============================================================ */
const Sync = (() => {
  const TOKEN_KEY = "zero_sync_token";
  const ENABLED_KEY = "zero_sync_enabled";
  const GIST_KEY = "zero_sync_gist_id";
  const LOCAL_KEY = "zero_sync_local_updated";
  const GIST_FILE = "xingyu-data.json";
  const API = "https://api.github.com";
  const SNAPSHOT_V = 2;
  const REQUEST_TIMEOUT_MS = 20000;

  let lastPushed = null;   // 最近一次成功推送后，本地内容对应的 updatedAt(ms)
  let pushTimer = null;
  let inFlight = false;    // 防止并发同步
  let suppressing = false; // 拉取写入时抑制本地改动标记，避免推拉死循环

  const listeners = [];
  function emit(status) { listeners.forEach(fn => { try { fn(status); } catch (e) {} }); }

  function getToken() { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; } }
  function setToken(t) {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, String(t).trim());
      else localStorage.removeItem(TOKEN_KEY);
    } catch (e) { emit({ phase: "sync", err: "无法保存 GitHub Token，请检查浏览器存储权限" }); }
  }
  function isEnabled() { try { return localStorage.getItem(ENABLED_KEY) === "1"; } catch (e) { return false; } }
  function setEnabled(v) {
    try {
      if (v) localStorage.setItem(ENABLED_KEY, "1");
      else localStorage.removeItem(ENABLED_KEY);
    } catch (e) {}
  }
  function getGistId() { try { return localStorage.getItem(GIST_KEY) || ""; } catch (e) { return ""; } }
  function getLocalStamp() { try { return parseInt(localStorage.getItem(LOCAL_KEY) || "0", 10) || 0; } catch (e) { return 0; } }

  function authHeaders() {
    return {
      "Authorization": "Bearer " + getToken(),
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json"
    };
  }

  async function request(path, options) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(API + path, Object.assign({}, options, { signal: controller.signal }));
    } catch (e) {
      if (e.name === "AbortError") throw new Error("云同步请求超时");
      throw new Error("云同步网络请求失败，请检查网络连接");
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      let msg = "HTTP " + res.status;
      try {
        const j = await res.json();
        if (j.message) msg = j.message;
      } catch (e) {}
      throw new Error(msg);
    }
    return res.json().catch(() => { throw new Error("云同步返回数据格式异常"); });
  }

  function snapshot() {
    let data = null;
    try { data = JSON.parse(Store.exportAll()); } catch (e) {}
    return { v: SNAPSHOT_V, updatedAt: new Date().toISOString(), data };
  }

  // 本地有真实改动（用户操作）-> 更新时间戳并排程自动推送
  function onLocalChange() {
    if (suppressing) return;
    try { localStorage.setItem(LOCAL_KEY, String(Date.now())); } catch (e) {}
    if (!isEnabled()) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => { pushTimer = null; sync().catch(() => {}); }, 2000);
  }

  // 推送本地数据到 Gist（无 Gist 时自动创建私有 Gist）
  async function push() {
    const stamp = snapshot();
    const content = JSON.stringify(stamp);
    let gid = getGistId();
    if (gid) {
      await request("/gists/" + gid, {
        method: "PATCH", headers: authHeaders(),
        body: JSON.stringify({ files: { [GIST_FILE]: { content } } })
      });
    } else {
      const g = await request("/gists", {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({
          description: "星屿（Zero）学习工作台数据同步（自动创建）",
          public: false,
          files: { [GIST_FILE]: { content } }
        })
      });
      try { localStorage.setItem(GIST_KEY, g.id); } catch (e) {}
    }
    const now = Date.now();
    lastPushed = now;
    try { localStorage.setItem(LOCAL_KEY, String(now)); } catch (e) {}
    return { dir: "pushed", at: now };
  }

  // 若远端更新则拉取覆盖本地
  async function pull() {
    const gid = getGistId();
    if (!gid) return { dir: "none" };
    const g = await request("/gists/" + gid);
    const f = g.files && g.files[GIST_FILE];
    if (!f || !f.content) return { dir: "none" };
    let remote;
    try { remote = JSON.parse(f.content); } catch (e) { throw new Error("云端数据解析失败"); }
    const remoteTs = new Date(remote.updatedAt || 0).getTime() || 0;
    if (remoteTs <= getLocalStamp()) return { dir: "none", remoteTs };
    suppressing = true;
    let ok = false;
    try { if (remote.data) ok = Store.importAll(JSON.stringify(remote.data)); } finally { suppressing = false; }
    if (!ok) throw new Error("云端数据导入失败");
    try { localStorage.setItem(LOCAL_KEY, String(remoteTs)); } catch (e) {}
    lastPushed = remoteTs;
    return { dir: "pulled", remoteTs };
  }

  // 主入口：远端更新则拉取，否则本地有改动才推送
  async function sync() {
    if (inFlight) return { dir: "busy" };
    inFlight = true;
    try {
      if (!getToken()) { emit({ phase: "sync", err: "未配置 GitHub Token" }); return { dir: "no-token" }; }
      const pulled = await pull();
      if (pulled.dir === "pulled") { emit({ phase: "sync", ok: "拉取完成" }); return pulled; }
      const localStamp = getLocalStamp();
      if (lastPushed === null) lastPushed = localStamp;
      if (!getGistId() || localStamp > lastPushed) {
        const p = await push();
        emit({ phase: "sync", ok: "已推送" });
        return p;
      }
      emit({ phase: "sync", ok: "已是最新" });
      return { dir: "uptodate" };
    } catch (err) {
      emit({ phase: "sync", err: err.message });
      return { dir: "error", err: err.message };
    } finally {
      inFlight = false;
    }
  }

  function init() {
    Store.onSave(onLocalChange);
    if (isEnabled() && getToken()) {
      // 启动静默同步（拉取最新 + 推送本地改动）
      setTimeout(() => sync().catch(() => {}), 800);
    }
  }

  return { init, sync, isEnabled, setEnabled, getToken, setToken, getGistId, listeners };
})();
