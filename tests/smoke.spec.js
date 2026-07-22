const { test, expect } = require("@playwright/test");

test("public fallback preserves case 001", async ({ page }) => {
  await page.goto("http://127.0.0.1:8766/");
  const frame = page.frameLocator("#case-frame");
  await expect(frame.locator("#intro")).toBeVisible();
  await expect(frame.locator("#confetti")).toBeAttached();
  await expect(frame.locator("#progress")).toBeAttached();
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

test("admin stays hidden without Supabase configuration", async ({ page }) => {
  await page.goto("http://127.0.0.1:8766/admin.html");
  await expect(page.locator("#login-panel")).toBeVisible();
  await expect(page.locator("#dashboard")).toBeHidden();
  await expect(page.locator("#login-message")).toContainText("chưa được cấu hình");
});
