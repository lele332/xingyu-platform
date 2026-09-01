const path = require("path");
const { spawn } = require("child_process");
const http = require("http");
const { chromium } = require("playwright-core");

const root = path.resolve(__dirname, "..");
const port = 8773;
const base = `http://127.0.0.1:${port}/`;
const python = process.env.PYTHON || "python";
const edge = process.env.EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

function waitForServer() {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const poll = () => {
      http.get(`${base}__xingyu_health__`, response => {
        response.resume();
        if (response.statusCode === 200) resolve();
        else retry();
      }).on("error", retry);
    };
    const retry = () => Date.now() - start > 10000 ? reject(new Error("server timeout")) : setTimeout(poll, 150);
    poll();
  });
}

async function main() {
  const server = spawn(python, ["server.py", String(port)], { cwd: root, windowsHide: true, stdio: "ignore" });
  const browser = await chromium.launch({ executablePath: edge, headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: "dark" });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    await waitForServer();
    await page.addInitScript(() => {
      if (window.top !== window.self) return;
      if (!sessionStorage.getItem("pomo_test_initialized")) {
        localStorage.clear();
        localStorage.setItem("zero_onboarded_v3", "1");
        sessionStorage.setItem("pomo_test_initialized", "1");
      }
    });
    await page.goto(base, { waitUntil: "networkidle" });
    if (await page.locator("#splashSkip").isVisible().catch(() => false)) {
      await page.locator("#splashSkip").click();
    }
    await page.locator('[data-mobile-view="focus"]').click();
    await page.waitForTimeout(200);

    // 2 分钟番茄：61 秒后暂停，应记录 1 分钟部分专注。
    await page.locator("#pomoWork").fill("2");
    await page.locator("#pomoBreak").fill("1");
    await page.locator("#pomoWork").dispatchEvent("change");
    await page.locator("#pomoBreak").dispatchEvent("change");

    await page.locator("#btnPomoStart").click();
    const runningText = await page.locator("#pomoMode").textContent();
    const overlayDisplay = await page.locator("#focusOverlay").evaluate(el => el.style.display);
    await page.waitForTimeout(62000);
    const beforePauseTime = await page.locator("#pomoTime").textContent();

    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    await page.locator("#btnPomoStart").click();
    await page.waitForTimeout(250);
    const pausedText = await page.locator("#pomoMode").textContent();
    const pausedTime = await page.locator("#pomoTime").textContent();
    await page.waitForTimeout(700);
    const pausedStableTime = await page.locator("#pomoTime").textContent();
    const partialState = await page.evaluate(() => ({
      records: Store.getAll("pomodoros"),
      partialCount: Store.getAll("pomodoros").filter(p => p.type === "focus" && p.completed === false).length
    }));

    // 继续按钮应从暂停位置继续，而不是重置。
    await page.locator("#btnPomoStart").click();
    const resumedText = await page.locator("#pomoMode").textContent();
    await page.waitForTimeout(1100);
    const resumedTime = await page.locator("#pomoTime").textContent();

    // 重置会保留已记录的部分专注。
    await page.locator("#btnPomoReset").click();
    const afterReset = await page.locator("#pomoTime").textContent();
    const state = await page.evaluate(() => ({
      records: Store.getAll("pomodoros"),
      partialCount: Store.getAll("pomodoros").filter(p => p.type === "focus" && p.completed === false).length
    }));

    const result = {
      runningText,
      overlayDisplay,
      beforePauseTime,
      pausedText,
      pausedTime,
      pausedStableTime,
      partialState,
      resumedText,
      resumedTime,
      afterReset,
      state,
      errors
    };
    console.log(JSON.stringify(result, null, 2));
    const failed =
      errors.length ||
      !runningText.includes("专注") ||
      overlayDisplay !== "block" ||
      pausedTime !== pausedStableTime ||
      !pausedText.includes("已暂停") ||
      partialState.partialCount !== 1 ||
      partialState.records[0]?.completed !== false ||
      !resumedText.includes("专注") ||
      resumedTime === pausedTime ||
      afterReset !== "02:00" ||
      state.partialCount !== 1;
    if (failed) process.exitCode = 1;
  } finally {
    await browser.close();
    server.kill();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
