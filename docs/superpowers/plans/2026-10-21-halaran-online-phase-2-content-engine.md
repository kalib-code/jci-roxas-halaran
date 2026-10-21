# Halaran Online — Phase 2: Content Engine and Domain Switch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins write, preview and publish articles, project stories and downloadable resources in the site's own admin; public article, project and resource pages go live within seconds; public pages stop loading Clerk; then `jciroxashalaran.com` moves from Webflow to Vercel.

**Architecture:** Content logic lives in plain functions under `lib/content/` that take a Drizzle `db` (tested against in-memory SQLite). Thin server actions under `app/admin/**/actions.js` check the `admin` role, call those functions, and `revalidatePath` the affected public pages. The Tiptap editor and the Vercel Blob uploader are the only new client components. Public pages are server components pre-rendered from Turso.

**Tech Stack:** Next.js 15 App Router (JS), Drizzle + Turso, Clerk v6, Tiptap 2, Vercel Blob 1 (client uploads), sanitize-html, Zod 3, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-21-halaran-online-phase-2-design.md` (parent: `docs/superpowers/specs/2026-10-21-halaran-online-design.md`).

## Global Constraints

- JavaScript only; JSX files use `.jsx`. Follow Phase 1 patterns (`lib/` functions take `db` first; pages use `getDb()`).
- Pinned majors: `@tiptap/*@^2.12`, `@vercel/blob@^1.1`, `zod@^3.25`, `sanitize-html@^2.17`. (Newer majors exist; these are pinned for known APIs.)
- Only the `admin` role may create, edit, publish or upload content. New area `content` = `["admin"]` in `lib/roles.js`. Officers keep the read-only `/admin` home.
- Allowed body HTML: `h2 h3 p br strong em ul ol li a blockquote img`; links http/https/mailto only; external links get `rel="noopener noreferrer"`; images only from `*.public.blob.vercel-storage.com`, the site URL, or site-relative paths.
- Uploads: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`; maximum 10 MB (10 × 1024 × 1024 bytes).
- Meta description 1–160 characters. Slugs come from `slugify` and lock after an item's first publish (articles) or creation (projects).
- Public queries never return draft articles. Projects have no draft state (they stay public as in Phase 1).
- After every content write, revalidate exactly: article → `/articles`, `/articles/<slug>`, `/`, `/sitemap.xml`; project → `/projects`, `/projects/<slug>`, `/`, `/sitemap.xml`; resource → `/resources`.
- Page rules from Phase 1 apply to every new public page: one `<h1>`, unique title/description/canonical, alt text, nothing clipped at 375px.
- Public pages must not load any Clerk script (`*.clerk.accounts.dev`, `*.clerk.com`, `accounts.dev`).
- Performance target: Lighthouse mobile LCP < 2.5 s, Best Practices ≥ 90, SEO ≥ 90, Accessibility ≥ 90 on `/` and one article page.

## Review Focus

- **Content pasted from Word or Google Docs** (inline styles, spans, scripts, `javascript:` links): stored body is clean, allowed formatting survives. → test in Task 3.
- **Keyword case differs between the plan and the article** ("Bonifacio Day" vs "bonifacio day"): publishing still links the plan row. → test in Task 5.
- **Editing the title of a published article:** the slug, and therefore the URL, does not change. → test in Task 5.
- **Unpublishing:** the article disappears from `/articles`, its URL returns 404, and it leaves the sitemap. → tests in Tasks 5 and 12.
- **Uploading an iPhone HEIC photo or a 12 MB file:** refused before upload with a clear message. → test in Task 3.

## File Structure

```
app/
  layout.jsx                      MODIFY: remove ClerkProvider
  sign-in/layout.jsx              CREATE: ClerkProvider for sign-in
  admin/layout.jsx                MODIFY: wrap in ClerkProvider, admin nav
  admin/page.jsx                  MODIFY: dashboard
  admin/articles/page.jsx, new/page.jsx, [id]/page.jsx, [id]/preview/page.jsx, actions.js
  admin/projects/page.jsx, new/page.jsx, [id]/page.jsx, actions.js
  admin/resources/page.jsx, actions.js
  admin/seo-plan/page.jsx, actions.js
  api/upload/route.js             CREATE: Vercel Blob token, admin only
  articles/page.jsx, articles/[slug]/page.jsx
  projects/[slug]/page.jsx
  resources/page.jsx
  page.jsx                        MODIFY: "From the blog" row
  sitemap.js                      MODIFY: async, DB-driven
components/
  ArticleCard.jsx                 public card
  ProjectCard.jsx                 MODIFY: links to project page
  admin/AdminNav.jsx, FileUpload.jsx, RichTextEditor.jsx, GooglePreview.jsx,
  admin/ArticleEditor.jsx, ProjectEditor.jsx, ResourceForm.jsx
lib/
  roles.js                        MODIFY: content area
  auth.js                         requireArea(area)
  sanitize.js                     cleanHtml
  uploads.js                      UPLOAD_TYPES, MAX_UPLOAD_BYTES, checkUpload
  revalidate.js                   pathsForArticle, pathsForProject, RESOURCE_PATHS, revalidateAll
  content/validation.js           CATEGORIES, articleInput, projectInput, resourceInput, publishProblems, hasText
  content/articles.js             save/publish/unpublish + public queries
  content/projects.js             save, photos, getProjectBySlug
  content/resources.js            create, list, delete
  content/seoPlan.js              list, add, setStatus, monthProgress, linkPublishedArticle
  seo.js                          MODIFY: articleLd, buildSitemap({routes, articles, projects})
  routes.js                       MODIFY: /articles, /resources
db/
  schema.js                       MODIFY: articles, seoPlan, resources, projects.bodyJson/updatedAt
  migrations/0001_*.sql           generated
  seed-data.js, seed.js           MODIFY: SEO_PLAN
scripts/prepare-e2e-db.mjs        MODIFY: one published + one draft article
test/ …                           unit tests per lib file
e2e/site.spec.js                  MODIFY
```

---

### Task 1: Load Clerk only where it is used

**Files:**
- Modify: `app/layout.jsx`, `app/admin/layout.jsx`, `e2e/site.spec.js`
- Create: `app/sign-in/layout.jsx`

**Interfaces:**
- Produces: public pages without `ClerkProvider`; `/sign-in` and `/admin` wrapped in `ClerkProvider`.

- [ ] **Step 1: Write the failing e2e test**

Append to `e2e/site.spec.js`:

```js
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
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx playwright test -g "load no Clerk script"`
Expected: FAIL on every route, listing `clerk.accounts.dev` (or similar) URLs.

- [ ] **Step 3: Move `ClerkProvider` out of the root layout**

In `app/layout.jsx` remove the `import { ClerkProvider } from "@clerk/nextjs";` line and replace the returned JSX with:

```jsx
    <html lang="en" className={`${syne.variable} ${spaceGrotesk.variable} ${inter.variable}`}>
      <body>
        <div className="wrap">
          <Nav />
          {children}
        </div>
        <Analytics />
        {process.env.NEXT_PUBLIC_GA_ID && <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />}
      </body>
    </html>
```

Create `app/sign-in/layout.jsx`:

```jsx
import { ClerkProvider } from "@clerk/nextjs";

export default function SignInLayout({ children }) {
  return <ClerkProvider>{children}</ClerkProvider>;
}
```

Overwrite `app/admin/layout.jsx`:

```jsx
import { ClerkProvider } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { canAccess, roleFromSessionClaims } from "@/lib/roles.js";

// Second gate behind middleware.js: the admin area never renders for
// someone without an admin-area role, even if middleware is bypassed.
export default async function AdminLayout({ children }) {
  const { sessionClaims } = await auth();
  if (!canAccess(roleFromSessionClaims(sessionClaims), "admin")) notFound();
  return <ClerkProvider>{children}</ClerkProvider>;
}
```

- [ ] **Step 4: Run the full e2e suite**

Run: `npx playwright test`
Expected: all pass, including the 5 new "load no Clerk script" tests and the Clerk sign-in card test.

- [ ] **Step 5: Commit**

```bash
git add app/layout.jsx app/sign-in/layout.jsx app/admin/layout.jsx e2e/site.spec.js
git commit -m "Load Clerk only on sign-in and admin pages"
```

---

### Task 2: Schema for articles, SEO plan and resources

**Files:**
- Modify: `db/schema.js`, `db/seed-data.js`, `db/seed.js`, `test/seed.test.js`, `test/schema.test.js`
- Create: `db/migrations/0001_content.sql` (generated)

**Interfaces:**
- Produces tables: `articles`, `seoPlan`, `resources`; `projects.bodyJson`, `projects.updatedAt`; `SEO_PLAN` (30 rows) seeded when `seo_plan` is empty.

- [ ] **Step 1: Write the failing tests**

Append inside the `describe("schema", …)` block of `test/schema.test.js`, and add `articles, seoPlan` to its schema import:

```js
  it("rejects duplicate article slugs", async () => {
    const db = await testDb();
    await db.insert(articles).values({ slug: "rizal-day", title: "Rizal Day", updatedAt: "2026-10-21T00:00:00Z" });
    await expect(
      db.insert(articles).values({ slug: "rizal-day", title: "Copy", updatedAt: "2026-10-21T00:00:00Z" }),
    ).rejects.toThrow();
  });

  it("allows a keyword only once per month in the SEO plan", async () => {
    const db = await testDb();
    await db.insert(seoPlan).values({ month: "2026-11", keyword: "rizal day" });
    await db.insert(seoPlan).values({ month: "2026-12", keyword: "rizal day" });
    await expect(db.insert(seoPlan).values({ month: "2026-11", keyword: "rizal day" })).rejects.toThrow();
  });

  it("defaults new articles to draft", async () => {
    const db = await testDb();
    await db.insert(articles).values({ slug: "a", title: "A", updatedAt: "2026-10-21T00:00:00Z" });
    const [row] = await db.select().from(articles);
    expect(row.status).toBe("draft");
  });
```

In `test/seed.test.js`, add `seoPlan` to the schema import and add to the first test:

```js
    expect(await total(db, seoPlan)).toBe(30);
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run test/schema.test.js test/seed.test.js`
Expected: FAIL — `articles`/`seoPlan` are undefined imports.

- [ ] **Step 3: Extend the schema**

In `db/schema.js`, add to `projects` (after `featured`):

```js
  bodyJson: text("body_json"),
  updatedAt: text("updated_at"),
```

Append:

```js
export const articles = sqliteTable("articles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  metaDescription: text("meta_description"),
  targetKeyword: text("target_keyword"),
  category: text("category", { enum: ["capiz", "holidays", "leadership", "business", "community"] })
    .notNull()
    .default("community"),
  bodyJson: text("body_json"),
  bodyHtml: text("body_html"),
  coverUrl: text("cover_url"),
  coverAlt: text("cover_alt"),
  authorId: integer("author_id").references(() => members.id, { onDelete: "set null" }),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  status: text("status", { enum: ["draft", "published"] }).notNull().default("draft"),
  publishedAt: text("published_at"),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by"),
});

export const seoPlan = sqliteTable(
  "seo_plan",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    month: text("month").notNull(),
    keyword: text("keyword").notNull(),
    volume: integer("volume"),
    kd: integer("kd"),
    workingTitle: text("working_title"),
    status: text("status", { enum: ["idea", "drafting", "published"] }).notNull().default("idea"),
    articleId: integer("article_id").references(() => articles.id, { onDelete: "set null" }),
  },
  (t) => [uniqueIndex("seo_plan_month_keyword").on(t.month, t.keyword)],
);

export const resources = sqliteTable("resources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description"),
  fileUrl: text("file_url").notNull(),
  kind: text("kind", { enum: ["template", "training", "bylaws", "other"] }).notNull().default("template"),
  visibility: text("visibility", { enum: ["public", "members"] }).notNull().default("public"),
  createdAt: text("created_at").notNull(),
});
```

- [ ] **Step 4: Generate the migration**

Run: `npx drizzle-kit generate --name content`
Expected: creates `db/migrations/0001_content.sql` with `CREATE TABLE articles`, `seo_plan`, `resources` and two `ALTER TABLE projects ADD` statements.

- [ ] **Step 5: Seed the SEO plan**

Append to `db/seed-data.js`:

```js
// [month, keyword, volume, kd, working title] from the Obsidian note
// "JCI Roxas Halaran — SEO Keyword Plan (10 per month)" (PH data, 2026-10-21).
export const SEO_PLAN = [
  ["2026-11", "halaran festival", 140, 10, "Sinadya sa Halaran festival guide"],
  ["2026-11", "bonifacio day", 14800, 0, "Bonifacio Day (Nov 30): history and meaning"],
  ["2026-11", "rizal day", 12100, 0, "Rizal Day (Dec 30): what Filipinos commemorate"],
  ["2026-11", "roxas city capiz", 27100, 0, "Roxas City, Capiz: a local's guide"],
  ["2026-11", "seafood capital of the philippines", 1600, 4, "Why Roxas City is the Seafood Capital of the Philippines"],
  ["2026-11", "baybay beach roxas city", 3600, 0, "Capiz tourist spots: Baybay Beach, Olotayan Island and more"],
  ["2026-11", "typhoon preparedness", 1000, 0, "Typhoon preparedness checklist for Capiz families"],
  ["2026-11", "anti bullying act", 4400, 0, "The Anti-Bullying Act explained"],
  ["2026-11", "jci philippines", 2400, 30, "What is JCI? JCI in the Philippines"],
  ["2026-11", "project proposal sample", 12100, 6, "Community project proposal sample (free template)"],
  ["2026-12", "manuel roxas", 33100, 1, "Manuel Roxas: the Capiz-born president"],
  ["2026-12", "capiz", 22200, 0, "A short history of Capiz"],
  ["2026-12", "capiz shells", 6600, 0, "Capiz shells: from Roxas City to the world"],
  ["2026-12", "dti business registration", 6600, 10, "DTI business registration guide"],
  ["2026-12", "entrepreneurship in the philippines", 4400, 0, "Entrepreneurship in the Philippines"],
  ["2026-12", "negosyo ideas", 2900, 0, "20 negosyo ideas for the province"],
  ["2026-12", "sponsorship letter", 1600, 0, "Sponsorship letter sample"],
  ["2026-12", "volunteer philippines", 1300, 16, "Volunteer opportunities in Capiz and the Philippines"],
  ["2026-12", "event proposal", 720, 0, "Event proposal template"],
  ["2026-12", "jci roxas halaran", null, null, "JCI Roxas Halaran 2026 year in review"],
  ["2027-01", "araw ng kagitingan", 27100, 6, "Araw ng Kagitingan (Apr 9): the story of Bataan"],
  ["2027-01", "labor day philippines", 5400, 3, "Labor Day in the Philippines"],
  ["2027-01", "edsa people power anniversary", 210, null, "EDSA People Power anniversary (Feb 25)"],
  ["2027-01", "public speaking tips", 4400, 24, "Public speaking tips for first-time leaders"],
  ["2027-01", "types of leadership", 4400, 34, "Types of leadership, with Filipino examples"],
  ["2027-01", "qualities of a good leader", 2900, 15, "Qualities of a good leader"],
  ["2027-01", "ngo in the philippines", 2900, 0, "NGOs and youth organizations in the Philippines"],
  ["2027-01", "community development", 1900, 13, "Community development: how to start"],
  ["2027-01", "sdg philippines", 1000, 11, "The SDGs in the Philippines"],
  ["2027-01", "tree planting philippines", 720, 0, "How to organize a tree planting"],
].map(([month, keyword, volume, kd, workingTitle]) => ({ month, keyword, volume, kd, workingTitle }));
```

In `db/seed.js`, add `seoPlan` to the schema import, `SEO_PLAN` to the seed-data import, and at the end of `seed`:

```js
  if (await isEmpty(seoPlan)) await db.insert(seoPlan).values(SEO_PLAN);
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `npx vitest run`
Expected: all PASS (45 tests).

- [ ] **Step 7: Apply to local and Turso databases**

Run: `npm run db:migrate && npm run db:seed`
Expected: `Migrations applied.` then `Seed complete.` (`.env.local` points at Turso; the seed only fills the new, empty `seo_plan` table.)

- [ ] **Step 8: Commit**

```bash
git add db test
git commit -m "Add articles, SEO plan and resources tables; seed the Nov–Jan SEO plan"
```

---

### Task 3: HTML cleaning and upload checks

**Files:**
- Create: `lib/sanitize.js`, `lib/uploads.js`, `test/sanitize.test.js`, `test/uploads.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `cleanHtml(html: string, { siteUrl?: string } = {}): string`; `UPLOAD_TYPES: string[]`, `MAX_UPLOAD_BYTES: number`, `checkUpload({ type, size }): string | null` (null = OK, otherwise the message to show).

- [ ] **Step 1: Install**

Run: `npm install sanitize-html@^2.17.0`

- [ ] **Step 2: Write the failing tests**

`test/sanitize.test.js`:

```js
import { describe, it, expect } from "vitest";
import { cleanHtml } from "@/lib/sanitize.js";

const SITE = "https://jciroxashalaran.com";
const clean = (html) => cleanHtml(html, { siteUrl: SITE });

describe("cleanHtml", () => {
  it("keeps the formatting the editor produces", () => {
    const html = '<h2>Title</h2><p><strong>Bold</strong> and <em>italic</em></p><ul><li>One</li></ul><blockquote><p>Quote</p></blockquote>';
    expect(clean(html)).toBe(html);
  });

  it("removes scripts, event handlers and inline styles pasted from Word", () => {
    const html = '<p style="color:red" onclick="steal()">Hi<script>alert(1)</script><span class="MsoNormal">there</span></p>';
    expect(clean(html)).toBe("<p>Hithere</p>");
  });

  it("turns h1 and h4 into nothing but keeps their text", () => {
    expect(clean("<h1>Big</h1><h4>Small</h4>")).toBe("BigSmall");
  });

  it("drops javascript: links but keeps the text", () => {
    expect(clean('<p><a href="javascript:alert(1)">click</a></p>')).toBe("<p><a>click</a></p>");
  });

  it("marks external links noopener and leaves site links alone", () => {
    expect(clean('<a href="https://example.com">x</a>')).toBe('<a href="https://example.com" rel="noopener noreferrer" target="_blank">x</a>');
    expect(clean('<a href="/projects">x</a>')).toBe('<a href="/projects">x</a>');
    expect(clean(`<a href="${SITE}/join">x</a>`)).toBe(`<a href="${SITE}/join">x</a>`);
  });

  it("keeps images from Vercel Blob or the site and drops others", () => {
    const blob = '<img src="https://abc123.public.blob.vercel-storage.com/a.jpg" alt="Trees" />';
    expect(clean(blob)).toBe('<img src="https://abc123.public.blob.vercel-storage.com/a.jpg" alt="Trees" />');
    expect(clean('<img src="/assets/img/logo-site.png" alt="Logo" />')).toBe('<img src="/assets/img/logo-site.png" alt="Logo" />');
    expect(clean('<img src="https://evil.example/x.jpg" alt="x" />')).toBe("");
    expect(clean('<img src="//evil.example/x.jpg" alt="x" />')).toBe("");
  });

  it("handles empty input", () => {
    expect(clean("")).toBe("");
    expect(clean(null)).toBe("");
  });
});
```

`test/uploads.test.js`:

```js
import { describe, it, expect } from "vitest";
import { checkUpload, MAX_UPLOAD_BYTES } from "@/lib/uploads.js";

describe("checkUpload", () => {
  it("accepts JPG, PNG, WebP and PDF up to 10 MB", () => {
    expect(checkUpload({ type: "image/jpeg", size: 2_000_000 })).toBeNull();
    expect(checkUpload({ type: "application/pdf", size: MAX_UPLOAD_BYTES })).toBeNull();
  });

  it("refuses iPhone HEIC photos with a fix-it message", () => {
    expect(checkUpload({ type: "image/heic", size: 2_000_000 })).toBe(
      "This file type isn't supported. Use a JPG, PNG or WebP image, or a PDF. (iPhone photos: share as JPG first.)",
    );
  });

  it("refuses files over 10 MB", () => {
    expect(checkUpload({ type: "image/jpeg", size: 12 * 1024 * 1024 })).toBe(
      "This file is 12.0 MB. The limit is 10 MB — resize or compress it first.",
    );
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run test/sanitize.test.js test/uploads.test.js`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement**

`lib/sanitize.js`:

```js
import sanitizeHtml from "sanitize-html";
import { SITE } from "./site.js";

const BLOB_HOST = /\.public\.blob\.vercel-storage\.com$/;

function isAllowedImage(src = "", siteUrl) {
  if (src.startsWith("/") && !src.startsWith("//")) return true;
  try {
    const url = new URL(src);
    return url.protocol === "https:" && (BLOB_HOST.test(url.hostname) || src.startsWith(`${siteUrl}/`));
  } catch {
    return false;
  }
}

// Server-side allow-list for article and project bodies (spec §4).
export function cleanHtml(html, { siteUrl = SITE.url } = {}) {
  return sanitizeHtml(html ?? "", {
    allowedTags: ["h2", "h3", "p", "br", "strong", "em", "ul", "ol", "li", "a", "blockquote", "img"],
    allowedAttributes: { a: ["href", "rel", "target"], img: ["src", "alt"] },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    selfClosing: ["img", "br"],
    exclusiveFilter: (frame) => frame.tag === "img" && !isAllowedImage(frame.attribs.src, siteUrl),
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href;
        if (!href) return { tagName, attribs: {} };
        const external = /^https?:\/\//.test(href) && !href.startsWith(`${siteUrl}/`) && href !== siteUrl;
        return {
          tagName,
          attribs: external ? { href, rel: "noopener noreferrer", target: "_blank" } : { href },
        };
      },
    },
  });
}
```

`lib/uploads.js`:

```js
export const UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// Returns null when the file is fine, otherwise a message for the person uploading.
export function checkUpload({ type, size }) {
  if (!UPLOAD_TYPES.includes(type)) {
    return "This file type isn't supported. Use a JPG, PNG or WebP image, or a PDF. (iPhone photos: share as JPG first.)";
  }
  if (size > MAX_UPLOAD_BYTES) {
    return `This file is ${(size / 1024 / 1024).toFixed(1)} MB. The limit is 10 MB — resize or compress it first.`;
  }
  return null;
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run test/sanitize.test.js test/uploads.test.js`
Expected: PASS (10 tests). If a sanitizer expectation differs only in self-closing tag syntax (`<img ... />` vs `<img ...>`), keep the test expectation and adjust `selfClosing`/`parser` options, not the test.

- [ ] **Step 6: Commit**

```bash
git add lib/sanitize.js lib/uploads.js test/sanitize.test.js test/uploads.test.js package.json package-lock.json
git commit -m "Add server-side HTML cleaning and upload checks"
```

---

### Task 4: Validation and publish rules

**Files:**
- Create: `lib/content/validation.js`, `test/validation.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces:
  - `CATEGORIES: string[]`, `CATEGORY_LABELS: Record<string,string>`
  - `articleInput`, `projectInput`, `resourceInput` (Zod schemas; see code)
  - `hasText(html): boolean`
  - `publishProblems(article): string[]` (empty = publishable)
  - `imageAltProblems(html): number` (count of `<img>` without non-empty alt)

- [ ] **Step 1: Install**

Run: `npm install zod@^3.25.0`

- [ ] **Step 2: Write the failing tests**

`test/validation.test.js`:

```js
import { describe, it, expect } from "vitest";
import { articleInput, publishProblems, hasText, imageAltProblems } from "@/lib/content/validation.js";

const ready = {
  title: "Rizal Day",
  metaDescription: "What Filipinos commemorate on December 30.",
  targetKeyword: "rizal day",
  bodyHtml: "<p>José Rizal was executed on December 30, 1896.</p>",
  coverUrl: null,
  coverAlt: null,
};

describe("articleInput", () => {
  it("fills defaults for an empty draft", () => {
    const r = articleInput.parse({});
    expect(r).toMatchObject({ title: "", category: "community", authorId: null, projectId: null });
  });

  it("rejects a meta description over 160 characters", () => {
    const r = articleInput.safeParse({ metaDescription: "x".repeat(161) });
    expect(r.success).toBe(false);
    expect(r.error.issues[0].message).toBe("Meta description must be 160 characters or fewer");
  });

  it("turns empty author and project selections into null", () => {
    expect(articleInput.parse({ authorId: "", projectId: "3" })).toMatchObject({ authorId: null, projectId: 3 });
  });
});

describe("publishProblems", () => {
  it("passes a complete article", () => {
    expect(publishProblems(ready)).toEqual([]);
  });

  it("lists every missing field", () => {
    expect(publishProblems({ title: "", metaDescription: "", targetKeyword: "", bodyHtml: "<p> </p>" })).toEqual([
      "Add a title",
      "Add a meta description",
      "Add a target keyword",
      "Write the article body",
    ]);
  });

  it("requires alt text for the cover and for every image in the body", () => {
    expect(
      publishProblems({ ...ready, coverUrl: "https://x.public.blob.vercel-storage.com/c.jpg", coverAlt: "", bodyHtml: '<p>Hi</p><img src="/a.jpg" alt="">' }),
    ).toEqual(["Add alt text for the cover image", "Add alt text to 1 image in the body"]);
  });
});

describe("helpers", () => {
  it("hasText ignores tags and whitespace", () => {
    expect(hasText("<p>&nbsp; </p>")).toBe(false);
    expect(hasText("<p>Hi</p>")).toBe(true);
  });

  it("counts images without alt text", () => {
    expect(imageAltProblems('<img src="/a.jpg" alt="A"><img src="/b.jpg"><img src="/c.jpg" alt=" ">')).toBe(2);
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run test/validation.test.js`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

`lib/content/validation.js`:

```js
import { z } from "zod";

export const CATEGORIES = ["capiz", "holidays", "leadership", "business", "community"];
export const CATEGORY_LABELS = {
  capiz: "Capiz",
  holidays: "Holidays",
  leadership: "Leadership",
  business: "Business",
  community: "Community",
};

const optionalId = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? null : Number(v)),
  z.number().int().positive().nullable(),
);
const text = (max) => z.string().trim().max(max).default("");

export const articleInput = z.object({
  title: text(160),
  slug: text(120),
  metaDescription: z.string().trim().max(160, "Meta description must be 160 characters or fewer").default(""),
  targetKeyword: text(80),
  category: z.enum(CATEGORIES).default("community"),
  bodyJson: z.string().default(""),
  bodyHtml: z.string().default(""),
  coverUrl: text(500),
  coverAlt: text(200),
  authorId: optionalId.default(null),
  projectId: optionalId.default(null),
});

export const projectInput = z.object({
  title: z.string().trim().min(1, "Add a title").max(160),
  slug: text(120),
  summary: text(300),
  startDate: z.string().trim().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Use a date like 2026-11-30").default(""),
  endDate: z.string().trim().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Use a date like 2026-11-30").default(""),
  barangay: text(120),
  pillar: z.enum(["leadership", "community", "global"]).default("community"),
  status: z.enum(["planned", "ongoing", "done"]).default("done"),
  coverUrl: text(500),
  coverAlt: text(200),
  bodyJson: z.string().default(""),
  bodyHtml: z.string().default(""),
});

export const resourceInput = z.object({
  title: z.string().trim().min(1, "Add a title").max(160),
  description: text(300),
  fileUrl: z.string().trim().url("Upload a file first"),
  kind: z.enum(["template", "training", "bylaws", "other"]).default("template"),
  visibility: z.enum(["public", "members"]).default("public"),
});

export function hasText(html) {
  return (html ?? "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length > 0;
}

export function imageAltProblems(html) {
  const imgs = (html ?? "").match(/<img\b[^>]*>/gi) ?? [];
  return imgs.filter((tag) => !/\balt="[^"]*\S[^"]*"/i.test(tag)).length;
}

export function publishProblems(a) {
  const problems = [];
  if (!a.title?.trim()) problems.push("Add a title");
  if (!a.metaDescription?.trim()) problems.push("Add a meta description");
  if (!a.targetKeyword?.trim()) problems.push("Add a target keyword");
  if (!hasText(a.bodyHtml)) problems.push("Write the article body");
  if (a.coverUrl && !a.coverAlt?.trim()) problems.push("Add alt text for the cover image");
  const missingAlt = imageAltProblems(a.bodyHtml);
  if (missingAlt) problems.push(`Add alt text to ${missingAlt} image${missingAlt > 1 ? "s" : ""} in the body`);
  return problems;
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run test/validation.test.js`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/content/validation.js test/validation.test.js package.json package-lock.json
git commit -m "Add content validation and publish rules"
```

---

### Task 5: Article store (save, publish, unpublish, public queries)

**Files:**
- Create: `lib/content/articles.js`, `lib/content/seoPlan.js`, `test/articles.test.js`

**Interfaces:**
- Consumes: `articles`, `seoPlan`, `members`, `projects` tables; `articleInput`, `publishProblems`; `cleanHtml`; `slugify`.
- Produces (`ctx = { userId: string, now?: string }`; results `{ ok: true, article } | { ok: false, errors: string[] }`):
  - `saveArticle(db, { id?, expectedUpdatedAt?, ...fields }, ctx)`
  - `publishArticle(db, id, { expectedUpdatedAt }, ctx)`
  - `unpublishArticle(db, id, ctx)`
  - `getArticle(db, id)`, `listArticlesAdmin(db, { status? } = {})`
  - `listPublishedArticles(db, { category?, limit? } = {})`, `getPublishedArticle(db, slug)` (adds `authorName`), `relatedArticles(db, article, limit = 3)`, `listArticlesForProject(db, projectId)`
  - From `lib/content/seoPlan.js`: `linkPublishedArticle(db, article)`, `unlinkArticle(db, articleId)`, `listPlan(db)`, `addPlanKeyword(db, input)`, `setPlanStatus(db, id, status)`, `monthProgress(db, month)`

- [ ] **Step 1: Write the failing tests**

`test/articles.test.js`:

```js
import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { seoPlan } from "@/db/schema.js";
import {
  saveArticle,
  publishArticle,
  unpublishArticle,
  listPublishedArticles,
  getPublishedArticle,
  relatedArticles,
} from "@/lib/content/articles.js";

const ctx = { userId: "user_admin", now: "2026-11-01T00:00:00.000Z" };
const complete = {
  title: "Bonifacio Day: History and Meaning",
  metaDescription: "Why the Philippines remembers Andrés Bonifacio every November 30.",
  targetKeyword: "Bonifacio Day",
  category: "holidays",
  bodyJson: "{}",
  bodyHtml: '<p>Andrés Bonifacio founded the Katipunan.</p><script>x()</script>',
};

let db;
beforeEach(async () => {
  db = await testDb();
  await seed(db);
});

async function published(fields = complete) {
  const saved = await saveArticle(db, fields, ctx);
  return publishArticle(db, saved.article.id, { expectedUpdatedAt: saved.article.updatedAt }, ctx);
}

describe("saveArticle", () => {
  it("saves a draft with a slug from the title and a cleaned body", async () => {
    const r = await saveArticle(db, complete, ctx);
    expect(r.ok).toBe(true);
    expect(r.article).toMatchObject({ slug: "bonifacio-day-history-and-meaning", status: "draft", updatedBy: "user_admin" });
    expect(r.article.bodyHtml).toBe("<p>Andrés Bonifacio founded the Katipunan.</p>");
  });

  it("saves an empty draft", async () => {
    const r = await saveArticle(db, {}, ctx);
    expect(r.ok).toBe(true);
    expect(r.article.slug).toMatch(/^untitled/);
  });

  it("refuses a slug another article already uses", async () => {
    await saveArticle(db, complete, ctx);
    const r = await saveArticle(db, { ...complete, title: "Other" , slug: "bonifacio-day-history-and-meaning" }, ctx);
    expect(r).toEqual({ ok: false, errors: ["The address /articles/bonifacio-day-history-and-meaning is taken — try bonifacio-day-history-and-meaning-2"] });
  });

  it("refuses to overwrite a newer save", async () => {
    const first = await saveArticle(db, complete, ctx);
    await saveArticle(db, { id: first.article.id, expectedUpdatedAt: first.article.updatedAt, ...complete, title: "B" }, { ...ctx, now: "2026-11-02T00:00:00.000Z" });
    const stale = await saveArticle(db, { id: first.article.id, expectedUpdatedAt: first.article.updatedAt, ...complete, title: "C" }, ctx);
    expect(stale).toEqual({ ok: false, errors: ["This was changed since you opened it — reload"] });
  });

  it("keeps the slug when a published article's title changes", async () => {
    const pub = await published();
    const edited = await saveArticle(db, { id: pub.article.id, expectedUpdatedAt: pub.article.updatedAt, ...complete, title: "Bonifacio Day 2026", slug: "new-slug" }, ctx);
    expect(edited.article.slug).toBe("bonifacio-day-history-and-meaning");
  });
});

describe("publishArticle", () => {
  it("refuses an incomplete article and lists what is missing", async () => {
    const draft = await saveArticle(db, { title: "Only a title" }, ctx);
    const r = await publishArticle(db, draft.article.id, { expectedUpdatedAt: draft.article.updatedAt }, ctx);
    expect(r).toEqual({ ok: false, errors: ["Add a meta description", "Add a target keyword", "Write the article body"] });
  });

  it("publishes and links the SEO plan row even when the keyword case differs", async () => {
    const r = await published();
    expect(r.article).toMatchObject({ status: "published", publishedAt: ctx.now });
    const [row] = await db.select().from(seoPlan).where(eq(seoPlan.keyword, "bonifacio day"));
    expect(row).toMatchObject({ status: "published", articleId: r.article.id });
  });
});

describe("public queries", () => {
  it("never return drafts", async () => {
    await saveArticle(db, { ...complete, title: "Draft only" }, ctx);
    const pub = await published();
    expect((await listPublishedArticles(db)).map((a) => a.id)).toEqual([pub.article.id]);
    expect(await getPublishedArticle(db, "draft-only")).toBeNull();
  });

  it("unpublishing hides the article and resets its plan row to drafting", async () => {
    const pub = await published();
    await unpublishArticle(db, pub.article.id, ctx);
    expect(await getPublishedArticle(db, pub.article.slug)).toBeNull();
    const [row] = await db.select().from(seoPlan).where(eq(seoPlan.keyword, "bonifacio day"));
    expect(row.status).toBe("drafting");
  });

  it("filters by category and finds related articles", async () => {
    const a = await published();
    const b = await published({ ...complete, title: "Rizal Day", targetKeyword: "rizal day" });
    await published({ ...complete, title: "Capiz Shells", targetKeyword: "capiz shells", category: "capiz" });
    expect((await listPublishedArticles(db, { category: "capiz" })).map((x) => x.title)).toEqual(["Capiz Shells"]);
    expect((await relatedArticles(db, a.article)).map((x) => x.id)).toEqual([b.article.id]);
  });

  it("includes the author's name and falls back to null", async () => {
    const r = await published();
    expect((await getPublishedArticle(db, r.article.slug)).authorName).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run test/articles.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the SEO plan store**

`lib/content/seoPlan.js`:

```js
import { and, asc, eq, sql, count } from "drizzle-orm";
import { seoPlan } from "../../db/schema.js";

export function listPlan(db) {
  return db.select().from(seoPlan).orderBy(asc(seoPlan.month), asc(seoPlan.id));
}

export async function addPlanKeyword(db, { month, keyword, volume = null, kd = null, workingTitle = null }) {
  const k = keyword.trim().toLowerCase();
  if (!/^\d{4}-\d{2}$/.test(month) || !k) return { ok: false, errors: ["Use a month like 2026-12 and a keyword"] };
  try {
    const [row] = await db.insert(seoPlan).values({ month, keyword: k, volume, kd, workingTitle }).returning();
    return { ok: true, row };
  } catch {
    return { ok: false, errors: [`"${k}" is already planned for ${month}`] };
  }
}

export async function setPlanStatus(db, id, status) {
  if (!["idea", "drafting", "published"].includes(status)) return { ok: false, errors: ["Unknown status"] };
  await db.update(seoPlan).set({ status }).where(eq(seoPlan.id, id));
  return { ok: true };
}

export async function monthProgress(db, month) {
  const [total] = await db.select({ n: count() }).from(seoPlan).where(eq(seoPlan.month, month));
  const [done] = await db
    .select({ n: count() })
    .from(seoPlan)
    .where(and(eq(seoPlan.month, month), eq(seoPlan.status, "published")));
  return { published: done.n, total: total.n };
}

export async function linkPublishedArticle(db, article) {
  if (!article.targetKeyword) return;
  await db
    .update(seoPlan)
    .set({ status: "published", articleId: article.id })
    .where(sql`lower(${seoPlan.keyword}) = lower(${article.targetKeyword.trim()})`);
}

export async function unlinkArticle(db, articleId) {
  await db.update(seoPlan).set({ status: "drafting" }).where(eq(seoPlan.articleId, articleId));
}
```

- [ ] **Step 4: Implement the article store**

`lib/content/articles.js`:

```js
import { and, desc, eq, ne } from "drizzle-orm";
import { articles, members } from "../../db/schema.js";
import { articleInput, publishProblems } from "./validation.js";
import { cleanHtml } from "../sanitize.js";
import { slugify } from "../format.js";
import { linkPublishedArticle, unlinkArticle } from "./seoPlan.js";

const STALE = "This was changed since you opened it — reload";

export async function getArticle(db, id) {
  const [row] = await db.select().from(articles).where(eq(articles.id, Number(id)));
  return row ?? null;
}

export function listArticlesAdmin(db, { status } = {}) {
  const q = db.select().from(articles).orderBy(desc(articles.updatedAt));
  return status ? q.where(eq(articles.status, status)) : q;
}

async function slugTaken(db, slug, id) {
  const cond = id ? and(eq(articles.slug, slug), ne(articles.id, id)) : eq(articles.slug, slug);
  return (await db.select({ id: articles.id }).from(articles).where(cond)).length > 0;
}

export async function saveArticle(db, { id, expectedUpdatedAt, ...raw }, { userId, now = new Date().toISOString() }) {
  const parsed = articleInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  const data = parsed.data;

  const existing = id ? await getArticle(db, id) : null;
  if (id && !existing) return { ok: false, errors: ["Article not found"] };
  if (existing && expectedUpdatedAt !== existing.updatedAt) return { ok: false, errors: [STALE] };

  // Slug is locked once the article has ever been published (spec §3).
  let slug = existing?.publishedAt ? existing.slug : slugify(data.slug || data.title);
  if (!slug) slug = `untitled-${Date.parse(now)}`;
  if (!existing?.publishedAt && (await slugTaken(db, slug, existing?.id))) {
    return { ok: false, errors: [`The address /articles/${slug} is taken — try ${slug}-2`] };
  }

  const values = {
    title: data.title || "Untitled",
    slug,
    metaDescription: data.metaDescription || null,
    targetKeyword: data.targetKeyword || null,
    category: data.category,
    bodyJson: data.bodyJson || null,
    bodyHtml: cleanHtml(data.bodyHtml),
    coverUrl: data.coverUrl || null,
    coverAlt: data.coverAlt || null,
    authorId: data.authorId,
    projectId: data.projectId,
    updatedAt: now,
    updatedBy: userId,
  };

  const [article] = existing
    ? await db.update(articles).set(values).where(eq(articles.id, existing.id)).returning()
    : await db.insert(articles).values(values).returning();
  if (article.status === "published") await linkPublishedArticle(db, article);
  return { ok: true, article };
}

export async function publishArticle(db, id, { expectedUpdatedAt }, { userId, now = new Date().toISOString() }) {
  const existing = await getArticle(db, id);
  if (!existing) return { ok: false, errors: ["Article not found"] };
  if (expectedUpdatedAt !== existing.updatedAt) return { ok: false, errors: [STALE] };
  const problems = publishProblems(existing);
  if (problems.length) return { ok: false, errors: problems };

  const [article] = await db
    .update(articles)
    .set({ status: "published", publishedAt: existing.publishedAt ?? now, updatedAt: now, updatedBy: userId })
    .where(eq(articles.id, existing.id))
    .returning();
  await linkPublishedArticle(db, article);
  return { ok: true, article };
}

export async function unpublishArticle(db, id, { userId, now = new Date().toISOString() }) {
  const [article] = await db
    .update(articles)
    .set({ status: "draft", updatedAt: now, updatedBy: userId })
    .where(eq(articles.id, Number(id)))
    .returning();
  if (!article) return { ok: false, errors: ["Article not found"] };
  await unlinkArticle(db, article.id);
  return { ok: true, article };
}

const publicFields = {
  id: articles.id,
  slug: articles.slug,
  title: articles.title,
  metaDescription: articles.metaDescription,
  category: articles.category,
  bodyHtml: articles.bodyHtml,
  coverUrl: articles.coverUrl,
  coverAlt: articles.coverAlt,
  projectId: articles.projectId,
  publishedAt: articles.publishedAt,
  updatedAt: articles.updatedAt,
  authorName: members.name,
};

function publishedQuery(db) {
  return db
    .select(publicFields)
    .from(articles)
    .leftJoin(members, eq(articles.authorId, members.id))
    .orderBy(desc(articles.publishedAt), desc(articles.id));
}

export function listPublishedArticles(db, { category, limit } = {}) {
  const cond = category
    ? and(eq(articles.status, "published"), eq(articles.category, category))
    : eq(articles.status, "published");
  const q = publishedQuery(db).where(cond);
  return limit ? q.limit(limit) : q;
}

export async function getPublishedArticle(db, slug) {
  const [row] = await publishedQuery(db).where(and(eq(articles.status, "published"), eq(articles.slug, slug)));
  return row ?? null;
}

export function relatedArticles(db, article, limit = 3) {
  return publishedQuery(db)
    .where(and(eq(articles.status, "published"), eq(articles.category, article.category), ne(articles.id, article.id)))
    .limit(limit);
}

export function listArticlesForProject(db, projectId) {
  return publishedQuery(db).where(and(eq(articles.status, "published"), eq(articles.projectId, projectId)));
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run test/articles.test.js`
Expected: PASS (11 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/content/articles.js lib/content/seoPlan.js test/articles.test.js
git commit -m "Add the article store with publish rules, slug lock and SEO plan linking"
```

---

### Task 6: Project, resource and SEO plan stores

**Files:**
- Create: `lib/content/projects.js`, `lib/content/resources.js`, `test/projects-resources.test.js`, `test/seo-plan.test.js`

**Interfaces:**
- Produces:
  - `saveProject(db, { id?, expectedUpdatedAt?, ...fields }, ctx)` → `{ ok, project } | { ok:false, errors }` (slug locked after creation)
  - `getProject(db, id)`, `getProjectBySlug(db, slug)` → project + `photos[]` | null
  - `addProjectPhoto(db, { projectId, url, alt, caption?, kind? })`, `deleteProjectPhoto(db, photoId)`
  - `createResource(db, input, ctx)`, `listResources(db, { visibility? } = {})`, `deleteResource(db, id)`

- [ ] **Step 1: Write the failing tests**

`test/projects-resources.test.js`:

```js
import { describe, it, expect, beforeEach } from "vitest";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { saveProject, getProjectBySlug, addProjectPhoto } from "@/lib/content/projects.js";
import { createResource, listResources } from "@/lib/content/resources.js";

const ctx = { userId: "user_admin", now: "2026-11-01T00:00:00.000Z" };
let db;
beforeEach(async () => {
  db = await testDb();
  await seed(db);
});

describe("projects", () => {
  it("creates a project with a slug and cleaned story", async () => {
    const r = await saveProject(db, { title: "Coastal Cleanup 2026", bodyHtml: "<p>We cleaned Baybay.</p><iframe></iframe>" }, ctx);
    expect(r.project).toMatchObject({ slug: "coastal-cleanup-2026", body: "<p>We cleaned Baybay.</p>", updatedAt: ctx.now });
  });

  it("keeps the slug after creation", async () => {
    const r = await saveProject(db, { title: "Tree Planting" }, ctx);
    const e = await saveProject(db, { id: r.project.id, expectedUpdatedAt: r.project.updatedAt, title: "Tree Planting 2026", slug: "other" }, ctx);
    expect(e.project.slug).toBe("tree-planting");
  });

  it("edits a seeded project that has no updatedAt yet", async () => {
    const seeded = await getProjectBySlug(db, "coastline-cuts");
    const r = await saveProject(db, { id: seeded.id, expectedUpdatedAt: seeded.updatedAt, title: "Coastline Cuts", summary: "Mangrove care" }, ctx);
    expect(r.ok).toBe(true);
  });

  it("requires alt text for gallery photos and returns them with the project", async () => {
    const p = await getProjectBySlug(db, "coastline-cuts");
    expect(await addProjectPhoto(db, { projectId: p.id, url: "/a.jpg", alt: "" })).toEqual({ ok: false, errors: ["Add alt text for the photo"] });
    await addProjectPhoto(db, { projectId: p.id, url: "/a.jpg", alt: "Volunteers planting mangroves" });
    expect((await getProjectBySlug(db, "coastline-cuts")).photos).toHaveLength(1);
  });
});

describe("resources", () => {
  it("creates a public resource and lists only public ones for the public page", async () => {
    await createResource(db, { title: "Project proposal template", fileUrl: "https://x.public.blob.vercel-storage.com/p.pdf" }, ctx);
    await createResource(db, { title: "Bylaws", fileUrl: "https://x.public.blob.vercel-storage.com/b.pdf", visibility: "members", kind: "bylaws" }, ctx);
    expect((await listResources(db, { visibility: "public" })).map((r) => r.title)).toEqual(["Project proposal template"]);
  });

  it("refuses a resource without an uploaded file", async () => {
    expect(await createResource(db, { title: "x", fileUrl: "" }, ctx)).toEqual({ ok: false, errors: ["Upload a file first"] });
  });
});
```

`test/seo-plan.test.js`:

```js
import { describe, it, expect, beforeEach } from "vitest";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { addPlanKeyword, monthProgress, setPlanStatus, listPlan } from "@/lib/content/seoPlan.js";

let db;
beforeEach(async () => {
  db = await testDb();
  await seed(db);
});

describe("SEO plan", () => {
  it("starts with 10 ideas for November", async () => {
    expect(await monthProgress(db, "2026-11")).toEqual({ published: 0, total: 10 });
  });

  it("adds a keyword once per month, lowercased", async () => {
    expect((await addPlanKeyword(db, { month: "2027-02", keyword: "  Valentine's Day PH " })).row.keyword).toBe("valentine's day ph");
    expect(await addPlanKeyword(db, { month: "2027-02", keyword: "valentine's day ph" })).toEqual({
      ok: false,
      errors: ['"valentine\'s day ph" is already planned for 2027-02'],
    });
  });

  it("changes a status and rejects unknown ones", async () => {
    const [first] = await listPlan(db);
    expect(await setPlanStatus(db, first.id, "drafting")).toEqual({ ok: true });
    expect(await setPlanStatus(db, first.id, "done")).toEqual({ ok: false, errors: ["Unknown status"] });
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run test/projects-resources.test.js test/seo-plan.test.js`
Expected: `seo-plan.test.js` PASS (its store exists from Task 5); `projects-resources.test.js` FAIL — modules not found.

- [ ] **Step 3: Implement**

`lib/content/projects.js`:

```js
import { asc, eq } from "drizzle-orm";
import { projects, projectPhotos } from "../../db/schema.js";
import { projectInput } from "./validation.js";
import { cleanHtml } from "../sanitize.js";
import { slugify } from "../format.js";

export async function getProject(db, id) {
  const [row] = await db.select().from(projects).where(eq(projects.id, Number(id)));
  return row ?? null;
}

export async function getProjectBySlug(db, slug) {
  const [row] = await db.select().from(projects).where(eq(projects.slug, slug));
  if (!row) return null;
  const photos = await db
    .select()
    .from(projectPhotos)
    .where(eq(projectPhotos.projectId, row.id))
    .orderBy(asc(projectPhotos.sort), asc(projectPhotos.id));
  return { ...row, photos };
}

export async function saveProject(db, { id, expectedUpdatedAt, ...raw }, { now = new Date().toISOString() }) {
  const parsed = projectInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  const d = parsed.data;

  const existing = id ? await getProject(db, id) : null;
  if (id && !existing) return { ok: false, errors: ["Project not found"] };
  if (existing && (expectedUpdatedAt ?? null) !== (existing.updatedAt ?? null)) {
    return { ok: false, errors: ["This was changed since you opened it — reload"] };
  }

  const slug = existing ? existing.slug : slugify(d.slug || d.title);
  if (!existing) {
    const taken = await db.select({ id: projects.id }).from(projects).where(eq(projects.slug, slug));
    if (taken.length) return { ok: false, errors: [`The address /projects/${slug} is taken — try ${slug}-2`] };
  }

  const values = {
    title: d.title,
    slug,
    summary: d.summary || null,
    startDate: d.startDate || null,
    endDate: d.endDate || null,
    barangay: d.barangay || null,
    pillar: d.pillar,
    status: d.status,
    coverUrl: d.coverUrl || null,
    coverAlt: d.coverAlt || null,
    bodyJson: d.bodyJson || null,
    body: cleanHtml(d.bodyHtml),
    updatedAt: now,
  };
  if (values.coverUrl && !values.coverAlt) return { ok: false, errors: ["Add alt text for the cover image"] };

  const [project] = existing
    ? await db.update(projects).set(values).where(eq(projects.id, existing.id)).returning()
    : await db.insert(projects).values(values).returning();
  return { ok: true, project };
}

export async function addProjectPhoto(db, { projectId, url, alt, caption = null, kind = "gallery" }) {
  if (!alt?.trim()) return { ok: false, errors: ["Add alt text for the photo"] };
  const [photo] = await db
    .insert(projectPhotos)
    .values({ projectId: Number(projectId), url, alt: alt.trim(), caption, kind })
    .returning();
  return { ok: true, photo };
}

export async function deleteProjectPhoto(db, photoId) {
  const [photo] = await db.delete(projectPhotos).where(eq(projectPhotos.id, Number(photoId))).returning();
  return photo ? { ok: true, photo } : { ok: false, errors: ["Photo not found"] };
}
```

`lib/content/resources.js`:

```js
import { desc, eq } from "drizzle-orm";
import { resources } from "../../db/schema.js";
import { resourceInput } from "./validation.js";

export async function createResource(db, raw, { now = new Date().toISOString() }) {
  const parsed = resourceInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  const [resource] = await db
    .insert(resources)
    .values({ ...parsed.data, description: parsed.data.description || null, createdAt: now })
    .returning();
  return { ok: true, resource };
}

export function listResources(db, { visibility } = {}) {
  const q = db.select().from(resources).orderBy(desc(resources.createdAt), desc(resources.id));
  return visibility ? q.where(eq(resources.visibility, visibility)) : q;
}

export async function deleteResource(db, id) {
  const [resource] = await db.delete(resources).where(eq(resources.id, Number(id))).returning();
  return resource ? { ok: true, resource } : { ok: false, errors: ["Resource not found"] };
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/content/projects.js lib/content/resources.js test/projects-resources.test.js test/seo-plan.test.js
git commit -m "Add project, resource and SEO plan stores"
```

---

### Task 7: Admin role gate, revalidation and server actions

**Files:**
- Modify: `lib/roles.js`, `test/roles.test.js`
- Create: `lib/auth.js`, `lib/revalidate.js`, `app/admin/articles/actions.js`, `app/admin/projects/actions.js`, `app/admin/resources/actions.js`, `app/admin/seo-plan/actions.js`, `test/revalidate.test.js`, `test/actions.test.js`

**Interfaces:**
- Produces:
  - `canAccess(role, "content")` true only for `admin`.
  - `requireArea(area): Promise<{ userId, role }>` (calls `notFound()` when not allowed).
  - `pathsForArticle(slug)`, `pathsForProject(slug)`, `RESOURCE_PATHS`, `revalidateAll(paths)`.
  - Server actions (all return plain objects):
    - articles: `saveArticleAction(input)`, `publishArticleAction(id, expectedUpdatedAt)`, `unpublishArticleAction(id)`
    - projects: `saveProjectAction(input)`, `addProjectPhotoAction(input)`, `deleteProjectPhotoAction(photoId, slug)`
    - resources: `createResourceAction(input)`, `deleteResourceAction(id)`
    - SEO plan (form actions): `addPlanKeywordAction(formData)`, `setPlanStatusAction(formData)`

- [ ] **Step 1: Write the failing tests**

Append to `test/roles.test.js`:

```js
describe("content area", () => {
  it("is admin-only", () => {
    expect(canAccess("admin", "content")).toBe(true);
    for (const r of ["member", "officer", "treasurer"]) expect(canAccess(r, "content")).toBe(false);
  });
});
```

`test/revalidate.test.js`:

```js
import { describe, it, expect } from "vitest";
import { pathsForArticle, pathsForProject, RESOURCE_PATHS } from "@/lib/revalidate.js";

describe("revalidation paths", () => {
  it("covers every page an article appears on", () => {
    expect(pathsForArticle("rizal-day")).toEqual(["/articles", "/articles/rizal-day", "/", "/sitemap.xml"]);
  });
  it("covers every page a project appears on", () => {
    expect(pathsForProject("coastline-cuts")).toEqual(["/projects", "/projects/coastline-cuts", "/", "/sitemap.xml"]);
  });
  it("covers the resources page", () => {
    expect(RESOURCE_PATHS).toEqual(["/resources"]);
  });
});
```

`test/actions.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from "vitest";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";

const h = vi.hoisted(() => ({ db: null, claims: null, revalidated: [] }));

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: h.claims ? "user_1" : null, sessionClaims: h.claims }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: (p) => h.revalidated.push(p) }));
vi.mock("@/lib/db.js", () => ({ getDb: () => h.db }));

const { saveArticleAction, publishArticleAction } = await import("@/app/admin/articles/actions.js");

const complete = {
  title: "Rizal Day",
  metaDescription: "What Filipinos commemorate on December 30.",
  targetKeyword: "rizal day",
  bodyHtml: "<p>José Rizal.</p>",
};

beforeEach(async () => {
  h.db = await testDb();
  await seed(h.db);
  h.revalidated = [];
});

describe("article actions", () => {
  it("refuse officers", async () => {
    h.claims = { metadata: { role: "officer" } };
    await expect(saveArticleAction(complete)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("refuse signed-out callers", async () => {
    h.claims = null;
    await expect(saveArticleAction(complete)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("let admins save drafts without refreshing public pages", async () => {
    h.claims = { metadata: { role: "admin" } };
    const r = await saveArticleAction(complete);
    expect(r.ok).toBe(true);
    expect(h.revalidated).toEqual([]);
  });

  it("refresh the article's public pages on publish", async () => {
    h.claims = { metadata: { role: "admin" } };
    const saved = await saveArticleAction(complete);
    const r = await publishArticleAction(saved.article.id, saved.article.updatedAt);
    expect(r.ok).toBe(true);
    expect(h.revalidated).toEqual(["/articles", "/articles/rizal-day", "/", "/sitemap.xml"]);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run test/roles.test.js test/revalidate.test.js test/actions.test.js`
Expected: FAIL — `content` area missing, modules not found.

- [ ] **Step 3: Implement**

In `lib/roles.js`, add to `AREA_ROLES`:

```js
  content: ["admin"],
```

`lib/auth.js`:

```js
import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { canAccess, roleFromSessionClaims } from "./roles.js";

// Server-side gate for pages and server actions (spec §4: every write re-checks the role).
export async function requireArea(area) {
  const { userId, sessionClaims } = await auth();
  const role = roleFromSessionClaims(sessionClaims);
  if (!userId || !canAccess(role, area)) notFound();
  return { userId, role };
}
```

`lib/revalidate.js`:

```js
import { revalidatePath } from "next/cache";

export const pathsForArticle = (slug) => ["/articles", `/articles/${slug}`, "/", "/sitemap.xml"];
export const pathsForProject = (slug) => ["/projects", `/projects/${slug}`, "/", "/sitemap.xml"];
export const RESOURCE_PATHS = ["/resources"];

export function revalidateAll(paths) {
  for (const p of paths) revalidatePath(p);
}
```

`app/admin/articles/actions.js`:

```js
"use server";

import { getDb } from "@/lib/db.js";
import { requireArea } from "@/lib/auth.js";
import { pathsForArticle, revalidateAll } from "@/lib/revalidate.js";
import { saveArticle, publishArticle, unpublishArticle } from "@/lib/content/articles.js";

export async function saveArticleAction(input) {
  const { userId } = await requireArea("content");
  const r = await saveArticle(getDb(), input, { userId });
  if (r.ok && r.article.status === "published") revalidateAll(pathsForArticle(r.article.slug));
  return r;
}

export async function publishArticleAction(id, expectedUpdatedAt) {
  const { userId } = await requireArea("content");
  const r = await publishArticle(getDb(), id, { expectedUpdatedAt }, { userId });
  if (r.ok) revalidateAll(pathsForArticle(r.article.slug));
  return r;
}

export async function unpublishArticleAction(id) {
  const { userId } = await requireArea("content");
  const r = await unpublishArticle(getDb(), id, { userId });
  if (r.ok) revalidateAll(pathsForArticle(r.article.slug));
  return r;
}
```

`app/admin/projects/actions.js`:

```js
"use server";

import { getDb } from "@/lib/db.js";
import { requireArea } from "@/lib/auth.js";
import { pathsForProject, revalidateAll } from "@/lib/revalidate.js";
import { saveProject, addProjectPhoto, deleteProjectPhoto, getProject } from "@/lib/content/projects.js";

export async function saveProjectAction(input) {
  const { userId } = await requireArea("content");
  const r = await saveProject(getDb(), input, { userId });
  if (r.ok) revalidateAll(pathsForProject(r.project.slug));
  return r;
}

export async function addProjectPhotoAction(input) {
  await requireArea("content");
  const db = getDb();
  const r = await addProjectPhoto(db, input);
  if (r.ok) revalidateAll(pathsForProject((await getProject(db, input.projectId)).slug));
  return r;
}

export async function deleteProjectPhotoAction(photoId, slug) {
  await requireArea("content");
  const r = await deleteProjectPhoto(getDb(), photoId);
  if (r.ok) revalidateAll(pathsForProject(slug));
  return r;
}
```

`app/admin/resources/actions.js`:

```js
"use server";

import { getDb } from "@/lib/db.js";
import { requireArea } from "@/lib/auth.js";
import { RESOURCE_PATHS, revalidateAll } from "@/lib/revalidate.js";
import { createResource, deleteResource } from "@/lib/content/resources.js";

export async function createResourceAction(input) {
  const { userId } = await requireArea("content");
  const r = await createResource(getDb(), input, { userId });
  if (r.ok) revalidateAll(RESOURCE_PATHS);
  return r;
}

export async function deleteResourceAction(id) {
  await requireArea("content");
  const r = await deleteResource(getDb(), id);
  if (r.ok) revalidateAll(RESOURCE_PATHS);
  return r;
}
```

`app/admin/seo-plan/actions.js`:

```js
"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db.js";
import { requireArea } from "@/lib/auth.js";
import { addPlanKeyword, setPlanStatus } from "@/lib/content/seoPlan.js";

const num = (v) => (v === null || v === "" ? null : Number(v));

export async function addPlanKeywordAction(formData) {
  await requireArea("content");
  await addPlanKeyword(getDb(), {
    month: String(formData.get("month") ?? ""),
    keyword: String(formData.get("keyword") ?? ""),
    volume: num(formData.get("volume")),
    kd: num(formData.get("kd")),
    workingTitle: String(formData.get("workingTitle") ?? "") || null,
  });
  revalidatePath("/admin/seo-plan");
}

export async function setPlanStatusAction(formData) {
  await requireArea("content");
  await setPlanStatus(getDb(), Number(formData.get("id")), String(formData.get("status")));
  revalidatePath("/admin/seo-plan");
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/roles.js lib/auth.js lib/revalidate.js app/admin test
git commit -m "Add admin-only server actions that refresh affected public pages"
```

---

### Task 8: Uploads to Vercel Blob

**Files:**
- Create: `app/api/upload/route.js`
- Modify: `package.json`, `.env.example`, `README.md`

**Interfaces:**
- Consumes: `UPLOAD_TYPES`, `MAX_UPLOAD_BYTES`, `canAccess`, `roleFromSessionClaims`.
- Produces: `POST /api/upload` compatible with `upload(..., { handleUploadUrl: "/api/upload" })` from `@vercel/blob/client`.

**Prerequisite (manual):** in the Vercel dashboard → Storage → Create **Blob** store "jci-roxas-halaran", connect it to the project (adds `BLOB_READ_WRITE_TOKEN` to Production/Preview), then `vercel env pull .env.blob` and copy only `BLOB_READ_WRITE_TOKEN` into `.env.local`.

- [ ] **Step 1: Install**

Run: `npm install @vercel/blob@^1.1.0`

- [ ] **Step 2: Implement the route**

`app/api/upload/route.js`:

```js
import { handleUpload } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { canAccess, roleFromSessionClaims } from "@/lib/roles.js";
import { UPLOAD_TYPES, MAX_UPLOAD_BYTES } from "@/lib/uploads.js";

async function isContentAdmin() {
  const { userId, sessionClaims } = await auth();
  return Boolean(userId) && canAccess(roleFromSessionClaims(sessionClaims), "content");
}

export async function POST(request) {
  const body = await request.json();
  // Check the role before Blob does anything (including looking for its token),
  // so a signed-out or non-admin caller always gets 403.
  if (body?.type === "blob.generate-client-token" && !(await isContentAdmin())) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        if (!(await isContentAdmin())) throw new Error("Not allowed");
        return { allowedContentTypes: UPLOAD_TYPES, maximumSizeInBytes: MAX_UPLOAD_BYTES, addRandomSuffix: true };
      },
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(json);
  } catch (error) {
    const status = error.message === "Not allowed" ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
```

Add to `.env.example`:

```
# Vercel Blob (uploads; from the connected Blob store)
BLOB_READ_WRITE_TOKEN=
```

Add to the README deploy checklist, as item 4:

```markdown
4. **Vercel Blob.** Create a Blob store in Vercel → Storage and connect it to the project, so
   `BLOB_READ_WRITE_TOKEN` exists for Production and Preview. Admin image and file uploads need it.
```

- [ ] **Step 3: Verify the gate**

Run:

```bash
npm run build && (npx next start -p 5199 &) && sleep 5
curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "content-type: application/json" \
  -d '{"type":"blob.generate-client-token","payload":{"pathname":"a.jpg","callbackUrl":"http://localhost:5199/api/upload","clientPayload":null,"multipart":false}}' \
  http://localhost:5199/api/upload
pkill -f "next start -p 5199"
```

Expected: `403` (signed out).

- [ ] **Step 4: Commit**

```bash
git add app/api/upload/route.js package.json package-lock.json .env.example README.md
git commit -m "Add admin-only Vercel Blob upload route"
```

---

### Task 9: Editor components

**Files:**
- Create: `components/admin/FileUpload.jsx`, `components/admin/RichTextEditor.jsx`, `components/admin/GooglePreview.jsx`, `test/admin-components.test.jsx`
- Modify: `package.json`, `app/globals.css`

**Interfaces:**
- Produces:
  - `<FileUpload accept={string} requireAlt={boolean} label={string} onUploaded={({ url, alt, name }) => void} />`
  - `<RichTextEditor initialJson={string|null} onChange={({ json, html }) => void} />`
  - `<GooglePreview title={string} slug={string} description={string} basePath="/articles" />`
  - `previewTitle(title)` and `previewDescription(text)` exported from `GooglePreview.jsx` (truncate to 60 / 158 characters with "…").

- [ ] **Step 1: Install**

Run: `npm install @tiptap/react@^2.12.0 @tiptap/pm@^2.12.0 @tiptap/starter-kit@^2.12.0 @tiptap/extension-link@^2.12.0 @tiptap/extension-image@^2.12.0`

- [ ] **Step 2: Write the failing tests**

`test/admin-components.test.jsx`:

```jsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import GooglePreview, { previewTitle, previewDescription } from "@/components/admin/GooglePreview.jsx";
import FileUpload from "@/components/admin/FileUpload.jsx";

afterEach(cleanup);

describe("GooglePreview", () => {
  it("truncates like a search result", () => {
    expect(previewTitle("x".repeat(70))).toBe(`${"x".repeat(59)}…`);
    expect(previewDescription("y".repeat(200))).toBe(`${"y".repeat(157)}…`);
  });

  it("shows the URL the article will have", () => {
    render(<GooglePreview title="Rizal Day" slug="rizal-day" description="d" basePath="/articles" />);
    expect(screen.getByText(/jciroxashalaran\.com › articles › rizal-day/)).toBeTruthy();
  });
});

describe("FileUpload", () => {
  it("keeps the upload button disabled until alt text is written", () => {
    render(<FileUpload accept="image/*" requireAlt label="Cover image" onUploaded={() => {}} />);
    const button = screen.getByRole("button", { name: "Upload" });
    expect(button.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Alt text (describe the image)"), { target: { value: "Volunteers" } });
    expect(button.disabled).toBe(true); // still no file
  });

  it("shows the file-type message before uploading", () => {
    render(<FileUpload accept="image/*" requireAlt label="Cover image" onUploaded={() => {}} />);
    const file = new File(["x"], "IMG_0001.HEIC", { type: "image/heic" });
    fireEvent.change(screen.getByLabelText("Cover image"), { target: { files: [file] } });
    expect(screen.getByRole("alert").textContent).toContain("share as JPG first");
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run test/admin-components.test.jsx`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement**

`components/admin/GooglePreview.jsx`:

```jsx
const cut = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
export const previewTitle = (t) => cut(t, 60);
export const previewDescription = (d) => cut(d, 158);

export default function GooglePreview({ title, slug, description, basePath }) {
  return (
    <div className="gpreview" aria-label="Google search preview">
      <span className="gpreview__url">jciroxashalaran.com › {basePath.replace(/^\//, "")} › {slug || "…"}</span>
      <span className="gpreview__title">{previewTitle(`${title || "Untitled"} | JCI Roxas Halaran`)}</span>
      <span className="gpreview__desc">{previewDescription(description || "Add a meta description.")}</span>
    </div>
  );
}
```

`components/admin/FileUpload.jsx`:

```jsx
"use client";

import { useId, useState } from "react";
import { upload } from "@vercel/blob/client";
import { checkUpload } from "@/lib/uploads.js";

export default function FileUpload({ accept, requireAlt = false, label, onUploaded }) {
  const id = useId();
  const [file, setFile] = useState(null);
  const [alt, setAlt] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  function choose(e) {
    const f = e.target.files?.[0] ?? null;
    const problem = f ? checkUpload({ type: f.type, size: f.size }) : null;
    setError(problem);
    setFile(problem ? null : f);
  }

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const blob = await upload(file.name, file, { access: "public", handleUploadUrl: "/api/upload" });
      onUploaded({ url: blob.url, alt: alt.trim(), name: file.name });
      setFile(null);
      setAlt("");
    } catch (e) {
      setError(`Upload failed (${e.message}). Check your connection and try again.`);
    } finally {
      setBusy(false);
    }
  }

  const ready = file && (!requireAlt || alt.trim()) && !busy;
  return (
    <div className="upload">
      <label htmlFor={`${id}-file`}>{label}</label>
      <input id={`${id}-file`} type="file" accept={accept} onChange={choose} />
      {requireAlt && (
        <>
          <label htmlFor={`${id}-alt`}>Alt text (describe the image)</label>
          <input id={`${id}-alt`} value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={200} />
        </>
      )}
      <button type="button" className="btn" disabled={!ready} onClick={send}>
        {busy ? "Uploading…" : "Upload"}
      </button>
      {error && <p role="alert" className="form-error">{error}</p>}
    </div>
  );
}
```

`components/admin/RichTextEditor.jsx`:

```jsx
"use client";

import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import FileUpload from "./FileUpload.jsx";

function ToolButton({ editor, label, action, active }) {
  return (
    <button
      type="button"
      className={"tool" + (active ? " tool--on" : "")}
      aria-pressed={active}
      onClick={() => action(editor.chain().focus()).run()}
    >
      {label}
    </button>
  );
}

export default function RichTextEditor({ initialJson, onChange }) {
  const [linkUrl, setLinkUrl] = useState("");
  const [showImage, setShowImage] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, codeBlock: false, code: false, horizontalRule: false, strike: false }),
      Link.configure({ openOnClick: false }),
      Image,
    ],
    content: initialJson ? JSON.parse(initialJson) : "",
    onUpdate: ({ editor: e }) => onChange({ json: JSON.stringify(e.getJSON()), html: e.getHTML() }),
  });
  if (!editor) return <div className="rte rte--loading">Loading editor…</div>;

  return (
    <div className="rte">
      <div className="rte__toolbar" role="toolbar" aria-label="Formatting">
        <ToolButton editor={editor} label="H2" active={editor.isActive("heading", { level: 2 })} action={(c) => c.toggleHeading({ level: 2 })} />
        <ToolButton editor={editor} label="H3" active={editor.isActive("heading", { level: 3 })} action={(c) => c.toggleHeading({ level: 3 })} />
        <ToolButton editor={editor} label="Bold" active={editor.isActive("bold")} action={(c) => c.toggleBold()} />
        <ToolButton editor={editor} label="Italic" active={editor.isActive("italic")} action={(c) => c.toggleItalic()} />
        <ToolButton editor={editor} label="• List" active={editor.isActive("bulletList")} action={(c) => c.toggleBulletList()} />
        <ToolButton editor={editor} label="1. List" active={editor.isActive("orderedList")} action={(c) => c.toggleOrderedList()} />
        <ToolButton editor={editor} label="Quote" active={editor.isActive("blockquote")} action={(c) => c.toggleBlockquote()} />
        <span className="rte__link">
          <input aria-label="Link URL" placeholder="https://…" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
          <button type="button" className="tool" onClick={() => { if (linkUrl) editor.chain().focus().setLink({ href: linkUrl }).run(); setLinkUrl(""); }}>Link</button>
          <button type="button" className="tool" onClick={() => editor.chain().focus().unsetLink().run()}>Unlink</button>
        </span>
        <button type="button" className="tool" onClick={() => setShowImage(!showImage)}>Image</button>
      </div>
      {showImage && (
        <FileUpload
          accept="image/jpeg,image/png,image/webp"
          requireAlt
          label="Image to insert"
          onUploaded={({ url, alt }) => { editor.chain().focus().setImage({ src: url, alt }).run(); setShowImage(false); }}
        />
      )}
      <EditorContent editor={editor} className="rte__body article-body" />
    </div>
  );
}
```

Append admin styles to `app/globals.css`:

```css
/* ============================================================
   Admin (Phase 2)
   ============================================================ */
