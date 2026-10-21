# Halaran Online — Phase 5: Proof — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Public `/impact` (interactive Capiz map + live totals) and `/transparency` (money in and out), live home stats, project locations and impact metrics in admin, and an `/admin/evidence` dashboard with monthly analytics snapshots and CSV exports.

**Architecture:** Pure aggregation functions in `lib/proof/*` take a Drizzle `db` and are tested on in-memory SQLite. Pages are server components; the map is a client component that loads Leaflet only on `/impact`. Admin actions use `requireArea("content")`.

**Tech Stack:** Next.js 15 App Router (JS), Drizzle + Turso, Leaflet 1.9.4 + OpenStreetMap tiles, Zod 3, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-21-halaran-online-phase-5-design.md`. **Spec corrections:** `project_metrics` did not exist yet (it was only in the parent spec), so migration `0005` creates it. The home page shows a live figure only when it is larger than the chapter's stated figure in `SITE.stats` (the database holds fewer projects than the chapter has run, so a lower live number would undersell it).

**Code blocks:** whole files are introduced by `` `path`: ``; appends by `` `path` (append): ``; other edits are exact old/new text.

## Global Constraints

- JavaScript only; `.jsx` for JSX. Aggregations never expose payer names, emails, phones or receipt URLs on public pages.
- Money in integer centavos, shown with `formatPesos`. Confirmed payments only. A payment's year/month is the Philippine date of `confirmed_at`; an expense's is `spent_on`; an evidence row's month is the Philippine month of `created_at`.
- Coordinates must be inside the Philippines (lat 4–22, lng 116–127).
- Leaflet loads only on `/impact` (client component, dynamic import); the map renders only when at least one project has coordinates.
- CSV through `csvCell`.
- Phase 1–4 page rules apply to `/impact` and `/transparency`.

## Review Focus

- **A payment confirmed at 01:00 on 1 January (Philippine time):** counted in the new year on `/transparency`. → Task 3 test.
- **An evidence row logged at 07:30 Philippine time on the 1st of a month:** counted in that month, not the previous one. → Task 4 test.
- **A project title containing `<script>` or quotes shown in a map popup:** escaped, not executed. → Task 6 test.
- **Pasting a Google Maps URL (`…/@11.5853,122.7511,15z`) into the location box:** coordinates extracted. → Task 2 test.
- **The same metric entered twice for one project:** one row kept, last value wins. → Task 2 test.

---

### Task 1: Schema

**Files:**
- Modify: `db/schema.js`, `test/schema.test.js`
- Create: `db/migrations/0005_proof.sql` (generated)

- [ ] **Step 1: Write the failing test**

Append inside the top `describe("schema", …)` of `test/schema.test.js` (add `projectMetrics, analyticsSnapshots` to its schema import):

```js
  it("keeps one value per project and metric, and one analytics snapshot per month", async () => {
    const db = await testDb();
    const [p] = await db.insert(projects).values({ slug: "p", title: "P" }).returning();
    await db.insert(projectMetrics).values({ projectId: p.id, metric: "trees_planted", value: 10 });
    await expect(db.insert(projectMetrics).values({ projectId: p.id, metric: "trees_planted", value: 5 })).rejects.toThrow();
    await db.insert(analyticsSnapshots).values({ month: "2026-11", updatedAt: "x" });
    await expect(db.insert(analyticsSnapshots).values({ month: "2026-11", updatedAt: "x" })).rejects.toThrow();
  });
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run test/schema.test.js`
Expected: FAIL — `projectMetrics` undefined.

- [ ] **Step 3: Add the tables**

`db/schema.js` (append):

```js
export const projectMetrics = sqliteTable(
  "project_metrics",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    metric: text("metric").notNull(),
    value: integer("value").notNull(),
  },
  (t) => [uniqueIndex("project_metrics_project_metric").on(t.projectId, t.metric)],
);

export const analyticsSnapshots = sqliteTable("analytics_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  month: text("month").notNull().unique(),
  organicClicks: integer("organic_clicks"),
  impressions: integer("impressions"),
  visitors: integer("visitors"),
  note: text("note"),
  updatedBy: text("updated_by"),
  updatedAt: text("updated_at").notNull(),
});
```

Run: `npx drizzle-kit generate --name proof`
Expected: `db/migrations/0005_proof.sql` creating `project_metrics` and `analytics_snapshots`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --exclude test/import-articles.test.js`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add db/schema.js db/migrations test/schema.test.js
git commit -m "Add project metrics and analytics snapshot tables"
```

---

### Task 2: Project locations and impact metrics

**Files:**
- Create: `lib/proof/location.js`, `lib/proof/metrics.js`, `test/proof-projects.test.js`
- Modify: `lib/content/validation.js`, `lib/content/projects.js`

**Interfaces:**
- Produces: `parseCoordinates(text) → { lat, lng } | null`, `inPhilippines(lat, lng)`, `LOCATION_MESSAGE`; `METRICS` (key → label), `setProjectMetrics(db, projectId, rows)`, `listProjectMetrics(db, projectId)`; `projectInput` gains `lat`, `lng`; `saveProject` stores them.

- [ ] **Step 1: Write the failing tests**

`test/proof-projects.test.js`:

```js
import { describe, it, expect, beforeEach } from "vitest";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { parseCoordinates, inPhilippines } from "@/lib/proof/location.js";
import { setProjectMetrics, listProjectMetrics } from "@/lib/proof/metrics.js";
import { saveProject, getProjectBySlug } from "@/lib/content/projects.js";

let db;
beforeEach(async () => {
  db = await testDb();
  await seed(db);
});

describe("coordinates", () => {
  it("reads a plain pair and a Google Maps link", () => {
    expect(parseCoordinates("11.5853, 122.7511")).toEqual({ lat: 11.5853, lng: 122.7511 });
    expect(parseCoordinates("https://www.google.com/maps/place/Baybay/@11.6047,122.7339,15z/data")).toEqual({ lat: 11.6047, lng: 122.7339 });
    expect(parseCoordinates("Roxas City")).toBeNull();
  });

  it("checks the Philippines bounds", () => {
    expect(inPhilippines(11.58, 122.75)).toBe(true);
    expect(inPhilippines(51.5, -0.12)).toBe(false);
  });

  it("saves a project location and refuses one outside the Philippines", async () => {
    const p = await getProjectBySlug(db, "coastline-cuts");
    const ok = await saveProject(db, { id: p.id, expectedUpdatedAt: p.updatedAt, title: p.title, lat: "11.6047", lng: "122.7339", barangay: "Baybay" }, {});
    expect(ok.project).toMatchObject({ lat: 11.6047, lng: 122.7339, barangay: "Baybay" });
    const bad = await saveProject(db, { id: p.id, expectedUpdatedAt: ok.project.updatedAt, title: p.title, lat: "51.5", lng: "-0.12" }, {});
    expect(bad).toEqual({ ok: false, errors: ["Use coordinates inside the Philippines, e.g. 11.5853, 122.7511"] });
  });

  it("requires both coordinates or neither", async () => {
    const p = await getProjectBySlug(db, "coastline-cuts");
    expect((await saveProject(db, { id: p.id, expectedUpdatedAt: p.updatedAt, title: p.title, lat: "11.6" }, {})).ok).toBe(false);
  });
});

