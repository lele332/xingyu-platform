/* ============================================================
   idb.js — IndexedDB 存储层（数据镜像 + 大容量恢复）
   - 用途：突破 localStorage 5MB 上限；localStorage 被清时自动恢复
   - 数据：以 JSON 字符串存入 kv store（与 localStorage 同构）
   - 安全：写入时由调用方剔除敏感字段（apiKey 等）
   ============================================================ */
const Idb = (() => {
  const DB_NAME = "xingyu-db";
  const DB_VERSION = 1;
  const STORE = "kv";
  const KEY_DATA = "xingyu_data";

  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      try {
        if (!window.indexedDB) { reject(new Error("IndexedDB 不可用")); return; }
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE)) {
            db.createObjectStore(STORE); // keyPath 默认：用 key 参数
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error("打开 IndexedDB 失败"));
      } catch (e) { reject(e); }
    });
    return dbPromise;
  }

  // 写入（key 默认 KEY_DATA）
  function set(value, key) {
    return open().then(db => new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(value, key || KEY_DATA);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      } catch (e) { reject(e); }
    })).catch(() => false); // 失败静默（不影响主流程）
  }

  // 读取
  function get(key) {
    return open().then(db => new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(key || KEY_DATA);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      } catch (e) { reject(e); }
    })).catch(() => null);
  }

  // 删除
  function remove(key) {
    return open().then(db => new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(key || KEY_DATA);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      } catch (e) { reject(e); }
    })).catch(() => false);
  }

  return { set, get, remove };
})();
