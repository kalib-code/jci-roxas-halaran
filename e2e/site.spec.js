import { test, expect } from "@playwright/test";
import { STATIC_ROUTES } from "../lib/routes.js";
import { REDIRECTS } from "../lib/redirects.js";

test.describe("every public page", () => {
  const titles = new Set();

  for (const path of STATIC_ROUTES) {
    test(`${path} is indexable and well formed`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res.status()).toBe(200);
      await expect(page.locator("h1")).toHaveCount(1);

      const title = await page.title();
      expect(title.length).toBeGreaterThan(10);
      expect(titles.has(title)).toBe(false);
      titles.add(title);

      const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
      expect(new URL(canonical).pathname).toBe(path);
      await expect(page.locator('meta[name="description"]')).toHaveCount(1);
    });

    test(`${path} has no text or images cut off on a 375px phone`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(path);
      // .wrap hides overflow, so page scroll width can't reveal clipping:
      // check each visible element's right edge instead.
      const clipped = await page.evaluate(() =>
        [...document.querySelectorAll("h1, h2, h3, p, a, span, time, blockquote, img")]
          .filter((el) => !el.closest("svg"))
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ el, r }) =>
            r.width > 0 && (r.right > window.innerWidth + 1 || el.scrollWidth > el.clientWidth + 1),
          )
          .map(({ el, r }) => `${el.tagName}.${el.className} "${el.textContent.trim().slice(0, 30)}" right=${Math.round(r.right)}`),
      );
      expect(clipped).toEqual([]);
    });

    test(`${path} has no broken images`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const broken = await page.$$eval("img", (imgs) =>
        imgs.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src),
      );
      expect(broken).toEqual([]);
    });
  }
});

test("home page declares the chapter as an NGO", async ({ page }) => {
  await page.goto("/");
  const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
  expect(JSON.parse(ld)["@type"]).toContain("NGO");
});

test("officers page shows the 2026 president and initials for missing photos", async ({ page }) => {
  await page.goto("/officers");
  await expect(page.getByText("Jaime Cortes Altavas — 2026 Local Organization President")).toBeVisible();
  const judy = page.locator(".officer", { hasText: "Judy Daliva" });
  await expect(judy.locator(".initials")).toHaveText("JD");
  await expect(judy.locator("img")).toHaveCount(0);
});

test("sitemap and robots", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const path of STATIC_ROUTES) expect(sitemap).toContain(`http://localhost:3100${path === "/" ? "/" : path}`);
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /admin");
  expect(robots).toContain("Sitemap: http://localhost:3100/sitemap.xml");
});

test.describe("old links", () => {
  for (const r of REDIRECTS) {
    test(`${r.source} redirects permanently to ${r.destination}`, async ({ request }) => {
      const res = await request.get(r.source, { maxRedirects: 0 });
      expect(res.status()).toBe(308);
      expect(new URL(res.headers()["location"], "http://localhost:3100").pathname).toBe(r.destination);
    });
  }

  test("a trailing slash still lands on the right page", async ({ page }) => {
    await page.goto("/about-us/");
    expect(new URL(page.url()).pathname).toBe("/about");
  });
});

test("unknown pages return 404 with a helpful page", async ({ page }) => {
  const res = await page.goto("/no-such-page");
  expect(res.status()).toBe(404);
  await expect(page.locator("h1")).toHaveText("Page not found");
});

test("admin requires sign-in", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/sign-in/);
});
