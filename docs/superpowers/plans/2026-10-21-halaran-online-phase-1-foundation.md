# Halaran Online — Phase 1: Foundation and Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Vite single-page app with a Next.js site backed by Turso and Clerk that serves the migrated JCI Roxas Halaran content (home, about, officers, projects, join) as pre-rendered, SEO-ready pages, deployed on Vercel.

**Architecture:** One Next.js App Router app in this repo. Content lives in Turso (SQLite) accessed through Drizzle; a seed script migrates the content from `src/data/site.js` and the live Webflow site. Pages are server components that read through a small query layer and are cached with `revalidate`. Clerk protects `/admin` and `/members` by role. The domain does **not** switch in this phase (that happens at the end of Phase 2).

**Tech Stack:** Next.js 15 (App Router, JavaScript), React 19, Drizzle ORM + `@libsql/client` (Turso), Clerk (`@clerk/nextjs` v6), Vitest + Testing Library, Playwright, Vercel Analytics, GA4 via `@next/third-parties`.

**Spec:** `docs/superpowers/specs/2026-10-21-halaran-online-design.md` (sections 1, 2, 3 "People" and "Content", 4 "Rendering and SEO", 7, 8, 9 Phase 1).

## Global Constraints

- JavaScript only, no TypeScript. Files with JSX use the `.jsx` extension (repo convention).
- Next.js `^15.5` App Router; React `^19.1`; Node 22 (`"engines": { "node": ">=22" }`).
- Database: Turso via Drizzle; migrations live in `db/migrations` and are applied with the Drizzle migrator.
- Auth: Clerk; roles `member`, `officer`, `treasurer`, `admin` in Clerk `publicMetadata.role`, exposed in the session token as `metadata.role`.
- Logo: `public/assets/img/logo-site.png` (current Webflow logo, white wordmark, 1463×708 ≈ 2.07:1); icons `favicon-32.png`, `favicon-48.png`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`. Use the logo only on dark backgrounds. The old `logo-dc.png` is no longer used.
- Brand system unchanged: tokens `--basalt #121314`, `--canopy #1c3b2b`, `--sage #3a6b4f`, `--dune #ede8df`, `--ochre #e5a823`; fonts Syne (display), Space Grotesk (labels), Inter (body).
- Design direction: mellon.org layout and restraint (story-led homepage, large type, generous white space); keep our fonts and palette.
- Exactly one `<h1>` per page. Every page has a unique title, meta description and canonical URL.
- Every image has meaningful alt text; decorative elements are `aria-hidden`.
- No member email or phone number is rendered on public pages (the chapter's own email is fine).
- Webflow redirects (permanent): `/about-us`→`/about`, `/our-officers`→`/officers`, `/contact`→`/join`, `/leadership`→`/officers`. Next.js answers permanent redirects with **308**, which search engines treat like 301.
- Quality bar: Lighthouse 90+ for SEO and accessibility on key pages; LCP under 2.5s on mobile.

## Review Focus

- **Officers with no photo** (4 of the 2026 board have none): show an initials tile, never a broken image. → tests in Task 6 (`OfficerCard`) and Task 9 (all images load).
- **Projects with no cover image or no date** (all six 2026 projects, plus SA DAGAT and Hapag ng Daigdig): show a placeholder tile, omit the date, sort undated projects last. → tests in Task 4 (ordering) and Task 6 (`ProjectCard`).
- **Running the seed again after content was edited**: no duplicates, and the edit is kept. → test in Task 3.
- **Old links with a trailing slash, or `/leadership` from the vercel.app redesign**: land on the right page. → tests in Task 9.
- **Long Syne headlines on a 375px phone**: no horizontal scrolling on any page. → test in Task 9.

## Content gaps to collect from the chapter (not blocking)

The seed uses what exists today. Ask the chapter for: the 2026 president's bio and message (Jaime Cortes Altavas), summaries and photos for the 2026 projects and for SA DAGAT / Hapag ng Daigdig, photos of Jaime Miguel Dadivas, Johbert Flores, Judy Daliva and Manuel Luis Luna, sponsor logos and links, confirmation of the Facebook page URL, and whether "Jaime Altavas" belongs in the partners list (Webflow lists him there).

## File Structure

```
app/
  layout.jsx                 root layout: fonts, globals.css, Nav, analytics (+ ClerkProvider in Task 8)
  globals.css                carried over from src/site.css + new classes
  page.jsx                   home
  about/page.jsx
  officers/page.jsx
  projects/page.jsx
  join/page.jsx
  not-found.jsx
  robots.js
  sitemap.js
  admin/page.jsx             role-protected placeholder (Task 8)
  sign-in/[[...sign-in]]/page.jsx   (Task 8)
components/
  Nav.jsx                    client: mobile menu, active link
  SiteFooter.jsx             CTA + baseline with contact
  Contours.jsx               moved from src/components
  OfficerCard.jsx            photo or initials tile
  ProjectCard.jsx            cover or placeholder tile
  FaqList.jsx                client: accordion
  JsonLd.jsx                 renders a JSON-LD script tag
lib/
  site.js                    static chapter facts (name, url, address, pillars, stats…)
  format.js                  initials, formatDate, slugify
  routes.js                  STATIC_ROUTES, NAV_LINKS
  redirects.js               REDIRECTS (used by next.config.mjs)
  seo.js                     pageMetadata, organizationLd, breadcrumbLd, buildSitemap
  roles.js                   ROLES, normalizeRole, canAccess (Task 8)
  db.js                      createDb, getDb
  queries.js                 getCurrentBoard, getPastPresidents, listProjects, listFaqs, listAwards, listSponsors
db/
  schema.js                  Drizzle schema (Phase 1 tables)
  migrations/                generated SQL
  seed-data.js               migrated content
  seed.js                    seed(db): idempotent, non-destructive
scripts/
  migrate.mjs, seed.mjs, prepare-e2e-db.mjs
middleware.js                Clerk route protection (Task 8)
test/                        Vitest unit/component tests
e2e/site.spec.js             Playwright
```

Deleted: `index.html`, `vite.config.js`, `src/` (after content is moved), `dist/`. Kept: `static/` (design archive), `public/assets/`.

---

### Task 1: Replace Vite with Next.js and set up Vitest

**Files:**
- Modify: `package.json`, `.gitignore`, `vercel.json`
- Create: `next.config.mjs`, `jsconfig.json`, `vitest.config.mjs`, `.env.example`, `app/layout.jsx` (temporary), `app/page.jsx` (temporary), `lib/format.js`, `test/format.test.js`
- Delete: `index.html`, `vite.config.js`, `dist/`

**Interfaces:**
- Produces: `initials(name: string): string`, `formatDate(iso: string|null): string|null`, `slugify(text: string): string` from `lib/format.js`.

- [ ] **Step 1: Replace dependencies and scripts**

Overwrite `package.json`:

```json
{
  "name": "jci-roxas-halaran",
  "private": true,
  "version": "2.0.0",
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "next dev -p 5174",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "node --env-file=.env.local scripts/migrate.mjs",
    "db:seed": "node --env-file=.env.local scripts/seed.mjs"
  },
  "dependencies": {
    "next": "^15.5.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "@testing-library/react": "^16.3.0",
    "@vitejs/plugin-react": "^4.5.0",
    "jsdom": "^26.1.0",
    "vitest": "^3.2.0"
  }
}
```

Run: `rm -rf node_modules package-lock.json dist index.html vite.config.js && npm install`
Expected: install completes without errors.

- [ ] **Step 2: Add Next.js, alias and test config**

`next.config.mjs`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
```

`jsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] }
  }
}
```

`vitest.config.mjs`:

```js
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.{js,jsx}"],
  },
});
```

`vercel.json` (replaces the SPA catch-all rewrite, which would break Next.js routing):

```json
{
  "framework": "nextjs"
}
```

Append to `.gitignore`:

```
.next/
*.db
*.db-journal
.env*.local
test-results/
playwright-report/
```

`.env.example`:

```
# Turso (local dev can use file:local.db)
TURSO_DATABASE_URL=file:local.db
TURSO_AUTH_TOKEN=

# Public site URL (no trailing slash)
NEXT_PUBLIC_SITE_URL=http://localhost:5174

# Clerk (Task 8)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in

