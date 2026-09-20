/* kb-smoke.js —— 专业课程知识库前端冒烟。
   校验：视图可切换、课程列表与条目能渲染、公式能渲染、无运行时异常、无横向溢出。
   需要先在 8800 端口起一个服务： .venv-native/Scripts/python.exe server.py 8800 */
const path = require("path");
const { chromium } = require("playwright-core");

const root = path.resolve(__dirname, "..");
const base = process.env.KB_BASE || "http://127.0.0.1:8800/";
const edge = process.env.EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

function assert(cond, msg) {
  if (!cond) throw new Error("断言失败: " + msg);
  console.log("  ✓ " + msg);
}

(async () => {
  const browser = await chromium.launch({ executablePath: edge, headless: true });
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });

  await page.addInitScript(() => {
    if (window.top === window.self) {
      try {
        localStorage.setItem("zero_onboarded_v4", "1");
      } catch (e) { }
    }
  });
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const skip = page.locator("#splashSkip");
  if (await skip.isVisible().catch(() => false)) await skip.click({ timeout: 1500 }).catch(() => {});

  console.log("[1] 切换到专业课程库");
  await page.click('.nav-item[data-view="kb"]');
  await page.waitForTimeout(1200);
  assert(await page.locator("#view-kb").isVisible(), "课程库视图可见");

  const n = await page.locator("#kbSubjectList .kb-subj").count();
  assert(n >= 9, `课程列表渲染 ${n} 门课（>=9）`);

  console.log("[2] 打开章节地图");
  const chCount = await page.locator("#kbPanel details.kb-ch").count();
  assert(chCount > 0, `章节地图渲染 ${chCount} 章`);

  console.log("[3] 切到公式卡");
  await page.click('.kb-tab[data-tab="formula"]');
  await page.waitForTimeout(1500);
  const fCount = await page.locator("#kbPanel .kb-item").count();
  assert(fCount > 0, `公式卡渲染 ${fCount} 条`);
  const texCount = await page.locator("#kbPanel .kb-formula").count();
  assert(texCount > 0, `公式渲染 ${texCount} 个`);

  console.log("[4] 切到题型卡");
  await page.click('.kb-tab[data-tab="exercise"]');
  await page.waitForTimeout(1500);
  const eCount = await page.locator("#kbPanel .kb-item").count();
  assert(eCount > 0, `题型卡渲染 ${eCount} 条`);

  console.log("[5] 全库检索");
  await page.fill("#kbSearchInput", "横向分布系数");
  await page.click("#kbSearchBtn");
  await page.waitForTimeout(1800);
  const sCount = await page.locator("#kbPanel .kb-item").count();
  assert(sCount > 0, `检索命中 ${sCount} 条`);

  console.log("[6] 布局与异常");
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  assert(!overflow, "1280px 无横向溢出");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  const overflowMobile = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  assert(!overflowMobile, "390px 无横向溢出");

  assert(errors.length === 0, "无运行时错误" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(root, "data", "kb-smoke.png"), fullPage: false });
  console.log("\n截图: data/kb-smoke.png");
  await browser.close();
  console.log("\nKB SMOKE PASS");
})().catch(async e => {
  console.error("\nKB SMOKE FAIL:", e.message);
  process.exit(1);
});
