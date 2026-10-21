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

test("officers page shows the 2026 president and a photo for every officer", async ({ page }) => {
  await page.goto("/officers");
  await expect(page.getByText("Jaime Cortes Altavas — 2026 Local Organization President")).toBeVisible();
  await expect(page.locator(".officer .initials")).toHaveCount(0);
  await expect(page.locator(".officer", { hasText: "Judy Daliva" }).locator("img")).toHaveAttribute("alt", "Judy Daliva");
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

test("site heading styles do not leak into the Clerk sign-in card", async ({ page }) => {
  await page.goto("/sign-in");
  const title = page.locator(".cl-headerTitle");
  await expect(title).toBeVisible({ timeout: 15_000 });
  const style = await title.evaluate((el) => {
    const s = getComputedStyle(el);
    return { size: parseFloat(s.fontSize), transform: s.textTransform };
  });
  expect(style.size).toBeLessThan(32);
  expect(style.transform).not.toBe("uppercase");
});

test.describe("public pages load no Clerk script", () => {
  for (const path of STATIC_ROUTES) {
    test(`${path}`, async ({ page }) => {
      const clerk = [];
      page.on("request", (req) => {
        if (/clerk\.|accounts\.dev/.test(new URL(req.url()).hostname)) clerk.push(req.url());
      });
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(clerk).toEqual([]);
    });
  }
});

const ARTICLE = "/articles/bonifacio-day-history-and-meaning";

test(`${ARTICLE} is indexable, has Article data and no clipping`, async ({ page }) => {
  const res = await page.goto(ARTICLE);
  expect(res.status()).toBe(200);
  await expect(page.locator("h1")).toHaveCount(1);
  const types = await page.$$eval('script[type="application/ld+json"]', (els) => els.map((e) => JSON.parse(e.textContent)["@type"]));
  expect(types).toContain("Article");
  await page.setViewportSize({ width: 375, height: 812 });
  const overflow = await page.evaluate(() =>
    [...document.querySelectorAll("h1, h2, p")].filter((el) => el.scrollWidth > el.clientWidth + 1).length,
  );
  expect(overflow).toBe(0);
});

test("draft articles are not public and not in the sitemap", async ({ page, request }) => {
  const res = await page.goto("/articles/unfinished-draft");
  expect(res.status()).toBe(404);
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain(ARTICLE);
  expect(sitemap).not.toContain("unfinished-draft");
});

test("project cards open project pages", async ({ page }) => {
  await page.goto("/projects");
  await page.getByRole("link", { name: /Coastline Cuts/ }).click();
  await expect(page).toHaveURL(/\/projects\/coastline-cuts$/);
  await expect(page.locator("h1")).toHaveText("Coastline Cuts");
});

test("the article admin requires sign-in", async ({ page }) => {
  await page.goto("/admin/articles");
  await expect(page).toHaveURL(/sign-in/);
});

test("the upload route refuses signed-out callers", async ({ request }) => {
  const res = await request.post("/api/upload", {
    data: { type: "blob.generate-client-token", payload: { pathname: "a.jpg", callbackUrl: "http://localhost:3100/api/upload", clientPayload: null, multipart: false } },
  });
  expect(res.status()).toBe(403);
});

const EVENT = "/events/general-assembly-2027";

test(`${EVENT} has Event data, a calendar file and passes page checks`, async ({ page, request }) => {
  const res = await page.goto(EVENT);
  expect(res.status()).toBe(200);
  await expect(page.locator("h1")).toHaveCount(1);
  const types = await page.$$eval('script[type="application/ld+json"]', (els) => els.map((e) => JSON.parse(e.textContent)["@type"]));
  expect(types).toContain("Event");
  const ics = await request.get(`${EVENT}/ics`);
  expect(ics.headers()["content-type"]).toContain("text/calendar");
  expect(await ics.text()).toContain("DTSTART:20990115T100000Z");
});

test("RSVP: first person goes, the same email is a duplicate, the next joins the waitlist", async ({ page }) => {
  const rsvp = async (name, email) => {
    await page.goto(EVENT);
    await page.getByLabel("Name").first().fill(name);
    await page.getByLabel("Email").first().fill(email);
    await page.locator("#rsvp").getByRole("checkbox").check();
    await page.locator("#rsvp").getByRole("button", { name: /RSVP/ }).click();
  };
  await rsvp("Ana Cruz", "ana.e2e@example.ph");
  await expect(page.locator("#rsvp").getByRole("status")).toContainText("You're going!");
  await rsvp("Ana Cruz", "ANA.E2E@example.ph");
  await expect(page.locator("#rsvp").getByRole("alert")).toContainText("already on the list");
  await rsvp("Ben Reyes", "ben.e2e@example.ph");
  await expect(page.locator("#rsvp").getByRole("status")).toContainText("waitlist");
});

test("membership application shows a confirmation", async ({ page }) => {
  await page.goto("/join");
  const form = page.locator("#apply");
  await form.getByLabel("Full name").fill("Carla Santos");
  await form.getByLabel("Email").fill("carla.e2e@example.ph");
  await form.getByLabel("Birthdate").fill("1999-05-05");
  await form.getByRole("checkbox").check();
  await form.getByRole("button", { name: "Apply" }).click();
  await expect(form.getByRole("status")).toContainText("We received your application");
});

test("pledge form shows the campaign and a confirmation", async ({ page }) => {
  await page.goto("/support");
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  const form = page.locator("#pledge");
  await form.getByLabel("Name").fill("Dino Reyes");
  await form.getByLabel("Email").fill("dino.e2e@example.ph");
  await form.getByLabel("Amount (₱)").fill("500");
  await form.getByLabel("Reference number").fill("e2e0001");
  await form.getByRole("checkbox").check();
  await form.getByRole("button", { name: "Submit payment details" }).click();
  await expect(form.getByRole("status")).toContainText("confirm your payment");
});

test("engagement admin screens require sign-in", async ({ page }) => {
  for (const path of ["/admin/applications", "/admin/events", "/admin/payments", "/admin/campaigns", "/admin/expenses"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/sign-in/);
  }
});

test.describe("Hiligaynon pages", () => {
  for (const path of ["/hil", "/hil/join", "/hil/events", "/hil/support"]) {
    test(`${path} is a well-formed Hiligaynon page`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res.status()).toBe(200);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator('[lang="hil"]').first()).toBeVisible();
      const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
      expect(new URL(canonical).pathname).toBe(path);
    });
  }

  test("English pages point to their Hiligaynon twins", async ({ page }) => {
    await page.goto("/join");
    const hil = await page.locator('link[rel="alternate"][hreflang="hil"]').getAttribute("href");
    expect(new URL(hil).pathname).toBe("/hil/join");
    await expect(page.getByRole("link", { name: "Hiligaynon" })).toBeVisible();
  });

  test("the Hiligaynon application form uses Hiligaynon labels", async ({ page }) => {
    await page.goto("/hil/join");
    await expect(page.locator("#apply").getByLabel("Bug-os nga ngalan")).toBeVisible();
  });
});

test("members area requires sign-in", async ({ page }) => {
  for (const path of ["/members", "/members/profile", "/members/directory", "/members/passport", "/members/library", "/members/events", "/admin/members", "/admin/passport"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/sign-in/);
  }
});

test("the avatar upload route refuses signed-out callers", async ({ request }) => {
  const res = await request.post("/api/upload-avatar", {
    data: { type: "blob.generate-client-token", payload: { pathname: "a.jpg", callbackUrl: "http://localhost:3100/api/upload-avatar", clientPayload: null, multipart: false } },
  });
  expect(res.status()).toBe(403);
});