# Analytics (optional)
NEXT_PUBLIC_GA_ID=
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=
```

Run: `cp .env.example .env.local`

- [ ] **Step 3: Temporary layout and page so the app builds**

`app/layout.jsx`:

```jsx
export const metadata = { title: "JCI Roxas Halaran" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`app/page.jsx`:

```jsx
export default function Home() {
  return <h1>JCI Roxas Halaran</h1>;
}
```

Run: `npm run build`
Expected: build succeeds and lists route `/`.

- [ ] **Step 4: Write the failing tests for `lib/format.js`**

`test/format.test.js`:

```js
import { describe, it, expect } from "vitest";
import { initials, formatDate, slugify } from "@/lib/format.js";

describe("initials", () => {
  it("uses the first and last name", () => {
    expect(initials("Judy Daliva")).toBe("JD");
  });
  it("skips middle initials and suffixes", () => {
    expect(initials("Elmer D. Jimenez Jr.")).toBe("EJ");
    expect(initials("Mark Vincent D. Bernas")).toBe("MB");
  });
  it("handles a single name", () => {
    expect(initials("Lemuel")).toBe("L");
  });
});

describe("formatDate", () => {
  it("formats an ISO date in long form", () => {
    expect(formatDate("2025-07-08")).toBe("July 8, 2025");
  });
  it("returns null for missing or invalid dates", () => {
    expect(formatDate(null)).toBeNull();
    expect(formatDate("not-a-date")).toBeNull();
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Talentadong Tatay 2026")).toBe("talentadong-tatay-2026");
  });
  it("drops quotes, apostrophes and punctuation", () => {
    expect(slugify("“Be a Friend, Not a Bully”")).toBe("be-a-friend-not-a-bully");
    expect(slugify("Symposium on Men's Mental Health")).toBe("symposium-on-mens-mental-health");
  });
  it("removes accents", () => {
    expect(slugify("Pan-ay Café")).toBe("pan-ay-cafe");
  });
});
```

- [ ] **Step 5: Run the tests to see them fail**

Run: `npx vitest run test/format.test.js`
Expected: FAIL, cannot resolve `@/lib/format.js`.

- [ ] **Step 6: Implement `lib/format.js`**

```js
const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv"]);

// Two-letter initials from the first and last real name parts
// ("Elmer D. Jimenez Jr." -> "EJ").
export function initials(name) {
  const parts = name
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}]/gu, ""))
    .filter((w) => w.length > 1 && !SUFFIXES.has(w.toLowerCase()));
  if (parts.length === 0) return name.slice(0, 1).toUpperCase();
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

export function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : DATE_FORMAT.format(d);
}

export function slugify(text) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
```

- [ ] **Step 7: Run the tests to see them pass**

Run: `npx vitest run test/format.test.js`
Expected: PASS (8 tests).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Replace Vite with Next.js and add Vitest with format helpers"
```

---

### Task 2: Database schema, client and first migration

**Files:**
- Create: `db/schema.js`, `lib/db.js`, `drizzle.config.js`, `scripts/migrate.mjs`, `db/migrations/*` (generated), `test/helpers/db.js`, `test/schema.test.js`
- Modify: `package.json` (dependencies)

**Interfaces:**
- Produces: tables `members`, `officerTerms`, `projects`, `projectPhotos`, `faqs`, `awards`, `sponsors` exported from `db/schema.js`; `createDb(url?, authToken?)` and `getDb()` from `lib/db.js`; `testDb(): Promise<db>` from `test/helpers/db.js` (fresh, migrated, in-memory).

- [ ] **Step 1: Install database packages**

Run: `npm install drizzle-orm@^0.44.0 @libsql/client@^0.15.0 && npm install -D drizzle-kit@^0.31.0`
Expected: installs without errors.

- [ ] **Step 2: Write the schema**

`db/schema.js`:

```js
import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";

export const members = sqliteTable("members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clerkUserId: text("clerk_user_id").unique(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  email: text("email"),
  photoUrl: text("photo_url"),
  profession: text("profession"),
  business: text("business"),
  skills: text("skills"),
  bio: text("bio"),
  quote: text("quote"),
  joinedAt: text("joined_at"),
  status: text("status", { enum: ["active", "inactive", "senator", "alumni"] })
    .notNull()
    .default("active"),
  inDirectory: integer("in_directory", { mode: "boolean" }).notNull().default(false),
  feePaidYear: integer("fee_paid_year"),
});

export const officerTerms = sqliteTable(
  "officer_terms",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    year: integer("year").notNull(),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [uniqueIndex("officer_terms_member_year_role").on(t.memberId, t.year, t.role)],
);

export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  summary: text("summary"),
  body: text("body"),
  coverUrl: text("cover_url"),
  coverAlt: text("cover_alt"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  barangay: text("barangay"),
  lat: real("lat"),
  lng: real("lng"),
  pillar: text("pillar", { enum: ["leadership", "community", "global"] })
    .notNull()
    .default("community"),
  status: text("status", { enum: ["planned", "ongoing", "done"] }).notNull().default("done"),
  featured: integer("featured", { mode: "boolean" }).notNull().default(false),
});

export const projectPhotos = sqliteTable("project_photos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  caption: text("caption"),
  alt: text("alt").notNull(),
  kind: text("kind", { enum: ["gallery", "before", "after"] }).notNull().default("gallery"),
  sort: integer("sort").notNull().default(0),
});

export const faqs = sqliteTable("faqs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  question: text("question").notNull().unique(),
  answer: text("answer").notNull(),
  sort: integer("sort").notNull().default(0),
});

export const awards = sqliteTable(
  "awards",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    awardedBy: text("awarded_by").notNull(),
    year: integer("year").notNull(),
  },
  (t) => [uniqueIndex("awards_title_year").on(t.title, t.year)],
);

export const sponsors = sqliteTable("sponsors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  logoUrl: text("logo_url"),
  url: text("url"),
  tier: text("tier"),
  year: integer("year"),
});
```

- [ ] **Step 3: Write the client, config and migrate script**

`lib/db.js`:

```js
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../db/schema.js";

export function createDb(
  url = process.env.TURSO_DATABASE_URL,
  authToken = process.env.TURSO_AUTH_TOKEN,
) {
  if (!url) throw new Error("TURSO_DATABASE_URL is not set");
  return drizzle(createClient({ url, authToken }), { schema });
}

let db;
export function getDb() {
  db ??= createDb();
  return db;
}
```

`drizzle.config.js`:

```js
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.js",
  out: "./db/migrations",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL ?? "file:local.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});
```

`scripts/migrate.mjs`:

```js
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDb } from "../lib/db.js";

await migrate(createDb(), { migrationsFolder: "db/migrations" });
console.log("Migrations applied.");
```

`test/helpers/db.js`:

```js
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDb } from "../../lib/db.js";

// A fresh, fully migrated in-memory database for each test.
export async function testDb() {
  const db = createDb("file::memory:");
  await migrate(db, { migrationsFolder: "db/migrations" });
  return db;
}
```

- [ ] **Step 4: Generate the first migration**

Run: `npx drizzle-kit generate --name init`
Expected: creates `db/migrations/0000_init.sql` containing `CREATE TABLE` statements for all seven tables.

- [ ] **Step 5: Write the failing schema test**

`test/schema.test.js`:

```js
import { describe, it, expect } from "vitest";
import { testDb } from "./helpers/db.js";
import { members, officerTerms, projects, faqs } from "@/db/schema.js";

describe("schema", () => {
  it("stores and reads a member with defaults", async () => {
    const db = await testDb();
    await db.insert(members).values({ slug: "judy-daliva", name: "Judy Daliva" });
    const [row] = await db.select().from(members);
    expect(row.status).toBe("active");
    expect(row.inDirectory).toBe(false);
  });

  it("rejects duplicate slugs", async () => {
    const db = await testDb();
    await db.insert(projects).values({ slug: "coastline-cuts", title: "Coastline Cuts" });
    await expect(
      db.insert(projects).values({ slug: "coastline-cuts", title: "Copy" }),
    ).rejects.toThrow();
  });

  it("rejects the same person holding the same role twice in one year", async () => {
    const db = await testDb();
    const [m] = await db
      .insert(members)
      .values({ slug: "jasper-sayo", name: "Jasper L. Sayo" })
      .returning();
    await db.insert(officerTerms).values({ memberId: m.id, role: "Vice President", year: 2026 });
    await expect(
      db.insert(officerTerms).values({ memberId: m.id, role: "Vice President", year: 2026 }),
    ).rejects.toThrow();
  });

  it("rejects duplicate FAQ questions", async () => {
    const db = await testDb();
    await db.insert(faqs).values({ question: "What is JCI?", answer: "A" });
    await expect(db.insert(faqs).values({ question: "What is JCI?", answer: "B" })).rejects.toThrow();
  });
});
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run test/schema.test.js`
Expected: PASS (4 tests). If a test fails because the migration file is missing, re-run Step 4.

- [ ] **Step 7: Apply migrations to the local database**

Run: `npm run db:migrate`
Expected: prints `Migrations applied.` and creates `local.db`.

- [ ] **Step 8: Commit**

```bash
git add db lib/db.js drizzle.config.js scripts/migrate.mjs test package.json package-lock.json
git commit -m "Add Drizzle schema for members, officers, projects and site content"
```

---

### Task 3: Migrate content with an idempotent seed

**Files:**
- Create: `db/seed-data.js`, `db/seed.js`, `scripts/seed.mjs`, `test/seed.test.js`

**Interfaces:**
- Consumes: `db/schema.js` tables; `slugify` from `lib/format.js`; `testDb()`.
- Produces: `seed(db): Promise<void>` (insert-if-missing; never overwrites or duplicates); exported arrays `MEMBERS`, `TERMS`, `PROJECTS`, `FAQS`, `AWARDS`, `SPONSORS` from `db/seed-data.js`.

- [ ] **Step 1: Write the content file**

`db/seed-data.js` (content from `src/data/site.js`, `src/pages/Leadership.jsx` and jciroxashalaran.com, checked 2026-10-21):

```js
const img = (name) => `/assets/img/${name}`;

export const MEMBERS = [
  {
    slug: "lemuel-capa",
    name: "Lemuel J. Capa",
    photoUrl: img("president-lemuel-capa.jpg"),
    bio: "Lemuel Capa led JCI Roxas Halaran in 2025 with a clear mission: to empower, uplift, and transform the next generation of leaders. Grounded in servant leadership and driven by purpose, he championed the call to “Lead, Excel, Motivate,” inspiring others through action and heart.\n\nAs President, Lemuel built a chapter that thrives on unity, service, and visionary leadership—one that leads change not just in the community, but in the lives of every young leader it touches.",
    quote: "Leadership is not a title, it's a mission—Lead with purpose, Excel with passion, Motivate with heart—transforming young leaders, ONE VISION, ONE MILESTONE at a time.",
  },
  { slug: "john-paul-sorongon", name: "John Paul Sorongon" },
  { slug: "jaime-altavas", name: "Jaime Cortes Altavas", photoUrl: img("officer-jaime-cortes-altavas.jpg") },
  { slug: "mark-vincent-bernas", name: "Mark Vincent D. Bernas", photoUrl: img("officer-mark-vincent-bernas.jpg") },
  { slug: "john-moses-aposaga", name: "John Moses B. Aposaga", photoUrl: img("officer-john-moses-aposaga.jpg") },
  { slug: "gian-carlo-velado", name: "Gian Carlo Velado", photoUrl: img("officer-gian-carlo-velado.jpg") },
  { slug: "joshua-kenneth-anas", name: "Joshua Kenneth Anas", photoUrl: img("officer-joshua-kenneth-anas.jpg") },
  { slug: "elmer-jimenez-jr", name: "Elmer D. Jimenez Jr.", photoUrl: img("officer-elmer-jimenez-jr.jpg") },
  { slug: "miko-miguel-ramos", name: "Miko Miguel H. Ramos", photoUrl: img("officer-miko-miguel-ramos.jpg") },
  { slug: "christopher-bryan-bernas", name: "Christopher Bryan C. Bernas", photoUrl: img("officer-christopher-bernas.jpg") },
  { slug: "jasper-sayo", name: "Jasper L. Sayo", photoUrl: img("officer-jasper-sayo.jpg") },
  { slug: "eugenio-dalida-jr", name: "Eugenio Dalida Jr.", photoUrl: img("officer-eugenio-dalida-jr.jpg") },
  { slug: "raymark-bigcas", name: "Raymark B. Bigcas", photoUrl: img("officer-raymark-bigcas.jpg") },
  { slug: "jaime-miguel-dadivas", name: "Jaime Miguel Dadivas" },
  { slug: "johbert-flores", name: "Johbert Flores" },
  { slug: "judy-daliva", name: "Judy Daliva" },
  { slug: "manuel-luis-luna", name: "Manuel Luis Luna" },
];

// [member slug, role] in display order; index = sort.
const BOARDS = {
  2024: [["john-paul-sorongon", "President"]],
  2025: [
    ["lemuel-capa", "President"],
    ["mark-vincent-bernas", "Executive Vice President"],
    ["john-moses-aposaga", "VP Internal"],
    ["jaime-altavas", "VP External"],
    ["gian-carlo-velado", "Secretary"],
    ["joshua-kenneth-anas", "Treasurer"],
    ["elmer-jimenez-jr", "Auditor"],
    ["miko-miguel-ramos", "BOD Social Media & Marketing"],
    ["christopher-bryan-bernas", "BOD Membership"],
    ["jasper-sayo", "BOD Community"],
    ["eugenio-dalida-jr", "BOD International"],
    ["raymark-bigcas", "Local Skills Development Director"],
  ],
  2026: [
    ["jaime-altavas", "President"],
    ["mark-vincent-bernas", "Executive Vice President"],
    ["jasper-sayo", "Vice President"],
    ["raymark-bigcas", "Vice President"],
    ["john-moses-aposaga", "Secretary"],
    ["christopher-bryan-bernas", "Treasurer"],
    ["gian-carlo-velado", "Local Skills Development Director"],
    ["elmer-jimenez-jr", "Director"],
    ["eugenio-dalida-jr", "Director"],
    ["jaime-miguel-dadivas", "Director"],
    ["johbert-flores", "Director"],
    ["judy-daliva", "Director"],
    ["manuel-luis-luna", "Director"],
  ],
};

export const TERMS = Object.entries(BOARDS).flatMap(([year, rows]) =>
  rows.map(([member, role], sort) => ({ member, role, year: Number(year), sort })),
);

export const PROJECTS = [
  { slug: "mural-marker-inauguration", title: "Mural Marker Inauguration", startDate: "2026-08-07" },
  { slug: "sampukanay-2026", title: "Sampukanay 2026", startDate: "2026-07-11" },
  { slug: "symposium-on-mens-mental-health", title: "Symposium on Men's Mental Health", startDate: "2026-06-30" },
  { slug: "provincial-arbor-day-2026", title: "Provincial Arbor Day 2026", startDate: "2026-06-25" },
  { slug: "talentadong-tatay-2026", title: "Talentadong Tatay 2026", startDate: "2026-06-21" },
  { slug: "coastline-cuts", title: "Coastline Cuts", startDate: "2026-06-20" },
  {
    slug: "ironmen-awards-2025",
    title: "IRONMEN Awards 2025",
    startDate: "2025-07-08",
    coverUrl: img("project-ironmen-awards-2025.jpg"),
    coverAlt: "IRONMEN Awards 2025 ceremony",
  },
  {
    slug: "be-a-friend-not-a-bully",
    title: "“Be a Friend, Not a Bully”",
    startDate: "2025-07-04",
    coverUrl: img("project-be-a-friend-not-a-bully.jpg"),
    coverAlt: "“Be a Friend, Not a Bully” anti-bullying campaign",
  },
  {
    slug: "friends-x-jci-roxas-halaran",
    title: "FRIENDS x JCI Roxas Halaran",
    startDate: "2025-06-07",
    coverUrl: img("project-friends-x-jci-roxas-halaran.jpg"),
    coverAlt: "FRIENDS x JCI Roxas Halaran event",
  },
  { slug: "sa-dagat", title: "SA DAGAT" },
  { slug: "hapag-ng-daigdig", title: "Hapag ng Daigdig" },
];

export const FAQS = [
  ["What is JCI?", "JCI (Junior Chamber International) is a worldwide organization of young active citizens aged 18 to 40 who take collective action to improve themselves and the world around them."],
  ["Who can join JCI?", "Anyone aged 18 to 40 who wants to develop leadership skills and create positive change in the community."],
  ["How do I become a member?", "Reach out through our Facebook page or email, or attend one of our events — we'll walk you through the membership process from there."],
  ["What are the benefits of joining JCI?", "Leadership training, hands-on project experience, entrepreneurship opportunities, and access to a worldwide network of young leaders."],
  ["Is there a membership fee?", "Yes — an annual fee covers local and international dues. Contact us for current rates."],
  ["What kind of projects does JCI organize?", "Community development projects, youth advocacy campaigns like “Be a Friend, Not a Bully,” leadership trainings, and partnership events across the region."],
  ["How can I participate in JCI events?", "Follow our Facebook page for announcements — most events are open to guests and prospective members."],
  ["Can I join JCI if I have no leadership experience?", "Absolutely. JCI exists to develop leaders — training and hands-on opportunities are what membership is for."],
  ["How can my business or organization partner with JCI?", "Email us or message our Facebook page — we welcome partnerships for community projects, sponsorships, and joint initiatives."],
].map(([question, answer], sort) => ({ question, answer, sort }));

export const AWARDS = [
  { title: "Nominated Top 5 Best Local Organization Website", awardedBy: "Temiong Awards", year: 2024 },
  { title: "Nominated Top 5 Most Outstanding Local Organization", awardedBy: "Quadro Awards", year: 2024 },
  { title: "Star Local President — Lemuel Capa", awardedBy: "JCI Philippines", year: 2025 },
  { title: "Star Local President — John Paul Sorongon", awardedBy: "JCI Philippines", year: 2024 },
];

export const SPONSORS = [
  { name: "Tuyo De Capiz" },
  { name: "RXS Seafood Hub" },
  { name: "Spaces Studio" },
  { name: "CAPA Dance Academy" },
];
```

- [ ] **Step 2: Write the failing seed tests**

`test/seed.test.js`:

```js
import { describe, it, expect } from "vitest";
import { eq, count } from "drizzle-orm";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { members, officerTerms, projects, faqs, awards, sponsors } from "@/db/schema.js";

const total = async (db, table) => (await db.select({ n: count() }).from(table))[0].n;

describe("seed", () => {
  it("loads all migrated content", async () => {
    const db = await testDb();
    await seed(db);
    expect(await total(db, members)).toBe(17);
    expect(await total(db, officerTerms)).toBe(26);
    expect(await total(db, projects)).toBe(11);
    expect(await total(db, faqs)).toBe(9);
    expect(await total(db, awards)).toBe(4);
    expect(await total(db, sponsors)).toBe(4);
  });

  it("can run twice without duplicating anything", async () => {
    const db = await testDb();
    await seed(db);
    await seed(db);
    expect(await total(db, members)).toBe(17);
    expect(await total(db, officerTerms)).toBe(26);
    expect(await total(db, projects)).toBe(11);
  });

  it("never overwrites content edited after the first run", async () => {
    const db = await testDb();
    await seed(db);
    await db.update(projects).set({ title: "Coastline Cuts 2026" }).where(eq(projects.slug, "coastline-cuts"));
    await seed(db);
    const [row] = await db.select().from(projects).where(eq(projects.slug, "coastline-cuts"));
    expect(row.title).toBe("Coastline Cuts 2026");
  });
});
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npx vitest run test/seed.test.js`
Expected: FAIL, cannot resolve `@/db/seed.js`.

- [ ] **Step 4: Implement the seed**

`db/seed.js`:

```js
import { members, officerTerms, projects, faqs, awards, sponsors } from "./schema.js";
import { MEMBERS, TERMS, PROJECTS, FAQS, AWARDS, SPONSORS } from "./seed-data.js";

// Inserts migrated content only where it is missing. Safe to re-run: it never
// duplicates rows and never overwrites edits made later in the admin area.
// No transaction on purpose: libsql opens a new connection per transaction,
// which breaks in-memory test databases; every insert is idempotent instead.
export async function seed(db) {
  await db.insert(members).values(MEMBERS).onConflictDoNothing({ target: members.slug });

  const ids = new Map(
    (await db.select({ id: members.id, slug: members.slug }).from(members)).map((m) => [m.slug, m.id]),
  );
  const terms = TERMS.map(({ member, role, year, sort }) => {
    const memberId = ids.get(member);
    if (!memberId) throw new Error(`Seed term references unknown member "${member}"`);
    return { memberId, role, year, sort };
  });
  await db.insert(officerTerms).values(terms).onConflictDoNothing();

  await db.insert(projects).values(PROJECTS).onConflictDoNothing({ target: projects.slug });
  await db.insert(faqs).values(FAQS).onConflictDoNothing({ target: faqs.question });
  await db.insert(awards).values(AWARDS).onConflictDoNothing();
  await db.insert(sponsors).values(SPONSORS).onConflictDoNothing({ target: sponsors.name });
}
```

`scripts/seed.mjs`:

```js
import { createDb } from "../lib/db.js";
import { seed } from "../db/seed.js";

await seed(createDb());
console.log("Seed complete.");
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run test/seed.test.js`
Expected: PASS (3 tests).

- [ ] **Step 6: Seed the local database**

Run: `npm run db:seed`
Expected: prints `Seed complete.`

- [ ] **Step 7: Commit**

```bash
git add db/seed-data.js db/seed.js scripts/seed.mjs test/seed.test.js
git commit -m "Migrate chapter content into the database with an idempotent seed"
```

---

### Task 4: Query layer

**Files:**
- Create: `lib/queries.js`, `test/queries.test.js`

**Interfaces:**
- Consumes: schema tables, `seed(db)`, `testDb()`.
- Produces (every function takes `db` as its first argument):
  - `getCurrentBoard(db) → { year: number|null, president: Officer|null, officers: Officer[] }`
  - `getPastPresidents(db, beforeYear: number) → Officer[]` (newest first)
  - `listProjects(db, { limit?: number } = {}) → Project[]` (newest first, undated last)
  - `listFaqs(db)`, `listAwards(db)` (newest first), `listSponsors(db)`
  - `Officer = { name, slug, role, year, photoUrl, bio, quote }`; `Project` = a `projects` row.

- [ ] **Step 1: Write the failing tests**

`test/queries.test.js`:

```js
import { describe, it, expect, beforeAll } from "vitest";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import {
  getCurrentBoard,
  getPastPresidents,
  listProjects,
  listFaqs,
  listAwards,
} from "@/lib/queries.js";

let db;
beforeAll(async () => {
  db = await testDb();
  await seed(db);
});

describe("getCurrentBoard", () => {
  it("returns the latest year's president separately from the board", async () => {
    const board = await getCurrentBoard(db);
    expect(board.year).toBe(2026);
    expect(board.president.name).toBe("Jaime Cortes Altavas");
    expect(board.officers).toHaveLength(12);
    expect(board.officers[0]).toMatchObject({
      name: "Mark Vincent D. Bernas",
      role: "Executive Vice President",
    });
  });

  it("returns an empty board when there are no terms", async () => {
    const empty = await testDb();
    expect(await getCurrentBoard(empty)).toEqual({ year: null, president: null, officers: [] });
  });
});

describe("getPastPresidents", () => {
  it("lists earlier presidents, newest first", async () => {
    const past = await getPastPresidents(db, 2026);
    expect(past.map((p) => [p.name, p.year])).toEqual([
      ["Lemuel J. Capa", 2025],
      ["John Paul Sorongon", 2024],
    ]);
  });
});

describe("listProjects", () => {
  it("puts the newest projects first", async () => {
    const latest = await listProjects(db, { limit: 3 });
    expect(latest.map((p) => p.slug)).toEqual([
      "mural-marker-inauguration",
      "sampukanay-2026",
      "symposium-on-mens-mental-health",
    ]);
  });

  it("puts undated projects last", async () => {
    const all = await listProjects(db);
    expect(all).toHaveLength(11);
    expect(all.slice(-2).map((p) => p.slug)).toEqual(["sa-dagat", "hapag-ng-daigdig"]);
  });
});

describe("listFaqs and listAwards", () => {
  it("keeps FAQ order and sorts awards newest first", async () => {
    expect((await listFaqs(db))[0].question).toBe("What is JCI?");
    expect((await listAwards(db))[0].year).toBe(2025);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run test/queries.test.js`
Expected: FAIL, cannot resolve `@/lib/queries.js`.

- [ ] **Step 3: Implement the queries**

`lib/queries.js`:

```js
import { asc, desc, eq, lt, max, and, sql } from "drizzle-orm";
import { members, officerTerms, projects, faqs, awards, sponsors } from "../db/schema.js";

const officerFields = {
  name: members.name,
  slug: members.slug,
  role: officerTerms.role,
  year: officerTerms.year,
  photoUrl: members.photoUrl,
  bio: members.bio,
  quote: members.quote,
};

export async function getCurrentBoard(db) {
  const [{ year }] = await db.select({ year: max(officerTerms.year) }).from(officerTerms);
  if (year == null) return { year: null, president: null, officers: [] };

  const rows = await db
    .select(officerFields)
    .from(officerTerms)
    .innerJoin(members, eq(officerTerms.memberId, members.id))
    .where(eq(officerTerms.year, year))
    .orderBy(asc(officerTerms.sort), asc(officerTerms.id));

  const president = rows.find((r) => r.role === "President") ?? null;
  return { year, president, officers: rows.filter((r) => r !== president) };
}

export function getPastPresidents(db, beforeYear) {
  return db
    .select(officerFields)
    .from(officerTerms)
    .innerJoin(members, eq(officerTerms.memberId, members.id))
    .where(and(eq(officerTerms.role, "President"), lt(officerTerms.year, beforeYear)))
    .orderBy(desc(officerTerms.year));
}

export function listProjects(db, { limit } = {}) {
  const query = db
    .select()
    .from(projects)
    .orderBy(sql`${projects.startDate} is null`, desc(projects.startDate), asc(projects.id));
  return limit ? query.limit(limit) : query;
}

export function listFaqs(db) {
  return db.select().from(faqs).orderBy(asc(faqs.sort), asc(faqs.id));
}

export function listAwards(db) {
  return db.select().from(awards).orderBy(desc(awards.year), asc(awards.id));
}

export function listSponsors(db) {
  return db.select().from(sponsors).orderBy(asc(sponsors.name));
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run test/queries.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/queries.js test/queries.test.js
git commit -m "Add query layer for board, projects, FAQs, awards and sponsors"
```

---

### Task 5: Site facts, SEO helpers, redirects, robots and sitemap

**Files:**
- Create: `lib/site.js`, `lib/routes.js`, `lib/redirects.js`, `lib/seo.js`, `app/robots.js`, `app/sitemap.js`, `test/seo.test.js`, `test/redirects.test.js`
- Modify: `next.config.mjs`

**Interfaces:**
- Produces:
  - `SITE` from `lib/site.js` (fields used below).
  - `STATIC_ROUTES: string[]`, `NAV_LINKS: {href,label}[]` from `lib/routes.js`.
  - `REDIRECTS: {source,destination,permanent}[]` from `lib/redirects.js`.
  - From `lib/seo.js`: `absoluteUrl(path)`, `pageMetadata({ title, description, path })`, `organizationLd()`, `breadcrumbLd(items: {name,path}[])`, `buildSitemap(routes, now?)`.

- [ ] **Step 1: Site facts and routes**

`lib/site.js`:

```js
export const SITE = {
  name: "JCI Roxas Halaran",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://jciroxashalaran.com").replace(/\/$/, ""),
  description:
    "JCI Roxas Halaran is a Capiz-based JCI chapter of young active citizens creating positive change through leadership development, community projects and global outreach.",
  email: "roxashalaran.jci@gmail.com",
  facebookUrl: "https://www.facebook.com/profile.php?id=100089228427082",
  address: { locality: "Roxas City", region: "Capiz", postalCode: "5800", country: "PH" },
  foundedYear: 2023,
  // Current logo from the Webflow site (white wordmark + blue/teal shield, 1463×708).
  // White text: only place it on dark backgrounds (Basalt, Canopy).
  logo: "/assets/img/logo-site.png",
  ogImage: "/assets/img/about-stat-woman-wearing-glass.jpeg",
  aboutPhoto: "/assets/img/about-stat-woman-wearing-glass.jpeg",
  mission:
    "To provide leadership development opportunities that empower young people to create positive change.",
  vision: "To be the leading global network of young leaders.",
  pillars: [
    { num: "01", title: "Leadership Development", body: "Training and hands-on activities to strengthen leadership skills." },
    { num: "02", title: "Community Projects", body: "We organize local projects to address community needs." },
    { num: "03", title: "Global Outreach", body: "We engage in global initiatives to learn and share best practices." },
  ],
  stats: [
    { value: "3+", label: "Years of activity" },
    { value: "50+", label: "Successful projects" },
    { value: "10+", label: "Communities helped" },
    { value: "25+", label: "Members" },
  ],
};
```

`lib/routes.js`:

```js
export const STATIC_ROUTES = ["/", "/about", "/officers", "/projects", "/join"];

export const NAV_LINKS = [
  { href: "/about", label: "About" },
  { href: "/projects", label: "Projects" },
  { href: "/officers", label: "Officers" },
  { href: "/join", label: "Join" },
];
```

`lib/redirects.js`:

```js
// Old Webflow URLs, plus /leadership from the vercel.app redesign.
export const REDIRECTS = [
  { source: "/about-us", destination: "/about", permanent: true },
  { source: "/our-officers", destination: "/officers", permanent: true },
  { source: "/contact", destination: "/join", permanent: true },
  { source: "/leadership", destination: "/officers", permanent: true },
];
```

- [ ] **Step 2: Write the failing tests**

`test/redirects.test.js`:

```js
import { describe, it, expect } from "vitest";
import { REDIRECTS } from "@/lib/redirects.js";
import { STATIC_ROUTES } from "@/lib/routes.js";

describe("REDIRECTS", () => {
  it("covers every old Webflow page", () => {
    const sources = REDIRECTS.map((r) => r.source);
    expect(sources).toEqual(expect.arrayContaining(["/about-us", "/our-officers", "/contact"]));
  });

  it("only points at pages that exist, with no chains", () => {
    for (const r of REDIRECTS) {
      expect(STATIC_ROUTES).toContain(r.destination);
      expect(REDIRECTS.map((x) => x.source)).not.toContain(r.destination);
      expect(r.permanent).toBe(true);
    }
  });

  it("never redirects a live page away", () => {
    for (const r of REDIRECTS) expect(STATIC_ROUTES).not.toContain(r.source);
  });
});
```

`test/seo.test.js`:

```js
import { describe, it, expect } from "vitest";
import { SITE } from "@/lib/site.js";
import {
  absoluteUrl,
  pageMetadata,
  organizationLd,
  breadcrumbLd,
  buildSitemap,
} from "@/lib/seo.js";

describe("pageMetadata", () => {
  it("sets canonical, Open Graph and Twitter fields", () => {
    const m = pageMetadata({ title: "Our officers", description: "The board.", path: "/officers" });
    expect(m.title).toBe("Our officers");
    expect(m.alternates.canonical).toBe("/officers");
    expect(m.openGraph.url).toBe(`${SITE.url}/officers`);
    expect(m.openGraph.title).toBe("Our officers | JCI Roxas Halaran");
    expect(m.twitter.card).toBe("summary_large_image");
  });

  it("supports an absolute title for the home page", () => {
    const m = pageMetadata({ title: { absolute: "Home title" }, description: "d", path: "/" });
    expect(m.openGraph.title).toBe("Home title");
  });
});

describe("structured data", () => {
  it("describes the chapter as an NGO in Roxas City", () => {
    const ld = organizationLd();
    expect(ld["@type"]).toEqual(["NGO", "Organization"]);
    expect(ld.address.addressLocality).toBe("Roxas City");
    expect(ld.logo).toBe(absoluteUrl(SITE.logo));
  });

  it("builds breadcrumbs with positions and absolute URLs", () => {
    const ld = breadcrumbLd([{ name: "Home", path: "/" }, { name: "Officers", path: "/officers" }]);
    expect(ld.itemListElement[1]).toEqual({
      "@type": "ListItem",
      position: 2,
      name: "Officers",
      item: `${SITE.url}/officers`,
    });
  });
});

describe("buildSitemap", () => {
  it("lists every route with the home page first and highest", () => {
    const now = new Date("2026-10-21T00:00:00Z");
    const entries = buildSitemap(["/", "/about"], now);
    expect(entries).toEqual([
      { url: `${SITE.url}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
      { url: `${SITE.url}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    ]);
  });
});
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npx vitest run test/seo.test.js test/redirects.test.js`
Expected: `redirects.test.js` PASS; `seo.test.js` FAIL, cannot resolve `@/lib/seo.js`.

- [ ] **Step 4: Implement `lib/seo.js`**

```js
import { SITE } from "./site.js";

export function absoluteUrl(path) {
  return new URL(path, `${SITE.url}/`).toString();
}

export function pageMetadata({ title, description, path }) {
  const ogTitle = typeof title === "string" ? `${title} | ${SITE.name}` : title.absolute;
  const image = absoluteUrl(SITE.ogImage);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: ogTitle,
      description,
      url: absoluteUrl(path),
      siteName: SITE.name,
      locale: "en_PH",
      type: "website",
      images: [{ url: image }],
    },
    twitter: { card: "summary_large_image", title: ogTitle, description, images: [image] },
  };
}

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": ["NGO", "Organization"],
    name: SITE.name,
    url: absoluteUrl("/"),
    logo: absoluteUrl(SITE.logo),
    email: SITE.email,
    foundingDate: String(SITE.foundedYear),
    description: SITE.description,
    address: {
      "@type": "PostalAddress",
      addressLocality: SITE.address.locality,
      addressRegion: SITE.address.region,
      postalCode: SITE.address.postalCode,
      addressCountry: SITE.address.country,
    },
    sameAs: [SITE.facebookUrl],
    parentOrganization: {
      "@type": "Organization",
      name: "JCI Philippines",
      url: "https://jciphilippines.com",
    },
  };
}

export function breadcrumbLd(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function buildSitemap(routes, now = new Date()) {
  return routes.map((path) => ({
    url: absoluteUrl(path),
    lastModified: now,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run test/seo.test.js test/redirects.test.js`
Expected: PASS (8 tests).

- [ ] **Step 6: Wire redirects, robots and sitemap**

`next.config.mjs`:

```js
import { REDIRECTS } from "./lib/redirects.js";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return REDIRECTS;
  },
};

export default nextConfig;
```

`app/robots.js`:

```js
import { absoluteUrl } from "@/lib/seo.js";

export default function robots() {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/members", "/sign-in"] }],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
```

`app/sitemap.js`:

```js
import { STATIC_ROUTES } from "@/lib/routes.js";
import { buildSitemap } from "@/lib/seo.js";

export default function sitemap() {
  return buildSitemap(STATIC_ROUTES);
}
```

Run: `npm run build`
Expected: build succeeds; routes include `/robots.txt` and `/sitemap.xml`.

- [ ] **Step 7: Commit**

```bash
git add lib/site.js lib/routes.js lib/redirects.js lib/seo.js app/robots.js app/sitemap.js next.config.mjs test/seo.test.js test/redirects.test.js
git commit -m "Add SEO helpers, Webflow redirects, robots.txt and sitemap"
```

---

### Task 6: Layout, design system and shared components

**Files:**
- Create: `app/globals.css` (moved from `src/site.css`), `components/Nav.jsx`, `components/SiteFooter.jsx`, `components/Contours.jsx` (moved), `components/OfficerCard.jsx`, `components/ProjectCard.jsx`, `components/FaqList.jsx`, `components/JsonLd.jsx`, `test/components.test.jsx`
- Modify: `app/layout.jsx`, `package.json` (analytics packages)

**Interfaces:**
- Consumes: `SITE`, `NAV_LINKS`, `initials`, `formatDate`.
- Produces: `<Nav />`, `<SiteFooter />`, `<Contours variant="hero"|"quote"|"join" />`, `<OfficerCard officer={Officer} />`, `<ProjectCard project={Project} />`, `<FaqList faqs={{question,answer}[]} />`, `<JsonLd data={object} />`.

- [ ] **Step 1: Move the stylesheet and Contours, switch fonts to CSS variables**

Run:

```bash
mkdir -p components
git mv src/site.css app/globals.css
git mv src/components/Contours.jsx components/Contours.jsx
sed -i '' \
  -e 's/font-family: Syne, sans-serif/font-family: var(--font-syne), sans-serif/g' \
  -e 's/font-family: "Space Grotesk", monospace/font-family: var(--font-space-grotesk), monospace/g' \
  -e 's/font-family: Inter, system-ui, sans-serif/font-family: var(--font-inter), system-ui, sans-serif/g' \
  app/globals.css
grep -c "var(--font-" app/globals.css
```

Expected: the count is above 30 and `grep -n "Syne, sans-serif\|\"Space Grotesk\"" app/globals.css` returns nothing.

- [ ] **Step 2: Append the new component styles**

Append to `app/globals.css`:

```css
/* ============================================================
   Halaran Online additions (Phase 1)
   ============================================================ */
.hero__statement {
  max-width: 720px;
  font-family: var(--font-syne), sans-serif; font-weight: 700;
  font-size: clamp(1.2rem, 2.4vw, 1.8rem); line-height: 1.3;
  color: rgba(237, 232, 223, 0.85); text-wrap: pretty;
}
.page-hero { padding: 120px var(--pad-x) 48px; border-bottom: 1px solid rgba(237, 232, 223, 0.08); }
.page-hero h1 {
  font-family: var(--font-syne), sans-serif; font-weight: 800;
  font-size: clamp(2.4rem, 7vw, 5.2rem); line-height: 0.98;
  letter-spacing: -0.02em; text-transform: uppercase; color: var(--dune);
  overflow-wrap: anywhere;
}
.page-hero p { margin-top: 24px; max-width: 640px; font-size: 1.05rem; line-height: 1.7; color: rgba(237, 232, 223, 0.7); }

/* image frames used with next/image fill */
.project figure, .officer figure, .president__photo figure, .dune__photo { position: relative; overflow: hidden; }

/* officer without a photo */
.initials {
  display: grid; place-items: center; width: 100%; height: 100%;
  background: var(--canopy);
  font-family: var(--font-syne), sans-serif; font-weight: 800; font-size: 3rem;
  color: var(--ochre);
}

/* project without a cover image */
.project__placeholder {
  position: relative; display: grid; place-items: end start; width: 100%; height: 100%;
  padding: 20px; background: var(--canopy);
}
.project__placeholder .contours { opacity: 0.25; }
.project__placeholder span {
  position: relative;
  font-family: var(--font-space-grotesk), monospace; font-size: 0.72rem;
  letter-spacing: 0.12em; text-transform: uppercase; color: rgba(237, 232, 223, 0.6);
}
.project__meta h3 { overflow-wrap: anywhere; }

.section__more { margin-top: 40px; }

/* past presidents, partners, contact */
.list-rows > div {
  display: flex; justify-content: space-between; gap: 24px; flex-wrap: wrap;
  padding: 22px 0; border-top: 1px solid rgba(237, 232, 223, 0.12);
}
.list-rows .t { font-family: var(--font-syne), sans-serif; font-weight: 700; font-size: 1.15rem; color: var(--dune); }
.list-rows .y { font-family: var(--font-space-grotesk), monospace; font-size: 0.78rem; letter-spacing: 0.12em; color: var(--ochre); }
.contact { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
.contact > div { border-top: 2px solid var(--sage); padding-top: 20px; display: flex; flex-direction: column; gap: 8px; overflow-wrap: anywhere; }
.contact .l { font-family: var(--font-space-grotesk), monospace; font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(237, 232, 223, 0.6); }
@media (max-width: 900px) { .contact { grid-template-columns: 1fr; } }
```

- [ ] **Step 3: Write the failing component tests**

`test/components.test.jsx`:

```jsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import OfficerCard from "@/components/OfficerCard.jsx";
import ProjectCard from "@/components/ProjectCard.jsx";

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: ({ fill, sizes, priority, ...props }) => <img {...props} />,
}));

