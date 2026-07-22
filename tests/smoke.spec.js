const { test, expect } = require("@playwright/test");

async function instrumentAudio(page) {
  await page.addInitScript(() => {
    window.__audioTest = { contexts: 0, oscillators: 0 };
    const NativeContext = window.AudioContext || window.webkitAudioContext;
    if (!NativeContext) return;
    class TrackedContext extends NativeContext {
      constructor(...args) { super(...args); window.__audioTest.contexts += 1; }
      createOscillator() {
        const oscillator = super.createOscillator();
        const start = oscillator.start.bind(oscillator);
        oscillator.start = (...args) => { window.__audioTest.oscillators += 1; return start(...args); };
        return oscillator;
      }
    }
    window.AudioContext = TrackedContext;
    window.webkitAudioContext = TrackedContext;
  });
}

test("public Supabase selection preserves active case 001", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  await page.goto("http://127.0.0.1:8766/");
  const frame = page.frameLocator("#case-frame");
  await expect(frame.locator("#intro")).toBeVisible({ timeout: 15000 });
  await expect(frame.locator("#confetti")).toBeAttached();
  await expect(frame.locator("#progress")).toBeAttached();
  expect(errors).toEqual([]);
});

test("case 002 interaction and accessible modal", async ({ page }) => {
  await page.goto("http://127.0.0.1:8766/cases/case-002.html");
  await page.getByRole("button", { name: /MỞ HỒ SƠ/ }).click();
  await expect(page.getByRole("heading", { name: "Anh quên gọi em Ý dậy gòiii!" })).toBeVisible();
  const angry = page.getByRole("button", { name: /VẪN CÒN GIẬN/ });
  await angry.dispatchEvent("pointerenter");
  await angry.dispatchEvent("pointerenter");
  await angry.click();
  await expect(page.locator("#response")).toContainText("không ép em");
  await page.getByRole("button", { name: /HẾT GIẬN RỒI/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".modal-card")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("case 002 mobile does not overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:8766/cases/case-002.html");
  await page.getByRole("button", { name: /MỞ HỒ SƠ/ }).click();
  const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1);
});

test("audio starts only after opening case 001 and can be muted", async ({ page }) => {
  await instrumentAudio(page);
  await page.goto("http://127.0.0.1:8766/cases/case-001.html");
  expect(await page.evaluate(() => window.__audioTest)).toEqual({ contexts: 0, oscillators: 0 });
  await page.locator("#openBtn").click();
  await expect.poll(() => page.evaluate(() => window.__audioTest.oscillators)).toBeGreaterThan(0);
  const control = page.locator(".audio-control");
  await expect(control).toBeVisible();
  await expect(control).toHaveAttribute("aria-pressed", "true");
  await control.click();
  await expect(control).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => localStorage.getItem("sorry-site.audio.muted"))).toBe("true");
});

test("remembered mute prevents case 002 notes", async ({ page }) => {
  await instrumentAudio(page);
  await page.goto("http://127.0.0.1:8766/cases/case-002.html");
  await page.evaluate(() => localStorage.setItem("sorry-site.audio.muted", "true"));
  await page.reload();
  await page.locator("#open-case").click();
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__audioTest.oscillators)).toBe(0);
  await expect(page.locator(".audio-control")).toHaveAttribute("aria-pressed", "false");
});

test("case 002 starts its audio after the open gesture", async ({ page }) => {
  await instrumentAudio(page);
  await page.goto("http://127.0.0.1:8766/cases/case-002.html");
  expect(await page.evaluate(() => window.__audioTest.oscillators)).toBe(0);
  await page.locator("#open-case").click();
  await expect.poll(() => page.evaluate(() => window.__audioTest.oscillators)).toBeGreaterThan(0);
});

test("case remains usable when Web Audio is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "AudioContext", { configurable: true, value: undefined });
    Object.defineProperty(window, "webkitAudioContext", { configurable: true, value: undefined });
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:8766/cases/case-002.html");
  await page.locator("#open-case").click();
  await expect(page.locator("#intro")).toHaveClass(/hide/);
  await expect(page.locator(".audio-control")).toBeVisible();
  expect(errors).toEqual([]);
});

test("recipient feedback keeps message as text and does not inject HTML", async ({ page }) => {
  await page.goto("http://127.0.0.1:8766/cases/case-002.html");
  await page.locator("#open-case").click();
  await page.getByRole("button", { name: "Cho em thêm thời gian" }).click();
  const textarea = page.getByLabel("Lời nhắn cho người xin lỗi");
  await textarea.fill('<img src=x onerror="window.__xss=true">');
  expect(await textarea.inputValue()).toContain("<img");
  expect(await page.locator(".recipient-feedback img").count()).toBe(0);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
});

test("safe mode disables dodge, audio control and complex effects", async ({ page }) => {
  await page.goto("http://127.0.0.1:8766/cases/case-002.html");
  await page.locator("#open-case").click();
  await page.evaluate(() => window.postMessage({ type: "sorry-site:settings", globalAudioEnabled: true, safeMode: true }, location.origin));
  await expect(page.locator("html")).toHaveAttribute("data-safe-mode", "true");
  await expect(page.locator(".audio-control")).toBeDisabled();
  const angry = page.locator("#angry");
  await angry.hover();
  await expect(angry).toHaveCSS("transform", "none");
});

test("anonymous preview is blocked before case data is loaded", async ({ page }) => {
  await page.goto("http://127.0.0.1:8766/preview.html?id=1");
  await expect(page.getByRole("heading", { name: "Không thể mở preview" })).toBeVisible();
  await expect(page.locator("#device-frame")).toBeHidden();
});

test("admin dashboard stays hidden without a session", async ({ page }) => {
  await instrumentAudio(page);
  await page.goto("http://127.0.0.1:8766/admin.html");
  await expect(page.locator("#login-panel")).toBeVisible();
  await expect(page.locator("#dashboard")).toBeHidden();
  expect(await page.evaluate(() => window.__audioTest.contexts)).toBe(0);
  await expect(page.locator(".sidebar")).toContainText("Phản hồi");
});
