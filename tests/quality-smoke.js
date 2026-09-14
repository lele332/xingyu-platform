const { chromium } = require("playwright-core");

const BASE = process.env.XINGYU_URL || "http://127.0.0.1:8620";
const STRICT = process.env.XINGYU_SMOKE_STRICT === "1";
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/snap/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/* ⚠️ 2026-09-14：这条用例在 GitHub Actions 上连续红了 7 天（09-09 ~ 09-14）。
   不是平台代码坏了，是运行环境不具备：ubuntu runner 上既没有 CHROME_CANDIDATES
   里那些 Windows 路径的 Chrome，也没有 127.0.0.1:8620 的平台服务，
   playwright-core 又不会自己下载浏览器 -> launch 必炸 -> npm run check 必红。
   一直红的 CI 等于没有 CI（没人再看它）。现在改成「环境不具备就大声跳过」：
   原因写进日志和 $GITHUB_STEP_SUMMARY，能跑的地方照样全量断言、照样会红。
   本机想强制不许跳过：set XINGYU_SMOKE_STRICT=1 */
function skipOrFail(reason) {
  const line = "SKIP quality-smoke: " + reason;
  console.warn(line);
  if (process.env.GITHUB_STEP_SUMMARY) {
    try { require("fs").appendFileSync(process.env.GITHUB_STEP_SUMMARY, "> ⚠️ " + line + "\n"); } catch (e) {}
  }
  if (STRICT) {
    console.error("XINGYU_SMOKE_STRICT=1：不允许跳过");
    process.exit(1);
  }
  process.exit(0);
}

function findBrowser() {
  const fs = require("fs");
  const hit = CHROME_CANDIDATES.find(p => {
    try { return fs.existsSync(p); } catch (e) { return false; }
  });
  if (hit) return hit;
  const exe = process.platform === "win32" ? "where" : "which";
  for (const name of ["google-chrome", "chromium", "chromium-browser", "chrome", "msedge"]) {
    try {
      const r = require("child_process").spawnSync(exe, [name], { encoding: "utf8" });
      if (r.status === 0 && r.stdout.trim()) return r.stdout.trim().split(/\r?\n/)[0];
    } catch (e) {}
  }
  return undefined;
}

function probeBase() {
  return new Promise(resolve => {
    let settled = false;
    const done = v => { if (!settled) { settled = true; resolve(v); } };
    try {
      const u = new URL(BASE.replace(/\/$/, "") + "/index.html");
      const mod = u.protocol === "https:" ? require("https") : require("http");
      const req = mod.get(u, { timeout: 4000 }, res => { res.resume(); done(res.statusCode < 500); });
      req.on("error", () => done(false));
      req.on("timeout", () => { try { req.destroy(); } catch (e) {} done(false); });
    } catch (e) { done(false); }
  });
}

(async () => {
  const executablePath = findBrowser();
  if (!executablePath) {
    skipOrFail("未找到 Chrome/Chromium（查过 " + CHROME_CANDIDATES.length + " 个候选路径 + PATH）");
  }
  if (!(await probeBase())) {
    skipOrFail("平台服务在 " + BASE + " 无响应（先启动 server.py，或用 XINGYU_URL 指定地址）");
  }
  const browser = await chromium.launch({ headless: true, executablePath });

  for (const width of [360, 390, 768, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: Math.max(680, Math.round(width * .72)) } });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", err => pageErrors.push(err.message));
    await page.addInitScript(() => {
      localStorage.setItem("zero_onboarded_v4", "1");
      localStorage.setItem("zero_onboarded_v3", "1");
      localStorage.setItem("zero_icon_style", "classic");
    });
    await page.goto(`${BASE}/index.html`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2400);

    const state = await page.evaluate(() => ({
      hOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      navIcons: document.querySelectorAll(".nav-item svg.xy-icon").length,
      navBars: [...document.querySelectorAll(".mobile-tabbar,.mobile-nav")].filter(n => getComputedStyle(n).display !== "none").length,
      perfTrend: !!(window.XYPerf && window.XYPerf.healthSummary),
    }));
    assert(!state.hOverflow, `${width}px 出现横向溢出`);
    assert(state.navIcons >= 20, `${width}px 导航图标不足`);
    assert(state.perfTrend, `${width}px 性能趋势模块未加载`);
    if (width <= 900) assert(state.navBars === 1, `${width}px 移动端底部导航重复`);
    assert(pageErrors.length === 0, `${width}px 页面错误: ${pageErrors.join(" | ")}`);
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 900, height: 720 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem("zero_onboarded_v4", "1");
    localStorage.setItem("zero_onboarded_v3", "1");
  });
  await page.goto(`${BASE}/index.html`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2400);
  await page.evaluate(() => document.getElementById("btnSettings").click());
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('[data-settings-tab="system"]').click());
  await page.waitForTimeout(400);
  await page.evaluate(() => document.getElementById("btnOpenFeedback").click());
  await page.waitForTimeout(500);
  const feedback = await page.evaluate(() => ({
    open: !!document.querySelector("#feedbackModal .modal"),
    trendCards: document.querySelectorAll(".fb-trend-item").length,
    rawDetails: !!document.querySelector(".fb-raw"),
  }));
  assert(feedback.open, "反馈面板未打开");
  assert(feedback.trendCards >= 4, "反馈趋势卡不足");
  assert(feedback.rawDetails, "完整诊断区域缺失");
  await context.close();

  const petContext = await browser.newContext({ viewport: { width: 360, height: 540 } });
  const petPage = await petContext.newPage();
  const petErrors = [];
  petPage.on("pageerror", err => petErrors.push(err.message));
  await petPage.goto(`${BASE}/agent-pet.html`, { waitUntil: "domcontentloaded" });
  await petPage.waitForTimeout(3600);
  const pet = await petPage.evaluate(async () => {
    const res = await fetch("/api/pet-context", { cache: "no-store" });
    const data = await res.json();
    return {
      contextOk: res.ok && !!data.context,
      secretLeak: JSON.stringify(data).toLowerCase().includes("apikey"),
      bubble: !!document.getElementById("bubble"),
      proactive: typeof checkProactive === "function",
      hOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });
  assert(pet.contextOk, "宠物上下文接口失败");
  assert(!pet.secretLeak, "宠物上下文泄漏 API key");
  assert(pet.bubble, "宠物气泡缺失");
  assert(pet.proactive, "宠物主动陪伴逻辑缺失");
  assert(!pet.hOverflow, "宠物页横向溢出");
  assert(petErrors.length === 0, `宠物页错误: ${petErrors.join(" | ")}`);
  await petContext.close();

  await browser.close();
  console.log("Quality smoke OK");
})().catch(err => {
  console.error(err.message);
  process.exit(1);
});