describe("impact metrics", () => {
  it("replaces a project's metrics and keeps the last value for a repeated metric", async () => {
    const p = await getProjectBySlug(db, "coastline-cuts");
    await setProjectMetrics(db, p.id, [{ metric: "trees_planted", value: "100" }]);
    const r = await setProjectMetrics(db, p.id, [
      { metric: "people_reached", value: 50 },
      { metric: "trees_planted", value: 120 },
      { metric: "trees_planted", value: 150 },
    ]);
    expect(r.ok).toBe(true);
    const rows = await listProjectMetrics(db, p.id);
    expect(Object.fromEntries(rows.map((m) => [m.metric, m.value]))).toEqual({ people_reached: 50, trees_planted: 150 });
  });

  it("refuses unknown metrics and fractional values", async () => {
    const p = await getProjectBySlug(db, "coastline-cuts");
    expect((await setProjectMetrics(db, p.id, [{ metric: "bananas", value: 1 }])).ok).toBe(false);
    expect((await setProjectMetrics(db, p.id, [{ metric: "volunteers", value: 2.5 }])).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run test/proof-projects.test.js`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`lib/proof/location.js`:

```js
// Accepts "11.5853, 122.7511" or a Google Maps link containing "@11.58,122.75".
const PAIR = /(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/;

export const LOCATION_MESSAGE = "Use coordinates inside the Philippines, e.g. 11.5853, 122.7511";

export function parseCoordinates(text) {
  const m = String(text ?? "").match(PAIR);
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
}

export const inPhilippines = (lat, lng) => lat >= 4 && lat <= 22 && lng >= 116 && lng <= 127;
```

`lib/proof/metrics.js`:

```js
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { projectMetrics } from "../../db/schema.js";

export const METRICS = {
  people_reached: "People reached",
  trees_planted: "Trees planted",
  volunteers: "Volunteers",
  schools: "Schools",
  barangays: "Barangays served",
  kilos_collected: "Kilos of waste collected",
  meals_served: "Meals served",
};

const metricRow = z.object({
  metric: z.enum(Object.keys(METRICS), { errorMap: () => ({ message: "Choose a metric" }) }),
  value: z.coerce.number().int("Use whole numbers").min(0, "Use 0 or more").max(10_000_000),
});

export async function setProjectMetrics(db, projectId, rows) {
  const parsed = z.array(metricRow).max(20).safeParse(rows ?? []);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  const merged = new Map(parsed.data.map((r) => [r.metric, r.value]));
  await db.delete(projectMetrics).where(eq(projectMetrics.projectId, Number(projectId)));
  if (merged.size) {
    await db.insert(projectMetrics).values([...merged].map(([metric, value]) => ({ projectId: Number(projectId), metric, value })));
  }
  return { ok: true, metrics: Object.fromEntries(merged) };
}

export function listProjectMetrics(db, projectId) {
  return db.select().from(projectMetrics).where(eq(projectMetrics.projectId, Number(projectId))).orderBy(asc(projectMetrics.metric));
}
```

In `lib/content/validation.js`, add at the top:

```js
import { inPhilippines, LOCATION_MESSAGE } from "../proof/location.js";
```

and replace the closing of `projectInput` — the lines

```js
  bodyJson: z.string().default(""),
  bodyHtml: z.string().default(""),
});

export const resourceInput = z.object({
```

with

```js
  bodyJson: z.string().default(""),
  bodyHtml: z.string().default(""),
  lat: z.preprocess((v) => (v === "" || v === undefined || v === null ? null : Number(v)), z.number().nullable()).default(null),
  lng: z.preprocess((v) => (v === "" || v === undefined || v === null ? null : Number(v)), z.number().nullable()).default(null),
}).refine((d) => (d.lat === null && d.lng === null) || (d.lat !== null && d.lng !== null && inPhilippines(d.lat, d.lng)), {
  message: LOCATION_MESSAGE,
});

export const resourceInput = z.object({
```

In `lib/content/projects.js`, add to the `values` object in `saveProject` (after `body: cleanHtml(d.bodyHtml),`):

```js
    lat: d.lat,
    lng: d.lng,
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run --exclude test/import-articles.test.js`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/proof/location.js lib/proof/metrics.js lib/content/validation.js lib/content/projects.js test/proof-projects.test.js
git commit -m "Add project coordinates and impact metrics"
```

---

### Task 3: Impact totals, home stats and transparency

**Files:**
- Create: `lib/proof/impact.js`, `lib/proof/transparency.js`, `test/proof-public.test.js`

**Interfaces:**
- Produces: `impactTotals(db, { now? })` → `{ projectsDone, activeMembers, volunteers, eventsHeld, metrics }`; `mapProjects(db)`; `projectsByBarangay(db)` → `[{ barangay, projects }]`; `homeStats(totals, fallback)`; `transparencyYears(db)`; `transparencyForYear(db, year)` → `{ income, expensesTotal, balance, campaigns, projects, items }`.

- [ ] **Step 1: Write the failing tests**

`test/proof-public.test.js`:

```js
import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { projects } from "@/db/schema.js";
import { impactTotals, mapProjects, projectsByBarangay, homeStats } from "@/lib/proof/impact.js";
import { transparencyYears, transparencyForYear } from "@/lib/proof/transparency.js";
import { setProjectMetrics } from "@/lib/proof/metrics.js";
import { saveEvent, submitVolunteer } from "@/lib/engagement/events.js";
import { saveCampaign, submitPledge, confirmPayment, recordExpense } from "@/lib/engagement/money.js";

let db;
beforeEach(async () => {
  db = await testDb();
  await seed(db);
});
const coastline = async () => (await db.select().from(projects).where(eq(projects.slug, "coastline-cuts")))[0];

describe("impactTotals", () => {
  it("counts done projects, active members, volunteers, past events and sums metrics", async () => {
    const p = await coastline();
    await setProjectMetrics(db, p.id, [{ metric: "trees_planted", value: 120 }]);
    const { event } = await saveEvent(db, { title: "Assembly", startAt: "2026-10-01T18:00" });
    await saveEvent(db, { title: "Future", startAt: "2099-01-01T18:00" });
    await submitVolunteer(db, { eventId: event.id, name: "Ana Cruz", email: "a@x.ph", consent: true });
    const t = await impactTotals(db, { now: new Date("2026-11-01T00:00:00Z") });
    expect(t).toMatchObject({ projectsDone: 11, activeMembers: 17, volunteers: 1, eventsHeld: 1, metrics: { trees_planted: 120 } });
  });
});

describe("map and list", () => {
  it("returns only located projects for the map and groups all projects by barangay", async () => {
    await db.update(projects).set({ lat: 11.6, lng: 122.73, barangay: "Baybay" }).where(eq(projects.slug, "coastline-cuts"));
    expect((await mapProjects(db)).map((p) => p.slug)).toEqual(["coastline-cuts"]);
    const groups = await projectsByBarangay(db);
    expect(groups[0]).toMatchObject({ barangay: "Baybay" });
    expect(groups.at(-1).barangay).toBe("Location to be added");
  });
});

describe("homeStats", () => {
  const fallback = [
    { value: "3+", label: "Years of activity" },
    { value: "50+", label: "Successful projects" },
    { value: "10+", label: "Communities helped" },
    { value: "25+", label: "Members" },
  ];
  it("uses a live number only when it beats the stated figure", () => {
    const s = homeStats({ projectsDone: 11, activeMembers: 30, metrics: { barangays: 0 } }, fallback);
    expect(s.map((x) => x.value)).toEqual(["3+", "50+", "10+", "30"]);
  });
});

describe("transparency", () => {
  it("counts confirmed money by Philippine year and splits it by type, campaign and project", async () => {
    const p = await coastline();
    const { campaign } = await saveCampaign(db, { title: "Fund", goalPesos: 10000, projectId: p.id });
    const a = await submitPledge(db, { campaignId: campaign.id, payerName: "Ana Cruz", payerEmail: "a@x.ph", amountPesos: 1000, method: "gcash", referenceNo: "REF00001", consent: true });
    await confirmPayment(db, a.payment.id, { userId: "admin", now: "2026-12-31T17:00:00.000Z" }); // 2027-01-01 01:00 PH
    const b = await submitPledge(db, { type: "membership_fee", payerName: "Ben Reyes", payerEmail: "b@x.ph", amountPesos: 500, method: "gcash", referenceNo: "REF00002", consent: true });
    await confirmPayment(db, b.payment.id, { userId: "admin", now: "2027-03-01T00:00:00.000Z" });
    await submitPledge(db, { payerName: "Cy Lim", payerEmail: "c@x.ph", amountPesos: 999, method: "maya", referenceNo: "REF00003", consent: true }); // pending: ignored
    await recordExpense(db, { amountPesos: 300, description: "Trash bags", spentOn: "2027-01-05", campaignId: campaign.id, projectId: p.id }, { userId: "admin" });

    expect(await transparencyYears(db)).toEqual(["2027"]);
    const y = await transparencyForYear(db, "2027");
    expect(y.income).toEqual({ donation: 100000, sponsorship: 0, membership_fee: 50000, total: 150000 });
    expect(y).toMatchObject({ expensesTotal: 30000, balance: 120000 });
    expect(y.campaigns).toEqual([expect.objectContaining({ title: "Fund", raised: 100000, spent: 30000, goalCentavos: 1000000 })]);
    expect(y.projects).toEqual([expect.objectContaining({ title: "Coastline Cuts", spent: 30000 })]);
    expect(y.items[0]).toMatchObject({ description: "Trash bags", amountCentavos: 30000, projectTitle: "Coastline Cuts" });
    expect(JSON.stringify(y)).not.toContain("a@x.ph");
    expect(JSON.stringify(y)).not.toContain("Ana Cruz");
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run test/proof-public.test.js`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`lib/proof/impact.js`:

```js
import { asc, count, eq, isNotNull, and, sql } from "drizzle-orm";
import { projects, members, volunteerSignups, projectMetrics, events } from "../../db/schema.js";
import { phNow } from "../format.js";

export async function impactTotals(db, { now = new Date() } = {}) {
  const [[done], [active], [vols], metricRows, eventRows] = await Promise.all([
    db.select({ n: count() }).from(projects).where(eq(projects.status, "done")),
    db.select({ n: count() }).from(members).where(eq(members.status, "active")),
    db.select({ n: count() }).from(volunteerSignups),
    db.select({ metric: projectMetrics.metric, total: sql`sum(${projectMetrics.value})` }).from(projectMetrics).groupBy(projectMetrics.metric),
    db.select({ startAt: events.startAt, endAt: events.endAt }).from(events),
  ]);
  const today = phNow(now);
  return {
    projectsDone: done.n,
    activeMembers: active.n,
    volunteers: vols.n,
    eventsHeld: eventRows.filter((e) => (e.endAt || e.startAt) < today).length,
    metrics: Object.fromEntries(metricRows.map((r) => [r.metric, Number(r.total)])),
  };
}

export function mapProjects(db) {
  return db
    .select({ id: projects.id, slug: projects.slug, title: projects.title, startDate: projects.startDate, barangay: projects.barangay, lat: projects.lat, lng: projects.lng })
    .from(projects)
    .where(and(isNotNull(projects.lat), isNotNull(projects.lng)))
    .orderBy(asc(projects.title));
}

const UNKNOWN = "Location to be added";

export async function projectsByBarangay(db) {
  const rows = await db.select({ id: projects.id, slug: projects.slug, title: projects.title, barangay: projects.barangay }).from(projects).orderBy(asc(projects.title));
  const groups = new Map();
  for (const p of rows) {
    const key = p.barangay?.trim() || UNKNOWN;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === UNKNOWN) - (b === UNKNOWN) || a.localeCompare(b))
    .map(([barangay, list]) => ({ barangay, projects: list }));
}

const statedNumber = (value) => Number.parseInt(String(value).replace(/[^\d]/g, ""), 10) || 0;

// Live figures replace the chapter's stated figures only when they are larger.
export function homeStats(totals, fallback) {
  const live = [null, totals.projectsDone, totals.metrics?.barangays ?? 0, totals.activeMembers];
  return fallback.map((stat, i) =>
    live[i] !== null && live[i] > statedNumber(stat.value) ? { value: String(live[i]), label: stat.label } : stat,
  );
}
```

`lib/proof/transparency.js`:

```js
import { eq } from "drizzle-orm";
import { payments, expenses, campaigns, projects } from "../../db/schema.js";
import { phToday } from "../format.js";

const paymentYear = (p) => phToday(p.confirmedAt ?? p.createdAt).slice(0, 4);
const sum = (rows) => rows.reduce((s, r) => s + r.amountCentavos, 0);

async function confirmed(db) {
  return db.select().from(payments).where(eq(payments.status, "confirmed"));
}

export async function transparencyYears(db) {
  const [pays, exps] = await Promise.all([confirmed(db), db.select({ spentOn: expenses.spentOn }).from(expenses)]);
  const years = new Set([...pays.map(paymentYear), ...exps.map((e) => e.spentOn.slice(0, 4))]);
  return [...years].sort().reverse();
}

export async function transparencyForYear(db, year) {
  const [allPays, allExps, camps, projs] = await Promise.all([
    confirmed(db),
    db.select().from(expenses),
    db.select().from(campaigns),
    db.select({ id: projects.id, title: projects.title, slug: projects.slug }).from(projects),
  ]);
  const pays = allPays.filter((p) => paymentYear(p) === year);
  const exps = allExps.filter((e) => e.spentOn.startsWith(year));
  const byType = (type) => sum(pays.filter((p) => p.type === type));
  const income = { donation: byType("donation"), sponsorship: byType("sponsorship"), membership_fee: byType("membership_fee") };
  income.total = income.donation + income.sponsorship + income.membership_fee;
  const expensesTotal = sum(exps);
  const titleOf = (list, id) => list.find((x) => x.id === id)?.title ?? null;

  return {
    year,
    income,
    expensesTotal,
    balance: income.total - expensesTotal,
    campaigns: camps
      .map((c) => ({
        id: c.id,
        title: c.title,
        goalCentavos: c.goalCentavos,
        raised: sum(pays.filter((p) => p.campaignId === c.id)),
        spent: sum(exps.filter((e) => e.campaignId === c.id)),
      }))
      .filter((c) => c.raised || c.spent),
    projects: projs
      .map((p) => ({ id: p.id, title: p.title, slug: p.slug, spent: sum(exps.filter((e) => e.projectId === p.id)) }))
      .filter((p) => p.spent),
    items: exps
      .sort((a, b) => b.spentOn.localeCompare(a.spentOn) || b.id - a.id)
      .map((e) => ({
        id: e.id,
        spentOn: e.spentOn,
        description: e.description,
        amountCentavos: e.amountCentavos,
        projectTitle: titleOf(projs, e.projectId),
        campaignTitle: titleOf(camps, e.campaignId),
      })),
  };
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run test/proof-public.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/proof/impact.js lib/proof/transparency.js test/proof-public.test.js
git commit -m "Add impact totals, live home stats and transparency aggregation"
```

---

### Task 4: Evidence dashboard data and CSV

**Files:**
- Create: `lib/proof/evidence.js`, `test/proof-evidence.test.js`

**Interfaces:**
- Produces: `CRITERIA`, `CRITERION_LABELS`, `lastMonths(now, n)`, `monthlyEvidence(db, { now?, months? })`, `typeTotals(db)`, `snapshotInput`, `upsertSnapshot(db, raw, { userId, now? })`, `listSnapshots(db)`, `evidenceCsv(matrix, snapshots)`, `logCsv(db)`.

- [ ] **Step 1: Write the failing tests**

`test/proof-evidence.test.js`:

```js
import { describe, it, expect, beforeEach } from "vitest";
import { testDb } from "./helpers/db.js";
import { logEvent } from "@/lib/evidence.js";
import { lastMonths, monthlyEvidence, typeTotals, upsertSnapshot, listSnapshots, evidenceCsv, logCsv } from "@/lib/proof/evidence.js";

let db;
beforeEach(async () => {
  db = await testDb();
});

describe("months", () => {
  it("lists the last N Philippine months, oldest first", () => {
    expect(lastMonths(new Date("2026-12-31T17:00:00Z"), 3)).toEqual(["2026-11", "2026-12", "2027-01"]);
  });
});

describe("monthlyEvidence", () => {
  it("counts rows per criterion by Philippine month and zero-fills the rest", async () => {
    await logEvent(db, { type: "rsvp_created", now: "2026-10-31T23:30:00.000Z" }); // 2026-11-01 07:30 PH
    await logEvent(db, { type: "payment_confirmed", now: "2026-11-15T00:00:00.000Z" });
    await logEvent(db, { type: "member_approved", now: "2026-09-01T00:00:00.000Z" });
    const m = await monthlyEvidence(db, { now: new Date("2026-11-20T00:00:00Z"), months: 3 });
    expect(m).toEqual([
      { month: "2026-09", planning: 0, layout: 0, interactivity: 0, member_value: 1, total: 1 },
      { month: "2026-10", planning: 0, layout: 0, interactivity: 0, member_value: 0, total: 0 },
      { month: "2026-11", planning: 1, layout: 0, interactivity: 1, member_value: 0, total: 2 },
    ]);
    expect(await typeTotals(db)).toEqual(expect.arrayContaining([{ type: "rsvp_created", n: 1 }]));
  });
});

describe("analytics snapshots", () => {
  it("creates and then updates one snapshot per month", async () => {
    await upsertSnapshot(db, { month: "2026-11", organicClicks: "120", impressions: "4000", visitors: "", note: "" }, { userId: "admin" });
    await upsertSnapshot(db, { month: "2026-11", organicClicks: "150", impressions: "4500", visitors: "900", note: "After switch" }, { userId: "admin" });
    expect(await listSnapshots(db)).toEqual([expect.objectContaining({ month: "2026-11", organicClicks: 150, impressions: 4500, visitors: 900, note: "After switch" })]);
  });

  it("refuses a bad month or negative numbers", async () => {
    expect((await upsertSnapshot(db, { month: "Nov 2026" }, { userId: "admin" })).ok).toBe(false);
    expect((await upsertSnapshot(db, { month: "2026-11", organicClicks: "-1" }, { userId: "admin" })).ok).toBe(false);
  });
});

describe("CSV", () => {
  it("joins the monthly counts with the analytics numbers", () => {
    const csv = evidenceCsv(
      [{ month: "2026-11", planning: 1, layout: 0, interactivity: 2, member_value: 0, total: 3 }],
      [{ month: "2026-11", organicClicks: 150, impressions: 4500, visitors: null, note: "=cmd" }],
    );
    expect(csv.split("\r\n")).toEqual([
      '"Month","Planning & execution","Layout & presentation","Interactivity & services","Value to members","Total","Organic clicks","Impressions","Visitors","Note"',
      '"2026-11","1","0","2","0","3","150","4500","","\'=cmd"',
    ]);
  });

  it("exports every log row", async () => {
    await logEvent(db, { type: "rsvp_created", refTable: "rsvps", refId: 1, now: "2026-11-01T00:00:00.000Z" });
    expect((await logCsv(db)).split("\r\n")[1]).toBe('"2026-11-01T00:00:00.000Z","rsvp_created","interactivity","public","rsvps","1"');
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run test/proof-evidence.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`lib/proof/evidence.js`:

```js
import { asc, count, desc } from "drizzle-orm";
import { z } from "zod";
import { eventsLog, analyticsSnapshots } from "../../db/schema.js";
import { phNow, phToday } from "../format.js";
import { csvCell } from "../safe.js";

export const CRITERIA = ["planning", "layout", "interactivity", "member_value"];
export const CRITERION_LABELS = {
  planning: "Planning & execution",
  layout: "Layout & presentation",
  interactivity: "Interactivity & services",
  member_value: "Value to members",
};

export function lastMonths(now, n) {
  const [y, m] = phNow(now).slice(0, 7).split("-").map(Number);
  const out = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

export async function monthlyEvidence(db, { now = new Date(), months = 12 } = {}) {
  const list = lastMonths(now, months);
  const rows = await db.select({ criterion: eventsLog.criterion, createdAt: eventsLog.createdAt }).from(eventsLog);
  const matrix = new Map(list.map((month) => [month, { month, planning: 0, layout: 0, interactivity: 0, member_value: 0, total: 0 }]));
  for (const r of rows) {
    const cell = matrix.get(phToday(r.createdAt).slice(0, 7));
    if (cell && r.criterion in cell) {
      cell[r.criterion] += 1;
      cell.total += 1;
    }
  }
  return [...matrix.values()];
}

export function typeTotals(db) {
  return db.select({ type: eventsLog.type, n: count() }).from(eventsLog).groupBy(eventsLog.type).orderBy(desc(count()));
}

const optionalCount = z
  .preprocess((v) => (v === "" || v === undefined || v === null ? null : Number(v)), z.number().int("Use whole numbers").min(0, "Use 0 or more").nullable())
  .default(null);

export const snapshotInput = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Use a month like 2026-11"),
  organicClicks: optionalCount,
  impressions: optionalCount,
  visitors: optionalCount,
  note: z.string().trim().max(300).default(""),
});

export async function upsertSnapshot(db, raw, { userId, now = new Date().toISOString() }) {
  const parsed = snapshotInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  const d = parsed.data;
  const values = { organicClicks: d.organicClicks, impressions: d.impressions, visitors: d.visitors, note: d.note || null, updatedBy: userId, updatedAt: now };
  const [snapshot] = await db
    .insert(analyticsSnapshots)
    .values({ month: d.month, ...values })
    .onConflictDoUpdate({ target: analyticsSnapshots.month, set: values })
    .returning();
  return { ok: true, snapshot };
}

export function listSnapshots(db) {
  return db.select().from(analyticsSnapshots).orderBy(desc(analyticsSnapshots.month));
}

export function evidenceCsv(matrix, snapshots) {
  const byMonth = new Map(snapshots.map((s) => [s.month, s]));
  const header = ["Month", ...CRITERIA.map((c) => CRITERION_LABELS[c]), "Total", "Organic clicks", "Impressions", "Visitors", "Note"];
  const rows = matrix.map((r) => {
    const s = byMonth.get(r.month) ?? {};
    return [r.month, ...CRITERIA.map((c) => r[c]), r.total, s.organicClicks, s.impressions, s.visitors, s.note];
  });
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export async function logCsv(db) {
  const rows = await db.select().from(eventsLog).orderBy(asc(eventsLog.createdAt), asc(eventsLog.id));
  const header = ["Date", "Type", "Criterion", "Actor", "Ref table", "Ref id"];
  return [header, ...rows.map((r) => [r.createdAt, r.type, r.criterion, r.actor, r.refTable, r.refId])]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run test/proof-evidence.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/proof/evidence.js test/proof-evidence.test.js
git commit -m "Add the evidence dashboard data, analytics snapshots and CSV exports"
```

---

### Task 5: Admin actions, project editor and evidence screen

**Files:**
- Create: `app/admin/evidence/actions.js`, `app/admin/evidence/page.jsx`, `app/admin/evidence/log.csv/route.js`, `app/admin/evidence.csv/route.js`, `components/admin/SnapshotForm.jsx`, `components/admin/ProjectMetricsEditor.jsx`, `test/proof-actions.test.js`
- Modify: `app/admin/projects/actions.js`, `app/admin/projects/[id]/page.jsx`, `components/admin/ProjectEditor.jsx`, `components/admin/AdminNav.jsx`, `app/admin/payments/actions.js`

**Interfaces:**
- Produces: `setProjectMetricsAction(projectId, rows)`, `saveSnapshotAction(input)`.

- [ ] **Step 1: Write the failing tests**

`test/proof-actions.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from "vitest";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { listProjects } from "@/lib/queries.js";

const h = vi.hoisted(() => ({ db: null, claims: null, revalidated: [] }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: h.claims ? "user_1" : null, sessionClaims: h.claims }),
  clerkClient: async () => ({ users: { getUser: async () => ({ publicMetadata: {} }) } }),
}));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
vi.mock("next/cache", () => ({ revalidatePath: (p) => h.revalidated.push(p) }));
vi.mock("@/lib/db.js", async (orig) => ({ ...(await orig()), getDb: () => h.db }));

const { setProjectMetricsAction } = await import("@/app/admin/projects/actions.js");
const { saveSnapshotAction } = await import("@/app/admin/evidence/actions.js");

beforeEach(async () => {
  h.db = await testDb();
  await seed(h.db);
  h.revalidated = [];
});

describe("proof admin actions", () => {
  it("refuse officers", async () => {
    h.claims = { metadata: { role: "officer" } };
    await expect(setProjectMetricsAction(1, [])).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(saveSnapshotAction({ month: "2026-11" })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("save metrics and refresh the impact page and the project", async () => {
    h.claims = { metadata: { role: "admin" } };
    const [p] = await listProjects(h.db, { limit: 1 });
    expect((await setProjectMetricsAction(p.id, [{ metric: "trees_planted", value: 10 }])).ok).toBe(true);
    expect(h.revalidated).toEqual(expect.arrayContaining(["/impact", `/projects/${p.slug}`, "/"]));
  });

  it("save an analytics snapshot", async () => {
    h.claims = { metadata: { role: "admin" } };
    expect(await saveSnapshotAction({ month: "2026-11", organicClicks: "10" })).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run test/proof-actions.test.js`
Expected: FAIL — `setProjectMetricsAction` not exported; evidence actions missing.

- [ ] **Step 3: Implement the actions**

In `app/admin/projects/actions.js`, add imports:

```js
import { revalidatePath } from "next/cache";
import { setProjectMetrics } from "@/lib/proof/metrics.js";
```

change `saveProjectAction`'s refresh line `if (r.ok) revalidateAll(pathsForProject(r.project.slug));` to

```js
  if (r.ok) {
    revalidateAll(pathsForProject(r.project.slug));
    revalidatePath("/impact");
  }
```

and append:

```js
export async function setProjectMetricsAction(projectId, rows) {
  await requireArea("content");
  const db = getDb();
  const r = await setProjectMetrics(db, projectId, rows);
  if (!r.ok) return r;
  const project = await getProject(db, projectId);
  if (project) revalidateAll(pathsForProject(project.slug));
  revalidatePath("/impact");
  return { ok: true };
}
```

`app/admin/evidence/actions.js`:

```js
"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db.js";
import { requireArea } from "@/lib/auth.js";
import { upsertSnapshot } from "@/lib/proof/evidence.js";

export async function saveSnapshotAction(input) {
  const { userId } = await requireArea("content");
  const r = await upsertSnapshot(getDb(), input, { userId });
  if (!r.ok) return r;
  revalidatePath("/admin/evidence");
  return { ok: true };
}
```

In `app/admin/payments/actions.js`, extend `refreshMoney` with:

```js
  revalidatePath("/transparency");
  revalidatePath("/impact");
```

and after `if (r.ok) revalidatePath("/admin/expenses");` in `recordExpenseAction` change it to:

```js
  if (r.ok) {
    revalidatePath("/admin/expenses");
    revalidatePath("/transparency");
  }
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run --exclude test/import-articles.test.js`
Expected: all PASS.

- [ ] **Step 5: Project editor: location and metrics**

`components/admin/ProjectMetricsEditor.jsx`:

```jsx
"use client";

import { useState, useTransition } from "react";
import { METRICS } from "@/lib/proof/metrics.js";
import { setProjectMetricsAction } from "@/app/admin/projects/actions.js";

export default function ProjectMetricsEditor({ projectId, initial }) {
  const [rows, setRows] = useState(initial.length ? initial.map((m) => ({ metric: m.metric, value: String(m.value) })) : []);
  const [message, setMessage] = useState(null);
  const [pending, start] = useTransition();
  const update = (i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const save = () => start(async () => {
    try {
      const r = await setProjectMetricsAction(projectId, rows.filter((r) => r.value !== ""));
      setMessage(r.ok ? "Impact numbers saved." : r.errors.join(" "));
    } catch (e) {
      setMessage(`Couldn't save (${e.message})`);
    }
  });
  return (
    <section>
      <h2 className="syne">Impact numbers</h2>
      {rows.map((r, i) => (
        <div className="actions" key={i}>
          <select aria-label="Metric" value={r.metric} onChange={(e) => update(i, { metric: e.target.value })}>
            {Object.entries(METRICS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <input aria-label="Value" type="number" min="0" step="1" value={r.value} onChange={(e) => update(i, { value: e.target.value })} />
          <button type="button" className="tool" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>Remove</button>
        </div>
      ))}
      <p className="actions">
        <button type="button" className="tool" onClick={() => setRows((rs) => [...rs, { metric: "people_reached", value: "" }])}>Add a number</button>
        <button type="button" className="btn" disabled={pending} onClick={save}>Save impact numbers</button>
      </p>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
```

In `components/admin/ProjectEditor.jsx`:

1. Add the import `import ProjectMetricsEditor from "./ProjectMetricsEditor.jsx";` and `import { parseCoordinates } from "@/lib/proof/location.js";`.
2. Change the signature to `export default function ProjectEditor({ project, metrics = [] }) {`.
3. Change the `fields` line to:

```jsx
const fields = ["title", "summary", "startDate", "endDate", "barangay", "pillar", "status", "coverUrl", "coverAlt", "bodyJson", "bodyHtml", "lat", "lng"];
```

4. Insert directly after the Barangay field (`<div className="field"><label htmlFor="brgy">Barangay</label>…</div>`):

```jsx
        <div className="field">
          <label htmlFor="loc-paste">Location (paste "lat, lng" or a Google Maps link)</label>
          <input id="loc-paste" placeholder="11.5853, 122.7511" onChange={(e) => {
            const c = parseCoordinates(e.target.value);
            if (c) setForm((f) => ({ ...f, lat: String(c.lat), lng: String(c.lng) }));
          }} />
        </div>
        <div className="field"><label htmlFor="lat">Latitude</label><input id="lat" inputMode="decimal" value={form.lat} onChange={set("lat")} /></div>
        <div className="field"><label htmlFor="lng">Longitude</label><input id="lng" inputMode="decimal" value={form.lng} onChange={set("lng")} /></div>
```

5. Insert, inside the `{meta && (` block, before `<section>` with the Gallery heading:

```jsx
          <ProjectMetricsEditor projectId={meta.id} initial={metrics} />
```

(wrap both in a fragment: `{meta && (<>` … `</>)}`).

In `app/admin/projects/[id]/page.jsx`, add `import { listProjectMetrics } from "@/lib/proof/metrics.js";`, load `const metrics = await listProjectMetrics(db, row.id);` after `getProjectBySlug`, and render `<ProjectEditor project={project} metrics={metrics} />`.

- [ ] **Step 6: Evidence screen and CSV routes**

`components/admin/SnapshotForm.jsx`:

```jsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSnapshotAction } from "@/app/admin/evidence/actions.js";

export default function SnapshotForm({ month, snapshot }) {
  const router = useRouter();
  const [form, setForm] = useState({
    month,
    organicClicks: snapshot?.organicClicks ?? "",
    impressions: snapshot?.impressions ?? "",
    visitors: snapshot?.visitors ?? "",
    note: snapshot?.note ?? "",
  });
  const [message, setMessage] = useState(null);
  const [pending, start] = useTransition();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = () => start(async () => {
    try {
      const r = await saveSnapshotAction(form);
      setMessage(r.ok ? "Saved." : r.errors.join(" "));
      if (r.ok) router.refresh();
    } catch (e) {
      setMessage(`Couldn't save (${e.message})`);
    }
  });
  return (
    <section className="editor__side">
      <h2 className="syne">Analytics for</h2>
      <div className="field"><label htmlFor="sn-month">Month</label><input id="sn-month" value={form.month} onChange={set("month")} placeholder="2026-11" /></div>
      <div className="field"><label htmlFor="sn-clicks">Organic clicks (Search Console)</label><input id="sn-clicks" type="number" min="0" value={form.organicClicks} onChange={set("organicClicks")} /></div>
      <div className="field"><label htmlFor="sn-impr">Impressions (Search Console)</label><input id="sn-impr" type="number" min="0" value={form.impressions} onChange={set("impressions")} /></div>
      <div className="field"><label htmlFor="sn-vis">Visitors (GA4)</label><input id="sn-vis" type="number" min="0" value={form.visitors} onChange={set("visitors")} /></div>
      <div className="field"><label htmlFor="sn-note">Note</label><input id="sn-note" value={form.note} onChange={set("note")} /></div>
      <button type="button" className="btn" disabled={pending} onClick={save}>Save analytics</button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
```

`app/admin/evidence/page.jsx`:

```jsx
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { monthlyEvidence, typeTotals, listSnapshots, CRITERIA, CRITERION_LABELS } from "@/lib/proof/evidence.js";
import { LOG_CRITERIA } from "@/lib/evidence.js";
import { phNow } from "@/lib/format.js";
import AdminNav from "@/components/admin/AdminNav.jsx";
import SnapshotForm from "@/components/admin/SnapshotForm.jsx";

export const metadata = { title: "Evidence — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Evidence() {
  await requireArea("content");
  const db = getDb();
  const [matrix, types, snapshots] = await Promise.all([monthlyEvidence(db), typeTotals(db), listSnapshots(db)]);
  const thisMonth = phNow().slice(0, 7);
  const snap = new Map(snapshots.map((s) => [s.month, s]));
  return (
    <div className="admin">
      <h1>Bid evidence</h1>
      <AdminNav isAdmin />
      <p>Every countable action on the site, by Temiong criterion. <a href="/admin/evidence.csv">Download monthly CSV</a> · <a href="/admin/evidence/log.csv">Download every log entry</a></p>
      <table className="admin-table">
        <thead><tr><th>Month</th>{CRITERIA.map((c) => <th key={c}>{CRITERION_LABELS[c]}</th>)}<th>Total</th><th>Organic clicks</th><th>Visitors</th></tr></thead>
        <tbody>
          {matrix.slice().reverse().map((r) => (
            <tr key={r.month}>
              <td>{r.month}</td>
              {CRITERIA.map((c) => <td key={c}>{r[c]}</td>)}
              <td><strong>{r.total}</strong></td>
              <td>{snap.get(r.month)?.organicClicks ?? "—"}</td>
              <td>{snap.get(r.month)?.visitors ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 className="syne">All time, by action</h2>
      <table className="admin-table">
        <thead><tr><th>Action</th><th>Criterion</th><th>Count</th></tr></thead>
        <tbody>{types.map((t) => <tr key={t.type}><td>{t.type.replace(/_/g, " ")}</td><td>{CRITERION_LABELS[LOG_CRITERIA[t.type]] ?? "—"}</td><td>{t.n}</td></tr>)}</tbody>
      </table>
      <SnapshotForm key={thisMonth} month={thisMonth} snapshot={snap.get(thisMonth)} />
    </div>
  );
}
```

`app/admin/evidence.csv/route.js`:

```js
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { monthlyEvidence, listSnapshots, evidenceCsv } from "@/lib/proof/evidence.js";

export async function GET() {
  await requireArea("content");
  const db = getDb();
  const [matrix, snapshots] = await Promise.all([monthlyEvidence(db), listSnapshots(db)]);
  return new Response(evidenceCsv(matrix, snapshots), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="jci-roxas-halaran-evidence.csv"' },
  });
}
```

`app/admin/evidence/log.csv/route.js`:

```js
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { logCsv } from "@/lib/proof/evidence.js";

export async function GET() {
  await requireArea("content");
  return new Response(await logCsv(getDb()), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="jci-roxas-halaran-evidence-log.csv"' },
  });
}
```

In `components/admin/AdminNav.jsx`, add after the Passport link:

```jsx
          <Link href="/admin/evidence">Evidence</Link>
```

- [ ] **Step 7: Build and commit**

Run: `npx vitest run --exclude test/import-articles.test.js && NEXT_DIST_DIR=.next-check npx next build`
Expected: PASS; build lists `/admin/evidence`, `/admin/evidence.csv`, `/admin/evidence/log.csv`.

```bash
git add app/admin components/admin test/proof-actions.test.js
git commit -m "Add project location and impact editors and the admin evidence dashboard"
```

---

### Task 6: Public impact and transparency pages

**Files:**
- Create: `components/ImpactMap.jsx`, `lib/proof/popup.js`, `app/impact/page.jsx`, `app/transparency/page.jsx`, `test/proof-popup.test.js`
- Modify: `lib/routes.js`, `components/SiteFooter.jsx`, `components/pages/HomePage.jsx`, `app/globals.css`, `package.json`

**Interfaces:**
- Produces: `popupHtml(project)` (escaped HTML for a map popup).

- [ ] **Step 1: Install Leaflet**

Run: `npm install leaflet@1.9.4`

(If npm reports the other session's uncommitted `package.json` changes, keep them: only the `leaflet` dependency line is this task's change; stage `package.json` hunks with care or ledger a ruling.)

- [ ] **Step 2: Write the failing test**

`test/proof-popup.test.js`:

```js
import { describe, it, expect } from "vitest";
import { popupHtml } from "@/lib/proof/popup.js";

describe("popupHtml", () => {
  it("escapes project text and links to the project page", () => {
    const html = popupHtml({ slug: "x", title: 'Clean-up <script>alert(1)</script> "Baybay"', startDate: "2026-06-20", barangay: "Baybay & Culasi" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&quot;Baybay&quot;");
    expect(html).toContain("Baybay &amp; Culasi");
    expect(html).toContain('href="/projects/x"');
  });
});
```

Run: `npx vitest run test/proof-popup.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the popup, map and pages**

`lib/proof/popup.js`:

```js
import { formatDate } from "../format.js";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Leaflet popups take HTML strings; everything from the database is escaped.
export function popupHtml(p) {
  const meta = [formatDate(p.startDate), p.barangay].filter(Boolean).map(esc).join(" · ");
  return `<strong>${esc(p.title)}</strong>${meta ? `<br>${meta}` : ""}<br><a href="/projects/${encodeURIComponent(p.slug)}">View project</a>`;
}
```

Run: `npx vitest run test/proof-popup.test.js` → PASS.

`components/ImpactMap.jsx`:

```jsx
"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { popupHtml } from "@/lib/proof/popup.js";

// Interactive map of project locations (Leaflet + OpenStreetMap, loaded only here).
export default function ImpactMap({ points }) {
  const ref = useRef(null);

  useEffect(() => {
    let map;
    let cancelled = false;
    import("leaflet").then(({ default: L }) => {
      if (cancelled || !ref.current) return;
      map = L.map(ref.current, { scrollWheelZoom: false }).setView([11.4, 122.6], 9);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      const markers = points.map((p) =>
        L.circleMarker([p.lat, p.lng], { radius: 9, color: "#121314", weight: 2, fillColor: "#E5A823", fillOpacity: 0.9 })
          .bindPopup(popupHtml(p))
          .addTo(map),
      );
      if (markers.length > 1) map.fitBounds(L.featureGroup(markers).getBounds().pad(0.3));
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [points]);

  return <div ref={ref} className="impact-map" role="region" aria-label="Map of project locations in Capiz" />;
}
```

`app/impact/page.jsx`:

```jsx
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import ImpactMap from "@/components/ImpactMap.jsx";
import { getDb } from "@/lib/db.js";
import { impactTotals, mapProjects, projectsByBarangay } from "@/lib/proof/impact.js";
import { METRICS } from "@/lib/proof/metrics.js";
import { pageMetadata, breadcrumbLd } from "@/lib/seo.js";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: "Our impact in Capiz",
  description: "Where JCI Roxas Halaran works across Capiz and what our projects have achieved: projects, volunteers, people reached and more.",
  path: "/impact",
});

export default async function Impact() {
  const db = getDb();
  const [totals, points, groups] = await Promise.all([impactTotals(db), mapProjects(db), projectsByBarangay(db)]);
  const stats = [
    ["Projects completed", totals.projectsDone],
    ["Active members", totals.activeMembers],
    ["Volunteers signed up", totals.volunteers],
    ["Events held", totals.eventsHeld],
    ...Object.entries(METRICS).filter(([k]) => totals.metrics[k] > 0).map(([k, label]) => [label, totals.metrics[k]]),
  ];
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Our impact", path: "/impact" }])} />
      <header className="page-hero">
        <h1>Our impact in Capiz</h1>
        <p>Where we work and what our projects have achieved, updated as each project is recorded.</p>
      </header>
      <section className="section">
        <div className="stats">
          {stats.map(([label, value]) => (
            <div className="stat" key={label}>
              <span className="v">{value.toLocaleString("en-PH")}</span>
              <span className="l">{label}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="section section--line-top">
        <div className="section__bar"><h2>Project map</h2><span className="label">Capiz</span></div>
        {points.length ? <ImpactMap points={points} /> : <p>Project locations are being added — see the list below.</p>}
      </section>
      <section className="section">
        <div className="section__bar"><h2>Projects by place</h2><span className="label">List</span></div>
        {groups.map((g) => (
          <div key={g.barangay} className="impact-group">
            <h3 className="syne">{g.barangay}</h3>
            <ul>{g.projects.map((p) => <li key={p.id}><Link href={`/projects/${p.slug}`}>{p.title}</Link></li>)}</ul>
          </div>
        ))}
      </section>
      <SiteFooter />
    </>
  );
}
```

`app/transparency/page.jsx`:

```jsx
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import { getDb } from "@/lib/db.js";
import { transparencyYears, transparencyForYear } from "@/lib/proof/transparency.js";
import { formatDate, formatPesos, phNow } from "@/lib/format.js";
import { pageMetadata, breadcrumbLd } from "@/lib/seo.js";

export const metadata = pageMetadata({
  title: "Transparency",
  description: "How JCI Roxas Halaran raises and spends money: confirmed donations, sponsorships and fees, and every expense, by year.",
  path: "/transparency",
});

export default async function Transparency({ searchParams }) {
  const db = getDb();
  const years = await transparencyYears(db);
  const { year: asked } = await searchParams;
  const current = phNow().slice(0, 4);
  const year = years.includes(asked) ? asked : years[0] ?? current;
  const y = await transparencyForYear(db, year);
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Transparency", path: "/transparency" }])} />
      <header className="page-hero">
        <h1>Transparency</h1>
        <p>Every peso in and out. Only payments our treasurer confirmed are counted; donor names are never shown.</p>
        {years.length > 1 && (
          <p className="actions category-filter">
            {years.map((yr) => <Link key={yr} href={`/transparency?year=${yr}`} aria-current={yr === year ? "page" : undefined}>{yr}</Link>)}
          </p>
        )}
      </header>
      <section className="section">
        <div className="section__bar"><h2>{year} at a glance</h2><span className="label">Summary</span></div>
        <div className="stats">
          <div className="stat"><span className="v">{formatPesos(y.income.total)}</span><span className="l">Money in</span></div>
          <div className="stat"><span className="v">{formatPesos(y.expensesTotal)}</span><span className="l">Money out</span></div>
          <div className="stat"><span className="v">{formatPesos(y.balance)}</span><span className="l">Balance</span></div>
        </div>
        <table className="admin-table money-table">
          <tbody>
            <tr><td>Donations</td><td>{formatPesos(y.income.donation)}</td></tr>
            <tr><td>Sponsorships</td><td>{formatPesos(y.income.sponsorship)}</td></tr>
            <tr><td>Membership fees</td><td>{formatPesos(y.income.membership_fee)}</td></tr>
          </tbody>
        </table>
      </section>
      {y.campaigns.length > 0 && (
        <section className="section">
          <div className="section__bar"><h2>Campaigns</h2><span className="label">Raised vs spent</span></div>
          <table className="admin-table money-table">
            <thead><tr><th>Campaign</th><th>Goal</th><th>Raised</th><th>Spent</th></tr></thead>
            <tbody>{y.campaigns.map((c) => <tr key={c.id}><td>{c.title}</td><td>{formatPesos(c.goalCentavos)}</td><td>{formatPesos(c.raised)}</td><td>{formatPesos(c.spent)}</td></tr>)}</tbody>
          </table>
        </section>
      )}
      {y.projects.length > 0 && (
        <section className="section">
          <div className="section__bar"><h2>Spending by project</h2><span className="label">Projects</span></div>
          <table className="admin-table money-table">
            <tbody>{y.projects.map((p) => <tr key={p.id}><td><Link href={`/projects/${p.slug}`}>{p.title}</Link></td><td>{formatPesos(p.spent)}</td></tr>)}</tbody>
          </table>
        </section>
      )}
      <section className="section">
        <div className="section__bar"><h2>Expenses</h2><span className="label">{y.items.length} items</span></div>
        {y.items.length === 0 ? <p>No expenses recorded for {year} yet.</p> : (
          <table className="admin-table money-table">
            <thead><tr><th>Date</th><th>What</th><th>For</th><th>Amount</th></tr></thead>
            <tbody>{y.items.map((e) => <tr key={e.id}><td>{formatDate(e.spentOn)}</td><td>{e.description}</td><td>{e.projectTitle ?? e.campaignTitle ?? "General"}</td><td>{formatPesos(e.amountCentavos)}</td></tr>)}</tbody>
          </table>
        )}
      </section>
      <SiteFooter />
    </>
  );
}
```

In `lib/routes.js`, change `STATIC_ROUTES` to:

```js
export const STATIC_ROUTES = ["/", "/about", "/officers", "/projects", "/articles", "/events", "/resources", "/support", "/impact", "/transparency", "/join"];
```

In `components/SiteFooter.jsx`, replace `<Link href="/resources">Free resources</Link>` with:

```jsx
          <Link href="/resources">Free resources</Link> ·{" "}
          <Link href="/impact">Impact</Link> ·{" "}
          <Link href="/transparency">Transparency</Link>
```

In `components/pages/HomePage.jsx`, add `import { impactTotals, homeStats } from "@/lib/proof/impact.js";`, add `impactTotals(db)` as a fifth item of the `Promise.all` destructured to `totals`, and change `{SITE.stats.map((s) => (` to `{homeStats(totals, SITE.stats).map((s) => (`.

`app/globals.css` (append):

```css
/* ============================================================
   Proof (Phase 5)
   ============================================================ */
.impact-map { height: clamp(320px, 55vw, 520px); width: 100%; border: 1px solid rgba(237, 232, 223, 0.15); }
.impact-map .leaflet-popup-content a { color: #1c3b2b; text-decoration: underline; }
.impact-group { margin-bottom: 24px; }
.impact-group ul { margin: 8px 0 0; padding-left: 20px; }
.money-table td:last-child, .money-table th:last-child { text-align: right; }
```

- [ ] **Step 4: Run tests and build**

Run: `npx vitest run --exclude test/import-articles.test.js && NEXT_DIST_DIR=.next-check npx next build`
Expected: PASS; build lists `/impact` and `/transparency`.

- [ ] **Step 5: Commit**

```bash
git add components/ImpactMap.jsx lib/proof/popup.js app/impact app/transparency test/proof-popup.test.js lib/routes.js components/SiteFooter.jsx components/pages/HomePage.jsx app/globals.css package.json package-lock.json
git commit -m "Add the impact map and transparency pages, footer links and live home stats"
```

---

### Task 7: End-to-end checks, migrate and deploy

**Files:**
- Modify: `e2e/site.spec.js`

- [ ] **Step 1: Add the tests**

`e2e/site.spec.js` (append):

```js
test("impact page lists projects by place even without map locations", async ({ page }) => {
  await page.goto("/impact");
  await expect(page.getByRole("link", { name: "Coastline Cuts" })).toBeVisible();
  await expect(page.getByText("Project locations are being added")).toBeVisible();
});

test("transparency page never shows donor names", async ({ page }) => {
  await page.goto("/transparency");
  await expect(page.locator("h1")).toHaveText("Transparency");
  await expect(page.getByText("Dino Reyes")).toHaveCount(0);
});

test("evidence dashboard and its CSV exports require sign-in", async ({ page, request }) => {
  await page.goto("/admin/evidence");
  await expect(page).toHaveURL(/sign-in/);
  for (const path of ["/admin/evidence.csv", "/admin/evidence/log.csv"]) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect([307, 404]).toContain(res.status());
  }
});
```

- [ ] **Step 2: Run the whole e2e suite**

Run: `npx playwright test`
Expected: all PASS, including `/impact` and `/transparency` in the per-route checks.

- [ ] **Step 3: Commit, migrate Turso, push**

```bash
git add e2e/site.spec.js
git commit -m "Add end-to-end checks for impact, transparency and evidence"
npm run db:migrate
git push
```

- [ ] **Step 4: Hand over**

Add a Bid Evidence Log row ("Phase 5 proof: impact map, transparency page, live home stats, evidence dashboard with CSV"). Tell the user: add coordinates and impact numbers to each project in admin; enter last month's Search Console/GA4 numbers in `/admin/evidence` monthly; download the CSVs for the bid. Production deploy follows the same PR → merge flow as PR #2.
