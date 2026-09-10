const { chromium } = require("playwright-core");

const BASE = process.env.XINGYU_URL || "http://127.0.0.1:8620";
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
].filter(Boolean);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

(async () => {
  const executablePath = CHROME_CANDIDATES.find(p => {
    try { return require("fs").existsSync(p); } catch { return false; }
  });
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