afterEach(cleanup);

describe("OfficerCard", () => {
  it("shows the photo when there is one", () => {
    render(<OfficerCard officer={{ name: "Jasper L. Sayo", role: "Vice President", photoUrl: "/a.jpg" }} />);
    expect(screen.getByRole("img", { name: "Jasper L. Sayo" })).toBeTruthy();
  });

  it("shows initials instead of a broken image when there is no photo", () => {
    const { container } = render(
      <OfficerCard officer={{ name: "Judy Daliva", role: "Director", photoUrl: null }} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("JD")).toBeTruthy();
    expect(screen.getByText("Judy Daliva")).toBeTruthy();
  });
});

describe("ProjectCard", () => {
  it("shows cover and formatted date", () => {
    render(
      <ProjectCard
        project={{ title: "IRONMEN Awards 2025", startDate: "2025-07-08", coverUrl: "/i.jpg", coverAlt: "Ceremony" }}
      />,
    );
    expect(screen.getByRole("img", { name: "Ceremony" })).toBeTruthy();
    expect(screen.getByText("July 8, 2025")).toBeTruthy();
  });

  it("shows a placeholder and no date when they are missing", () => {
    const { container } = render(<ProjectCard project={{ title: "SA DAGAT", startDate: null, coverUrl: null }} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".project__placeholder")).toBeTruthy();
    expect(container.querySelector("time")).toBeNull();
  });
});
```

- [ ] **Step 4: Run the tests to see them fail**

Run: `npx vitest run test/components.test.jsx`
Expected: FAIL, cannot resolve `@/components/OfficerCard.jsx`.

- [ ] **Step 5: Implement the components**

`components/OfficerCard.jsx`:

```jsx
import Image from "next/image";
import { initials } from "@/lib/format.js";

