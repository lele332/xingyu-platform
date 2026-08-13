/* ============================================================
   backup.js — 本地自动备份
   - 优先把数据备份到本机磁盘（server.py 的 POST /api/backup，写入 data/backups/）
   - 无本地服务器（file:// 打开 / 部署到 Pages）时，降级为浏览器下载 JSON 文件
   - 超过 7 天未备份时，打开平台自动静默备份一次；设置页可查看状态与手动备份
   依赖：store.js（先加载）、app-core.js 提供的 toast（后加载即可，运行时才调用）
   ============================================================ */
const Backup = (() => {
  const KEY_LAST = "zero_backup_last_at";   // 上次成功备份的时间戳（ms）
  const AUTO_DAYS = 7;                      // 超过 N 天未备份 → 自动备份
  const REMIND_DAYS = 14;                   // 超过 N 天未备份 → 打开时弱提示（若自动备份失败）

  let serverInfo = null;                    // {count, lastFile, lastAt} 或 null（无服务器）

  function getLastAt() {
    try { return parseInt(localStorage.getItem(KEY_LAST) || "0", 10) || 0; }
    catch (e) { return 0; }
  }
  function setLastAt(ts) {
    try { localStorage.setItem(KEY_LAST, String(ts)); } catch (e) {}
  }

  /* ---------- 服务器探测与信息 ---------- */
  async function fetchServerInfo() {
    try {
      const resp = await fetch("api/backup/info", { cache: "no-store" });
      if (!resp.ok) return null;
      const j = await resp.json();
      return j && j.ok ? j : null;
    } catch (e) {
      return null;
    }
  }

  function fmtLast(ts) {
    if (!ts) return "从未";
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  /* ---------- 执行备份 ---------- */
  async function doBackup(options = {}) {
    const silent = !!options.silent;
    const data = Store.exportAll(); // 已自动剔除 API Key

    // 1) 优先：写入本机磁盘（仅当检测到本地服务）
    if (serverInfo !== null || (await fetchServerInfo())) {
      serverInfo = serverInfo || (await fetchServerInfo());
      try {
        const resp = await fetch("api/backup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data, at: new Date().toISOString() })
        });
        if (resp.ok) {
          const j = await resp.json().catch(() => null);
          if (j && j.ok) {
            serverInfo = { count: j.count, lastFile: j.file, lastAt: null };
            setLastAt(Date.now());
            if (!silent) toast("已备份到本机磁盘（data/backups/）", "ok");
            return { mode: "server", file: j.file, count: j.count };
          }
        }
      } catch (e) { /* 继续降级 */ }
    }

    // 2) 降级：浏览器下载 JSON 备份文件
    try {
      const blob = new Blob([data], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      a.download = "xingyu-backup-" + stamp + ".json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
      setLastAt(Date.now());
      if (!silent) toast("已下载备份文件（浏览器下载目录）", "ok");
      return { mode: "download" };
    } catch (e) {
      if (!silent) toast("备份失败，请检查浏览器权限", "err");
      return null;
    }
  }

  /* ---------- 设置页状态 ---------- */
  function updateStatusUI() {
    const el = $("#backupStatus");
    if (!el) return;
    const last = serverInfo && serverInfo.lastFile ? serverInfo.lastFile : null;
    let text;
    if (serverInfo) {
      text = `上次备份：${last ? last.slice(7, 15) + " " + last.slice(16, 22) : "从未"} · 磁盘 ${serverInfo.count || 0} 份`;
    } else {
      const ts = getLastAt();
      text = ts ? `上次备份：${fmtLast(ts)}（浏览器下载）` : "上次备份：从未";
    }
    el.textContent = text;
  }

  /* ---------- 设置页按钮 ---------- */
  function bind() {
    const btn = $("#btnBackupNow");
    if (btn) {
      btn.onclick = async () => {
        btn.disabled = true;
        btn.textContent = "备份中...";
        await doBackup();
        await refreshInfo();
        updateStatusUI();
        btn.disabled = false;
        btn.textContent = "立即备份";
      };
    }
  }

  async function refreshInfo() {
    serverInfo = await fetchServerInfo();
    return serverInfo;
  }

  /* ---------- 改动后防抖自动备份（真正"无感"） ---------- */
  let autoTimer = null;
  function scheduleAutoBackup() {
    if (autoTimer) clearTimeout(autoTimer);
    autoTimer = setTimeout(async () => {
      autoTimer = null;
      // 仅在有本机磁盘服务时静默自动备份，避免在纯浏览器环境无端触发文件下载
      if (serverInfo) {
        await doBackup({ silent: true });
      }
    }, 30000); // 数据改动停止 30 秒后，静默备份一次
  }

  /* ---------- 启动 ---------- */
  async function init() {
    serverInfo = await fetchServerInfo();
    // 数据一变，就排程一次静默备份（防抖 30 秒，不打扰用户）
    if (window.Store && Store.onSave) Store.onSave(scheduleAutoBackup);
    const lastAt = getLastAt();
    const days = lastAt ? (Date.now() - lastAt) / 86400000 : Infinity;
    if (serverInfo && lastAt && days >= AUTO_DAYS) {
      // 超过 7 天未备份 → 静默自动备份到磁盘
      doBackup({ silent: true });
    } else if (!serverInfo && days >= REMIND_DAYS) {
      // 无本地服务且很久没备份 → 弱提示（不打断）
      setTimeout(() => toast(`已 ${Math.floor(days)} 天未备份，可在「设置 → 自动备份」中手动备份`, "info", { key: "backup-remind", duration: 5000 }), 3000);
    }
    updateStatusUI();
  }

  return { init, bind, doBackup, refreshInfo, updateStatusUI };
})();
