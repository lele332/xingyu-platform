const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const path = require("path");

function reply(data, etag = '"v1"', status = 200) {
  return { ok: status < 300, status, headers: { get: () => etag }, json: async () => data };
}
async function setup() {
  const memory = new Map();
  const timers = new Map();
  let id = 0;
  const snapshot = { schemaVersion: 3, profile: {}, settings: {}, notes: [
    { id: "n1", content: "original" }
  ], hasData: true, updatedAt: "2026-09-15T01:00:00.000Z" };
  memory.set("xingyu_platform_v1", JSON.stringify(snapshot));
  const calls = [];
  const ctx = {
    console: { warn() {}, error() {}, info() {} },
    AbortController, Blob, Date, Promise,
    location: { protocol: "http:" },
    window: { addEventListener() {}, dispatchEvent() {} },
    navigator: { sendBeacon() { throw Error("clean state must not beacon"); } },
    CustomEvent: class { constructor(name, options) { this.type = name; this.detail = options; } },
    localStorage: {
      getItem: k => memory.get(k) || null,
      setItem: (k, v) => memory.set(k, String(v)),
      removeItem: k => memory.delete(k),
      key: i => [...memory.keys()][i],
      get length() { return memory.size; }
    },
    setTimeout: (fn, ms) => { timers.set(++id, { fn, ms }); return id; },
    clearTimeout: i => timers.delete(i),
    setInterval: () => ++id,
    fetch: async (url, options) => {
      calls.push({ url, options });
      return reply(snapshot);
    }
  };
  const source = fs.readFileSync(path.join(__dirname, "../js/store.js"), "utf8")
    .replace("return { load, save, onSave", `globalThis.probe = {
      pullServerSnapshot, saveStateToServer, flushServerStateSave,
      pending: hasPendingChanges, dirtyAt: () => { localDirtyAt = 0; }
    }; return { load, save, onSave`);
  vm.createContext(ctx);
  vm.runInContext(source + "\nglobalThis.store = Store;", ctx);
  for (let i = 0; i < 15; i++) await Promise.resolve();
  return { ctx, calls, timers, snapshot, memory };
}

(async () => {
  {
    const { ctx, calls } = await setup();
    assert(!ctx.probe.pending(), "server import is not a local edit");
    ctx.fetch = async (url, options) => {
      calls.push({ url, options });
      assert.equal(options.headers["If-None-Match"], '"v1"');
      return reply(null, '"v1"', 304);
    };
    assert(await ctx.probe.pullServerSnapshot());
    ctx.probe.flushServerStateSave(); // no unnecessary write on clean page exit
  }
  {
    const { ctx, snapshot } = await setup();
    let finish;
    ctx.fetch = () => new Promise(resolve => { finish = resolve; });
    const pulling = ctx.probe.pullServerSnapshot();
    ctx.store.update("notes", "n1", { content: "new local edit" });
    finish(reply(snapshot, '"v2"'));
    assert.equal(await pulling, false, "stale response must not replace an in-flight edit");
    assert.equal(ctx.store.getAll("notes")[0].content, "new local edit");
  }
  {
    const { ctx, timers } = await setup();
    ctx.store.update("notes", "n1", { content: "offline edit" });
    ctx.fetch = async () => { throw Error("offline"); };
    await ctx.probe.saveStateToServer();
    assert(ctx.probe.pending(), "failed save stays pending");
    assert([...timers.values()].some(t => t.ms === 1000), "retry scheduled");
    ctx.probe.dirtyAt();
    let pulls = 0;
    ctx.fetch = async () => { pulls++; };
    assert.equal(await ctx.probe.pullServerSnapshot(), false);
    assert.equal(pulls, 0, "no overwrite after old three-second dirty window expires");
    ctx.fetch = async () => reply({ serverUpdatedAt: "2026-09-15T02:00:00Z" });
    await ctx.probe.saveStateToServer();
    assert(!ctx.probe.pending(), "successful retry acknowledges edit");
  }
  {
    const { ctx } = await setup();
    ctx.store.update("notes", "n1", { content: "first" });
    let finish;
    ctx.fetch = () => new Promise(resolve => { finish = resolve; });
    const saving = ctx.probe.saveStateToServer();
    ctx.store.update("notes", "n1", { content: "second" });
    finish(reply({ serverUpdatedAt: "2026-09-15T02:00:00Z" }));
    await saving;
    assert(ctx.probe.pending(), "old acknowledgement cannot clear newer edits");
  }
  console.log("Store sync race/retry/304 tests OK");
})().catch(err => { console.error(err); process.exitCode = 1; });