export default function OfficerCard({ officer }) {
  return (
    <div className="officer">
      <figure>
        {officer.photoUrl ? (
          <Image src={officer.photoUrl} alt={officer.name} fill sizes="(max-width: 560px) 100vw, (max-width: 900px) 50vw, 25vw" style={{ objectFit: "cover", objectPosition: "top" }} />
        ) : (
          <div className="initials" aria-hidden="true">{initials(officer.name)}</div>
        )}
      </figure>
      <div className="officer__meta">
        <span className="name">{officer.name}</span>
        <span className="role">{officer.role}</span>
      </div>
    </div>
  );
}
```

`components/ProjectCard.jsx`:

```jsx
import Image from "next/image";
import Contours from "@/components/Contours.jsx";
import { formatDate } from "@/lib/format.js";

export default function ProjectCard({ project }) {
  const date = formatDate(project.startDate);
  return (
    <article className="project">
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
    </article>
  );
}
```

`components/FaqList.jsx`:

```jsx
"use client";

import { useState } from "react";

export default function FaqList({ faqs }) {
  const [openIndex, setOpenIndex] = useState(0);
  return (
    <div className="faq__list">
      {faqs.map((f, i) => {
        const open = openIndex === i;
        return (
          <div className={"faq__item" + (open ? " open" : "")} key={f.question}>
            <button className="faq__q" aria-expanded={open} onClick={() => setOpenIndex(open ? -1 : i)}>
              <span className="n">{String(i + 1).padStart(2, "0")}</span>
              <span className="q">{f.question}</span>
              <span className="m" aria-hidden="true">{open ? "−" : "+"}</span>
            </button>
            <p className="faq__a">{f.answer}</p>
          </div>
        );
      })}
    </div>
  );
}
```

`components/JsonLd.jsx`:

```jsx
export default function JsonLd({ data }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
```

`components/Nav.jsx`:

```jsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { SITE } from "@/lib/site.js";
import { NAV_LINKS } from "@/lib/routes.js";

export default function Nav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const close = () => setOpen(false);

  return (
    <nav className="nav" aria-label="Main">
      <Link className="nav__logo" href="/" aria-label={`${SITE.name} — home`} onClick={close}>
        <Image src={SITE.logo} alt={SITE.name} width={91} height={44} priority />
      </Link>
      <button
        className="nav__burger"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span></span><span></span><span></span>
      </button>
      <div className={"nav__links" + (open ? " open" : "")}>
        {NAV_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={pathname === l.href ? "active" : undefined}
            aria-current={pathname === l.href ? "page" : undefined}
            onClick={close}
          >
            {l.label}
          </Link>
        ))}
        <Link className="btn" href="/join" onClick={close}>Become a Member</Link>
      </div>
    </nav>
  );
}
```

`components/SiteFooter.jsx`:

```jsx
import Link from "next/link";
import Image from "next/image";
import { SITE } from "@/lib/site.js";

