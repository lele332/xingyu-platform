/* ============================================================
   store.js — 数据存储层（localStorage）
   ============================================================ */
const Store = (() => {
  const KEY = "xingyu_platform_v1";
  const CORRUPT_KEY_PREFIX = KEY + "_corrupt_";
  const SCHEMA_VERSION = 3;

  const defaults = () => {
    const d = {
      schemaVersion: SCHEMA_VERSION,
      profile: { name: "同学", avatar: "", school: "", major: "", grade: "", slogan: "", goal: "", email: "" },
      settings: { baseUrl: "https://api.deepseek.com/v1", apiKey: "", model: "deepseek-chat", nickname: "", splashSound: "intro-ambient", splashSoundEnabled: true, developerMode: false, useLocalAiProxy: false },
      courses: [],       // {id, name, teacher, day(1-7), start, end, location, color}
      tasks: [],         // {id, title, courseId, due(ISO), priority(high/mid/low), status(todo/doing/done), estimate}
      notes: [],         // {id, title, subject, tags[], content, createdAt, updatedAt}
      cards: [],         // {id, question, answer, subject, createdAt}
      pomodoros: [],     // {id, startAt, minutes, type(focus/break)}
      exams: [],         // {id, title, type(exam/homework/event/important), date(YYYY-MM-DD), time, note, status(upcoming/done), createdAt}
      grades: [],        // {id, subject, name, score, credit, semester}
      skills: [],        // {id, name, level(1-100)}
      projects: [],      // {id, name, role, desc, link, start, end}
      literature: [],    // {id, title, authors, journal, year, doi, tags[], notes, favorite, createdAt}
      running: [],       // {id, type(run/half/full), date, distanceKm, durationMin, pace, avgHr, cadence, maxHr, calories, elevationGain, source, note, recordId, importedAt}
      supervisorSessions: [], // {id, startAt, minutes, completed, violations, warnings, presenceRate, postureScore, events}
      trash: []          // {id, entityKey, item, deletedAt}
    };
    // 本地配置（local-config.js，含用户 API Key，不随仓库发布）
    if (window.LOCAL_CONFIG) {
      d.settings.baseUrl = window.LOCAL_CONFIG.baseUrl || d.settings.baseUrl;
      d.settings.apiKey = window.LOCAL_CONFIG.apiKey || d.settings.apiKey;
      d.settings.model = window.LOCAL_CONFIG.model || d.settings.model;
    }
    return d;
  };

  let data = null;
  const ARRAY_KEYS = ["courses", "tasks", "notes", "cards", "pomodoros", "exams", "grades", "skills", "projects", "literature", "running", "supervisorSessions", "trash"];
  let lastError = "";
  let firstRun = false;

  function storageGet(key) {
    try { return localStorage.getItem(key); }
    catch (e) { lastError = "浏览器存储不可用"; return null; }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      lastError = e && e.name === "QuotaExceededError" ? "本地空间不足，请先导出数据或清理旧缓存" : "本地数据保存失败";
      console.error("[星屿]", lastError, e);
      return false;
    }
  }

  function storageRemove(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }

  function isRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value);
  }

  function normalizeData(parsed) {
    if (!isRecord(parsed)) throw new Error("数据格式不正确");
    const base = defaults();
    const normalized = base;
    normalized.schemaVersion = SCHEMA_VERSION;
    normalized.profile = Object.assign({}, base.profile, isRecord(parsed.profile) ? parsed.profile : {});
    normalized.settings = Object.assign({}, base.settings, isRecord(parsed.settings) ? parsed.settings : {});
    ARRAY_KEYS.forEach(key => {
      normalized[key] = Array.isArray(parsed[key]) ? parsed[key] : [];
    });
    normalized.courses = normalized.courses.filter(isRecord);
    normalized.tasks = normalized.tasks.filter(isRecord);
    normalized.notes = normalized.notes.filter(isRecord);
    normalized.cards = normalized.cards.filter(isRecord);
    normalized.pomodoros = normalized.pomodoros.filter(isRecord);
    normalized.grades = normalized.grades.filter(isRecord);
    normalized.skills = normalized.skills.filter(isRecord);
    normalized.projects = normalized.projects.filter(isRecord);
    normalized.literature = normalized.literature.filter(isRecord);
    normalized.running = normalized.running.filter(isRecord);
    normalized.supervisorSessions = normalized.supervisorSessions.filter(isRecord);
    normalized.trash = normalized.trash.filter(isRecord).filter(entry => {
      const ts = new Date(entry.deletedAt || 0).getTime();
      return ts && Date.now() - ts < 30 * 86400000;
    });
    return normalized;
  }

  const saveHooks = [];
  const deleteHooks = [];

  /* ---------- 本机实时状态同步（防止 WebView2 / 端口变化后丢数据） ---------- */
  const SERVER_SYNC_ENABLED = location.protocol === "http:" || location.protocol === "https:";
  const LOCAL_STATE_ENABLED = SERVER_SYNC_ENABLED;
  const SYNC_CURSOR_KEY = "xingyu_server_sync_cursor";
  const DEVICE_ID_KEY = "xingyu_device_id";
  let stateSaveTimer = 0;
  let stateSaveInFlight = false;
  let stateSaveQueued = false;
  let syncReady = false;
  let suppressServerSync = false;
  let syncPulling = false;
  let syncPushing = false;
  let syncPushQueued = false;
  let syncPullTimer = 0;

  function canUseLocalStateServer() { return SERVER_SYNC_ENABLED; }

  // 本地最近一次真实写入的时间（毫秒）。用于阻止服务端轮询把用户"刚改还没推上去"
  // 的数据覆盖掉：推送有 700ms 防抖，这期间若发生拉取，服务端快照内容更旧、
  // 但时间戳可能比本地游标新，就会把刚保存的改动整包回滚（深审计 2026-09-05 实锤）。
  let localDirtyAt = 0;

  function buildStateEnvelope(stamp) {
    return JSON.stringify({
      data: JSON.parse(exportAll({ includeSecrets: true })),
      updatedAt: stamp || Date.now()
    });
  }

  async function saveStateToServer() {
    if (!canUseLocalStateServer()) return;
    if (stateSaveInFlight) { stateSaveQueued = true; return; }
    stateSaveInFlight = true;
    const stamp = Date.now();
    try {
      const response = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: buildStateEnvelope(stamp)
      });
      if (!response.ok) throw new Error("state save failed: " + response.status);
      // 推送成功后必须推进本地游标：否则下一次 12s 轮询会认为"服务端更新"，
      // 把这份内容相同、时间戳更新的快照导回来，用户期间的改动就被静默回滚。
      writeSyncCursor(stamp);
    } catch (error) {
      console.warn("[星屿] 实时状态保存失败", error);
    } finally {
      stateSaveInFlight = false;
      if (stateSaveQueued) {
        stateSaveQueued = false;
        setTimeout(() => { void saveStateToServer(); }, 200);
      }
    }
  }

  function scheduleServerStateSave() {
    if (!canUseLocalStateServer() || !syncReady || suppressServerSync) return;
    clearTimeout(stateSaveTimer);
    stateSaveTimer = setTimeout(() => { void saveStateToServer(); }, 700);
  }

  function flushServerStateSave() {
    if (!canUseLocalStateServer() || !syncReady || suppressServerSync) return;
    clearTimeout(stateSaveTimer);
    try {
      navigator.sendBeacon("/api/state", new Blob([buildStateEnvelope()], { type: "application/json" }));
    } catch (error) {
      console.warn("[星屿] 实时状态 flush 失败", error);
    }
  }


  function getDeviceId() {
    try {
      let id = localStorage.getItem(DEVICE_ID_KEY);
      if (!id) {
        id = "dev-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
        localStorage.setItem(DEVICE_ID_KEY, id);
      }
      return id;
    } catch (e) {
      return "dev-unknown";
    }
  }

  function readSyncCursor() {
    try { return Number(localStorage.getItem(SYNC_CURSOR_KEY) || 0); }
    catch (e) { return 0; }
  }

  function writeSyncCursor(value) {
    try {
      const stamp = Number(value || 0);
      if (stamp > readSyncCursor()) localStorage.setItem(SYNC_CURSOR_KEY, String(stamp));
    } catch (e) {}
  }

  async function pushCurrentSnapshot(force = false) {
    if (!canUseLocalStateServer() || !syncReady || suppressServerSync) return false;
    if (syncPushing) { syncPushQueued = true; return false; }
    syncPushing = true;
    try {
      const response = await fetch("/api/sync/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: buildStateEnvelope()
      });
      if (!response.ok) throw new Error("sync push failed: " + response.status);
      const payload = await response.json();
      const serverStamp = payload && payload.serverUpdatedAt ? new Date(payload.serverUpdatedAt).getTime() : payload.updatedAt;
      if (serverStamp) writeSyncCursor(serverStamp);
      return true;
    } catch (error) {
      console.warn("[星屿] 服务器同步推送失败", error);
      if (force) window.dispatchEvent(new CustomEvent("xingyu:sync-error", { detail: { message: "数据同步失败" } }));
      return false;
    } finally {
      syncPushing = false;
      if (syncPushQueued) {
        syncPushQueued = false;
        setTimeout(() => { void pushCurrentSnapshot(false); }, 200);
      }
    }
  }

  async function pullServerSnapshot(force = false) {
    if (!canUseLocalStateServer() || suppressServerSync || syncPushing) return false;
    if (syncPulling) return false;
    syncPulling = true;
    try {
      const response = await fetch("/api/data/bootstrap", { cache: "no-store" });
      if (!response.ok) throw new Error("sync pull failed: " + response.status);
      const snapshot = await response.json();
      const stamp = Number(snapshot.serverUpdatedAt ? new Date(snapshot.serverUpdatedAt).getTime() : (snapshot.updatedAt || 0));
      const cursor = readSyncCursor();
      // 本地刚改过（含推送防抖窗口内）→ 先别拉，保住用户刚保存的改动
      if (!force && localDirtyAt && (Date.now() - localDirtyAt) < 3000) return false;
      if (!force && stamp && stamp <= cursor) return true;
      if (!snapshot.hasData) return false;
      suppressServerSync = true;
      const previousError = lastError;
      const ok = importAll(JSON.stringify(snapshot));
      suppressServerSync = false;
      lastError = previousError;
      if (!ok) throw new Error("server snapshot import failed");
      clearTimeout(stateSaveTimer);
      writeSyncCursor(stamp || Date.now());
      try { window.dispatchEvent(new CustomEvent("xingyu:server-synced", { detail: { at: stamp } })); } catch (e) {}
      return true;
    } catch (error) {
      suppressServerSync = false;
      console.warn("[星屿] 服务器同步拉取失败", error);
      return false;
    } finally {
      syncPulling = false;
    }
  }

  function startServerSyncPolling() {
    if (!canUseLocalStateServer()) return;
    clearTimeout(syncPullTimer);
    syncPullTimer = setInterval(() => { void pullServerSnapshot(false); }, 12000);
  }

  async function initializeServerSync() {
    if (!canUseLocalStateServer()) return;
    try {
      const pulled = await pullServerSnapshot(true);
      syncReady = true;
      if (!pulled) await pushCurrentSnapshot(true);
    } catch (error) {
      syncReady = true;
      console.warn("[星屿] 初始同步失败", error);
    } finally {
      startServerSyncPolling();
    }
  }

  function load() {
    lastError = "";
    let hadStoredData = false;
    try {
      const raw = storageGet(KEY);
      if (raw) {
        hadStoredData = true;
        const parsed = JSON.parse(raw);
        data = normalizeData(parsed);
        // 若本地存储未配置 AI Key，但存在本地配置文件，则自动填充（方便使用且不上传密钥）
        if (window.LOCAL_CONFIG && (!data.settings.apiKey || data.settings.apiKey === "LOCAL")) {
          data.settings.apiKey = window.LOCAL_CONFIG.apiKey || data.settings.apiKey;
          data.settings.baseUrl = window.LOCAL_CONFIG.baseUrl || data.settings.baseUrl;
          data.settings.model = window.LOCAL_CONFIG.model || data.settings.model;
          save();
        }
        return;
      }
    } catch (e) {
      lastError = "本地数据损坏，已创建新的数据空间";
      const raw = storageGet(KEY);
      if (raw) storageSet(CORRUPT_KEY_PREFIX + Date.now(), raw);
      storageRemove(KEY);
      console.warn("[星屿] 数据加载失败，已隔离损坏数据", e);
    }
    firstRun = !hadStoredData;
    data = defaults();
    // 首次使用，写入示例数据
    seedDemo();
  }

  // 写入失败提示节流：配额写满时高频 save 会连续失败，提示需限流避免刷屏
  let lastStorageWarn = 0;
  function notifyStorageFailure() {
    const now = Date.now();
    if (now - lastStorageWarn < 60000) return;
    lastStorageWarn = now;
    try {
      window.dispatchEvent(new CustomEvent("xingyu:storage-error", {
        detail: { message: lastError || "本地数据保存失败" }
      }));
    } catch (e) {
      console.error("[星屿]", lastError);
    }
  }

  function save() {
    if (!data) data = defaults();
    data.schemaVersion = SCHEMA_VERSION;
    prunePomodoros(); // 归档超量番茄记录，防主键无限增长
    const ok = storageSet(KEY, JSON.stringify(data));
    // 本地刚写过：记下脏时间戳，供服务端拉取判断"别把新改动覆盖掉"
    localDirtyAt = Date.now();
    // 调用方大多忽略返回值（19 处裸调用），这里主动派发事件让 UI 提示，
    // 否则 localStorage 写满时数据静默丢失，用户完全无感知。
    if (!ok) notifyStorageFailure();
    saveHooks.forEach(fn => { try { fn(); } catch (e) { console.warn("save hook 错误", e); } });
    return ok;
  }

  /* ---------- pomodoros 归档（2026-08-29） ----------
     番茄记录只增不减，数年后主键体积可观。超过阈值时把最旧的记录
     移入独立归档键（保留全部历史，主键恒定在阈值内）。 */
  const POMODORO_ARCHIVE_KEY = "xingyu_pomodoros_archive";
  const POMODORO_KEEP = 600;       // 主键保留最近 600 条
  const POMODORO_TRIGGER = 800;    // 超过 800 条才触发归档，避免频繁搬移
  function prunePomodoros() {
    if (!data || !Array.isArray(data.pomodoros) || data.pomodoros.length <= POMODORO_TRIGGER) return;
    const sorted = data.pomodoros.slice().sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
    const overflow = sorted.slice(0, sorted.length - POMODORO_KEEP);
    data.pomodoros = sorted.slice(-POMODORO_KEEP);
    try {
      const prev = JSON.parse(storageGet(POMODORO_ARCHIVE_KEY) || "[]");
      if (Array.isArray(prev)) {
        storageSet(POMODORO_ARCHIVE_KEY, JSON.stringify(prev.concat(overflow)));
        console.info("[星屿] 番茄记录已归档", overflow.length, "条");
      }
    } catch (e) {
      console.warn("[星屿] 番茄记录归档失败（保留在主数据中）", e);
      data.pomodoros = overflow.concat(data.pomodoros); // 归档失败则还原
    }
  }
  function getPomodoroArchive() {
    try {
      const arr = JSON.parse(storageGet(POMODORO_ARCHIVE_KEY) || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function onSave(fn) { saveHooks.push(fn); }
  function onDelete(fn) { deleteHooks.push(fn); }

  function seedDemo() {
    const today = new Date();
    const d = (offset) => {
      const t = new Date(today);
      t.setDate(t.getDate() + offset);
      return t.toISOString();
    };

    data.courses = [
      { id: uid(), name: "高等数学", teacher: "李老师", day: 1, start: "08:00", end: "09:40", location: "教学楼A-301", color: "var(--course-1)" },
      { id: uid(), name: "数据结构", teacher: "王老师", day: 1, start: "10:00", end: "11:40", location: "实验楼B-201", color: "var(--course-2)" },
      { id: uid(), name: "大学英语", teacher: "陈老师", day: 2, start: "08:00", end: "09:40", location: "教学楼C-105", color: "var(--course-3)" },
      { id: uid(), name: "操作系统", teacher: "赵老师", day: 3, start: "14:00", end: "15:40", location: "实验楼B-105", color: "var(--course-4)" },
      { id: uid(), name: "线性代数", teacher: "李老师", day: 4, start: "10:00", end: "11:40", location: "教学楼A-502", color: "var(--course-5)" },
      { id: uid(), name: "计算机网络", teacher: "孙老师", day: 5, start: "08:00", end: "09:40", location: "实验楼B-301", color: "var(--course-1)" },
    ];

    data.tasks = [
      { id: uid(), title: "高数第三章课后习题", courseId: data.courses[0].id, due: d(2), priority: "high", status: "todo", estimate: 90 },
      { id: uid(), title: "数据结构实验报告", courseId: data.courses[1].id, due: d(3), priority: "mid", status: "doing", estimate: 120 },
      { id: uid(), title: "英语听力练习 Unit 4", courseId: data.courses[2].id, due: d(5), priority: "low", status: "todo", estimate: 30 },
      { id: uid(), title: "操作系统复习第一章", courseId: data.courses[3].id, due: d(1), priority: "high", status: "todo", estimate: 60 },
      { id: uid(), title: "线代矩阵作业", courseId: data.courses[4].id, due: d(-1), priority: "mid", status: "done", estimate: 45 },
    ];

    data.notes = [
      { id: uid(), title: "高数：极限与连续", subject: "高等数学", tags: ["高数", "极限"], content: "1. 极限的定义：ε-δ 语言\n2. 两个重要极限\n3. 无穷小与无穷大\n4. 连续函数性质：介值定理、最值定理", createdAt: d(-2), updatedAt: d(-2) },
      { id: uid(), title: "数据结构：二叉树遍历", subject: "数据结构", tags: ["树", "遍历"], content: "先序：根-左-右\n中序：左-根-右\n后序：左-右-根\n层次：队列实现\n\n应用：表达式树、哈夫曼树", createdAt: d(-4), updatedAt: d(-1) },
      { id: uid(), title: "英语作文模板整理", subject: "大学英语", tags: ["英语", "作文"], content: "开头：Nowadays, ... has become a hot topic.\n正文：First and foremost, ... Moreover, ...\n结尾：In conclusion, ...", createdAt: d(-6), updatedAt: d(-3) },
    ];

    data.cards = [
      { id: uid(), question: "两个重要极限是什么？", answer: "① lim(x→0) sinx/x = 1\n② lim(x→∞) (1+1/x)^x = e", subject: "高等数学", createdAt: d(-1) },
      { id: uid(), question: "二叉树中序遍历特点？", answer: "左子树 → 根节点 → 右子树。对二叉搜索树进行中序遍历会得到有序序列。", subject: "数据结构", createdAt: d(-1) },
      { id: uid(), question: "TCP 三次握手过程？", answer: "① 客户端发送 SYN\n② 服务端回复 SYN+ACK\n③ 客户端发送 ACK，建立连接", subject: "计算机网络", createdAt: d(0) },
    ];

    data.grades = [
      { id: uid(), subject: "高等数学", name: "期中考试", score: 88, credit: 5, semester: "2026春" },
      { id: uid(), subject: "大学英语", name: "期中考试", score: 92, credit: 3, semester: "2026春" },
      { id: uid(), subject: "数据结构", name: "单元测试", score: 85, credit: 4, semester: "2026春" },
    ];

    data.skills = [
      { id: uid(), name: "Python", level: 75 },
      { id: uid(), name: "Java", level: 60 },
      { id: uid(), name: "数据分析", level: 55 },
      { id: uid(), name: "英语", level: 70 },
    ];

    data.projects = [
      { id: uid(), name: "校园二手交易小程序", role: "开发", desc: "基于微信小程序的校园二手交易平台，实现商品发布、搜索、聊天功能。", link: "", start: "2026-03", end: "2026-05" },
    ];

    save();
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ---------- 通用 CRUD ---------- */
  function getAll(key) { return Array.isArray(data[key]) ? data[key] : []; }
  function add(key, item) {
    if (!ARRAY_KEYS.includes(key) || !isRecord(item)) return null;
    if (!Array.isArray(data[key])) data[key] = [];
    if (!item.id) item.id = uid();
    data[key].push(item);
    save();
    return item;
  }
  function update(key, id, patch) {
    if (!ARRAY_KEYS.includes(key) || !isRecord(patch)) return null;
    const idx = data[key].findIndex(x => x.id === id);
    if (idx > -1) {
      data[key][idx] = Object.assign({}, data[key][idx], patch);
      save();
      return data[key][idx];
    }
    return null;
  }
  function remove(key, id, options = {}) {
    if (!ARRAY_KEYS.includes(key) || key === "trash") return null;
    const item = data[key].find(x => x.id === id);
    if (!item) return null;
    let trashEntry = null;
    if (!options.permanent) {
      trashEntry = {
        id: uid(),
        entityKey: key,
        item: JSON.parse(JSON.stringify(item)),
        deletedAt: new Date().toISOString()
      };
      data.trash.unshift(trashEntry);
      data.trash = data.trash.slice(0, 200);
    }
    data[key] = data[key].filter(x => x.id !== id);
    save();
    if (trashEntry) deleteHooks.forEach(fn => { try { fn(trashEntry); } catch (e) {} });
    return trashEntry;
  }
  function replaceAll(key, items) {
    if (!ARRAY_KEYS.includes(key)) return;
    data[key] = Array.isArray(items) ? items.filter(isRecord) : [];
    save();
  }

  /* ---------- 便捷方法 ---------- */
  function getProfile() { return data.profile; }
  function setProfile(p) { data.profile = Object.assign(data.profile, p); save(); }
  function getSettings() { return data.settings; }
  function setSettings(s) { data.settings = Object.assign(data.settings, s); save(); }

  function getCourseName(courseId) {
    const c = data.courses.find(x => x.id === courseId);
    return c ? c.name : "";
  }

  function exportAll(options = {}) {
    const snapshot = JSON.parse(JSON.stringify(data));
    snapshot.schemaVersion = SCHEMA_VERSION;
    if (!options.includeSecrets && snapshot.settings) snapshot.settings.apiKey = "";
    // 归档的番茄记录并入导出/备份，确保备份完整可恢复
    const archive = getPomodoroArchive();
    if (archive.length) snapshot.pomodoros = archive.concat(snapshot.pomodoros || []);
    return JSON.stringify(snapshot, null, 2);
  }
  function importAll(json) {
    try {
      const parsed = JSON.parse(json);
      const currentSettings = data && isRecord(data.settings) ? data.settings : defaults().settings;
      data = normalizeData(parsed);
      if (!parsed.settings || !parsed.settings.apiKey) data.settings.apiKey = currentSettings.apiKey || "";
      save();
      return true;
    } catch (e) {
      lastError = "导入失败：JSON 数据格式不正确";
      return false;
    }
  }
  function clearAll() {
    const backup = JSON.parse(JSON.stringify(data));
    if (backup.settings) backup.settings.apiKey = "";
    const backupKey = KEY + "_backup_" + Date.now();
    storageSet(backupKey, JSON.stringify(backup));
    try {
      const backups = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(KEY + "_backup_")) backups.push(key);
      }
      backups.sort().slice(0, -3).forEach(storageRemove);
    } catch (e) {}
    data = defaults();
    save();
  }

  function getTrash() {
    return data.trash.slice();
  }

  function restoreTrash(trashId) {
    const index = data.trash.findIndex(entry => entry.id === trashId);
    if (index < 0) return null;
    const entry = data.trash[index];
    if (!ARRAY_KEYS.includes(entry.entityKey) || entry.entityKey === "trash" || !isRecord(entry.item)) return null;
    const item = Object.assign({}, entry.item);
    if (data[entry.entityKey].some(existing => existing.id === item.id)) item.id = uid();
    data[entry.entityKey].push(item);
    data.trash.splice(index, 1);
    save();
    return { key: entry.entityKey, item };
  }

  function emptyTrash() {
    data.trash = [];
    save();
  }

  function getStorageInfo() {
    return { key: KEY, schemaVersion: SCHEMA_VERSION, lastError, healthy: !lastError, firstRun };
  }

  onSave(scheduleServerStateSave);
  window.addEventListener("pagehide", flushServerStateSave);

  // 2026-09-03 修复：此前 initializeServerSync 在 IIFE 外被调用，
  // 每次页面加载都抛 "initializeServerSync is not defined"。移回作用域内。
  void initializeServerSync();

  return { load, save, onSave, onDelete, uid, getAll, add, update, remove, replaceAll,
           getProfile, setProfile, getSettings, setSettings, getCourseName,
           exportAll, importAll, clearAll, getStorageInfo, getTrash, restoreTrash, emptyTrash };
})();

Store.load();


