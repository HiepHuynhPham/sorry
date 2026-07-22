const { test, expect } = require("@playwright/test");

test("case builder exposes the four validated creation steps", async ({ page }) => {
  await page.goto("http://127.0.0.1:8766/admin.html");
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    document.querySelector("#login-panel").hidden = true;
    document.querySelector("#dashboard").hidden = false;
    document.querySelectorAll(".admin-view").forEach((view) => (view.hidden = true));
    document.querySelector("#view-create").hidden = false;
  });
  await expect(page.locator("#case-builder")).toBeVisible();
  await expect(page.locator("#case-builder fieldset")).toHaveCount(4);
  await expect(page.locator(".builder-progress span")).toHaveCount(4);
  await page.locator('[name="case_number"]').fill("003");
  await page.locator('[name="recipient_name"]').fill("Ý");
  await page.locator('[name="title"]').fill("Một lời xin lỗi mới");
  await page.locator('[name="short_description"]').fill("Anh muốn nói lời xin lỗi thật lòng.");
  await page.locator('[name="incident"]').fill("Anh đã quên gọi đúng giờ.");
  await page.locator("#builder-next").click();
  await expect(page.locator('fieldset[data-step="2"]')).toBeVisible();
});

test("dynamic renderer treats database content as text", async ({ page }) => {
  const item = {
    id: 3,
    slug: "case-003",
    case_number: "003",
    recipient_display_name: "Ý",
    title: '<img src=x onerror="window.__dynamicXss=true">',
    short_description: "Một hồ sơ được tạo từ dashboard.",
    content: {
      hero_title: "Anh muốn xin lỗi em",
      hero_body: "Một lời giải thích ngắn.",
      serious_note: "Anh hiểu chuyện này nghiêm túc.",
      apology: "Anh xin lỗi.",
      signature: "Hiệp",
      final_question: "Em còn giận không?",
      modal_text: "Cảm ơn em.",
    },
    theme: { illustration: "bear", primary_color: "#d9688c" },
    audio_settings: { enabled: false, music_volume: 0.12, effect_volume: 0.2 },
    dodge_limit: 3,
    status: "draft",
  };
  await page.route("**/rest/v1/cases?*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(item) }),
  );
  await page.goto("http://127.0.0.1:8766/cases/case-dynamic.html?id=3");
  await expect(page.locator("#intro-title")).toHaveText(item.title);
  await expect(page.locator("#intro-title img")).toHaveCount(0);
  expect(await page.evaluate(() => window.__dynamicXss)).toBeUndefined();
  await page.locator("#open-case").click();
  await expect(page.locator("#intro")).toHaveClass(/hide/);
  await page.locator("#forgive").click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
