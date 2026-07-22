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

test("public Supabase selection loads the active case", async ({ page }) => {
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
  await page.getByRole("button", { name: "Cho em thêm thời gian" }).click();
  await page.getByLabel("Lời nhắn cho người xin lỗi").click();
  await expect(page.getByLabel("Lời nhắn cho người xin lỗi")).toBeFocused();
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

test("recipient message is capped at 300 characters and keeps a clear selection", async ({ page }) => {
  await page.goto("http://127.0.0.1:8766/cases/case-002.html");
  await page.locator("#open-case").click();
  const food = page.getByRole("button", { name: "Đền bằng đồ ăn đi" });
  await food.click();
  await expect(food).toHaveAttribute("aria-pressed", "true");
  const textarea = page.getByLabel("Lời nhắn cho người xin lỗi");
  await textarea.fill("á".repeat(350));
  await expect(textarea).toHaveValue("á".repeat(300));
  await expect(page.locator(".feedback-form small")).toHaveText("300/300");
});

test("failed feedback request preserves text and re-enables submit", async ({ page }) => {
  await page.route("**/rest/v1/rpc/submit_case_response", (route) => route.abort("internetdisconnected"));
  await page.goto("http://127.0.0.1:8766/cases/case-001.html");
  await page.locator("#openBtn").click();
  await page.getByRole("button", { name: "Cho em thêm thời gian" }).click();
  const textarea = page.getByLabel("Lời nhắn cho người xin lỗi");
  const message = "Anh nhớ lần sau đã nhận lời thì đặt báo thức liền nha.";
  await textarea.fill(message);
  const send = page.getByRole("button", { name: "Gửi phản hồi" });
  await send.click();
  await expect(page.locator(".feedback-result")).toContainText("nội dung vẫn được giữ lại");
  await expect(textarea).toHaveValue(message);
  await expect(send).toBeEnabled();
});

for (const viewport of [
  { width: 360, height: 800 }, { width: 412, height: 915 }, { width: 768, height: 1024 },
  { width: 1366, height: 768 }, { width: 1920, height: 1080 },
]) {
  test(`feedback stays interactive at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("http://127.0.0.1:8766/cases/case-002.html");
    await page.locator("#open-case").click();
    await page.getByRole("button", { name: "Đền bằng đồ ăn đi" }).click();
    const textarea = page.getByLabel("Lời nhắn cho người xin lỗi");
    await textarea.click();
    await expect(textarea).toBeFocused();
    const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(width.scroll).toBeLessThanOrEqual(width.client + 1);
  });
}

for (const testCase of [
  { name: "case 001", path: "case-001.html", open: "#openBtn" },
  { name: "case 002", path: "case-002.html", open: "#open-case" },
]) {
  test(`textarea receives pointer, keyboard and Vietnamese input in ${testCase.name}`, async ({ page }) => {
    await page.goto(`http://127.0.0.1:8766/cases/${testCase.path}`);
    await page.locator(testCase.open).click();
    await page.getByRole("button", { name: "Cho em thêm thời gian" }).click();
    const textarea = page.getByLabel("Lời nhắn cho người xin lỗi");
    await textarea.scrollIntoViewIfNeeded();
    const hitTarget = await textarea.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      const style = getComputedStyle(element);
      return { tag: target?.tagName, isTextarea: target === element, pointerEvents: style.pointerEvents, visibility: style.visibility, display: style.display, disabled: element.disabled, readOnly: element.readOnly, tabIndex: element.tabIndex };
    });
    expect(hitTarget).toMatchObject({ tag: "TEXTAREA", isTextarea: true, pointerEvents: "auto", visibility: "visible", disabled: false, readOnly: false, tabIndex: 0 });
    await textarea.click({ position: { x: 20, y: 20 } });
    await expect(textarea).toBeFocused();
    await textarea.pressSequentially("Anh nhớ đừng quên lần sau nha — em vẫn còn giận xíu.");
    await expect(textarea).toHaveValue("Anh nhớ đừng quên lần sau nha — em vẫn còn giận xíu.");
    await expect(page.locator(".feedback-form small")).toHaveText("52/300");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Gửi phản hồi" })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(textarea).toBeFocused();
  });
}

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