.admin { padding: 48px var(--pad-x) 96px; display: flex; flex-direction: column; gap: 32px; }
.admin h1 { font-family: var(--font-syne), sans-serif; font-weight: 800; font-size: clamp(1.8rem, 4vw, 2.6rem); color: var(--dune); }
.admin-nav { display: flex; flex-wrap: wrap; gap: 20px; font-family: var(--font-space-grotesk), monospace; font-size: 0.78rem; letter-spacing: 0.12em; text-transform: uppercase; }
.admin-table { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
.admin-table th, .admin-table td { text-align: left; padding: 12px 8px; border-top: 1px solid rgba(237, 232, 223, 0.12); }
.admin-table th { font-family: var(--font-space-grotesk), monospace; font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(237, 232, 223, 0.6); }
.editor { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 32px; align-items: start; }
@media (max-width: 1000px) { .editor { grid-template-columns: 1fr; } }
.editor__side { display: flex; flex-direction: column; gap: 16px; background: rgba(237, 232, 223, 0.04); padding: 20px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field label, .upload label { font-family: var(--font-space-grotesk), monospace; font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(237, 232, 223, 0.7); }
.field input, .field select, .field textarea, .upload input, .rte__link input {
  background: var(--basalt); color: var(--dune); border: 1px solid rgba(237, 232, 223, 0.2); padding: 10px 12px; font: inherit;
}
.field .count { font-size: 0.75rem; color: rgba(237, 232, 223, 0.5); }
.field .count--over { color: var(--ochre); }
.title-input { font-family: var(--font-syne), sans-serif; font-weight: 800; font-size: 1.8rem; background: transparent; color: var(--dune); border: none; border-bottom: 1px solid rgba(237, 232, 223, 0.2); padding: 8px 0; width: 100%; }
.form-error { color: #f2b8a2; }
.form-errors { border-left: 3px solid var(--ochre); padding: 12px 16px; background: rgba(229, 168, 35, 0.08); }
.form-ok { color: #a9d6b5; }
.actions { display: flex; flex-wrap: wrap; gap: 12px; }
.btn--ghost { background: transparent; color: var(--dune); border: 1px solid rgba(237, 232, 223, 0.3); }
.upload { display: flex; flex-direction: column; gap: 8px; padding: 12px; border: 1px dashed rgba(237, 232, 223, 0.25); }
.rte { border: 1px solid rgba(237, 232, 223, 0.2); }
.rte__toolbar { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px; border-bottom: 1px solid rgba(237, 232, 223, 0.2); }
.tool { background: transparent; color: var(--dune); border: 1px solid rgba(237, 232, 223, 0.2); padding: 6px 10px; font: inherit; font-size: 0.8rem; cursor: pointer; }
.tool--on { background: var(--ochre); color: var(--basalt); }
.rte__link { display: inline-flex; gap: 6px; }
.rte__body .ProseMirror { min-height: 420px; padding: 20px; outline: none; }
.gpreview { display: flex; flex-direction: column; gap: 4px; background: #fff; color: #202124; padding: 14px; font-family: Arial, sans-serif; }
.gpreview__url { font-size: 0.8rem; color: #4d5156; }
.gpreview__title { font-size: 1.15rem; color: #1a0dab; }
.gpreview__desc { font-size: 0.85rem; color: #4d5156; line-height: 1.5; }
.plan { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; }
.plan__card { border-top: 2px solid var(--sage); padding: 12px 0; display: flex; flex-direction: column; gap: 6px; }
.plan__card .k { font-family: var(--font-syne), sans-serif; font-weight: 700; color: var(--dune); }
.plan__card .m { font-size: 0.8rem; color: rgba(237, 232, 223, 0.6); }
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add components/admin app/globals.css test/admin-components.test.jsx package.json package-lock.json
git commit -m "Add the Tiptap editor, file uploader and Google preview components"
```

---

### Task 10: Admin screens

**Files:**
- Create: `components/admin/AdminNav.jsx`, `components/admin/ArticleEditor.jsx`, `components/admin/ProjectEditor.jsx`, `components/admin/ResourceForm.jsx`, `app/admin/articles/page.jsx`, `app/admin/articles/new/page.jsx`, `app/admin/articles/[id]/page.jsx`, `app/admin/articles/[id]/preview/page.jsx`, `app/admin/projects/page.jsx`, `app/admin/projects/new/page.jsx`, `app/admin/projects/[id]/page.jsx`, `app/admin/resources/page.jsx`, `app/admin/seo-plan/page.jsx`
- Modify: `app/admin/page.jsx`

**Interfaces:**
- Consumes: Task 5–7 stores and actions; Task 9 components; `requireArea`; `listMembers` below.
- Produces: the admin screens in spec §4. Article page component `ArticleView` from Task 11 is used by the preview page, so build Task 11's `components/ArticleView.jsx` first if executing out of order.

This task is UI wiring over tested stores and actions; its checks are the build, the signed-out e2e redirect (Task 12) and the manual run-through (Task 13).

- [ ] **Step 1: Admin navigation and dashboard**

`components/admin/AdminNav.jsx`:

```jsx
import Link from "next/link";

export default function AdminNav({ isAdmin }) {
  return (
    <nav className="admin-nav" aria-label="Admin">
      <Link href="/admin">Dashboard</Link>
      {isAdmin && (
        <>
          <Link href="/admin/articles">Articles</Link>
          <Link href="/admin/projects">Projects</Link>
          <Link href="/admin/resources">Resources</Link>
          <Link href="/admin/seo-plan">SEO plan</Link>
        </>
      )}
    </nav>
  );
}
```

Overwrite `app/admin/page.jsx`:

```jsx
import Link from "next/link";
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { monthProgress } from "@/lib/content/seoPlan.js";
import { listArticlesAdmin } from "@/lib/content/articles.js";
import AdminNav from "@/components/admin/AdminNav.jsx";

export const metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const thisMonth = () => new Date().toISOString().slice(0, 7);

export default async function Admin() {
  const { role } = await requireArea("admin");
  const isAdmin = role === "admin";
  const db = getDb();
  const month = thisMonth();
  const [progress, drafts] = isAdmin
    ? await Promise.all([monthProgress(db, month), listArticlesAdmin(db, { status: "draft" })])
    : [null, []];

  return (
    <div className="admin">
      <h1>Admin</h1>
      <AdminNav isAdmin={isAdmin} />
      <p>Signed in as <strong>{role}</strong>.{!isAdmin && " Only admins can edit content."}</p>
      {isAdmin && (
        <>
          <section>
            <h2 className="syne">SEO plan {month}</h2>
            <p>{progress.published} of {progress.total} articles published. <Link href="/admin/seo-plan">Open the plan →</Link></p>
          </section>
          <section>
            <h2 className="syne">Drafts</h2>
            {drafts.length === 0 ? <p>No drafts.</p> : (
              <ul>{drafts.slice(0, 5).map((a) => <li key={a.id}><Link href={`/admin/articles/${a.id}`}>{a.title}</Link></li>)}</ul>
            )}
            <p><Link className="btn" href="/admin/articles/new">New article</Link></p>
          </section>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Article list and editor pages**

`app/admin/articles/page.jsx`:

```jsx
import Link from "next/link";
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listArticlesAdmin } from "@/lib/content/articles.js";
import { CATEGORY_LABELS } from "@/lib/content/validation.js";
import AdminNav from "@/components/admin/AdminNav.jsx";

export const metadata = { title: "Articles — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminArticles({ searchParams }) {
  await requireArea("content");
  const { status } = await searchParams;
  const list = await listArticlesAdmin(getDb(), { status: ["draft", "published"].includes(status) ? status : undefined });
  return (
    <div className="admin">
      <h1>Articles</h1>
      <AdminNav isAdmin />
      <p className="actions">
        <Link className="btn" href="/admin/articles/new">New article</Link>
        <Link href="/admin/articles">All</Link>
        <Link href="/admin/articles?status=draft">Drafts</Link>
        <Link href="/admin/articles?status=published">Published</Link>
      </p>
      <table className="admin-table">
        <thead><tr><th>Title</th><th>Status</th><th>Category</th><th>Keyword</th><th>Updated</th></tr></thead>
        <tbody>
          {list.map((a) => (
            <tr key={a.id}>
              <td><Link href={`/admin/articles/${a.id}`}>{a.title}</Link></td>
              <td>{a.status}</td>
              <td>{CATEGORY_LABELS[a.category]}</td>
              <td>{a.targetKeyword ?? "—"}</td>
              <td>{a.updatedAt.slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

`components/admin/ArticleEditor.jsx`:

```jsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import RichTextEditor from "./RichTextEditor.jsx";
import FileUpload from "./FileUpload.jsx";
import GooglePreview from "./GooglePreview.jsx";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/content/validation.js";
import { saveArticleAction, publishArticleAction, unpublishArticleAction } from "@/app/admin/articles/actions.js";

const blank = { title: "", slug: "", metaDescription: "", targetKeyword: "", category: "community", bodyJson: "", bodyHtml: "", coverUrl: "", coverAlt: "", authorId: "", projectId: "" };

export default function ArticleEditor({ article, authors, projects, planKeywords, prefill = {} }) {
  const router = useRouter();
  const [form, setForm] = useState(() => (article ? { ...blank, ...strip(article) } : { ...blank, ...prefill }));
  const [meta, setMeta] = useState(article ? { id: article.id, updatedAt: article.updatedAt, status: article.status, locked: Boolean(article.publishedAt) } : null);
  const [errors, setErrors] = useState([]);
  const [notice, setNotice] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    const warn = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = (key) => (e) => { setForm((f) => ({ ...f, [key]: e.target.value })); setDirty(true); };

  function apply(r, message) {
    if (!r.ok) { setErrors(r.errors); setNotice(null); return false; }
    setErrors([]);
    setNotice(message);
    setDirty(false);
    setMeta({ id: r.article.id, updatedAt: r.article.updatedAt, status: r.article.status, locked: Boolean(r.article.publishedAt) });
    setForm((f) => ({ ...f, slug: r.article.slug }));
    if (!article && !meta) router.replace(`/admin/articles/${r.article.id}`);
    return true;
  }

  const save = () => start(async () => {
    apply(await saveArticleAction({ ...form, id: meta?.id, expectedUpdatedAt: meta?.updatedAt }), "Saved.");
  });
  const publish = () => start(async () => {
    const saved = await saveArticleAction({ ...form, id: meta?.id, expectedUpdatedAt: meta?.updatedAt });
    if (!apply(saved, null)) return;
    apply(await publishArticleAction(saved.article.id, saved.article.updatedAt), "Published — live now.");
  });
  const unpublish = () => start(async () => apply(await unpublishArticleAction(meta.id), "Unpublished — no longer public."));

  return (
    <div className="editor">
      <div>
        <input className="title-input" aria-label="Title" placeholder="Article title" value={form.title} onChange={set("title")} />
        {errors.length > 0 && (
          <div className="form-errors" role="alert"><ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul></div>
        )}
        {notice && <p className="form-ok" role="status">{notice}</p>}
        <RichTextEditor
          initialJson={article?.bodyJson ?? null}
          onChange={({ json, html }) => { setForm((f) => ({ ...f, bodyJson: json, bodyHtml: html })); setDirty(true); }}
        />
      </div>
      <aside className="editor__side">
        <div className="actions">
          <button type="button" className="btn btn--ghost" disabled={pending} onClick={save}>Save draft</button>
          <button type="button" className="btn" disabled={pending} onClick={publish}>{meta?.status === "published" ? "Update" : "Publish"}</button>
          {meta?.status === "published" && <button type="button" className="btn btn--ghost" disabled={pending} onClick={unpublish}>Unpublish</button>}
          {meta && <a href={`/admin/articles/${meta.id}/preview`} target="_blank" rel="noreferrer">Preview</a>}
        </div>
        <div className="field">
          <label htmlFor="slug">Address</label>
          <input id="slug" value={form.slug} onChange={set("slug")} readOnly={meta?.locked} placeholder="made from the title" />
          {meta?.locked && <span className="count">Locked after first publish so links never break.</span>}
        </div>
        <div className="field">
          <label htmlFor="kw">Target keyword</label>
          <input id="kw" list="plan-keywords" value={form.targetKeyword} onChange={set("targetKeyword")} />
          <datalist id="plan-keywords">{planKeywords.map((k) => <option key={k} value={k} />)}</datalist>
        </div>
        <div className="field">
          <label htmlFor="meta">Meta description</label>
          <textarea id="meta" rows={4} value={form.metaDescription} onChange={set("metaDescription")} />
          <span className={"count" + (form.metaDescription.length > 160 ? " count--over" : "")}>{form.metaDescription.length}/160</span>
        </div>
        <GooglePreview title={form.title} slug={form.slug} description={form.metaDescription} basePath="/articles" />
        <div className="field">
          <label htmlFor="cat">Category</label>
          <select id="cat" value={form.category} onChange={set("category")}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="author">Author</label>
          <select id="author" value={form.authorId ?? ""} onChange={set("authorId")}>
            <option value="">JCI Roxas Halaran</option>
            {authors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="proj">Related project</label>
          <select id="proj" value={form.projectId ?? ""} onChange={set("projectId")}>
            <option value="">None</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
        {form.coverUrl ? (
          <div className="field">
            <label>Cover image</label>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={form.coverUrl} alt={form.coverAlt} />
            <input aria-label="Cover alt text" value={form.coverAlt} onChange={set("coverAlt")} />
            <button type="button" className="tool" onClick={() => { setForm((f) => ({ ...f, coverUrl: "", coverAlt: "" })); setDirty(true); }}>Remove cover</button>
          </div>
        ) : (
          <FileUpload accept="image/jpeg,image/png,image/webp" requireAlt label="Cover image" onUploaded={({ url, alt }) => { setForm((f) => ({ ...f, coverUrl: url, coverAlt: alt })); setDirty(true); }} />
        )}
      </aside>
    </div>
  );
}

function strip(a) {
  return {
    title: a.title ?? "", slug: a.slug ?? "", metaDescription: a.metaDescription ?? "", targetKeyword: a.targetKeyword ?? "",
    category: a.category, bodyJson: a.bodyJson ?? "", bodyHtml: a.bodyHtml ?? "", coverUrl: a.coverUrl ?? "", coverAlt: a.coverAlt ?? "",
    authorId: a.authorId ?? "", projectId: a.projectId ?? "",
  };
}
```

Add to `lib/queries.js`:

```js
export function listMembers(db) {
  return db.select({ id: members.id, name: members.name }).from(members).orderBy(asc(members.name));
}
```

`app/admin/articles/new/page.jsx`:

```jsx
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listMembers, listProjects } from "@/lib/queries.js";
import { listPlan } from "@/lib/content/seoPlan.js";
import AdminNav from "@/components/admin/AdminNav.jsx";
import ArticleEditor from "@/components/admin/ArticleEditor.jsx";

export const metadata = { title: "New article — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NewArticle({ searchParams }) {
  await requireArea("content");
  const { keyword = "", title = "" } = await searchParams;
  const db = getDb();
  const [authors, projects, plan] = await Promise.all([listMembers(db), listProjects(db), listPlan(db)]);
  return (
    <div className="admin">
      <AdminNav isAdmin />
      <h1>New article</h1>
      <ArticleEditor article={null} authors={authors} projects={projects} planKeywords={plan.map((p) => p.keyword)} prefill={{ targetKeyword: keyword, title }} />
    </div>
  );
}
```

`app/admin/articles/[id]/page.jsx`:

```jsx
import { notFound } from "next/navigation";
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listMembers, listProjects } from "@/lib/queries.js";
import { listPlan } from "@/lib/content/seoPlan.js";
import { getArticle } from "@/lib/content/articles.js";
import AdminNav from "@/components/admin/AdminNav.jsx";
import ArticleEditor from "@/components/admin/ArticleEditor.jsx";

export const metadata = { title: "Edit article — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function EditArticle({ params }) {
  await requireArea("content");
  const { id } = await params;
  const db = getDb();
  const article = await getArticle(db, id);
  if (!article) notFound();
  const [authors, projects, plan] = await Promise.all([listMembers(db), listProjects(db), listPlan(db)]);
  return (
    <div className="admin">
      <AdminNav isAdmin />
      <h1>Edit article</h1>
      <ArticleEditor article={article} authors={authors} projects={projects} planKeywords={plan.map((p) => p.keyword)} />
    </div>
  );
}
```

`app/admin/articles/[id]/preview/page.jsx`:

```jsx
import { notFound } from "next/navigation";
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { getArticle } from "@/lib/content/articles.js";
import ArticleView from "@/components/ArticleView.jsx";

export const metadata = { title: "Preview — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PreviewArticle({ params }) {
  await requireArea("content");
  const { id } = await params;
  const article = await getArticle(getDb(), id);
  if (!article) notFound();
  return (
    <>
      <p className="form-errors" role="status">Preview — {article.status === "published" ? "this is live" : "not public yet"}.</p>
      <ArticleView article={{ ...article, authorName: null }} related={[]} project={null} />
    </>
  );
}
```

- [ ] **Step 3: Projects admin**

`components/admin/ProjectEditor.jsx`:

```jsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import RichTextEditor from "./RichTextEditor.jsx";
import FileUpload from "./FileUpload.jsx";
import { saveProjectAction, addProjectPhotoAction, deleteProjectPhotoAction } from "@/app/admin/projects/actions.js";

const fields = ["title", "summary", "startDate", "endDate", "barangay", "pillar", "status", "coverUrl", "coverAlt", "bodyJson", "bodyHtml"];

export default function ProjectEditor({ project }) {
  const router = useRouter();
  const [form, setForm] = useState(() =>
    Object.fromEntries(fields.map((k) => [k, project?.[k === "bodyHtml" ? "body" : k] ?? (k === "pillar" ? "community" : k === "status" ? "done" : "")])),
  );
  const [meta, setMeta] = useState(project ? { id: project.id, updatedAt: project.updatedAt, slug: project.slug } : null);
  const [photos, setPhotos] = useState(project?.photos ?? []);
  const [errors, setErrors] = useState([]);
  const [notice, setNotice] = useState(null);
  const [pending, start] = useTransition();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = () => start(async () => {
    const r = await saveProjectAction({ ...form, id: meta?.id, expectedUpdatedAt: meta?.updatedAt ?? null });
    if (!r.ok) { setErrors(r.errors); return; }
    setErrors([]);
    setNotice("Saved — live now.");
    setMeta({ id: r.project.id, updatedAt: r.project.updatedAt, slug: r.project.slug });
    if (!project) router.replace(`/admin/projects/${r.project.id}`);
  });

  return (
    <div className="editor">
      <div>
        <input className="title-input" aria-label="Title" placeholder="Project title" value={form.title} onChange={set("title")} />
        {errors.length > 0 && <div className="form-errors" role="alert"><ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul></div>}
        {notice && <p className="form-ok" role="status">{notice}</p>}
        <RichTextEditor initialJson={project?.bodyJson ?? null} onChange={({ json, html }) => setForm((f) => ({ ...f, bodyJson: json, bodyHtml: html }))} />
        {meta && (
          <section>
            <h2 className="syne">Gallery</h2>
            <ul>
              {photos.map((p) => (
                <li key={p.id}>
                  {p.alt}{" "}
                  <button type="button" className="tool" onClick={() => start(async () => {
                    const r = await deleteProjectPhotoAction(p.id, meta.slug);
                    if (r.ok) setPhotos((ps) => ps.filter((x) => x.id !== p.id));
                  })}>Remove</button>
                </li>
              ))}
            </ul>
            <FileUpload accept="image/jpeg,image/png,image/webp" requireAlt label="Add a photo" onUploaded={({ url, alt }) => start(async () => {
              const r = await addProjectPhotoAction({ projectId: meta.id, url, alt });
              if (r.ok) setPhotos((ps) => [...ps, r.photo]); else setErrors(r.errors);
            })} />
          </section>
        )}
      </div>
      <aside className="editor__side">
        <div className="actions">
          <button type="button" className="btn" disabled={pending} onClick={save}>Save</button>
          {meta && <a href={`/projects/${meta.slug}`} target="_blank" rel="noreferrer">View</a>}
        </div>
        <div className="field"><label htmlFor="summary">Summary</label><textarea id="summary" rows={3} value={form.summary} onChange={set("summary")} /></div>
        <div className="field"><label htmlFor="start">Start date</label><input id="start" type="date" value={form.startDate} onChange={set("startDate")} /></div>
        <div className="field"><label htmlFor="end">End date</label><input id="end" type="date" value={form.endDate} onChange={set("endDate")} /></div>
        <div className="field"><label htmlFor="brgy">Barangay</label><input id="brgy" value={form.barangay} onChange={set("barangay")} /></div>
        <div className="field">
          <label htmlFor="pillar">Pillar</label>
          <select id="pillar" value={form.pillar} onChange={set("pillar")}>
            <option value="leadership">Leadership</option><option value="community">Community</option><option value="global">Global</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="status">Status</label>
          <select id="status" value={form.status} onChange={set("status")}>
            <option value="planned">Planned</option><option value="ongoing">Ongoing</option><option value="done">Done</option>
          </select>
        </div>
        {form.coverUrl ? (
          <div className="field">
            <label>Cover image</label>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={form.coverUrl} alt={form.coverAlt} />
            <input aria-label="Cover alt text" value={form.coverAlt} onChange={set("coverAlt")} />
            <button type="button" className="tool" onClick={() => setForm((f) => ({ ...f, coverUrl: "", coverAlt: "" }))}>Remove cover</button>
          </div>
        ) : (
          <FileUpload accept="image/jpeg,image/png,image/webp" requireAlt label="Cover image" onUploaded={({ url, alt }) => setForm((f) => ({ ...f, coverUrl: url, coverAlt: alt }))} />
        )}
      </aside>
    </div>
  );
}
```

`app/admin/projects/page.jsx`:

```jsx
import Link from "next/link";
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listProjects } from "@/lib/queries.js";
import { formatDate } from "@/lib/format.js";
import AdminNav from "@/components/admin/AdminNav.jsx";

export const metadata = { title: "Projects — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminProjects() {
  await requireArea("content");
  const list = await listProjects(getDb());
  return (
    <div className="admin">
      <h1>Projects</h1>
      <AdminNav isAdmin />
      <p><Link className="btn" href="/admin/projects/new">New project</Link></p>
      <table className="admin-table">
        <thead><tr><th>Title</th><th>Date</th><th>Story</th></tr></thead>
        <tbody>
          {list.map((p) => (
            <tr key={p.id}>
              <td><Link href={`/admin/projects/${p.id}`}>{p.title}</Link></td>
              <td>{formatDate(p.startDate) ?? "—"}</td>
              <td>{p.body ? "Yes" : "Not yet"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

`app/admin/projects/new/page.jsx`:

```jsx
import { requireArea } from "@/lib/auth.js";
import AdminNav from "@/components/admin/AdminNav.jsx";
import ProjectEditor from "@/components/admin/ProjectEditor.jsx";

export const metadata = { title: "New project — Admin", robots: { index: false } };

export default async function NewProject() {
  await requireArea("content");
  return (
    <div className="admin">
      <AdminNav isAdmin />
      <h1>New project</h1>
      <ProjectEditor project={null} />
    </div>
  );
}
```

`app/admin/projects/[id]/page.jsx`:

```jsx
import { notFound } from "next/navigation";
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { getProject, getProjectBySlug } from "@/lib/content/projects.js";
import AdminNav from "@/components/admin/AdminNav.jsx";
import ProjectEditor from "@/components/admin/ProjectEditor.jsx";

export const metadata = { title: "Edit project — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function EditProject({ params }) {
  await requireArea("content");
  const { id } = await params;
  const db = getDb();
  const row = await getProject(db, id);
  if (!row) notFound();
  const project = await getProjectBySlug(db, row.slug);
  return (
    <div className="admin">
      <AdminNav isAdmin />
      <h1>Edit project</h1>
      <ProjectEditor project={project} />
    </div>
  );
}
```

- [ ] **Step 4: Resources and SEO plan admin**

`components/admin/ResourceForm.jsx`:

```jsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import FileUpload from "./FileUpload.jsx";
import { createResourceAction, deleteResourceAction } from "@/app/admin/resources/actions.js";

export function DeleteResourceButton({ id }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" className="tool" disabled={pending} onClick={() => start(async () => { await deleteResourceAction(id); router.refresh(); })}>
      Delete
    </button>
  );
}

export default function ResourceForm() {
  const router = useRouter();
  const [form, setForm] = useState({ title: "", description: "", kind: "template", visibility: "public", fileUrl: "" });
  const [errors, setErrors] = useState([]);
  const [pending, start] = useTransition();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = () => start(async () => {
    const r = await createResourceAction(form);
    if (!r.ok) { setErrors(r.errors); return; }
    setErrors([]);
    setForm({ title: "", description: "", kind: "template", visibility: "public", fileUrl: "" });
    router.refresh();
  });

  return (
    <section className="editor__side">
      <h2 className="syne">Add a resource</h2>
      {errors.length > 0 && <div className="form-errors" role="alert"><ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul></div>}
      <div className="field"><label htmlFor="rt">Title</label><input id="rt" value={form.title} onChange={set("title")} /></div>
      <div className="field"><label htmlFor="rd">Description</label><textarea id="rd" rows={2} value={form.description} onChange={set("description")} /></div>
      <div className="field">
        <label htmlFor="rk">Kind</label>
        <select id="rk" value={form.kind} onChange={set("kind")}>
          <option value="template">Template</option><option value="training">Training</option><option value="bylaws">Bylaws</option><option value="other">Other</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="rv">Who can see it</label>
        <select id="rv" value={form.visibility} onChange={set("visibility")}>
          <option value="public">Everyone</option><option value="members">Members only (Phase 4)</option>
        </select>
      </div>
      {form.fileUrl ? <p>File ready: {form.fileUrl.split("/").pop()}</p> : (
        <FileUpload accept="application/pdf,image/jpeg,image/png,image/webp" label="File" onUploaded={({ url }) => setForm((f) => ({ ...f, fileUrl: url }))} />
      )}
      <button type="button" className="btn" disabled={pending} onClick={submit}>Add resource</button>
    </section>
  );
}
```

`app/admin/resources/page.jsx`:

```jsx
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listResources } from "@/lib/content/resources.js";
import AdminNav from "@/components/admin/AdminNav.jsx";
import ResourceForm, { DeleteResourceButton } from "@/components/admin/ResourceForm.jsx";

export const metadata = { title: "Resources — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminResources() {
  await requireArea("content");
  const list = await listResources(getDb());
  return (
    <div className="admin">
      <h1>Resources</h1>
      <AdminNav isAdmin />
      <ResourceForm />
      <table className="admin-table">
        <thead><tr><th>Title</th><th>Kind</th><th>Visibility</th><th></th></tr></thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.id}>
              <td><a href={r.fileUrl} target="_blank" rel="noreferrer">{r.title}</a></td>
              <td>{r.kind}</td>
              <td>{r.visibility}</td>
              <td><DeleteResourceButton id={r.id} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

`app/admin/seo-plan/page.jsx`:

```jsx
import Link from "next/link";
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listPlan } from "@/lib/content/seoPlan.js";
import AdminNav from "@/components/admin/AdminNav.jsx";
import { addPlanKeywordAction, setPlanStatusAction } from "./actions.js";

export const metadata = { title: "SEO plan — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SeoPlan() {
  await requireArea("content");
  const rows = await listPlan(getDb());
  const months = [...new Set(rows.map((r) => r.month))];
  return (
    <div className="admin">
      <h1>SEO plan</h1>
      <AdminNav isAdmin />
      <div className="plan">
        {months.map((m) => {
          const items = rows.filter((r) => r.month === m);
          const done = items.filter((r) => r.status === "published").length;
          return (
            <section key={m}>
              <h2 className="syne">{m} — {done}/{items.length}</h2>
              {items.map((r) => (
                <div className="plan__card" key={r.id}>
                  <span className="k">{r.keyword}</span>
                  <span className="m">{r.volume ?? "—"} searches/mo · KD {r.kd ?? "—"}</span>
                  <span>{r.workingTitle}</span>
                  <form action={setPlanStatusAction} className="actions">
                    <input type="hidden" name="id" value={r.id} />
                    <select name="status" defaultValue={r.status} aria-label={`Status for ${r.keyword}`}>
                      <option value="idea">Idea</option><option value="drafting">Drafting</option><option value="published">Published</option>
                    </select>
                    <button className="tool" type="submit">Set</button>
                    {r.articleId ? (
                      <Link href={`/admin/articles/${r.articleId}`}>Open article</Link>
                    ) : (
                      <Link href={`/admin/articles/new?keyword=${encodeURIComponent(r.keyword)}&title=${encodeURIComponent(r.workingTitle ?? "")}`}>Write article</Link>
                    )}
                  </form>
                </div>
              ))}
            </section>
          );
        })}
      </div>
      <form action={addPlanKeywordAction} className="editor__side">
        <h2 className="syne">Add a keyword</h2>
        <div className="field"><label htmlFor="pm">Month</label><input id="pm" name="month" placeholder="2027-02" required /></div>
        <div className="field"><label htmlFor="pk">Keyword</label><input id="pk" name="keyword" required /></div>
        <div className="field"><label htmlFor="pv">Monthly searches</label><input id="pv" name="volume" type="number" min="0" /></div>
        <div className="field"><label htmlFor="pd">Difficulty (KD)</label><input id="pd" name="kd" type="number" min="0" max="100" /></div>
        <div className="field"><label htmlFor="pt">Working title</label><input id="pt" name="workingTitle" /></div>
        <button className="btn" type="submit">Add</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Build**

Run: `NEXT_DIST_DIR=.next-check npx next build`
Expected: build succeeds; admin routes listed as dynamic (ƒ).

- [ ] **Step 6: Commit**

```bash
git add components/admin app/admin lib/queries.js
git commit -m "Add admin screens for articles, projects, resources and the SEO plan"
```

---

### Task 11: Public article, project and resource pages

**Files:**
- Create: `components/ArticleCard.jsx`, `components/ArticleView.jsx`, `app/articles/page.jsx`, `app/articles/[slug]/page.jsx`, `app/projects/[slug]/page.jsx`, `app/resources/page.jsx`
- Modify: `lib/seo.js`, `test/seo.test.js`, `app/sitemap.js`, `lib/routes.js`, `components/ProjectCard.jsx`, `app/page.jsx`, `app/join/page.jsx`, `components/SiteFooter.jsx`, `app/globals.css`

**Interfaces:**
- Consumes: Task 5–6 public queries.
- Produces: `articleLd(article)`; `buildSitemap({ routes, articles = [], projects = [] })`; `<ArticleCard article featured? />`; `<ArticleView article related project />`.

- [ ] **Step 1: Write the failing tests**

In `test/seo.test.js`, add `articleLd` to the import, then replace the `describe("buildSitemap", …)` block with:

```js
describe("buildSitemap", () => {
  it("lists static routes without dates and content with its real update time", () => {
    const entries = buildSitemap({
      routes: ["/", "/about"],
      articles: [{ slug: "rizal-day", updatedAt: "2026-11-01T00:00:00.000Z" }],
      projects: [{ slug: "coastline-cuts", updatedAt: null }],
    });
    expect(entries).toEqual([
      { url: `${SITE.url}/`, changeFrequency: "weekly", priority: 1 },
      { url: `${SITE.url}/about`, changeFrequency: "monthly", priority: 0.7 },
      { url: `${SITE.url}/articles/rizal-day`, lastModified: new Date("2026-11-01T00:00:00.000Z"), changeFrequency: "monthly", priority: 0.8 },
      { url: `${SITE.url}/projects/coastline-cuts`, changeFrequency: "monthly", priority: 0.6 },
    ]);
  });
});

describe("articleLd", () => {
  const article = {
    slug: "rizal-day",
    title: "Rizal Day",
    metaDescription: "What Filipinos commemorate.",
    coverUrl: null,
    publishedAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-02T00:00:00.000Z",
    authorName: null,
  };

  it("describes an article by the chapter when there is no author", () => {
    const ld = articleLd(article);
    expect(ld).toMatchObject({
      "@type": "Article",
      headline: "Rizal Day",
      datePublished: "2026-11-01T00:00:00.000Z",
      dateModified: "2026-11-02T00:00:00.000Z",
      author: { "@type": "Organization", name: "JCI Roxas Halaran" },
      mainEntityOfPage: `${SITE.url}/articles/rizal-day`,
    });
    expect(ld.image).toBe(absoluteUrl(SITE.ogImage));
  });

  it("credits a named member as a Person", () => {
    expect(articleLd({ ...article, authorName: "Judy Daliva" }).author).toEqual({ "@type": "Person", name: "Judy Daliva" });
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run test/seo.test.js`
Expected: FAIL — `articleLd` is not a function; sitemap shape differs.

- [ ] **Step 3: Implement the SEO helpers**

In `lib/seo.js`, replace `buildSitemap` with:

```js
export function buildSitemap({ routes, articles = [], projects = [] }) {
  const entry = (path, updatedAt, priority) => ({
    url: absoluteUrl(path),
    ...(updatedAt ? { lastModified: new Date(updatedAt) } : {}),
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority,
  });
  return [
    ...routes.map((p) => entry(p, null, p === "/" ? 1 : 0.7)),
    ...articles.map((a) => entry(`/articles/${a.slug}`, a.updatedAt, 0.8)),
    ...projects.map((p) => entry(`/projects/${p.slug}`, p.updatedAt, 0.6)),
  ];
}

export function articleLd(article) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.metaDescription,
    image: article.coverUrl ?? absoluteUrl(SITE.ogImage),
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: article.authorName
      ? { "@type": "Person", name: article.authorName }
      : { "@type": "Organization", name: SITE.name },
    publisher: { "@type": "Organization", name: SITE.name, logo: { "@type": "ImageObject", url: absoluteUrl(SITE.logo) } },
    mainEntityOfPage: absoluteUrl(`/articles/${article.slug}`),
  };
}
```

Overwrite `app/sitemap.js`:

```js
import { STATIC_ROUTES } from "@/lib/routes.js";
import { buildSitemap } from "@/lib/seo.js";
import { getDb } from "@/lib/db.js";
import { listPublishedArticles } from "@/lib/content/articles.js";
import { listProjects } from "@/lib/queries.js";

export const revalidate = 3600;

export default async function sitemap() {
  const db = getDb();
  const [articles, projects] = await Promise.all([listPublishedArticles(db), listProjects(db)]);
  return buildSitemap({ routes: STATIC_ROUTES, articles, projects });
}
```

Update `lib/routes.js`:

```js
export const STATIC_ROUTES = ["/", "/about", "/officers", "/projects", "/articles", "/resources", "/join"];

export const NAV_LINKS = [
  { href: "/about", label: "About" },
  { href: "/projects", label: "Projects" },
  { href: "/articles", label: "Articles" },
  { href: "/officers", label: "Officers" },
  { href: "/join", label: "Join" },
];
```

Run: `npx vitest run test/seo.test.js test/redirects.test.js`
Expected: PASS.

- [ ] **Step 4: Article components and pages**

`components/ArticleCard.jsx`:

```jsx
import Link from "next/link";
import Image from "next/image";
import Contours from "@/components/Contours.jsx";
import { formatDate } from "@/lib/format.js";
import { CATEGORY_LABELS } from "@/lib/content/validation.js";

export default function ArticleCard({ article, featured = false }) {
  return (
    <article className={"project article-card" + (featured ? " article-card--featured" : "")}>
      <Link href={`/articles/${article.slug}`} className="article-card__link">
        <figure>
          {article.coverUrl ? (
            <Image src={article.coverUrl} alt={article.coverAlt ?? ""} fill sizes={featured ? "100vw" : "(max-width: 900px) 100vw, 33vw"} style={{ objectFit: "cover" }} />
          ) : (
            <div className="project__placeholder" aria-hidden="true"><Contours variant="quote" /><span>{CATEGORY_LABELS[article.category]}</span></div>
          )}
        </figure>
        <div className="project__meta">
          <h3>{article.title}</h3>
          <time className="label label--sm" dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
        </div>
        {article.metaDescription && <p className="article-card__excerpt">{article.metaDescription}</p>}
      </Link>
    </article>
  );
}
```

`components/ArticleView.jsx`:

```jsx
import Link from "next/link";
import Image from "next/image";
import ArticleCard from "@/components/ArticleCard.jsx";
import { formatDate } from "@/lib/format.js";
import { CATEGORY_LABELS } from "@/lib/content/validation.js";

export default function ArticleView({ article, related, project }) {
  return (
    <article className="article">
      <header className="page-hero article__head">
        <p className="label">
          <Link href={`/articles?category=${article.category}`}>{CATEGORY_LABELS[article.category]}</Link>
          {article.publishedAt && <> · <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time></>}
        </p>
        <h1>{article.title}</h1>
        <p className="article__byline">By {article.authorName ?? "JCI Roxas Halaran"}</p>
      </header>
      {article.coverUrl && (
        <figure className="article__cover">
          <Image src={article.coverUrl} alt={article.coverAlt ?? ""} fill sizes="100vw" style={{ objectFit: "cover" }} priority />
        </figure>
      )}
      <div className="section">
        <div className="article-body" dangerouslySetInnerHTML={{ __html: article.bodyHtml ?? "" }} />
        {project && (
          <p className="article__project">Part of our project <Link href={`/projects/${project.slug}`}>{project.title}</Link>.</p>
        )}
        <p className="section__more"><Link className="btn" href="/join">Join JCI Roxas Halaran</Link></p>
      </div>
      {related.length > 0 && (
        <section className="section section--line-top">
          <div className="section__bar"><h2>Related articles</h2><span className="label">Read next</span></div>
          <div className="projects">{related.map((a) => <ArticleCard key={a.id} article={a} />)}</div>
        </section>
      )}
    </article>
  );
}
```

`app/articles/page.jsx`:

```jsx
import Link from "next/link";
import ArticleCard from "@/components/ArticleCard.jsx";
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import { getDb } from "@/lib/db.js";
import { listPublishedArticles } from "@/lib/content/articles.js";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/content/validation.js";
import { pageMetadata, breadcrumbLd } from "@/lib/seo.js";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: "Articles",
  description: "Stories, guides and Capiz history from JCI Roxas Halaran: leadership, community, business and Philippine holidays.",
  path: "/articles",
});

export default async function Articles({ searchParams }) {
  const { category } = await searchParams;
  const active = CATEGORIES.includes(category) ? category : undefined;
  const list = await listPublishedArticles(getDb(), { category: active });
  const [first, ...rest] = list;
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Articles", path: "/articles" }])} />
      <header className="page-hero">
        <h1>Articles</h1>
        <p>Guides, stories and Capiz history from the chapter.</p>
        <p className="actions category-filter">
          <Link href="/articles" aria-current={active ? undefined : "page"}>All</Link>
          {CATEGORIES.map((c) => (
            <Link key={c} href={`/articles?category=${c}`} aria-current={active === c ? "page" : undefined}>{CATEGORY_LABELS[c]}</Link>
          ))}
        </p>
      </header>
      <section className="section">
        {list.length === 0 && <p>No articles here yet.</p>}
        {first && <ArticleCard article={first} featured />}
        {rest.length > 0 && <div className="projects article-grid">{rest.map((a) => <ArticleCard key={a.id} article={a} />)}</div>}
      </section>
      <SiteFooter />
    </>
  );
}
```

`app/articles/[slug]/page.jsx`:

```jsx
import { notFound } from "next/navigation";
import ArticleView from "@/components/ArticleView.jsx";
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import { getDb } from "@/lib/db.js";
import { getPublishedArticle, listPublishedArticles, relatedArticles } from "@/lib/content/articles.js";
import { getProject } from "@/lib/content/projects.js";
import { pageMetadata, breadcrumbLd, articleLd } from "@/lib/seo.js";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  return (await listPublishedArticles(getDb())).map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const article = await getPublishedArticle(getDb(), slug);
  if (!article) return { title: "Page not found", robots: { index: false } };
  const meta = pageMetadata({ title: article.title, description: article.metaDescription, path: `/articles/${slug}` });
  if (article.coverUrl) {
    meta.openGraph.images = [{ url: article.coverUrl }];
    meta.twitter.images = [article.coverUrl];
  }
  meta.openGraph.type = "article";
  return meta;
}

export default async function ArticlePage({ params }) {
  const { slug } = await params;
  const db = getDb();
  const article = await getPublishedArticle(db, slug);
  if (!article) notFound();
  const [related, project] = await Promise.all([
    relatedArticles(db, article),
    article.projectId ? getProject(db, article.projectId) : null,
  ]);
  return (
    <>
      <JsonLd data={articleLd(article)} />
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Articles", path: "/articles" }, { name: article.title, path: `/articles/${slug}` }])} />
      <ArticleView article={article} related={related} project={project} />
      <SiteFooter />
    </>
  );
}
```

- [ ] **Step 5: Project and resource pages**

`app/projects/[slug]/page.jsx`:

```jsx
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import ArticleCard from "@/components/ArticleCard.jsx";
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import { getDb } from "@/lib/db.js";
import { listProjects } from "@/lib/queries.js";
import { getProjectBySlug } from "@/lib/content/projects.js";
import { listArticlesForProject } from "@/lib/content/articles.js";
import { formatDate } from "@/lib/format.js";
import { pageMetadata, breadcrumbLd } from "@/lib/seo.js";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  return (await listProjects(getDb())).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const project = await getProjectBySlug(getDb(), slug);
  if (!project) return { title: "Page not found", robots: { index: false } };
  return pageMetadata({
    title: project.title,
    description: project.summary ?? `${project.title}, a JCI Roxas Halaran project in Roxas City, Capiz.`,
    path: `/projects/${slug}`,
  });
}

export default async function ProjectPage({ params }) {
  const { slug } = await params;
  const db = getDb();
  const project = await getProjectBySlug(db, slug);
  if (!project) notFound();
  const stories = await listArticlesForProject(db, project.id);
  const date = formatDate(project.startDate);
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Our projects", path: "/projects" }, { name: project.title, path: `/projects/${slug}` }])} />
      <header className="page-hero">
        <p className="label">{[date, project.barangay].filter(Boolean).join(" · ") || "Project"}</p>
        <h1>{project.title}</h1>
        {project.summary && <p>{project.summary}</p>}
      </header>
      {project.coverUrl && (
        <figure className="article__cover">
          <Image src={project.coverUrl} alt={project.coverAlt ?? project.title} fill sizes="100vw" style={{ objectFit: "cover" }} priority />
        </figure>
      )}
      <section className="section">
        {project.body ? <div className="article-body" dangerouslySetInnerHTML={{ __html: project.body }} /> : <p>The full story of this project is coming soon.</p>}
      </section>
      {project.photos.length > 0 && (
        <section className="section">
          <div className="section__bar"><h2>Gallery</h2><span className="label">Photos</span></div>
          <div className="projects">
            {project.photos.map((p) => (
              <figure className="gallery__item" key={p.id}>
                <Image src={p.url} alt={p.alt} fill sizes="(max-width: 900px) 100vw, 33vw" style={{ objectFit: "cover" }} />
              </figure>
            ))}
          </div>
        </section>
      )}
      {stories.length > 0 && (
        <section className="section">
          <div className="section__bar"><h2>Stories about this project</h2><span className="label">Articles</span></div>
          <div className="projects">{stories.map((a) => <ArticleCard key={a.id} article={a} />)}</div>
        </section>
      )}
      <p className="section"><Link className="btn" href="/projects">All projects</Link></p>
      <SiteFooter />
    </>
  );
}
```

`app/resources/page.jsx`:

```jsx
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import { getDb } from "@/lib/db.js";
import { listResources } from "@/lib/content/resources.js";
import { pageMetadata, breadcrumbLd } from "@/lib/seo.js";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: "Free resources",
  description: "Free templates from JCI Roxas Halaran: project proposal, sponsorship letter, event proposal and more.",
  path: "/resources",
});

const KIND_LABELS = { template: "Templates", training: "Training", bylaws: "Bylaws", other: "Other" };

export default async function Resources() {
  const list = await listResources(getDb(), { visibility: "public" });
  const kinds = Object.keys(KIND_LABELS).filter((k) => list.some((r) => r.kind === k));
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Free resources", path: "/resources" }])} />
      <header className="page-hero">
        <h1>Free resources</h1>
        <p>Templates and guides you can download and use for your own community projects.</p>
      </header>
      <section className="section">
        {list.length === 0 && <p>Resources are coming soon.</p>}
        {kinds.map((k) => (
          <div key={k}>
            <div className="section__bar"><h2>{KIND_LABELS[k]}</h2><span className="label">Download</span></div>
            <div className="list-rows">
              {list.filter((r) => r.kind === k).map((r) => (
                <div key={r.id}>
                  <span><span className="t">{r.title}</span>{r.description && <><br />{r.description}</>}</span>
                  <a className="btn" href={r.fileUrl} target="_blank" rel="noreferrer">Download</a>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
      <SiteFooter />
    </>
  );
}
```

- [ ] **Step 6: Link existing pages to the new ones**

Overwrite `components/ProjectCard.jsx` (same content as Phase 1, wrapped in a link to the project page):

```jsx
import Link from "next/link";
import Image from "next/image";
import Contours from "@/components/Contours.jsx";
import { formatDate } from "@/lib/format.js";

export default function ProjectCard({ project }) {
  const date = formatDate(project.startDate);
  return (
    <article className="project">
      <Link href={`/projects/${project.slug}`} className="article-card__link">
        <figure>
          {project.coverUrl ? (
            <Image src={project.coverUrl} alt={project.coverAlt ?? project.title} fill sizes="(max-width: 560px) 100vw, (max-width: 900px) 50vw, 33vw" style={{ objectFit: "cover" }} />
          ) : (
            <div className="project__placeholder" aria-hidden="true">
              <Contours variant="quote" />
              <span>JCI Roxas Halaran</span>
            </div>
          )}
        </figure>
        <div className="project__meta">
          <h3>{project.title}</h3>
          {date && (
            <time className="label label--sm" dateTime={project.startDate}>{date}</time>
          )}
        </div>
      </Link>
    </article>
  );
}
```

The Phase 1 component tests still pass: `next/link` renders in jsdom without a router. Add `slug: "x"` to the two `ProjectCard` test fixtures in `test/components.test.jsx` so the link has a real address.

In `app/page.jsx`, import `ArticleCard` and `listPublishedArticles`, load `latest` alongside projects:

```jsx
  const [projects, awards, latest] = await Promise.all([
    listProjects(db, { limit: 3 }),
    listAwards(db),
    listPublishedArticles(db, { limit: 3 }),
  ]);
```

and insert after the projects section:

```jsx
      {latest.length > 0 && (
        <section className="section">
          <div className="section__bar">
            <h2>From the blog</h2>
            <span className="label">Articles</span>
          </div>
          <div className="projects">{latest.map((a) => <ArticleCard key={a.id} article={a} />)}</div>
          <p className="section__more"><Link className="btn" href="/articles">All articles</Link></p>
        </section>
      )}
```

Change the home page's `export const revalidate = 300;` to `3600` on `/`, `/about`, `/officers`, `/projects` and `/join` (saves now refresh pages directly).

In `components/SiteFooter.jsx`, extend the second baseline `<span>`:

```jsx
          <a href={`mailto:${SITE.email}`}>{SITE.email}</a> ·{" "}
          <a href={SITE.facebookUrl} target="_blank" rel="noopener noreferrer">Facebook</a> ·{" "}
          <Link href="/resources">Free resources</Link>
```

In `app/join/page.jsx`, add a fourth contact item:

```jsx
          <div><span className="l">Free templates</span><Link href="/resources">Download our resources</Link></div>
```

(and `import Link from "next/link";`).

Append to `app/globals.css`:

```css
/* ============================================================
   Articles and project pages (Phase 2)
   ============================================================ */
.article-card__link { display: flex; flex-direction: column; gap: 16px; color: inherit; }
.article-card__link:hover h3 { color: var(--ochre); }
.article-card__excerpt { font-size: 0.95rem; line-height: 1.6; color: rgba(237, 232, 223, 0.7); }
.article-card--featured figure { height: clamp(260px, 42vw, 520px); }
.article-card--featured h3 { font-size: clamp(1.4rem, 3vw, 2.2rem); }
.article-grid { margin-top: 48px; }
.category-filter { margin-top: 24px; font-family: var(--font-space-grotesk), monospace; font-size: 0.78rem; letter-spacing: 0.12em; text-transform: uppercase; }
.category-filter a[aria-current="page"] { color: var(--dune); text-decoration: underline; }
.article__byline { font-family: var(--font-space-grotesk), monospace; font-size: 0.78rem; letter-spacing: 0.12em; text-transform: uppercase; }
.article__cover, .gallery__item { position: relative; overflow: hidden; height: clamp(240px, 45vw, 560px); margin: 0; }
.gallery__item { height: 300px; }
.article-body { max-width: 68ch; font-size: 1.1rem; line-height: 1.8; color: rgba(237, 232, 223, 0.88); overflow-wrap: anywhere; }
.article-body h2 { font-family: var(--font-syne), sans-serif; font-weight: 800; font-size: 1.8rem; line-height: 1.2; margin: 48px 0 16px; color: var(--dune); }
.article-body h3 { font-family: var(--font-syne), sans-serif; font-weight: 700; font-size: 1.3rem; margin: 32px 0 12px; color: var(--dune); }
.article-body p, .article-body ul, .article-body ol { margin: 0 0 20px; }
.article-body blockquote { border-left: 2px solid var(--ochre); margin: 24px 0; padding: 4px 0 4px 24px; font-family: var(--font-syne), sans-serif; font-weight: 700; color: var(--dune); }
.article-body img { width: 100%; height: auto; margin: 24px 0; }
.article-body a { text-decoration: underline; }
.article__project { margin-top: 32px; color: rgba(237, 232, 223, 0.7); }
```

- [ ] **Step 7: Run unit tests and build**

Run: `npx vitest run && NEXT_DIST_DIR=.next-check npx next build`
Expected: all tests PASS; build lists `/articles`, `/articles/[slug]`, `/projects/[slug]`, `/resources`.

- [ ] **Step 8: Commit**

```bash
git add components app lib test
git commit -m "Add public article, project and resource pages, blog row and DB-driven sitemap"
```

---

### Task 12: End-to-end checks for Phase 2

**Files:**
- Modify: `scripts/prepare-e2e-db.mjs`, `e2e/site.spec.js`

**Interfaces:**
- Consumes: `saveArticle`, `publishArticle`; new routes.

- [ ] **Step 1: Seed one published and one draft article for e2e**

Append to `scripts/prepare-e2e-db.mjs` before the final `console.log`:

```js
import { saveArticle, publishArticle } from "../lib/content/articles.js";

const ctx = { userId: "e2e" };
const draft = await saveArticle(db, { title: "Unfinished Draft", targetKeyword: "x" }, ctx);
const ready = await saveArticle(
  db,
  {
    title: "Bonifacio Day: History and Meaning",
    metaDescription: "Why the Philippines remembers Andrés Bonifacio every November 30.",
    targetKeyword: "bonifacio day",
    category: "holidays",
    bodyHtml: "<h2>Who was Bonifacio?</h2><p>Andrés Bonifacio founded the Katipunan in 1892.</p>",
  },
  ctx,
);
await publishArticle(db, ready.article.id, { expectedUpdatedAt: ready.article.updatedAt }, ctx);
console.log(`e2e articles: published ${ready.article.slug}, draft ${draft.article.slug}`);
```

(Move the new `import` line to the top of the file with the other imports.)

- [ ] **Step 2: Add the e2e tests**

Append to `e2e/site.spec.js`:

```js
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
```

- [ ] **Step 3: Run the whole e2e suite**

Run: `npx playwright test`
Expected: all PASS. Every route in `STATIC_ROUTES` (now including `/articles` and `/resources`) passes the Phase 1 checks and the "load no Clerk script" test.

- [ ] **Step 4: Commit**

```bash
git add scripts/prepare-e2e-db.mjs e2e/site.spec.js
git commit -m "Add end-to-end checks for articles, drafts, project pages and admin gates"
```

---

### Task 13: Lighthouse, manual admin run-through and preview deploy

**Files:**
- Modify: Obsidian `Projects/JCI Roxas Halaran/JCI Roxas Halaran — Bid Evidence Log.md`

- [ ] **Step 1: Lighthouse**

Build and serve the e2e database (`npm run e2e:serve` in one terminal), then:

```bash
CH=$(node -e 'import("./node_modules/playwright-core/index.mjs").then(m=>console.log(m.chromium.executablePath()))')
for p in / /articles/bonifacio-day-history-and-meaning; do
  CHROME_PATH="$CH" npx -y lighthouse@12 "http://localhost:3100$p" --quiet --chrome-flags="--headless=new" \
    --only-categories=performance,accessibility,best-practices,seo --output=json --output-path="/tmp/lh.json"
  node -e "const r=require('/tmp/lh.json');console.log('$p',Object.values(r.categories).map(c=>c.title+' '+Math.round(c.score*100)).join(' | '),'| LCP',r.audits['largest-contentful-paint'].displayValue)"
done
```

Expected: LCP < 2.5 s, Best Practices ≥ 90, SEO ≥ 90, Accessibility ≥ 90 on both. If LCP still misses, check the LCP element in the report (`largest-contentful-paint-element`) and fix that element (e.g. font `display: swap`, `priority` on the cover image) before continuing. Add the scores as a row in the Bid Evidence Log.

- [ ] **Step 2: Push and deploy a preview**

```bash
git push
vercel ls jci-roxas-halaran   # the push builds a Preview automatically
```

Expected: the new Preview is Ready. Check with `vercel curl /articles --deployment <preview-url>` → 200.

- [ ] **Step 3: Manual admin run-through (with the chapter admin, on the preview)**

Signed in as `admin`:
1. `/admin` shows the November progress (0/10) and the "New article" button.
2. `/admin/seo-plan` → "Write article" on "bonifacio day" opens the editor with the keyword and title filled in.
3. Write two paragraphs and an H2, insert an image (alt text required), add a cover, fill the meta description; the Google preview updates.
4. Save draft → Preview shows the article; the public URL returns 404.
5. Publish → the article appears on `/articles` and the home page within seconds; the plan card shows Published.
6. Edit the title and click Update → the URL stays the same.
7. Try to upload a HEIC photo → refused with the JPG message.
8. Unpublish → the URL returns 404 again.
9. Signed in as an `officer` → `/admin/articles` shows the 404 page.

Record any defect as a finding; fix with a failing test first.

- [ ] **Step 4: Open the Phase 2 pull request**

```bash
gh pr create --base main --head halaran-online --title "Halaran Online Phase 2: content engine" --body-file - <<'EOF'
Phase 2 of Halaran Online: admin-only content engine (articles, projects, resources, SEO plan), public article/project/resource pages, DB-driven sitemap, and Clerk loaded only on sign-in/admin.

Plan: docs/superpowers/plans/2026-10-21-halaran-online-phase-2-content-engine.md
Spec: docs/superpowers/specs/2026-10-21-halaran-online-phase-2-design.md

https://claude.ai/code/session_01Veo3QHt6DoiFbKo4ciLaDL
EOF
```

If PR #1 is still open, this PR's branch is the same (`halaran-online`); update PR #1's title and description instead of opening a second PR.

---

### Task 14: Domain switch (manual checklist, run with the user)

No code. Each step needs the user's accounts; do them in order and check each before the next.

- [ ] **Step 1: Clerk production instance**

In Clerk: create the production instance for `jciroxashalaran.com`; add the DNS records it lists; Restrictions → disable sign-up; Sessions → session token `{ "metadata": "{{user.public_metadata}}" }`; recreate the admin user with public metadata `{ "role": "admin" }`. Put `pk_live_…` and `sk_live_…` into Vercel **Production** (`vercel env rm` the test keys from Production first).

- [ ] **Step 2: Merge and deploy production**

Merge the PR into `main`. Vercel builds Production. Check `https://jci-roxas-halaran.vercel.app` → 200 on all public routes.

- [ ] **Step 3: DNS**

At the domain registrar, replace the Webflow records for `jciroxashalaran.com` and `www` with the records Vercel → Project → Domains shows. Leave the Webflow site published for 48 hours.

- [ ] **Step 4: Site URL**

`vercel env rm NEXT_PUBLIC_SITE_URL production && printf 'https://jciroxashalaran.com' | vercel env add NEXT_PUBLIC_SITE_URL production`, then redeploy Production.

- [ ] **Step 5: Verify live**

```bash
for p in / /about /officers /projects /articles /resources /join /about-us /our-officers /contact /leadership; do
  curl -s -o /dev/null -w "$p %{http_code} %{redirect_url}\n" https://jciroxashalaran.com$p
done
curl -s https://jciroxashalaran.com/sitemap.xml | grep -c "https://jciroxashalaran.com"
curl -s -o /dev/null -w "www %{http_code} %{redirect_url}\n" https://www.jciroxashalaran.com/
```

Expected: 200 for live pages, 308 to the right page for old URLs, sitemap URLs on the real domain, `www` redirecting to the apex (or the reverse, as configured in Vercel).

- [ ] **Step 6: Search Console and GA4**

Search Console → add a Domain property for `jciroxashalaran.com` (DNS TXT verification) → Sitemaps → submit `https://jciroxashalaran.com/sitemap.xml` → URL Inspection → request indexing for `/` and each published article. GA4 → create a property, put its ID in `NEXT_PUBLIC_GA_ID` (Production), redeploy, link GA4 to Search Console. Record the switch date in the Bid Evidence Log.
