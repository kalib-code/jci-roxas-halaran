import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("photoless project tiles start their text at the left edge", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/projects");
  const tile = page.locator(".project__placeholder").filter({ has: page.locator(".project__tile-title") }).first();
  const [box, pillar] = await Promise.all([tile.boundingBox(), tile.locator(".project__pillar").boundingBox()]);
  expect(pillar.x - box.x).toBeLessThan(40);
});

test("the how-to-pay card stays in view while the form scrolls", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 700 });
  await page.goto("/support");
  const card = page.getByRole("complementary", { name: "How to pay" });
  // Scroll 40px past the point where the card should start sticking (top: 100px).
  await page.evaluate(() => {
    const grid = document.querySelector(".pledge-grid").getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + grid.top - 100 + 40, behavior: "instant" });
  });
  const { y } = await card.boundingBox();
  expect(Math.round(y)).toBe(100);
});

test("the admin sidebar sticks on desktop and leaves no gap on phones", async ({ page }) => {
  const html = (rows) => `<!doctype html><style>${css}</style><body><div class="wrap"><div class="admin-shell">
    <nav class="admin-side"><div class="admin-side__group"><a href="#">Dashboard</a></div></nav>
    <div class="admin-main"><div class="admin"><h1>Dashboard</h1>${"<p>row</p>".repeat(rows)}</div></div></div></div></body>`;

  await page.setViewportSize({ width: 375, height: 812 });
  await page.setContent(html(1));
  const side = await page.locator(".admin-side").boundingBox();
  const main = await page.locator(".admin-main").boundingBox();
  expect(main.y - (side.y + side.height)).toBeLessThan(2);

  await page.setViewportSize({ width: 1440, height: 800 });
  await page.setContent(html(200));
  await page.evaluate(() => window.scrollTo({ top: 1500, behavior: "instant" }));
  expect(Math.round((await page.locator(".admin-side").boundingBox()).y)).toBe(81);
});

test("members can reach Sign out on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.setContent(`<!doctype html><style>${css}</style><body><div class="wrap"><div class="admin-shell members-area">
    <nav class="admin-side"><div class="admin-side__group"><a href="#">Home</a></div>
      <div class="admin-side__foot"><a href="/">View site</a><button type="button" class="tool">Sign out</button></div></nav>
    <div class="admin-main"><div class="admin"><h1>Welcome</h1></div></div></div></div></body>`);
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
});