export default function SiteFooter({ cta = true }) {
  return (
    <footer className="cta-footer">
      {cta && (
        <div className="cta-footer__inner">
          <Image src={SITE.logo} alt="" width={149} height={72} />
          <p className="cta-footer__title">Become a<br />member</p>
          <Link className="btn btn--lg" href="/join">Join JCI Roxas Halaran</Link>
        </div>
      )}
      <div className="baseline">
        <span>{SITE.name} — {SITE.address.locality}, {SITE.address.region}, {SITE.address.postalCode}</span>
        <span>
          <a href={`mailto:${SITE.email}`}>{SITE.email}</a> ·{" "}
          <a href={SITE.facebookUrl} target="_blank" rel="noopener noreferrer">Facebook</a>
        </span>
      </div>
    </footer>
  );
}
```

Note: the footer CTA title is a `<p>`, not an `<h2>`, so pages keep a clean heading outline; it keeps the `.cta-footer__title` styling.

- [ ] **Step 6: Run the tests to see them pass**

Run: `npx vitest run test/components.test.jsx`
Expected: PASS (4 tests).

- [ ] **Step 7: Real layout with fonts and analytics**

Run: `npm install @vercel/analytics@^1.5.0 @next/third-parties@^15.5.0`

Overwrite `app/layout.jsx`:

```jsx
import { Syne, Space_Grotesk, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { GoogleAnalytics } from "@next/third-parties/google";
import Nav from "@/components/Nav.jsx";
import { SITE } from "@/lib/site.js";
import "./globals.css";

const syne = Syne({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-syne", display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-space-grotesk", display: "swap" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-inter", display: "swap" });

export const metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.name, template: `%s | ${SITE.name}` },
  description: SITE.description,
  icons: {
    icon: [
      { url: "/assets/img/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/assets/img/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/assets/img/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/assets/img/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/assets/img/apple-touch-icon.png",
  },
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export default function RootLayout({ children }) {
  return (
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
  );
}
```

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add -A app components test package.json package-lock.json
git commit -m "Add layout, fonts, analytics and shared components with photo and cover fallbacks"
```

---

### Task 7: Public pages

**Files:**
- Create: `app/about/page.jsx`, `app/officers/page.jsx`, `app/projects/page.jsx`, `app/join/page.jsx`, `app/not-found.jsx`
- Modify: `app/page.jsx`
- Delete: `src/` (all remaining files)

**Interfaces:**
- Consumes: `getDb`, all query functions, `pageMetadata`, `organizationLd`, `breadcrumbLd`, `SITE`, components from Task 6.

Every page that reads the database exports `export const revalidate = 300;` so pages are pre-rendered and refreshed at most every five minutes (Phase 2 replaces this with on-publish revalidation).

- [ ] **Step 1: Home page (Mellon-style, story-led)**

Overwrite `app/page.jsx`:

```jsx
import Link from "next/link";
import Image from "next/image";
import Contours from "@/components/Contours.jsx";
import ProjectCard from "@/components/ProjectCard.jsx";
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import { getDb } from "@/lib/db.js";
import { listProjects, listAwards } from "@/lib/queries.js";
import { pageMetadata, organizationLd } from "@/lib/seo.js";
import { SITE } from "@/lib/site.js";

export const revalidate = 300;

export const metadata = pageMetadata({
  title: { absolute: "JCI Roxas Halaran | Leadership & Entrepreneurship in Roxas City, Capiz" },
  description: SITE.description,
  path: "/",
});

export default async function Home() {
  const db = getDb();
  const [projects, awards] = await Promise.all([listProjects(db, { limit: 3 }), listAwards(db)]);

  return (
    <>
      <JsonLd data={organizationLd()} />

      <header className="hero">
        <Contours variant="hero" />
        <div className="hero__inner">
          <h1 className="hero__title">JCI Roxas<br />Halaran<em>.</em></h1>
          <p className="hero__statement">Our offering to Capiz: young leaders turning local needs into lasting action.</p>
          <div className="hero__meta">
            <span>Based in Roxas City,<br />Capiz, 5800</span>
            <span>Part of JCI,<br />in 100+ countries</span>
            <span>Leadership<br />Entrepreneurship</span>
            <Link className="btn" href="/join">Become a Member →</Link>
          </div>
        </div>
      </header>

      <section id="about" className="section section--line-top">
        <div className="crumbs label">
          <span className="num">01</span><span className="mid">About Us</span><span className="end">{SITE.name}</span>
        </div>
        <div className="about__grid">
          <h2>We are a Capiz-based JCI chapter</h2>
          <p>Connecting members worldwide through shared values and empowering them to create positive change and opportunities on a global scale.</p>
        </div>
        <div className="pillars">
          {SITE.pillars.map((p) => (
            <div className="pillar" key={p.num}>
              <span className="num">{p.num}</span>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="projects" className="section">
        <div className="section__bar">
          <h2>Stories from our projects</h2>
          <span className="label">02 — Projects</span>
        </div>
        <div className="projects">
          {projects.map((p) => <ProjectCard key={p.slug} project={p} />)}
        </div>
        <p className="section__more"><Link className="btn" href="/projects">See all projects</Link></p>
      </section>

      <section className="quote">
        <Contours variant="quote" />
        <div className="quote__inner">
          <span className="label">03 — Our Goal</span>
          <p className="quote__text">Great leaders don't set out to be a leader… they set out to make a difference.</p>
        </div>
      </section>

      <section className="section section--line-bottom">
        <div className="crumbs label">
          <span className="num">04</span><span className="mid">Impact</span><span className="end">In numbers</span>
        </div>
        <div className="stats">
          {SITE.stats.map((s) => (
            <div className="stat" key={s.label}>
              <span className="v">{s.value}</span>
              <span className="l">{s.label}</span>
            </div>
          ))}
        </div>
        <p className="stats__mission">Our mission: {SITE.mission}</p>
      </section>

      <section className="dune section">
        <div className="dune__grid">
          <div className="dune__col">
            <span className="label">05 — Since {SITE.foundedYear}</span>
            <p className="dune__lede">The Philippine Jaycees, now JCI Philippines, is the first nationally organized leadership development organization in Asia. JCI Roxas Halaran carries that tradition into Capiz.</p>
            <div className="dune__stats">
              {awards.slice(0, 2).map((a) => (
                <div className="dune__stat" key={a.title}>
                  <span className="v">{a.year}</span>
                  <span className="l">{a.title}</span>
                </div>
              ))}
            </div>
            <p className="dune__note"><Link href="/about">Our story and recognition →</Link></p>
          </div>
          <div className="dune__photo">
            <Image src={SITE.aboutPhoto} alt="JCI Roxas Halaran members at a chapter activity" fill sizes="(max-width: 900px) 100vw, 50vw" style={{ objectFit: "cover" }} />
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
```

- [ ] **Step 2: About page**

`app/about/page.jsx`:

```jsx
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import { getDb } from "@/lib/db.js";
import { listAwards, listSponsors } from "@/lib/queries.js";
import { pageMetadata, breadcrumbLd } from "@/lib/seo.js";
import { SITE } from "@/lib/site.js";

export const revalidate = 300;

export const metadata = pageMetadata({
  title: "About us",
  description: "Who we are: JCI Roxas Halaran's mission, vision, values, recognition and partners in Roxas City, Capiz.",
  path: "/about",
});

export default async function About() {
  const db = getDb();
  const [awards, sponsors] = await Promise.all([listAwards(db), listSponsors(db)]);

  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "About us", path: "/about" }])} />
      <header className="page-hero">
        <h1>About JCI Roxas Halaran</h1>
        <p>A Capiz-based chapter of Junior Chamber International, the worldwide organization of young active citizens aged 18 to 40, active in Roxas City since {SITE.foundedYear}.</p>
      </header>

      <section className="section">
        <div className="about__grid">
          <h2>Mission</h2>
          <p>{SITE.mission}</p>
          <h2>Vision</h2>
          <p>{SITE.vision}</p>
        </div>
      </section>

      <section className="section section--line-top">
        <div className="stats">
          {SITE.stats.map((s) => (
            <div className="stat" key={s.label}>
              <span className="v">{s.value}</span>
              <span className="l">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section__bar"><h2>Recognition</h2><span className="label">Awards</span></div>
        {awards.map((a) => (
          <div className="award" key={a.title}>
            <span className="t">{a.title}</span>
            <span className="by">{a.awardedBy}</span>
            <span className="y">{a.year}</span>
          </div>
        ))}
      </section>

      <section className="section">
        <div className="section__bar"><h2>Partners</h2><span className="label">Thank you</span></div>
        <div className="list-rows">
          {sponsors.map((s) => (
            <div key={s.name}><span className="t">{s.name}</span></div>
          ))}
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
```

- [ ] **Step 3: Officers page**

`app/officers/page.jsx`:

```jsx
import Image from "next/image";
import OfficerCard from "@/components/OfficerCard.jsx";
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import { getDb } from "@/lib/db.js";
import { getCurrentBoard, getPastPresidents } from "@/lib/queries.js";
import { pageMetadata, breadcrumbLd } from "@/lib/seo.js";
import { initials } from "@/lib/format.js";

export const revalidate = 300;

export const metadata = pageMetadata({
  title: "Our officers",
  description: "Meet the president and board of officers leading JCI Roxas Halaran in Roxas City, Capiz.",
  path: "/officers",
});

export default async function Officers() {
  const db = getDb();
  const board = await getCurrentBoard(db);
  const past = board.year ? await getPastPresidents(db, board.year) : [];
  const { president } = board;

  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Our officers", path: "/officers" }])} />
      <header className="page-hero">
        <h1>Our officers</h1>
        <p>The {board.year ?? ""} board guiding JCI Roxas Halaran's mission of developing leaders for a changing world.</p>
      </header>

      {president && (
        <section className="president section">
          <div className="president__grid">
            <div className="president__photo">
              <figure>
                {president.photoUrl ? (
                  <Image src={president.photoUrl} alt={president.name} fill sizes="380px" style={{ objectFit: "cover", objectPosition: "top" }} priority />
                ) : (
                  <div className="initials" aria-hidden="true">{initials(president.name)}</div>
                )}
              </figure>
              <span className="label label--sm">{president.name} — {board.year} Local Organization President</span>
            </div>
            <div className="president__body">
              <h2 className="syne">{president.name}</h2>
              {president.bio?.split("\n\n").map((para) => <p className="bio" key={para}>{para}</p>)}
              {president.quote && <blockquote>“{president.quote}”</blockquote>}
            </div>
          </div>
        </section>
      )}

      <section className="section">
        <div className="section__bar"><h2>Board {board.year}</h2><span className="label">Officers</span></div>
        <div className="officers">
          {board.officers.map((o) => <OfficerCard key={`${o.slug}-${o.role}`} officer={o} />)}
        </div>
      </section>

      {past.length > 0 && (
        <section className="section">
          <div className="section__bar"><h2>Past presidents</h2><span className="label">Since 2023</span></div>
          <div className="list-rows">
            {past.map((p) => (
              <div key={p.year}><span className="t">{p.name}</span><span className="y">{p.year}</span></div>
            ))}
          </div>
        </section>
      )}

      <SiteFooter />
    </>
  );
}
```

Add to `app/globals.css` so the president's name uses the existing heading style:

```css
.president__body h2 { font-family: var(--font-syne), sans-serif; font-weight: 800; font-size: clamp(2rem, 4.5vw, 3.4rem); line-height: 1.02; color: var(--dune); overflow-wrap: anywhere; }
```

- [ ] **Step 4: Projects page**

`app/projects/page.jsx`:

```jsx
import ProjectCard from "@/components/ProjectCard.jsx";
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import { getDb } from "@/lib/db.js";
import { listProjects } from "@/lib/queries.js";
import { pageMetadata, breadcrumbLd } from "@/lib/seo.js";

export const revalidate = 300;

export const metadata = pageMetadata({
  title: "Our projects",
  description: "Community projects by JCI Roxas Halaran across Roxas City and Capiz: leadership, community development and global outreach.",
  path: "/projects",
});

export default async function Projects() {
  const projects = await listProjects(getDb());
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Our projects", path: "/projects" }])} />
      <header className="page-hero">
        <h1>Our projects</h1>
        <p>How the chapter turns local needs into lasting action across Roxas City and Capiz.</p>
      </header>
      <section className="section">
        <div className="projects">
          {projects.map((p) => <ProjectCard key={p.slug} project={p} />)}
        </div>
      </section>
      <SiteFooter />
    </>
  );
}
```

- [ ] **Step 5: Join page**

`app/join/page.jsx`:

```jsx
import FaqList from "@/components/FaqList.jsx";
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import { getDb } from "@/lib/db.js";
import { listFaqs } from "@/lib/queries.js";
import { pageMetadata, breadcrumbLd } from "@/lib/seo.js";
import { SITE } from "@/lib/site.js";

export const revalidate = 300;

export const metadata = pageMetadata({
  title: "Become a member",
  description: "Join JCI Roxas Halaran: who can join, membership benefits, fees and how to contact us in Roxas City, Capiz.",
  path: "/join",
});

export default async function Join() {
  const faqs = await listFaqs(getDb());
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Become a member", path: "/join" }])} />
      <header className="page-hero">
        <h1>Become a member</h1>
        <p>Join a worldwide network of young active citizens aged 18 to 40 creating positive change, starting right here in Roxas City.</p>
      </header>

      <section id="contact" className="section">
        <div className="section__bar"><h2>Get in touch</h2><span className="label">Contact</span></div>
        <div className="contact">
          <div><span className="l">Email</span><a href={`mailto:${SITE.email}`}>{SITE.email}</a></div>
          <div><span className="l">Facebook</span><a href={SITE.facebookUrl} target="_blank" rel="noopener noreferrer">Message our page</a></div>
          <div><span className="l">Location</span><span>{SITE.address.locality}, {SITE.address.region} {SITE.address.postalCode}</span></div>
        </div>
      </section>

      <section id="faq" className="dune section">
        <div className="faq__grid">
          <div className="faq__head">
            <span className="label">FAQ</span>
            <h2>Frequently asked questions</h2>
          </div>
          <FaqList faqs={faqs} />
        </div>
      </section>

      <SiteFooter cta={false} />
    </>
  );
}
```

- [ ] **Step 6: Not-found page**

`app/not-found.jsx`:

```jsx
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter.jsx";

export const metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <>
      <header className="page-hero">
        <h1>Page not found</h1>
        <p>This page may have moved. Try <Link href="/projects">our projects</Link>, <Link href="/officers">our officers</Link> or <Link href="/join">how to join</Link>.</p>
      </header>
      <SiteFooter />
    </>
  );
}
```

- [ ] **Step 7: Remove the old Vite source and verify**

Run: `git rm -r src && npm test && npm run build`
Expected: all unit tests PASS; build succeeds and lists `/`, `/about`, `/officers`, `/projects`, `/join` as static (○) or ISR pages.

Run: `npm run dev`, open http://localhost:5174 and each page.
Expected: all five pages render with the seeded content; the 2026 board shows Jaime Cortes Altavas as president and initials tiles for the four officers without photos.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Build home, about, officers, projects and join pages from the database"
```

---

### Task 8: Clerk sign-in and role-protected areas

**Files:**
- Create: `lib/roles.js`, `test/roles.test.js`, `middleware.js`, `app/admin/page.jsx`, `app/sign-in/[[...sign-in]]/page.jsx`
- Modify: `app/layout.jsx`, `package.json`

**Interfaces:**
- Produces: `ROLES`, `normalizeRole(value): string|null`, `canAccess(role, area: "members"|"admin"): boolean` from `lib/roles.js`.

**Prerequisite (manual, in the Clerk dashboard):**
1. Create a Clerk application "JCI Roxas Halaran" (email sign-in; turn **off** public sign-up under Restrictions, since members join by invitation in Phase 4).
2. Sessions → Customize session token → set `{ "metadata": "{{user.public_metadata}}" }`.
3. Copy the keys into `.env.local` (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`) and keep `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`.
4. Create your own user and set its public metadata to `{ "role": "admin" }`.

- [ ] **Step 1: Write the failing tests**

`test/roles.test.js`:

```js
import { describe, it, expect } from "vitest";
import { canAccess, normalizeRole } from "@/lib/roles.js";

describe("normalizeRole", () => {
  it("accepts known roles and rejects anything else", () => {
    expect(normalizeRole("treasurer")).toBe("treasurer");
    expect(normalizeRole("superuser")).toBeNull();
    expect(normalizeRole(undefined)).toBeNull();
  });
});

describe("canAccess", () => {
  it("lets every role into the members area", () => {
    for (const r of ["member", "officer", "treasurer", "admin"]) expect(canAccess(r, "members")).toBe(true);
  });

  it("keeps plain members and users without a role out of admin", () => {
    expect(canAccess("member", "admin")).toBe(false);
    expect(canAccess(undefined, "admin")).toBe(false);
    expect(canAccess(undefined, "members")).toBe(false);
  });

  it("lets officers, treasurers and admins into admin", () => {
    for (const r of ["officer", "treasurer", "admin"]) expect(canAccess(r, "admin")).toBe(true);
  });

  it("denies unknown areas", () => {
    expect(canAccess("admin", "billing")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run test/roles.test.js`
Expected: FAIL, cannot resolve `@/lib/roles.js`.

- [ ] **Step 3: Implement `lib/roles.js`**

```js
export const ROLES = ["member", "officer", "treasurer", "admin"];

const AREA_ROLES = {
  members: ["member", "officer", "treasurer", "admin"],
  admin: ["officer", "treasurer", "admin"],
};

export function normalizeRole(value) {
  return ROLES.includes(value) ? value : null;
}

export function canAccess(role, area) {
  const r = normalizeRole(role);
  return r !== null && (AREA_ROLES[area] ?? []).includes(r);
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run test/roles.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Install Clerk and add middleware**

Run: `npm install @clerk/nextjs@^6`

`middleware.js`:

```js
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { canAccess } from "./lib/roles.js";

const isAdmin = createRouteMatcher(["/admin(.*)"]);
const isMembers = createRouteMatcher(["/members(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (!isAdmin(req) && !isMembers(req)) return;

  const { userId, sessionClaims, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: req.url });

  const area = isAdmin(req) ? "admin" : "members";
  if (!canAccess(sessionClaims?.metadata?.role, area)) {
    // Signed in but not allowed: answer 404 so the area isn't advertised.
    return new NextResponse("Not found", { status: 404 });
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

- [ ] **Step 6: Wrap the app in ClerkProvider and add the pages**

In `app/layout.jsx`, add the import and wrap `<html>`:

```jsx
import { ClerkProvider } from "@clerk/nextjs";
```

```jsx
export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
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
    </ClerkProvider>
  );
}
```

`app/sign-in/[[...sign-in]]/page.jsx`:

```jsx
import { SignIn } from "@clerk/nextjs";

export const metadata = { title: "Sign in", robots: { index: false } };

export default function SignInPage() {
  return (
    <section className="page-hero" style={{ display: "grid", placeItems: "center" }}>
      <h1 className="syne">Sign in</h1>
      <SignIn />
    </section>
  );
}
```

`app/admin/page.jsx`:

```jsx
import { auth } from "@clerk/nextjs/server";
import { normalizeRole } from "@/lib/roles.js";

export const metadata = { title: "Admin", robots: { index: false } };

export default async function Admin() {
  const { sessionClaims } = await auth();
  const role = normalizeRole(sessionClaims?.metadata?.role);
  return (
    <header className="page-hero">
      <h1>Admin</h1>
      <p>Signed in as <strong>{role}</strong>. Content tools for articles, projects and the SEO plan arrive in Phase 2.</p>
    </header>
  );
}
```

- [ ] **Step 7: Verify by hand**

Run: `npm test && npm run build && npm run dev`
Expected: unit tests PASS; build succeeds. In the browser:
- `/admin` signed out → redirected to `/sign-in`.
- Signed in as your `admin` user → `/admin` shows "Signed in as admin".
- Change your role in Clerk to `member`, sign out and in again → `/admin` returns "Not found" (404).
- Set the role back to `admin`.

- [ ] **Step 8: Commit**

```bash
git add lib/roles.js test/roles.test.js middleware.js app package.json package-lock.json
git commit -m "Add Clerk sign-in and role-protected admin and members areas"
```

---

### Task 9: End-to-end checks (SEO, redirects, access, mobile)

**Files:**
- Create: `playwright.config.js`, `scripts/prepare-e2e-db.mjs`, `e2e/site.spec.js`
- Modify: `package.json` (dev dependency, script)

**Interfaces:**
- Consumes: the built app, `STATIC_ROUTES`, `REDIRECTS`, `seed`.

- [ ] **Step 1: Install Playwright and add the e2e database script**

Run: `npm install -D @playwright/test@^1.55.0 && npx playwright install chromium`

`scripts/prepare-e2e-db.mjs`:

```js
import { rmSync } from "node:fs";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDb } from "../lib/db.js";
import { seed } from "../db/seed.js";

rmSync("e2e.db", { force: true });
const db = createDb("file:e2e.db");
await migrate(db, { migrationsFolder: "db/migrations" });
await seed(db);
console.log("e2e.db ready.");
```

Add to `package.json` scripts:

```json
"e2e:serve": "node scripts/prepare-e2e-db.mjs && next build && next start -p 3100"
```

`playwright.config.js`:

```js
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://localhost:3100" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run e2e:serve",
    url: "http://localhost:3100",
    timeout: 240_000,
    reuseExistingServer: false,
    env: { TURSO_DATABASE_URL: "file:e2e.db", NEXT_PUBLIC_SITE_URL: "http://localhost:3100" },
  },
});
```

Clerk keys come from `.env.local`, which `next build`/`next start` load automatically; the `env` above takes precedence for the database and site URL.

- [ ] **Step 2: Write the e2e tests**

`e2e/site.spec.js`:

```js
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

    test(`${path} has no horizontal scroll on a 375px phone`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
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
  await expect(page.locator(".initials", { hasText: "JD" })).toBeVisible();
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
```

- [ ] **Step 3: Run the e2e suite**

Run: `npm run test:e2e`
Expected: all tests PASS. If the mobile-overflow test fails on a page, find the wide element with `document.querySelectorAll("*")` filtered by `getBoundingClientRect().right > 375` in the browser console, and fix it in `app/globals.css` (usually by adding `overflow-wrap: anywhere` or reducing a `clamp()` minimum).

- [ ] **Step 4: Commit**

```bash
git add playwright.config.js scripts/prepare-e2e-db.mjs e2e package.json package-lock.json
git commit -m "Add end-to-end checks for SEO, redirects, access, images and mobile layout"
```

---

### Task 10: Provision Turso, configure Vercel and deploy the preview

**Files:**
- Modify: `README.md`

This task has no automated test; each step lists what to check. The domain stays on Webflow until the end of Phase 2.

- [ ] **Step 1: Create the production database**

Run:

```bash
turso auth login
turso db create jci-roxas-halaran
turso db show jci-roxas-halaran --url
turso db tokens create jci-roxas-halaran
```

Expected: a `libsql://…turso.io` URL and a token.

- [ ] **Step 2: Migrate and seed production**

Run (with the production values, without saving them to a file):

```bash
TURSO_DATABASE_URL='libsql://<from step 1>' TURSO_AUTH_TOKEN='<token>' node scripts/migrate.mjs
TURSO_DATABASE_URL='libsql://<from step 1>' TURSO_AUTH_TOKEN='<token>' node scripts/seed.mjs
turso db shell jci-roxas-halaran "select count(*) from members; select count(*) from projects;"
```

Expected: `Migrations applied.`, `Seed complete.`, then 17 and 11.

- [ ] **Step 3: Set Vercel environment variables**

Run (each command prompts for the value; choose Production and Preview):

```bash
vercel env add TURSO_DATABASE_URL
vercel env add TURSO_AUTH_TOKEN
vercel env add NEXT_PUBLIC_SITE_URL          # https://jci-roxas-halaran.vercel.app until the domain switch
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
vercel env add CLERK_SECRET_KEY
vercel env add NEXT_PUBLIC_CLERK_SIGN_IN_URL # /sign-in
vercel env add NEXT_PUBLIC_GA_ID             # from a new GA4 property for jciroxashalaran.com
```

In the Clerk dashboard, add `https://jci-roxas-halaran.vercel.app` to the allowed origins of the production instance (or use the development instance for this preview).

- [ ] **Step 4: Update the README**

Replace the "Stack", "Develop" and "Build & deploy" sections of `README.md` with:

````markdown
## Stack

- **Next.js 15 (App Router) + React 19**, JavaScript
- **Turso** (SQLite) via **Drizzle ORM** — schema in `db/schema.js`, migrations in `db/migrations`
- **Clerk** for sign-in; roles (`member`, `officer`, `treasurer`, `admin`) in each user's public metadata
- Design system: Coastal Canopy & Basalt tokens at the top of `app/globals.css`; fonts Syne / Space Grotesk / Inter via `next/font`
- Spec: `docs/superpowers/specs/2026-10-21-halaran-online-design.md`

## Develop

```bash
cp .env.example .env.local   # fill in Clerk keys
npm install
npm run db:migrate && npm run db:seed
npm run dev                  # http://localhost:5174
```

## Test

```bash
npm test            # unit and component tests (Vitest)
npm run test:e2e    # end-to-end checks (Playwright, uses e2e.db)
```

## Database changes

Edit `db/schema.js`, then `npm run db:generate` and `npm run db:migrate`.
The seed (`npm run db:seed`) only inserts missing rows; it never overwrites edits.

## Deploy

Vercel builds on every push. Environment variables are listed in `.env.example`.
````

- [ ] **Step 5: Deploy and check the preview**

Run:

```bash
git add README.md
git commit -m "Document the Next.js, Turso and Clerk setup"
git push -u origin halaran-online
vercel --prod=false
```

Expected: a preview URL. Check on a phone:
- all five pages load with real content;
- `/about-us`, `/our-officers`, `/contact` and `/leadership` redirect;
- `/sitemap.xml` and `/robots.txt` use the preview URL;
- `/admin` asks you to sign in, and your admin user gets in.

Run Lighthouse (Chrome DevTools → Lighthouse → Mobile) on `/` and `/officers`.
Expected: SEO ≥ 90 and Accessibility ≥ 90. Record the scores in the Obsidian evidence notes for the bid.

- [ ] **Step 6: Open the pull request**

Run:

```bash
gh pr create --title "Halaran Online Phase 1: Next.js foundation and content migration" --body "$(cat <<'EOF'
Phase 1 of the Halaran Online spec: Next.js + Turso + Clerk foundation, migrated content, SEO plumbing, Webflow redirects, role-protected admin, analytics.

Plan: docs/superpowers/plans/2026-10-21-halaran-online-phase-1-foundation.md

https://claude.ai/code/session_01Veo3QHt6DoiFbKo4ciLaDL
EOF
)"
```

Expected: a PR URL. Merge after review; the domain switch happens at the end of Phase 2.
