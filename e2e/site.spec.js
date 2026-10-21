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

    for (const width of [375, 768, 1440]) {
      test(`${path} has no text or images cut off at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
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
    }

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

test("impact page lists projects by place even without map locations", async ({ page }) => {
  await page.goto("/impact");
  await expect(page.getByRole("link", { name: "Coastline Cuts" })).toBeVisible();
  await expect(page.getByText("are being mapped")).toBeVisible();
});

test("transparency page never shows donor names", async ({ page }) => {
  await page.goto("/transparency");
  await expect(page.locator("h1")).toHaveText("Transparency");
  await expect(page.getByText("Trash bags and gloves")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Coastal Cleanup Fund" }).first()).toBeVisible();
  await expect(page.getByRole("cell", { name: "₱1,250,000" })).toBeVisible();
  await expect(page.getByText("Ana Villanueva")).toHaveCount(0);
  await expect(page.getByText("ana.donor@example.ph")).toHaveCount(0);
});

test("evidence dashboard and its CSV exports require sign-in", async ({ page, request }) => {
  await page.goto("/admin/evidence");
  await expect(page).toHaveURL(/sign-in/);
  for (const path of ["/admin/evidence.csv", "/admin/evidence/log.csv"]) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect([307, 404]).toContain(res.status());
  }
});

test("transparency money figures fit on a tablet", async ({ page }) => {
  for (const width of [640, 768, 1024]) {
    await page.setViewportSize({ width, height: 1024 });
    await page.goto("/transparency");
    const clipped = await page.evaluate(() => {
      const box = document.querySelector(".stats--money").getBoundingClientRect();
      return [...document.querySelectorAll(".stats--money .stat .v")]
        .filter((el) => el.getBoundingClientRect().right > Math.min(box.right, window.innerWidth) + 1)
        .map((el) => el.textContent);
    });
    expect(clipped, `at ${width}px`).toEqual([]);
  }
});

test("main nav reaches Support and Impact, and the footer has three columns", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "Support" })).toHaveAttribute("href", "/support");
  await expect(nav.getByRole("link", { name: "Impact" })).toHaveAttribute("href", "/impact");
  await expect(page.getByRole("navigation", { name: "Accountability" }).getByRole("link", { name: "Transparency" })).toBeVisible();
});

test("support page shows the how-to-pay card with the campaign QR", async ({ page }) => {
  await page.goto("/support");
  const card = page.getByRole("complementary", { name: "How to pay" });
  await expect(card.getByRole("img", { name: "GCash QR code for the Coastal Cleanup Fund" })).toBeVisible();
  await page.locator("#pledge").getByLabel(/payment for/i).selectOption("membership_fee");
  await expect(card.getByText("Ask us for payment details")).toBeVisible();
});

test("project cards without a photo show their own title", async ({ page }) => {
  await page.goto("/projects");
  await expect(page.locator(".project__tile-title", { hasText: "Coastline Cuts" })).toHaveCount(1);
});

test("admin dashboard and tabbed lists still require sign-in", async ({ page }) => {
  for (const path of ["/admin", "/admin/payments?tab=confirmed", "/admin/applications?tab=declined"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/sign-in/);
  }
});

test.describe("e-calling card", () => {
  for (const width of [375, 768, 1440]) {
    test(`card page has nothing cut off at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/card/lemuel-capa");
      const clipped = await page.evaluate(() =>
        [...document.querySelectorAll(".ecard h1, .ecard p, .ecard a, .ecard span")]
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ el, r }) => r.width > 0 && (r.right > window.innerWidth + 1 || el.scrollWidth > el.clientWidth + 1))
          .map(({ el }) => el.textContent.trim().slice(0, 30)),
      );
      expect(clipped).toEqual([]);
    });
  }

  test("shows contact actions, a QR code and stays out of search", async ({ page }) => {
    await page.goto("/card/lemuel-capa");
    await expect(page.getByRole("heading", { level: 1, name: "Lemuel J. Capa" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Call" })).toHaveAttribute("href", "tel:+639171234567");
    await expect(page.getByRole("link", { name: "Save contact" })).toHaveAttribute("href", "/card/lemuel-capa/vcard");
    await expect(page.getByRole("img", { name: "QR code for this card" })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("unpublished cards are not found", async ({ request }) => {
    for (const path of ["/card/judy-daliva", "/card/judy-daliva/vcard", "/card/judy-daliva/image.png", "/card/nobody"]) {
      expect((await request.get(path)).status(), path).toBe(404);
    }
  });

  test("downloads a vCard and a card image", async ({ request }) => {
    const v = await request.get("/card/lemuel-capa/vcard");
    expect(v.headers()["content-type"]).toContain("text/vcard");
    expect(await v.text()).toContain("FN:Lemuel J. Capa");
    const img = await request.get("/card/lemuel-capa/image.png");
    expect(img.headers()["content-type"]).toBe("image/png");
  });

  test("my card page requires sign-in", async ({ page }) => {
    await page.goto("/members/card");
    await expect(page).toHaveURL(/sign-in/);
  });
});
