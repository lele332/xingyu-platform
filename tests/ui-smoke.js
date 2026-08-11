const { spawn } = require("child_process");
const path = require("path");
const http = require("http");
const { chromium } = require("playwright-core");

const root = path.resolve(__dirname, "..");
const port = 8769;
const base = `http://127.0.0.1:${port}/`;
const views = ["dashboard", "courses", "focus", "weather", "notes", "lit", "news", "growth", "ai"];
const edge = process.env.EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const python = process.env.PYTHON || "python";

function waitForServer() {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const poll = () => {
      http.get(`${base}__xingyu_health__`, response => {
        response.resume();
        if (response.statusCode === 200) resolve();
        else retry();
      }).on("error", retry);
    };
    const retry = () => {
      if (Date.now() - started > 10000) reject(new Error("本地测试服务器启动超时"));
      else setTimeout(poll, 180);
    };
    poll();
  });
}

async function inspect(browser, viewport, colorScheme) {
  const page = await browser.newPage({ viewport, colorScheme });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("zero_onboarded_v3", "1");
  });
  await page.goto(base, { waitUntil: "networkidle" });
  if (await page.locator("#splashSkip").isVisible().catch(() => false)) await page.locator("#splashSkip").click();
  const results = [];
  for (const view of views) {
    if (viewport.width <= 900) {
      if (["dashboard", "courses", "notes", "focus"].includes(view)) {
        await page.locator(`[data-mobile-view="${view}"]`).click();
      } else {
        await page.locator('[data-mobile-view="more"]').click();
        await page.locator(`.nav-item[data-view="${view}"]`).click();
      }
    } else {
      await page.locator(`.nav-item[data-view="${view}"]`).click();
    }
    await page.waitForTimeout(100);
    results.push(await page.evaluate(expected => ({
      expected,
      actual: document.querySelector(".view.active")?.id,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }), view));
  }
  await page.close();
  return { viewport, colorScheme, errors, results };
}

async function checkProductFeatures(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: "light" });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => localStorage.clear());
  await page.goto(base, { waitUntil: "networkidle" });
  if (await page.locator("#splashSkip").isVisible().catch(() => false)) await page.locator("#splashSkip").click();
  await page.waitForTimeout(650);
  const onboardingShown = await page.locator("#onboardingModal").evaluate(el => el.classList.contains("show"));
  await page.locator("#btnSkipOnboarding").click();

  const originalTaskCount = await page.evaluate(() => Store.getAll("tasks").length);
  await page.evaluate(() => Store.remove("tasks", Store.getAll("tasks")[0].id));
  const trashAfterDelete = await page.evaluate(() => Store.getTrash().length);
  await page.locator(".toast-action").last().click();
  const restoredTaskCount = await page.evaluate(() => Store.getAll("tasks").length);

  await page.locator('.nav-item[data-view="ai"]').click();
  const notesBefore = await page.evaluate(() => Store.getAll("notes").length);
  await page.locator("#chatInput").fill("帮我制定一个今天的学习计划");
  await page.locator("#btnChatSend").click();
  await page.waitForFunction(() => document.querySelector("#btnChatSend")?.disabled === false);
  const saveAction = page.locator('[data-chat-action="save"]').last();
  const aiActionsShown = await saveAction.isVisible();
  if (aiActionsShown) await saveAction.click();
  const notesAfter = await page.evaluate(() => Store.getAll("notes").length);

  await page.locator("#btnSettings").click();
  await page.locator('[data-theme-pick="system"]').click();
  const themeMode = await page.evaluate(() => document.documentElement.dataset.themeMode);

  const iconBackground = await page.locator(".logo-icon").evaluate(el => getComputedStyle(el).backgroundImage);
  await page.close();
  return {
    onboardingShown,
    trashAfterDelete,
    undoRestored: restoredTaskCount === originalTaskCount,
    aiActionsShown,
    aiSavedNote: notesAfter === notesBefore + 1,
    themeMode,
    iconLoaded: iconBackground.includes("xingyu-app-icon-256.png"),
    errors,
  };
}

(async () => {
  const server = spawn(python, ["server.py", String(port)], { cwd: root, windowsHide: true, stdio: "ignore" });
  let browser;
  try {
    await waitForServer();
    browser = await chromium.launch({ executablePath: edge, headless: true });
    const groups = [
      await inspect(browser, { width: 1440, height: 1000 }, "light"),
      await inspect(browser, { width: 1440, height: 1000 }, "dark"),
      await inspect(browser, { width: 390, height: 844 }, "dark"),
    ];
    const features = await checkProductFeatures(browser);
    console.log(JSON.stringify({ groups, features }, null, 2));
    const failed = groups.some(group =>
      group.errors.length ||
      group.results.some(result => result.actual !== `view-${result.expected}` || result.overflowX > 1)
    ) || features.errors.length || !features.onboardingShown || features.trashAfterDelete !== 1 ||
      !features.undoRestored || !features.aiActionsShown || !features.aiSavedNote ||
      features.themeMode !== "system" || !features.iconLoaded;
    if (failed) process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
