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
      if (!sessionStorage.getItem("pomo_test_initialized")) {
        localStorage.clear();
        localStorage.setItem("zero_onboarded_v3", "1");
        sessionStorage.setItem("pomo_test_initialized", "1");
      }
    });
    await page.goto(base, { waitUntil: "networkidle" });
    if (await page.locator("#splashSkip").isVisible().catch(() => false)) await page.locator("#splashSkip").click();
    await page.locator('[data-mobile-view="focus"]').click();
    await page.waitForTimeout(200);

    await page.locator("#pomoWork").fill("1");
    await page.locator("#pomoBreak").fill("1");
    await page.locator("#pomoWork").dispatchEvent("change");
    await page.locator("#pomoBreak").dispatchEvent("change");
    await page.locator("#btnPomoStart").click();
    const runningText = await page.locator("#pomoMode").textContent();
    const focusModeOpened = await page.locator("#focusMode").evaluate(el => el.classList.contains("is-open"));
    await page.waitForTimeout(1200);
    const afterOneSecond = await page.locator("#pomoTime").textContent();

    await page.locator("#btnFocusModeToggle").click();
    const pausedText = await page.locator("#pomoMode").textContent();
    const pausedTime = await page.locator("#pomoTime").textContent();
    await page.waitForTimeout(700);
    const pausedStableTime = await page.locator("#pomoTime").textContent();
    const beforeReload = await page.evaluate(() => ({
      prefs: localStorage.getItem("xingyu_pomo_prefs_v1"),
      session: localStorage.getItem("xingyu_pomo_session_v2"),
      current: { ...window.__debugPomo || {} }
    }));

    await page.locator("#btnFocusModeToggle").click();
    await page.reload({ waitUntil: "networkidle" });
    const sessionBeforeFocusClick = await page.evaluate(() => localStorage.getItem("xingyu_pomo_session_v2"));
    if (await page.locator("#splashSkip").isVisible().catch(() => false)) await page.locator("#splashSkip").click();
    await page.waitForFunction(() => document.querySelector("#focusMode")?.classList.contains("is-open"));
    const runningRestoreOpened = await page.locator("#focusMode").evaluate(el => el.classList.contains("is-open"));
    await page.locator("#btnFocusModeToggle").click();
    await page.keyboard.press("Escape");
    await page.locator('[data-mobile-view="focus"]').click();
    const restoredTime = await page.locator("#pomoTime").textContent();
    const afterReload = await page.evaluate(() => ({
      prefs: localStorage.getItem("xingyu_pomo_prefs_v1"),
      session: localStorage.getItem("xingyu_pomo_session_v2"),
      work: document.querySelector("#pomoWork")?.value,
      mode: document.querySelector("#pomoMode")?.textContent
    }));

    await page.locator("#btnPomoStart").click();
    const focusModeReopened = await page.locator("#focusMode").evaluate(el => el.classList.contains("is-open"));
    await page.keyboard.press("Escape");
    const focusModeClosed = await page.locator("#focusMode").evaluate(el => !el.classList.contains("is-open"));
    const escapedMode = await page.locator("#pomoMode").textContent();

    await page.locator("#btnPomoReset").click();
    const afterReset = await page.locator("#pomoTime").textContent();
    const state = await page.evaluate(() => ({
      pomos: Store.getAll("pomodoros"),
      mode: document.querySelector("#pomoRing")?.dataset.mode,
      progress: document.querySelector("#pomoRing")?.style.getPropertyValue("--progress"),
      localSession: localStorage.getItem("xingyu_pomo_session_v2")
    }));

    const result = {
      runningText,
      focusModeOpened,
      focusModeReopened,
      focusModeClosed,
      escapedMode,
      runningRestoreOpened,
      afterOneSecond,
      pausedText,
      pausedTime,
      pausedStableTime,
      restoredTime,
      beforeReload,
      afterReload,
      sessionBeforeFocusClick,
      afterReset,
      state,
      errors
    };
    console.log(JSON.stringify(result, null, 2));
    if (
      errors.length ||
      !runningText.includes("专注") ||
      !focusModeOpened ||
      !focusModeReopened ||
      !focusModeClosed ||
      !runningRestoreOpened ||
      !escapedMode.includes("暂停") ||
      pausedTime !== pausedStableTime ||
      Math.abs(
        Number(restoredTime.split(":")[0]) * 60 + Number(restoredTime.split(":")[1]) -
        (Number(pausedTime.split(":")[0]) * 60 + Number(pausedTime.split(":")[1]))
      ) > 2 ||
      afterReset !== "01:00" ||
      state.pomos.length !== 0 ||
      state.mode !== "work"
    ) process.exitCode = 1;
  } finally {
    await browser.close();
    server.kill();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
