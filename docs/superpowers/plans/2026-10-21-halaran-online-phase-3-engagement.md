# Halaran Online — Phase 3: Engagement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Visitors apply for membership, RSVP to events, volunteer and pledge donations without an account; admins approve members (Clerk invitation), run events and confirm payments; every action is logged as bid evidence.

**Architecture:** Same layering as Phase 2. Plain store functions in `lib/engagement/*` take a Drizzle `db` and a context (`{ now, userId }`) and are tested against in-memory SQLite. Public server actions in `app/actions/engagement.js` verify Turnstile, call the stores, send best-effort emails and revalidate pages. Admin server actions under `app/admin/**/actions.js` call `requireArea("content")` (admin only). Client forms are small components under `components/forms/`.

**Tech Stack:** Next.js 15 App Router (JS), Drizzle + Turso, Clerk v6 (invitations), Vercel Blob 1 (payment-proof uploads), Zod 3, Cloudflare Turnstile, Resend (REST), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-21-halaran-online-phase-3-design.md` (parent: `docs/superpowers/specs/2026-10-21-halaran-online-design.md`).

**Code blocks:** every block that is a whole file is introduced by a line of the form `` `path/to/file`: ``; blocks to append are introduced by `` `path/to/file` (append): ``. Patches to existing files are given as exact old/new text.

## Global Constraints

- JavaScript only; `.jsx` for JSX. Store functions take `db` first and a context object last; they return `{ ok: true, … } | { ok: false, errors: string[] }` and never throw for user mistakes.
- All Phase 3 admin screens and actions require the `admin` role via `requireArea("content")`.
- Money is integer centavos (`toCentavos(pesos) = Math.round(pesos * 100)`); displayed with `formatPesos(centavos)` as `₱1,500`.
- Event times are stored as Philippine local time `YYYY-MM-DDTHH:mm` (UTC+8, no DST). `phNow()` gives the current PH local time in that format.
- Emails are lower-cased and trimmed; payment reference numbers are upper-cased and trimmed.
- Every public form requires `consent: true` and a Turnstile token; Turnstile verification passes automatically only when `TURNSTILE_SECRET_KEY` is unset (local/e2e).
- Email sending never throws and never undoes a save; with no `RESEND_API_KEY` it is skipped.
- `events_log` criteria: `application_submitted`, `rsvp_created`, `volunteer_signed_up`, `pledge_submitted` → `interactivity`; `member_approved`, `attendance_marked` → `member_value`; `payment_confirmed`, `expense_recorded`, `article_published` → `planning`.
- Phase 1–2 page rules apply to new public pages (one h1, unique title/description/canonical, alt text, nothing clipped at 375px, no Clerk script on public pages).

## Review Focus

- **The same person RSVPs twice with different capitalisation of their email** (`Juan@Gmail.com` / `juan@gmail.com`): one RSVP, a clear "already on the list" message. → Task 4 test.
- **A GCash reference typed in lowercase that was already submitted in uppercase:** refused as a duplicate; the same reference on a different method (Maya) is allowed. → Task 5 test.
- **An applicant who turns 18 tomorrow / turned 41 yesterday:** refused with the age message; exactly 18 and exactly 40 are accepted. → Task 3 test.
- **Approving someone who is already a member (same email):** links the existing member, no duplicate member, invitation only if they have no Clerk account. → Task 3 test.
- **The Clerk invitation or Resend email fails:** the approval/submission is still saved and the admin sees what failed. → Tasks 3 and 6 tests.

---

### Task 1: Schema and evidence log

**Files:**
- Modify: `db/schema.js`, `test/schema.test.js`
- Create: `lib/evidence.js`, `lib/db-errors.js`, `test/evidence.test.js`, `db/migrations/0002_engagement.sql` (generated)

**Interfaces:**
- Produces tables `applications`, `events`, `rsvps`, `volunteerSignups`, `campaigns`, `payments`, `expenses`, `eventsLog`; `logEvent(db, { type, actor?, refTable?, refId?, meta?, now? })`; `LOG_CRITERIA`; `isUniqueViolation(error): boolean`.

- [ ] **Step 1: Write the failing tests**

`test/evidence.test.js`:

```js
import { describe, it, expect } from "vitest";
import { testDb } from "./helpers/db.js";
import { eventsLog } from "@/db/schema.js";
import { logEvent } from "@/lib/evidence.js";

describe("logEvent", () => {
  it("records the type with its award criterion", async () => {
    const db = await testDb();
    await logEvent(db, { type: "rsvp_created", refTable: "rsvps", refId: 4, meta: { status: "going" }, now: "2026-11-01T00:00:00.000Z" });
    const [row] = await db.select().from(eventsLog);
    expect(row).toMatchObject({ type: "rsvp_created", criterion: "interactivity", actor: "public", refTable: "rsvps", refId: 4, meta: '{"status":"going"}' });
  });

  it("maps every type to the right criterion", async () => {
    const db = await testDb();
    for (const type of ["member_approved", "payment_confirmed", "article_published"]) await logEvent(db, { type, actor: "user_1" });
    expect((await db.select().from(eventsLog)).map((r) => r.criterion)).toEqual(["member_value", "planning", "planning"]);
  });

  it("rejects unknown types", async () => {
    const db = await testDb();
    await expect(logEvent(db, { type: "made_up" })).rejects.toThrow("Unknown log type made_up");
  });
});
```

`test/schema.test.js` (append inside the top `describe("schema", …)` block — add `applications, rsvps, payments, events` to its schema import):

```js
  it("allows only one pending application per email", async () => {
    const db = await testDb();
    const base = { name: "Ana", email: "ana@x.ph", birthdate: "2000-01-01", consent: true, createdAt: "2026-11-01" };
    await db.insert(applications).values(base);
    await expect(db.insert(applications).values(base)).rejects.toThrow();
    await db.insert(applications).values({ ...base, status: "declined" });
  });

  it("allows one RSVP per event and email, and one payment per method and reference", async () => {
    const db = await testDb();
    const [ev] = await db.insert(events).values({ slug: "ga", title: "GA", startAt: "2027-01-15T18:00", updatedAt: "x" }).returning();
    const r = { eventId: ev.id, name: "A", email: "a@x.ph", consent: true, createdAt: "x" };
    await db.insert(rsvps).values(r);
    await expect(db.insert(rsvps).values(r)).rejects.toThrow();
    const p = { payerName: "A", payerEmail: "a@x.ph", amountCentavos: 100, method: "gcash", referenceNo: "ABC123", consent: true, createdAt: "x" };
    await db.insert(payments).values(p);
    await expect(db.insert(payments).values(p)).rejects.toThrow();
    await db.insert(payments).values({ ...p, method: "maya" });
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run test/evidence.test.js test/schema.test.js`
Expected: FAIL — module `@/lib/evidence.js` not found; new tables undefined.

- [ ] **Step 3: Extend the schema**

In `db/schema.js` add after the first import line:

```js
import { sql } from "drizzle-orm";
```

`db/schema.js` (append):

```js
export const applications = sqliteTable(
  "applications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    birthdate: text("birthdate").notNull(),
    barangay: text("barangay"),
    whyJoin: text("why_join"),
    referredBy: text("referred_by"),
    consent: integer("consent", { mode: "boolean" }).notNull(),
    status: text("status", { enum: ["pending", "approved", "declined"] }).notNull().default("pending"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: text("reviewed_at"),
    note: text("note"),
    memberId: integer("member_id").references(() => members.id, { onDelete: "set null" }),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("applications_pending_email").on(t.email).where(sql`status = 'pending'`)],
);

export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  descriptionJson: text("description_json"),
  startAt: text("start_at").notNull(),
  endAt: text("end_at"),
  venue: text("venue"),
  capacity: integer("capacity"),
  rsvpOpen: integer("rsvp_open", { mode: "boolean" }).notNull().default(true),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  coverUrl: text("cover_url"),
  coverAlt: text("cover_alt"),
  updatedAt: text("updated_at").notNull(),
});

export const rsvps = sqliteTable(
  "rsvps",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    consent: integer("consent", { mode: "boolean" }).notNull(),
    status: text("status", { enum: ["going", "waitlist", "cancelled"] }).notNull().default("going"),
    attended: integer("attended", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("rsvps_event_email").on(t.eventId, t.email)],
);

export const volunteerSignups = sqliteTable("volunteer_signups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  eventId: integer("event_id").references(() => events.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  skills: text("skills"),
  consent: integer("consent", { mode: "boolean" }).notNull(),
  createdAt: text("created_at").notNull(),
});

export const campaigns = sqliteTable("campaigns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  goalCentavos: integer("goal_centavos").notNull(),
  qrImageUrl: text("qr_image_url"),
  qrImageAlt: text("qr_image_alt"),
  paymentInstructions: text("payment_instructions"),
  open: integer("open", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const payments = sqliteTable(
  "payments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    type: text("type", { enum: ["donation", "sponsorship", "membership_fee"] }).notNull().default("donation"),
    payerName: text("payer_name").notNull(),
    payerEmail: text("payer_email").notNull(),
    memberId: integer("member_id").references(() => members.id, { onDelete: "set null" }),
    amountCentavos: integer("amount_centavos").notNull(),
    method: text("method", { enum: ["gcash", "maya", "bank"] }).notNull(),
    referenceNo: text("reference_no").notNull(),
    proofUrl: text("proof_url"),
    consent: integer("consent", { mode: "boolean" }).notNull(),
    status: text("status", { enum: ["pending", "confirmed", "rejected"] }).notNull().default("pending"),
    confirmedBy: text("confirmed_by"),
    confirmedAt: text("confirmed_at"),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("payments_method_reference").on(t.method, t.referenceNo)],
);

export const expenses = sqliteTable("expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
  amountCentavos: integer("amount_centavos").notNull(),
  description: text("description").notNull(),
  spentOn: text("spent_on").notNull(),
  receiptUrl: text("receipt_url"),
  recordedBy: text("recorded_by"),
  createdAt: text("created_at").notNull(),
});

export const eventsLog = sqliteTable("events_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(),
  criterion: text("criterion").notNull(),
  actor: text("actor").notNull().default("public"),
  refTable: text("ref_table"),
  refId: integer("ref_id"),
  meta: text("meta"),
  createdAt: text("created_at").notNull(),
});
```

- [ ] **Step 4: Implement the log and the error helper**

`lib/evidence.js`:

```js
import { eventsLog } from "../db/schema.js";

// Every countable action, tagged with the Temiong criterion it supports.
export const LOG_CRITERIA = {
  application_submitted: "interactivity",
  rsvp_created: "interactivity",
  volunteer_signed_up: "interactivity",
  pledge_submitted: "interactivity",
  member_approved: "member_value",
  attendance_marked: "member_value",
  payment_confirmed: "planning",
  expense_recorded: "planning",
  article_published: "planning",
};

export async function logEvent(db, { type, actor = "public", refTable = null, refId = null, meta = null, now = new Date().toISOString() }) {
  const criterion = LOG_CRITERIA[type];
  if (!criterion) throw new Error(`Unknown log type ${type}`);
  await db.insert(eventsLog).values({
    type,
    criterion,
    actor,
    refTable,
    refId,
    meta: meta ? JSON.stringify(meta) : null,
    createdAt: now,
  });
}
```

`lib/db-errors.js`:

```js
// libsql errors arrive wrapped by Drizzle; look through the cause chain.
export function isUniqueViolation(error) {
  const text = [error?.message, error?.cause?.message, error?.cause?.cause?.message].join(" ");
  return /UNIQUE constraint failed/i.test(text);
}
```

- [ ] **Step 5: Generate the migration**

Run: `npx drizzle-kit generate --name engagement`
Expected: `db/migrations/0002_engagement.sql` with 8 `CREATE TABLE` statements and `CREATE UNIQUE INDEX applications_pending_email … WHERE status = 'pending'`.

- [ ] **Step 6: Run the tests to see them pass**

Run: `npx vitest run`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add db lib/evidence.js lib/db-errors.js test
git commit -m "Add engagement tables and the evidence log"
```

---

### Task 2: Formatting, validation, Turnstile, email and calendar helpers

**Files:**
- Modify: `lib/format.js`, `test/format.test.js`
- Create: `lib/engagement/validation.js`, `lib/turnstile.js`, `lib/email.js`, `lib/ics.js`, `test/engagement-helpers.test.js`

**Interfaces:**
- Produces: `phNow(now?: Date): string`, `formatDateTime(local): string|null`, `ageOn(birthdate, today): number`, `formatPesos(centavos): string` (lib/format.js); `applicationInput`, `rsvpInput`, `volunteerInput`, `pledgeInput`, `eventInput`, `campaignInput`, `expenseInput`, `toCentavos(pesos)`; `verifyTurnstile(token, opts?) → Promise<boolean>`; `sendEmail({ to, subject, text }, opts?) → Promise<{ sent, reason? }>`; `buildIcs(event, { siteUrl, now? }) → string`.

- [ ] **Step 1: Write the failing tests**

`test/format.test.js` (append):

```js
import { phNow, formatDateTime, ageOn, formatPesos } from "@/lib/format.js";

describe("event and money formatting", () => {
  it("gives Philippine local time", () => {
    expect(phNow(new Date("2026-11-01T00:00:00Z"))).toBe("2026-11-01T08:00");
  });
  it("formats a stored event time", () => {
    expect(formatDateTime("2026-11-30T09:00")).toBe("Nov 30, 2026, 9:00 AM");
    expect(formatDateTime(null)).toBeNull();
  });
  it("computes age on a date", () => {
    expect(ageOn("2000-11-30", "2026-11-29")).toBe(25);
    expect(ageOn("2000-11-30", "2026-11-30T10:00:00.000Z")).toBe(26);
  });
  it("formats pesos", () => {
    expect(formatPesos(150000)).toBe("₱1,500");
  });
});
```

`test/engagement-helpers.test.js`:

```js
import { describe, it, expect, vi } from "vitest";
import { applicationInput, pledgeInput, volunteerInput, toCentavos } from "@/lib/engagement/validation.js";
import { verifyTurnstile } from "@/lib/turnstile.js";
import { sendEmail } from "@/lib/email.js";
import { buildIcs } from "@/lib/ics.js";

describe("engagement validation", () => {
  it("requires consent with a clear message", () => {
    const r = applicationInput.safeParse({ name: "Ana Cruz", email: "a@x.ph", birthdate: "2000-01-01", consent: false });
    expect(r.error.issues.map((i) => i.message)).toContain("Please agree to the privacy notice");
  });
  it("normalises email and reference numbers", () => {
    expect(applicationInput.parse({ name: "Ana Cruz", email: " Ana@X.PH ", birthdate: "2000-01-01", consent: true }).email).toBe("ana@x.ph");
    expect(pledgeInput.parse({ payerName: "Ana", payerEmail: "a@x.ph", amountPesos: "150.5", method: "gcash", referenceNo: " ab12cd ", consent: true }).referenceNo).toBe("AB12CD");
  });
  it("needs a project or an event to volunteer for", () => {
    expect(volunteerInput.safeParse({ name: "Ana Cruz", email: "a@x.ph", consent: true }).error.issues[0].message).toBe("Choose a project or event");
  });
  it("converts pesos to centavos", () => {
    expect(toCentavos(150.5)).toBe(15050);
  });
});

describe("verifyTurnstile", () => {
  it("passes when no secret is configured (local development)", async () => {
    expect(await verifyTurnstile("", { secret: "" })).toBe(true);
  });
  it("fails without a token when a secret is configured", async () => {
    expect(await verifyTurnstile("", { secret: "s" })).toBe(false);
  });
  it("asks Cloudflare and trusts its answer", async () => {
    const fetchImpl = vi.fn(async () => ({ json: async () => ({ success: true }) }));
    expect(await verifyTurnstile("tok", { secret: "s", fetchImpl })).toBe(true);
    expect(fetchImpl.mock.calls[0][0]).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
  });
  it("fails closed when Cloudflare is unreachable", async () => {
    expect(await verifyTurnstile("tok", { secret: "s", fetchImpl: async () => { throw new Error("down"); } })).toBe(false);
  });
});

describe("sendEmail", () => {
  it("skips quietly when not configured", async () => {
    expect(await sendEmail({ to: "a@x.ph", subject: "s", text: "t" }, { apiKey: "" })).toEqual({ sent: false, reason: "not-configured" });
  });
  it("posts to Resend", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true }));
    expect(await sendEmail({ to: "a@x.ph", subject: "Hi", text: "t" }, { apiKey: "k", from: "JCI <hi@x.ph>", fetchImpl })).toEqual({ sent: true });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ from: "JCI <hi@x.ph>", to: "a@x.ph", subject: "Hi", text: "t" });
  });
  it("reports failures without throwing", async () => {
    expect(await sendEmail({ to: "a", subject: "s", text: "t" }, { apiKey: "k", fetchImpl: async () => ({ ok: false, status: 422 }) })).toEqual({ sent: false, reason: "http-422" });
    expect(await sendEmail({ to: "a", subject: "s", text: "t" }, { apiKey: "k", fetchImpl: async () => { throw new Error("down"); } })).toEqual({ sent: false, reason: "down" });
  });
});

describe("buildIcs", () => {
  it("writes a calendar entry in UTC with escaped text", () => {
    const ics = buildIcs(
      { id: 3, slug: "ga", title: "General Assembly, 2027", venue: "Capiz; Roxas City", startAt: "2027-01-15T18:00", endAt: null },
      { siteUrl: "https://jciroxashalaran.com", now: new Date("2026-11-01T00:00:00Z") },
    );
    expect(ics).toContain("DTSTART:20270115T100000Z\r\n");
    expect(ics).toContain("DTEND:20270115T120000Z\r\n");
    expect(ics).toContain("SUMMARY:General Assembly\\, 2027\r\n");
    expect(ics).toContain("LOCATION:Capiz\\; Roxas City\r\n");
    expect(ics).toContain("URL:https://jciroxashalaran.com/events/ga\r\n");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run test/format.test.js test/engagement-helpers.test.js`
Expected: FAIL — missing exports/modules.

- [ ] **Step 3: Implement**

`lib/format.js` (append):

```js
const PH_OFFSET_MS = 8 * 60 * 60 * 1000;

// Event times are stored as Philippine local time "YYYY-MM-DDTHH:mm" (UTC+8, no DST).
export function phNow(now = new Date()) {
  return new Date(now.getTime() + PH_OFFSET_MS).toISOString().slice(0, 16);
}

const DATETIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

export function formatDateTime(local) {
  if (!local) return null;
  const d = new Date(`${local.slice(0, 16)}:00Z`);
  return Number.isNaN(d.getTime()) ? null : DATETIME_FORMAT.format(d).replace(/\u202f/g, " ");
}

export function ageOn(birthdate, today) {
  const [by, bm, bd] = birthdate.split("-").map(Number);
  const [ty, tm, td] = today.slice(0, 10).split("-").map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age;
}

const PESOS = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
export function formatPesos(centavos) {
  return PESOS.format(Math.round(centavos / 100));
}
```

`lib/engagement/validation.js`:

```js
import { z } from "zod";

const BLOB_URL = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i;
const QR_URL = /^(https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/|\/assets\/)/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const email = z.string().trim().toLowerCase().email("Enter a valid email address");
const consent = z.literal(true, { errorMap: () => ({ message: "Please agree to the privacy notice" }) });
const text = (max) => z.string().trim().max(max).default("");
const name = (msg) => z.string().trim().min(2, msg).max(120);
const optionalId = z
  .preprocess((v) => (v === "" || v === undefined || v === null ? null : Number(v)), z.number().int().positive().nullable())
  .default(null);
const pesos = z.coerce.number({ invalid_type_error: "Enter the amount" }).positive("Enter the amount").max(10_000_000);

export const toCentavos = (p) => Math.round(p * 100);

export const applicationInput = z.object({
  name: name("Enter your full name"),
  email,
  phone: text(30),
  birthdate: z.string().regex(DATE, "Enter your birthdate"),
  barangay: text(120),
  whyJoin: text(1000),
  referredBy: text(120),
  consent,
});

export const rsvpInput = z.object({
  eventId: z.coerce.number().int().positive(),
  name: name("Enter your name"),
  email,
  phone: text(30),
  consent,
});

export const volunteerInput = z
  .object({ projectId: optionalId, eventId: optionalId, name: name("Enter your name"), email, phone: text(30), skills: text(300), consent })
  .refine((v) => v.projectId || v.eventId, { message: "Choose a project or event" });

export const pledgeInput = z.object({
  campaignId: optionalId,
  type: z.enum(["donation", "sponsorship", "membership_fee"]).default("donation"),
  payerName: name("Enter your name"),
  payerEmail: email,
  amountPesos: pesos,
  method: z.enum(["gcash", "maya", "bank"], { errorMap: () => ({ message: "Choose how you paid" }) }),
  referenceNo: z.string().trim().toUpperCase().min(4, "Enter the reference number from your receipt").max(40),
  proofUrl: z.string().trim().regex(BLOB_URL).or(z.literal("")).default(""),
  consent,
});

export const eventInput = z.object({
  title: z.string().trim().min(1, "Add a title").max(160),
  slug: text(120),
  descriptionHtml: z.string().default(""),
  descriptionJson: z.string().default(""),
  startAt: z.string().regex(DATETIME, "Pick a start date and time"),
  endAt: z.string().regex(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})?$/, "Pick an end date and time").default(""),
  venue: text(200),
  capacity: z
    .preprocess((v) => (v === "" || v === undefined || v === null ? null : Number(v)), z.number().int().positive().nullable())
    .default(null),
  rsvpOpen: z.boolean().default(true),
  projectId: optionalId,
  coverUrl: text(500),
  coverAlt: text(200),
});

export const campaignInput = z.object({
  title: z.string().trim().min(1, "Add a title").max(160),
  slug: text(120),
  description: text(1000),
  projectId: optionalId,
  goalPesos: pesos,
  qrImageUrl: z.string().trim().regex(QR_URL, "Upload the QR image").or(z.literal("")).default(""),
  qrImageAlt: text(200),
  paymentInstructions: text(500),
  open: z.boolean().default(true),
});

export const expenseInput = z.object({
  amountPesos: pesos,
  description: z.string().trim().min(1, "Describe the expense").max(300),
  spentOn: z.string().regex(DATE, "Pick the date"),
  projectId: optionalId,
  campaignId: optionalId,
  receiptUrl: z.string().trim().regex(BLOB_URL).or(z.literal("")).default(""),
});
```

`lib/turnstile.js`:

```js
// Cloudflare Turnstile server check. With no secret configured (local dev and
// e2e) every request passes; in production the secret must be set.
export async function verifyTurnstile(token, { secret = process.env.TURNSTILE_SECRET_KEY, fetchImpl = fetch } = {}) {
  if (!secret) return true;
  if (!token) return false;
  try {
    const res = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}
```

`lib/email.js`:

```js
// Best-effort email through Resend. Never throws; callers treat failures as
// notes, never as a reason to undo a save.
export async function sendEmail(
  { to, subject, text },
  { apiKey = process.env.RESEND_API_KEY, from = process.env.EMAIL_FROM ?? "JCI Roxas Halaran <onboarding@resend.dev>", fetchImpl = fetch } = {},
) {
  if (!apiKey) return { sent: false, reason: "not-configured" };
  try {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text }),
    });
    return res.ok ? { sent: true } : { sent: false, reason: `http-${res.status}` };
  } catch (e) {
    return { sent: false, reason: e.message };
  }
}
```

`lib/ics.js`:

```js
const PH_OFFSET_MS = 8 * 60 * 60 * 1000;
const esc = (s = "") => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
const stamp = (date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const localToUtc = (local) => new Date(new Date(`${local.slice(0, 16)}:00Z`).getTime() - PH_OFFSET_MS);
const plusHours = (local, h) => new Date(new Date(`${local.slice(0, 16)}:00Z`).getTime() + h * 3600 * 1000).toISOString().slice(0, 16);

export function buildIcs(event, { siteUrl, now = new Date() }) {
  const end = event.endAt || plusHours(event.startAt, 2);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//JCI Roxas Halaran//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:event-${event.id}@jciroxashalaran.com`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(localToUtc(event.startAt))}`,
    `DTEND:${stamp(localToUtc(end))}`,
    `SUMMARY:${esc(event.title)}`,
    event.venue ? `LOCATION:${esc(event.venue)}` : null,
    `URL:${siteUrl}/events/${event.slug}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n")
    .concat("\r\n");
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run`
Expected: all PASS. If `formatPesos` prints `PHP 1,500` on this Node build, keep the test and set `currencyDisplay: "narrowSymbol"`.

- [ ] **Step 5: Commit**

```bash
git add lib test
git commit -m "Add engagement validation, Turnstile, email, calendar and formatting helpers"
```

---

### Task 3: Applications store

**Files:**
- Create: `lib/engagement/applications.js`, `test/applications.test.js`

**Interfaces:**
- Produces: `submitApplication(db, raw, { now? })`, `listApplications(db)`, `approveApplication(db, id, { userId, now?, invite? })` → `{ ok, member, invited, inviteError }`, `declineApplication(db, id, { userId, now?, note? })`.

- [ ] **Step 1: Write the failing tests**

`test/applications.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { members, eventsLog } from "@/db/schema.js";
import { submitApplication, approveApplication, declineApplication, listApplications } from "@/lib/engagement/applications.js";

const now = "2026-11-01T02:00:00.000Z";
const ana = { name: "Ana Cruz", email: "Ana@Example.ph", birthdate: "1998-04-12", consent: true };
let db;
beforeEach(async () => {
  db = await testDb();
  await seed(db);
});

describe("submitApplication", () => {
  it("saves a pending application with a lower-cased email and logs it", async () => {
    const r = await submitApplication(db, ana, { now });
    expect(r.application).toMatchObject({ email: "ana@example.ph", status: "pending" });
    expect((await db.select().from(eventsLog)).map((l) => l.type)).toEqual(["application_submitted"]);
  });

  it("accepts 18 today and 40 until the day before 41; refuses 17 and 41", async () => {
    const at = (birthdate) => submitApplication(db, { ...ana, email: `${birthdate}@x.ph`, birthdate }, { now });
    expect((await at("2008-11-01")).ok).toBe(true); // turned 18 today
    expect((await at("1985-11-02")).ok).toBe(true); // 40, turns 41 tomorrow
    expect(await at("2008-11-02")).toEqual({ ok: false, errors: ["JCI membership is for ages 18 to 40"] }); // turns 18 tomorrow
    expect(await at("1985-10-31")).toEqual({ ok: false, errors: ["JCI membership is for ages 18 to 40"] }); // turned 41 yesterday
  });

  it("refuses a second pending application but allows a new one after a decline", async () => {
    const first = await submitApplication(db, ana, { now });
    expect(await submitApplication(db, ana, { now })).toEqual({ ok: false, errors: ["You already have a pending application — we'll be in touch soon"] });
    await declineApplication(db, first.application.id, { userId: "admin", now });
    expect((await submitApplication(db, ana, { now })).ok).toBe(true);
  });
});

describe("approveApplication", () => {
  it("creates the member, invites them and logs the approval", async () => {
    const { application } = await submitApplication(db, ana, { now });
    const invite = vi.fn(async () => {});
    const r = await approveApplication(db, application.id, { userId: "admin", now, invite });
    expect(r).toMatchObject({ ok: true, invited: true, inviteError: null });
    expect(r.member).toMatchObject({ name: "Ana Cruz", email: "ana@example.ph", slug: "ana-cruz", joinedAt: "2026-11-01" });
    expect(invite).toHaveBeenCalledWith("ana@example.ph");
    expect((await listApplications(db))[0].status).toBe("approved");
  });

  it("links an existing member with the same email instead of duplicating", async () => {
    await db.update(members).set({ email: "ana@example.ph" }).where(eq(members.slug, "judy-daliva"));
    const { application } = await submitApplication(db, ana, { now });
    const r = await approveApplication(db, application.id, { userId: "admin", now, invite: async () => {} });
    expect(r.member.slug).toBe("judy-daliva");
    expect((await db.select().from(members)).length).toBe(17);
  });

  it("keeps the approval when the invitation fails", async () => {
    const { application } = await submitApplication(db, ana, { now });
    const r = await approveApplication(db, application.id, { userId: "admin", now, invite: async () => { throw new Error("Clerk down"); } });
    expect(r).toMatchObject({ ok: true, invited: false, inviteError: "Clerk down" });
  });

  it("refuses to review the same application twice", async () => {
    const { application } = await submitApplication(db, ana, { now });
    await approveApplication(db, application.id, { userId: "admin", now });
    expect(await approveApplication(db, application.id, { userId: "admin", now })).toEqual({ ok: false, errors: ["This application was already reviewed"] });
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run test/applications.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`lib/engagement/applications.js`:

```js
import { desc, eq, sql } from "drizzle-orm";
import { applications, members } from "../../db/schema.js";
import { applicationInput } from "./validation.js";
import { ageOn, slugify } from "../format.js";
import { logEvent } from "../evidence.js";
import { isUniqueViolation } from "../db-errors.js";

const issues = (r) => r.error.issues.map((i) => i.message);

export async function submitApplication(db, raw, { now = new Date().toISOString() } = {}) {
  const parsed = applicationInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: issues(parsed) };
  const d = parsed.data;
  const age = ageOn(d.birthdate, now);
  if (age < 18 || age > 40) return { ok: false, errors: ["JCI membership is for ages 18 to 40"] };
  try {
    const [application] = await db
      .insert(applications)
      .values({
        name: d.name,
        email: d.email,
        phone: d.phone || null,
        birthdate: d.birthdate,
        barangay: d.barangay || null,
        whyJoin: d.whyJoin || null,
        referredBy: d.referredBy || null,
        consent: true,
        createdAt: now,
      })
      .returning();
    await logEvent(db, { type: "application_submitted", refTable: "applications", refId: application.id, now });
    return { ok: true, application };
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, errors: ["You already have a pending application — we'll be in touch soon"] };
    throw e;
  }
}

export function listApplications(db) {
  return db
    .select()
    .from(applications)
    .orderBy(sql`${applications.status} = 'pending' desc`, desc(applications.createdAt), desc(applications.id));
}

async function pending(db, id) {
  const [app] = await db.select().from(applications).where(eq(applications.id, Number(id)));
  if (!app) return { error: "Application not found" };
  if (app.status !== "pending") return { error: "This application was already reviewed" };
  return { app };
}

async function uniqueSlug(db, name) {
  const base = slugify(name) || "member";
  for (let n = 1; ; n += 1) {
    const slug = n === 1 ? base : `${base}-${n}`;
    if (!(await db.select({ id: members.id }).from(members).where(eq(members.slug, slug))).length) return slug;
  }
}

export async function approveApplication(db, id, { userId, now = new Date().toISOString(), invite } = {}) {
  const { app, error } = await pending(db, id);
  if (error) return { ok: false, errors: [error] };

  let [member] = await db.select().from(members).where(sql`lower(${members.email}) = ${app.email}`);
  if (!member) {
    [member] = await db
      .insert(members)
      .values({ slug: await uniqueSlug(db, app.name), name: app.name, email: app.email, joinedAt: now.slice(0, 10), status: "active" })
      .returning();
  }
  await db
    .update(applications)
    .set({ status: "approved", reviewedBy: userId, reviewedAt: now, memberId: member.id })
    .where(eq(applications.id, app.id));
  await logEvent(db, { type: "member_approved", actor: userId, refTable: "members", refId: member.id, now });

  let invited = false;
  let inviteError = null;
  if (invite && !member.clerkUserId) {
    try {
      await invite(app.email);
      invited = true;
    } catch (e) {
      inviteError = e.message;
    }
  }
  return { ok: true, member, invited, inviteError };
}

export async function declineApplication(db, id, { userId, now = new Date().toISOString(), note = "" } = {}) {
  const { app, error } = await pending(db, id);
  if (error) return { ok: false, errors: [error] };
  await db
    .update(applications)
    .set({ status: "declined", reviewedBy: userId, reviewedAt: now, note: note || null })
    .where(eq(applications.id, app.id));
  return { ok: true };
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run test/applications.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/engagement/applications.js test/applications.test.js
git commit -m "Add the membership application store with approval and invitations"
```

---

### Task 4: Events, RSVPs and volunteers store

**Files:**
- Create: `lib/engagement/events.js`, `test/events.test.js`

**Interfaces:**
- Produces: `saveEvent(db, { id?, expectedUpdatedAt?, ...fields }, { now? })` → `{ ok, event }`; `getEvent(db, id)`; `getEventBySlug(db, slug)` → event + `{ going, waitlist }`; `listEvents(db, { now?: Date })` → `{ upcoming, past }` (each event has `going`, `waitlist`); `submitRsvp(db, raw, { now? })` → `{ ok, rsvp, status, event }`; `listRsvps(db, eventId)`; `setAttendance(db, rsvpId, attended, { userId, now? })`; `moveToGoing(db, rsvpId)`; `submitVolunteer(db, raw, { now? })`.

- [ ] **Step 1: Write the failing tests**

`test/events.test.js`:

```js
import { describe, it, expect, beforeEach } from "vitest";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { eventsLog } from "@/db/schema.js";
import { saveEvent, submitRsvp, listEvents, getEventBySlug, setAttendance, submitVolunteer, listRsvps } from "@/lib/engagement/events.js";

const now = "2026-11-01T00:00:00.000Z";
let db;
let ga;
beforeEach(async () => {
  db = await testDb();
  await seed(db);
  ga = (await saveEvent(db, { title: "General Assembly", startAt: "2027-01-15T18:00", capacity: 1, venue: "Roxas City" }, { now })).event;
});

const rsvp = (email, extra = {}) => submitRsvp(db, { eventId: ga.id, name: "Ana Cruz", email, consent: true, ...extra }, { now });

describe("events", () => {
  it("creates an event with a slug that stays after edits", async () => {
    expect(ga.slug).toBe("general-assembly");
    const e = await saveEvent(db, { id: ga.id, expectedUpdatedAt: ga.updatedAt, title: "General Assembly 2027", startAt: "2027-01-15T18:00" }, { now });
    expect(e.event.slug).toBe("general-assembly");
  });

  it("splits upcoming and past events by Philippine time", async () => {
    await saveEvent(db, { title: "Induction", startAt: "2026-10-20T18:00" }, { now });
    const { upcoming, past } = await listEvents(db, { now: new Date(now) });
    expect(upcoming.map((e) => e.slug)).toEqual(["general-assembly"]);
    expect(past.map((e) => e.slug)).toEqual(["induction"]);
  });
});

describe("RSVPs", () => {
  it("puts people on the waitlist once the event is full", async () => {
    expect((await rsvp("a@x.ph")).status).toBe("going");
    expect((await rsvp("b@x.ph")).status).toBe("waitlist");
    expect(await getEventBySlug(db, "general-assembly")).toMatchObject({ going: 1, waitlist: 1 });
  });

  it("treats the same email in different case as a duplicate", async () => {
    await rsvp("Juan@Gmail.com");
    expect(await rsvp("juan@gmail.com")).toEqual({ ok: false, errors: ["You're already on the list for this event"] });
  });

  it("refuses RSVPs when they are closed", async () => {
    await saveEvent(db, { id: ga.id, expectedUpdatedAt: ga.updatedAt, title: "General Assembly", startAt: "2027-01-15T18:00", rsvpOpen: false }, { now });
    expect(await rsvp("c@x.ph")).toEqual({ ok: false, errors: ["RSVPs are closed for this event"] });
  });

  it("logs RSVPs and attendance", async () => {
    const { rsvp: r } = await rsvp("a@x.ph");
    await setAttendance(db, r.id, true, { userId: "admin", now });
    expect((await listRsvps(db, ga.id))[0].attended).toBe(true);
    expect((await db.select().from(eventsLog)).map((l) => l.type)).toEqual(["rsvp_created", "attendance_marked"]);
  });
});

describe("volunteers", () => {
  it("records a sign-up for an event", async () => {
    const r = await submitVolunteer(db, { eventId: ga.id, name: "Ana Cruz", email: "a@x.ph", skills: "Photography", consent: true }, { now });
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run test/events.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`lib/engagement/events.js`:

```js
import { and, asc, count, eq, ne } from "drizzle-orm";
import { events, rsvps, volunteerSignups } from "../../db/schema.js";
import { eventInput, rsvpInput, volunteerInput } from "./validation.js";
import { cleanHtml } from "../sanitize.js";
import { phNow, slugify } from "../format.js";
import { logEvent } from "../evidence.js";
import { isUniqueViolation } from "../db-errors.js";

const issues = (r) => r.error.issues.map((i) => i.message);

async function rsvpCounts(db, eventId) {
  const rows = await db
    .select({ status: rsvps.status, n: count() })
    .from(rsvps)
    .where(eq(rsvps.eventId, eventId))
    .groupBy(rsvps.status);
  const of = (s) => rows.find((r) => r.status === s)?.n ?? 0;
  return { going: of("going"), waitlist: of("waitlist") };
}

export async function getEvent(db, id) {
  const [row] = await db.select().from(events).where(eq(events.id, Number(id)));
  return row ?? null;
}

export async function getEventBySlug(db, slug) {
  const [row] = await db.select().from(events).where(eq(events.slug, slug));
  return row ? { ...row, ...(await rsvpCounts(db, row.id)) } : null;
}

export async function listEvents(db, { now = new Date() } = {}) {
  const today = phNow(now);
  const all = await db.select().from(events).orderBy(asc(events.startAt), asc(events.id));
  const withCounts = await Promise.all(all.map(async (e) => ({ ...e, ...(await rsvpCounts(db, e.id)) })));
  const isUpcoming = (e) => (e.endAt || e.startAt) >= today;
  return { upcoming: withCounts.filter(isUpcoming), past: withCounts.filter((e) => !isUpcoming(e)).reverse() };
}

export async function saveEvent(db, { id, expectedUpdatedAt, ...raw }, { now = new Date().toISOString() } = {}) {
  const parsed = eventInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: issues(parsed) };
  const d = parsed.data;
  const existing = id ? await getEvent(db, id) : null;
  if (id && !existing) return { ok: false, errors: ["Event not found"] };
  if (existing && expectedUpdatedAt !== existing.updatedAt) {
    return { ok: false, errors: ["This was changed since you opened it — reload"] };
  }
  const slug = existing ? existing.slug : slugify(d.slug || d.title);
  if (!existing) {
    const taken = await db.select({ id: events.id }).from(events).where(eq(events.slug, slug));
    if (taken.length) return { ok: false, errors: [`The address /events/${slug} is taken — try ${slug}-2`] };
  }
  if (d.coverUrl && !d.coverAlt) return { ok: false, errors: ["Add alt text for the cover image"] };
  const values = {
    title: d.title,
    slug,
    description: cleanHtml(d.descriptionHtml),
    descriptionJson: d.descriptionJson || null,
    startAt: d.startAt,
    endAt: d.endAt || null,
    venue: d.venue || null,
    capacity: d.capacity,
    rsvpOpen: d.rsvpOpen,
    projectId: d.projectId,
    coverUrl: d.coverUrl || null,
    coverAlt: d.coverAlt || null,
    updatedAt: now,
  };
  const [event] = existing
    ? await db.update(events).set(values).where(eq(events.id, existing.id)).returning()
    : await db.insert(events).values(values).returning();
  return { ok: true, event };
}

export async function submitRsvp(db, raw, { now = new Date().toISOString() } = {}) {
  const parsed = rsvpInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: issues(parsed) };
  const d = parsed.data;
  const event = await getEvent(db, d.eventId);
  if (!event) return { ok: false, errors: ["Event not found"] };
  if (!event.rsvpOpen) return { ok: false, errors: ["RSVPs are closed for this event"] };
  const { going } = await rsvpCounts(db, event.id);
  const status = event.capacity && going >= event.capacity ? "waitlist" : "going";
  try {
    const [rsvp] = await db
      .insert(rsvps)
      .values({ eventId: event.id, name: d.name, email: d.email, phone: d.phone || null, consent: true, status, createdAt: now })
      .returning();
    await logEvent(db, { type: "rsvp_created", refTable: "rsvps", refId: rsvp.id, meta: { status }, now });
    return { ok: true, rsvp, status, event };
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, errors: ["You're already on the list for this event"] };
    throw e;
  }
}

export function listRsvps(db, eventId) {
  return db.select().from(rsvps).where(eq(rsvps.eventId, Number(eventId))).orderBy(asc(rsvps.createdAt), asc(rsvps.id));
}

export async function setAttendance(db, rsvpId, attended, { userId, now = new Date().toISOString() }) {
  const [rsvp] = await db.update(rsvps).set({ attended }).where(eq(rsvps.id, Number(rsvpId))).returning();
  if (!rsvp) return { ok: false, errors: ["RSVP not found"] };
  if (attended) await logEvent(db, { type: "attendance_marked", actor: userId, refTable: "rsvps", refId: rsvp.id, now });
  return { ok: true, rsvp };
}

export async function moveToGoing(db, rsvpId) {
  const [rsvp] = await db
    .update(rsvps)
    .set({ status: "going" })
    .where(and(eq(rsvps.id, Number(rsvpId)), ne(rsvps.status, "going")))
    .returning();
  return rsvp ? { ok: true, rsvp } : { ok: false, errors: ["Already going"] };
}

export async function submitVolunteer(db, raw, { now = new Date().toISOString() } = {}) {
  const parsed = volunteerInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: issues(parsed) };
  const d = parsed.data;
  const [signup] = await db
    .insert(volunteerSignups)
    .values({ projectId: d.projectId, eventId: d.eventId, name: d.name, email: d.email, phone: d.phone || null, skills: d.skills || null, consent: true, createdAt: now })
    .returning();
  await logEvent(db, { type: "volunteer_signed_up", refTable: "volunteer_signups", refId: signup.id, now });
  return { ok: true, signup };
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run test/events.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/engagement/events.js test/events.test.js
git commit -m "Add events, RSVPs with waitlist, attendance and volunteer sign-ups"
```

---

### Task 5: Campaigns, payments and expenses store

**Files:**
- Create: `lib/engagement/money.js`, `test/money.test.js`

**Interfaces:**
- Produces: `saveCampaign(db, { id?, ...fields }, { now? })` → `{ ok, campaign }`; `listCampaigns(db, { openOnly? })` (each with `raisedCentavos`); `getCampaignForProject(db, projectId)`; `submitPledge(db, raw, { now? })` → `{ ok, payment }`; `listPayments(db, { status? })`; `confirmPayment(db, id, { userId, now? })`; `rejectPayment(db, id, { userId, now?, note? })`; `recordExpense(db, raw, { userId, now? })`; `listExpenses(db)`.

- [ ] **Step 1: Write the failing tests**

`test/money.test.js`:

```js
import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { members, eventsLog } from "@/db/schema.js";
import { saveCampaign, listCampaigns, submitPledge, confirmPayment, rejectPayment, recordExpense } from "@/lib/engagement/money.js";

const now = "2026-11-01T00:00:00.000Z";
let db;
let fund;
beforeEach(async () => {
  db = await testDb();
  await seed(db);
  fund = (await saveCampaign(db, { title: "Coastal Cleanup Fund", goalPesos: 20000, qrImageUrl: "/assets/img/logo-site.png", qrImageAlt: "GCash QR" }, { now })).campaign;
});

const pledge = (extra = {}) =>
  submitPledge(db, { campaignId: fund.id, payerName: "Ana Cruz", payerEmail: "a@x.ph", amountPesos: 500, method: "gcash", referenceNo: "ABC12345", consent: true, ...extra }, { now });

describe("campaigns and pledges", () => {
  it("counts only confirmed payments toward the goal", async () => {
    const a = await pledge();
    await pledge({ referenceNo: "XYZ99999" });
    await confirmPayment(db, a.payment.id, { userId: "admin", now });
    const [c] = await listCampaigns(db, { openOnly: true });
    expect(c).toMatchObject({ goalCentavos: 2000000, raisedCentavos: 50000 });
  });

  it("refuses a reused reference number regardless of case, per method", async () => {
    await pledge();
    expect(await pledge({ referenceNo: "abc12345" })).toEqual({ ok: false, errors: ["That reference number was already submitted"] });
    expect((await pledge({ referenceNo: "abc12345", method: "maya" })).ok).toBe(true);
  });

  it("refuses pledges to a closed campaign", async () => {
    await saveCampaign(db, { id: fund.id, title: fund.title, goalPesos: 20000, open: false }, { now });
    expect(await pledge()).toEqual({ ok: false, errors: ["This campaign is closed"] });
  });

  it("marks a member's fee as paid when a membership fee is confirmed", async () => {
    await db.update(members).set({ email: "a@x.ph" }).where(eq(members.slug, "judy-daliva"));
    const p = await pledge({ type: "membership_fee", campaignId: "" });
    await confirmPayment(db, p.payment.id, { userId: "admin", now });
    const [judy] = await db.select().from(members).where(eq(members.slug, "judy-daliva"));
    expect(judy.feePaidYear).toBe(2026);
  });

  it("refuses to confirm twice and lets admins reject with a note", async () => {
    const a = await pledge();
    await confirmPayment(db, a.payment.id, { userId: "admin", now });
    expect(await confirmPayment(db, a.payment.id, { userId: "admin", now })).toEqual({ ok: false, errors: ["This payment was already reviewed"] });
    const b = await pledge({ referenceNo: "NOPE0001" });
    expect((await rejectPayment(db, b.payment.id, { userId: "admin", now, note: "Not found in GCash" })).ok).toBe(true);
  });
});

describe("expenses", () => {
  it("records and logs an expense", async () => {
    const r = await recordExpense(db, { amountPesos: 1250, description: "Trash bags", spentOn: "2026-11-02", campaignId: fund.id }, { userId: "admin", now });
    expect(r.expense.amountCentavos).toBe(125000);
    expect((await db.select().from(eventsLog)).map((l) => l.type)).toEqual(["expense_recorded"]);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run test/money.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`lib/engagement/money.js`:

```js
import { and, desc, eq, sql } from "drizzle-orm";
import { campaigns, payments, expenses, members } from "../../db/schema.js";
import { campaignInput, pledgeInput, expenseInput, toCentavos } from "./validation.js";
import { slugify } from "../format.js";
import { logEvent } from "../evidence.js";
import { isUniqueViolation } from "../db-errors.js";

const issues = (r) => r.error.issues.map((i) => i.message);

async function raised(db, campaignId) {
  const [r] = await db
    .select({ total: sql`coalesce(sum(${payments.amountCentavos}), 0)` })
    .from(payments)
    .where(and(eq(payments.campaignId, campaignId), eq(payments.status, "confirmed")));
  return Number(r.total);
}

async function getCampaign(db, id) {
  const [row] = await db.select().from(campaigns).where(eq(campaigns.id, Number(id)));
  return row ?? null;
}

export async function saveCampaign(db, { id, ...raw }, { now = new Date().toISOString() } = {}) {
  const parsed = campaignInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: issues(parsed) };
  const d = parsed.data;
  if (d.qrImageUrl && !d.qrImageAlt) return { ok: false, errors: ["Add alt text for the QR image"] };
  const existing = id ? await getCampaign(db, id) : null;
  if (id && !existing) return { ok: false, errors: ["Campaign not found"] };
  const slug = existing ? existing.slug : slugify(d.slug || d.title);
  const values = {
    title: d.title,
    slug,
    description: d.description || null,
    projectId: d.projectId,
    goalCentavos: toCentavos(d.goalPesos),
    qrImageUrl: d.qrImageUrl || null,
    qrImageAlt: d.qrImageAlt || null,
    paymentInstructions: d.paymentInstructions || null,
    open: d.open,
    updatedAt: now,
  };
  try {
    const [campaign] = existing
      ? await db.update(campaigns).set(values).where(eq(campaigns.id, existing.id)).returning()
      : await db.insert(campaigns).values({ ...values, createdAt: now }).returning();
    return { ok: true, campaign };
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, errors: [`A campaign called ${slug} already exists`] };
    throw e;
  }
}

export async function listCampaigns(db, { openOnly = false } = {}) {
  const q = db.select().from(campaigns).orderBy(desc(campaigns.createdAt), desc(campaigns.id));
  const rows = await (openOnly ? q.where(eq(campaigns.open, true)) : q);
  return Promise.all(rows.map(async (c) => ({ ...c, raisedCentavos: await raised(db, c.id) })));
}

export async function getCampaignForProject(db, projectId) {
  const [c] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.projectId, Number(projectId)), eq(campaigns.open, true)))
    .orderBy(desc(campaigns.createdAt));
  return c ? { ...c, raisedCentavos: await raised(db, c.id) } : null;
}

export async function submitPledge(db, raw, { now = new Date().toISOString() } = {}) {
  const parsed = pledgeInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: issues(parsed) };
  const d = parsed.data;
  if (d.campaignId) {
    const c = await getCampaign(db, d.campaignId);
    if (!c) return { ok: false, errors: ["Campaign not found"] };
    if (!c.open) return { ok: false, errors: ["This campaign is closed"] };
  }
  try {
    const [payment] = await db
      .insert(payments)
      .values({
        campaignId: d.campaignId,
        type: d.type,
        payerName: d.payerName,
        payerEmail: d.payerEmail,
        amountCentavos: toCentavos(d.amountPesos),
        method: d.method,
        referenceNo: d.referenceNo,
        proofUrl: d.proofUrl || null,
        consent: true,
        createdAt: now,
      })
      .returning();
    await logEvent(db, { type: "pledge_submitted", refTable: "payments", refId: payment.id, meta: { amountCentavos: payment.amountCentavos }, now });
    return { ok: true, payment };
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, errors: ["That reference number was already submitted"] };
    throw e;
  }
}

export function listPayments(db, { status } = {}) {
  const q = db.select().from(payments).orderBy(desc(payments.createdAt), desc(payments.id));
  return status ? q.where(eq(payments.status, status)) : q;
}

async function pendingPayment(db, id) {
  const [p] = await db.select().from(payments).where(eq(payments.id, Number(id)));
  if (!p) return { error: "Payment not found" };
  if (p.status !== "pending") return { error: "This payment was already reviewed" };
  return { p };
}

export async function confirmPayment(db, id, { userId, now = new Date().toISOString() }) {
  const { p, error } = await pendingPayment(db, id);
  if (error) return { ok: false, errors: [error] };
  let memberId = p.memberId;
  if (p.type === "membership_fee") {
    const [m] = await db.select().from(members).where(sql`lower(${members.email}) = ${p.payerEmail}`);
    if (m) {
      memberId = m.id;
      await db.update(members).set({ feePaidYear: Number(now.slice(0, 4)) }).where(eq(members.id, m.id));
    }
  }
  const [payment] = await db
    .update(payments)
    .set({ status: "confirmed", confirmedBy: userId, confirmedAt: now, memberId })
    .where(eq(payments.id, p.id))
    .returning();
  await logEvent(db, { type: "payment_confirmed", actor: userId, refTable: "payments", refId: p.id, meta: { amountCentavos: p.amountCentavos }, now });
  return { ok: true, payment };
}

export async function rejectPayment(db, id, { userId, now = new Date().toISOString(), note = "" }) {
  const { p, error } = await pendingPayment(db, id);
  if (error) return { ok: false, errors: [error] };
  const [payment] = await db
    .update(payments)
    .set({ status: "rejected", confirmedBy: userId, confirmedAt: now, note: note || null })
    .where(eq(payments.id, p.id))
    .returning();
  return { ok: true, payment };
}

export async function recordExpense(db, raw, { userId, now = new Date().toISOString() }) {
  const parsed = expenseInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: issues(parsed) };
  const d = parsed.data;
  const [expense] = await db
    .insert(expenses)
    .values({
      amountCentavos: toCentavos(d.amountPesos),
      description: d.description,
      spentOn: d.spentOn,
      projectId: d.projectId,
      campaignId: d.campaignId,
      receiptUrl: d.receiptUrl || null,
      recordedBy: userId,
      createdAt: now,
    })
    .returning();
  await logEvent(db, { type: "expense_recorded", actor: userId, refTable: "expenses", refId: expense.id, meta: { amountCentavos: expense.amountCentavos }, now });
  return { ok: true, expense };
}

export function listExpenses(db) {
  return db.select().from(expenses).orderBy(desc(expenses.spentOn), desc(expenses.id));
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run test/money.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/engagement/money.js test/money.test.js
git commit -m "Add campaigns, pledges with manual confirmation, and expenses"
```

---

### Task 6: Public actions and the payment-proof upload route

**Files:**
- Modify: `lib/revalidate.js`, `test/revalidate.test.js`, `.env.example`, `README.md`
- Create: `app/actions/engagement.js`, `app/api/upload-proof/route.js`, `test/public-actions.test.js`

**Interfaces:**
- Produces: `pathsForEvent(slug)`, `SUPPORT_PATHS`; server actions `applyAction(input)`, `rsvpAction(input)`, `volunteerAction(input)`, `pledgeAction(input)` returning `{ ok: true, message } | { ok: false, errors }`; `POST /api/upload-proof` (images ≤ 5 MB, Turnstile token in `clientPayload`).

- [ ] **Step 1: Write the failing tests**

`test/revalidate.test.js` (append):

```js
import { pathsForEvent, SUPPORT_PATHS } from "@/lib/revalidate.js";

describe("engagement paths", () => {
  it("covers every page an event appears on", () => {
    expect(pathsForEvent("ga")).toEqual(["/events", "/events/ga", "/", "/sitemap.xml"]);
    expect(SUPPORT_PATHS).toEqual(["/support", "/"]);
  });
});
```

`test/public-actions.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from "vitest";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { saveEvent } from "@/lib/engagement/events.js";

const h = vi.hoisted(() => ({ db: null, human: true, emails: [], revalidated: [] }));
vi.mock("@/lib/db.js", async (orig) => ({ ...(await orig()), getDb: () => h.db }));
vi.mock("@/lib/turnstile.js", () => ({ verifyTurnstile: async () => h.human }));
vi.mock("@/lib/email.js", () => ({ sendEmail: async (m) => { h.emails.push(m); return { sent: true }; } }));
vi.mock("next/cache", () => ({ revalidatePath: (p) => h.revalidated.push(p) }));

const { applyAction, rsvpAction, pledgeAction } = await import("@/app/actions/engagement.js");

let ga;
beforeEach(async () => {
  h.db = await testDb();
  await seed(h.db);
  h.human = true;
  h.emails = [];
  h.revalidated = [];
  ga = (await saveEvent(h.db, { title: "General Assembly", startAt: "2027-01-15T18:00", capacity: 1 })).event;
});

describe("public actions", () => {
  it("turn bots away", async () => {
    h.human = false;
    expect(await applyAction({ name: "Ana Cruz", email: "a@x.ph", birthdate: "1998-01-01", consent: true })).toEqual({
      ok: false,
      errors: ["Please complete the check and try again"],
    });
  });

  it("confirm an application and email both the applicant and the chapter", async () => {
    const r = await applyAction({ name: "Ana Cruz", email: "a@x.ph", birthdate: "1998-01-01", consent: true });
    expect(r).toEqual({ ok: true, message: "Thank you! We received your application and will contact you soon." });
    expect(h.emails.map((m) => m.to)).toEqual(["a@x.ph", "roxashalaran.jci@gmail.com"]);
  });

  it("tell a late RSVP they are on the waitlist and refresh the event pages", async () => {
    await rsvpAction({ eventId: ga.id, name: "Ana Cruz", email: "a@x.ph", consent: true });
    const r = await rsvpAction({ eventId: ga.id, name: "Ben Reyes", email: "b@x.ph", consent: true });
    expect(r.message).toBe("The event is full — you're on the waitlist. We'll email you if a spot opens.");
    expect(h.revalidated).toContain("/events/general-assembly");
  });

  it("acknowledge a pledge without counting it yet", async () => {
    const r = await pledgeAction({ payerName: "Ana Cruz", payerEmail: "a@x.ph", amountPesos: 500, method: "gcash", referenceNo: "ABC12345", consent: true });
    expect(r).toEqual({ ok: true, message: "Thank you! Our team will confirm your payment within a few days." });
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run test/revalidate.test.js test/public-actions.test.js`
Expected: FAIL — `pathsForEvent` missing; actions module not found.

- [ ] **Step 3: Implement**

`lib/revalidate.js` (append):

```js
export const pathsForEvent = (slug) => ["/events", `/events/${slug}`, "/", "/sitemap.xml"];
export const SUPPORT_PATHS = ["/support", "/"];
```

`app/actions/engagement.js`:

```js
"use server";

import { getDb } from "@/lib/db.js";
import { verifyTurnstile } from "@/lib/turnstile.js";
import { sendEmail } from "@/lib/email.js";
import { SITE } from "@/lib/site.js";
import { formatDateTime, formatPesos } from "@/lib/format.js";
import { pathsForEvent, revalidateAll } from "@/lib/revalidate.js";
import { submitApplication } from "@/lib/engagement/applications.js";
import { submitRsvp, submitVolunteer } from "@/lib/engagement/events.js";
import { submitPledge } from "@/lib/engagement/money.js";

const BOT = { ok: false, errors: ["Please complete the check and try again"] };

export async function applyAction(input) {
  if (!(await verifyTurnstile(input?.turnstileToken))) return BOT;
  const r = await submitApplication(getDb(), input);
  if (!r.ok) return r;
  const { name, email } = r.application;
  await Promise.all([
    sendEmail({
      to: email,
      subject: "We received your JCI Roxas Halaran application",
      text: `Hi ${name},\n\nThank you for applying to JCI Roxas Halaran. Our team will review your application and contact you soon.\n\nJCI Roxas Halaran\n${SITE.url}`,
    }),
    sendEmail({
      to: SITE.email,
      subject: `New membership application: ${name}`,
      text: `${name} (${email}) applied to join.\nReview it at ${SITE.url}/admin/applications`,
    }),
  ]);
  return { ok: true, message: "Thank you! We received your application and will contact you soon." };
}

export async function rsvpAction(input) {
  if (!(await verifyTurnstile(input?.turnstileToken))) return BOT;
  const r = await submitRsvp(getDb(), input);
  if (!r.ok) return r;
  revalidateAll(pathsForEvent(r.event.slug));
  const when = formatDateTime(r.event.startAt);
  const message =
    r.status === "waitlist"
      ? "The event is full — you're on the waitlist. We'll email you if a spot opens."
      : `You're going! See you on ${when}.`;
  await sendEmail({
    to: r.rsvp.email,
    subject: `${r.status === "waitlist" ? "Waitlist" : "RSVP"}: ${r.event.title}`,
    text: `Hi ${r.rsvp.name},\n\n${message}\n\n${r.event.title}\n${when}${r.event.venue ? `\n${r.event.venue}` : ""}\n${SITE.url}/events/${r.event.slug}`,
  });
  return { ok: true, message };
}

export async function volunteerAction(input) {
  if (!(await verifyTurnstile(input?.turnstileToken))) return BOT;
  const r = await submitVolunteer(getDb(), input);
  if (!r.ok) return r;
  await sendEmail({
    to: SITE.email,
    subject: `New volunteer: ${r.signup.name}`,
    text: `${r.signup.name} (${r.signup.email}) signed up to volunteer.${r.signup.skills ? `\nSkills: ${r.signup.skills}` : ""}`,
  });
  return { ok: true, message: "Thank you for volunteering! We'll contact you with details." };
}

export async function pledgeAction(input) {
  if (!(await verifyTurnstile(input?.turnstileToken))) return BOT;
  const r = await submitPledge(getDb(), input);
  if (!r.ok) return r;
  const p = r.payment;
  await sendEmail({
    to: SITE.email,
    subject: `New pledge to confirm: ${formatPesos(p.amountCentavos)} via ${p.method.toUpperCase()}`,
    text: `${p.payerName} (${p.payerEmail}) reported ${formatPesos(p.amountCentavos)} via ${p.method.toUpperCase()}, reference ${p.referenceNo}.\nConfirm it at ${SITE.url}/admin/payments`,
  });
  return { ok: true, message: "Thank you! Our team will confirm your payment within a few days." };
}
```

`app/api/upload-proof/route.js`:

```js
import { handleUpload } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { verifyTurnstile } from "@/lib/turnstile.js";

const PROOF_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PROOF_BYTES = 5 * 1024 * 1024;

// Public upload for payment screenshots: images only, 5 MB, Turnstile-checked.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        let token = "";
        try {
          token = JSON.parse(clientPayload ?? "{}").turnstileToken ?? "";
        } catch {
          token = "";
        }
        if (!(await verifyTurnstile(token))) throw new Error("Not allowed");
        return { allowedContentTypes: PROOF_TYPES, maximumSizeInBytes: MAX_PROOF_BYTES, addRandomSuffix: true };
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

`.env.example` (append):

```
# Cloudflare Turnstile (spam check on public forms; leave empty locally)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=

# Resend (email receipts; optional)
RESEND_API_KEY=
EMAIL_FROM=JCI Roxas Halaran <hello@jciroxashalaran.com>
```

In `README.md`, after deploy checklist item 4, add:

```markdown
5. **Turnstile and Resend (Phase 3).** Create a Cloudflare Turnstile widget for the site's hostnames and set
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`. Without the secret, public forms skip the bot check.
   For email receipts, verify the sending domain in Resend and set `RESEND_API_KEY` and `EMAIL_FROM`.
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/revalidate.js app/actions app/api/upload-proof .env.example README.md test
git commit -m "Add public engagement actions and the payment-proof upload route"
```

---

### Task 7: Admin engagement actions

**Files:**
- Create: `app/admin/applications/actions.js`, `app/admin/events/actions.js`, `app/admin/payments/actions.js`, `test/admin-engagement-actions.test.js`
- Modify: `app/admin/articles/actions.js`, `test/actions.test.js`

**Interfaces:**
- Produces: `approveApplicationAction(id)`, `declineApplicationAction(id, note)`; `saveEventAction(input)`, `setAttendanceAction(rsvpId, attended)`, `moveToGoingAction(rsvpId)`; `confirmPaymentAction(id)`, `rejectPaymentAction(id, note)`, `saveCampaignAction(input)`, `recordExpenseAction(input)`. Publishing an article now logs `article_published`.

- [ ] **Step 1: Write the failing tests**

`test/admin-engagement-actions.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from "vitest";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { submitApplication } from "@/lib/engagement/applications.js";
import { saveCampaign, submitPledge } from "@/lib/engagement/money.js";

const h = vi.hoisted(() => ({ db: null, claims: null, revalidated: [], invites: [] }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: h.claims ? "user_admin" : null, sessionClaims: h.claims }),
  clerkClient: async () => ({
    users: { getUser: async () => ({ publicMetadata: {} }) },
    invitations: { createInvitation: async (p) => { h.invites.push(p); return {}; } },
  }),
}));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
vi.mock("next/cache", () => ({ revalidatePath: (p) => h.revalidated.push(p) }));
vi.mock("@/lib/db.js", async (orig) => ({ ...(await orig()), getDb: () => h.db }));

const { approveApplicationAction } = await import("@/app/admin/applications/actions.js");
const { confirmPaymentAction } = await import("@/app/admin/payments/actions.js");

beforeEach(async () => {
  h.db = await testDb();
  await seed(h.db);
  h.revalidated = [];
  h.invites = [];
});

describe("admin engagement actions", () => {
  it("refuse officers", async () => {
    h.claims = { metadata: { role: "officer" } };
    await expect(approveApplicationAction(1)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("approve an application and send a Clerk invitation as a member", async () => {
    h.claims = { metadata: { role: "admin" } };
    const { application } = await submitApplication(h.db, { name: "Ana Cruz", email: "a@x.ph", birthdate: "1998-01-01", consent: true });
    const r = await approveApplicationAction(application.id);
    expect(r).toMatchObject({ ok: true, invited: true, memberName: "Ana Cruz" });
    expect(h.invites[0]).toMatchObject({ emailAddress: "a@x.ph", publicMetadata: { role: "member" }, ignoreExisting: true });
  });

  it("refresh the support page when a payment is confirmed", async () => {
    h.claims = { metadata: { role: "admin" } };
    const { campaign } = await saveCampaign(h.db, { title: "Fund", goalPesos: 1000 });
    const { payment } = await submitPledge(h.db, { campaignId: campaign.id, payerName: "Ana Cruz", payerEmail: "a@x.ph", amountPesos: 100, method: "gcash", referenceNo: "REF00001", consent: true });
    expect((await confirmPaymentAction(payment.id)).ok).toBe(true);
    expect(h.revalidated).toEqual(expect.arrayContaining(["/support", "/"]));
  });
});
```

In `test/actions.test.js`, add `eventsLog` import and a test inside `describe("article actions", …)`:

```js
  it("log publishing as planning evidence", async () => {
    h.claims = { metadata: { role: "admin" } };
    const saved = await saveArticleAction(complete);
    await publishArticleAction(saved.article.id, saved.article.updatedAt);
    expect((await h.db.select().from(eventsLog)).map((l) => [l.type, l.criterion])).toEqual([["article_published", "planning"]]);
  });
```

(with `import { eventsLog } from "@/db/schema.js";` at the top).

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run test/admin-engagement-actions.test.js test/actions.test.js`
Expected: FAIL — modules not found; no log row.

- [ ] **Step 3: Implement**

`app/admin/applications/actions.js`:

```js
"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db.js";
import { requireArea } from "@/lib/auth.js";
import { SITE } from "@/lib/site.js";
import { approveApplication, declineApplication } from "@/lib/engagement/applications.js";

async function inviteMember(email) {
  const clerk = await clerkClient();
  await clerk.invitations.createInvitation({
    emailAddress: email,
    publicMetadata: { role: "member" },
    redirectUrl: `${SITE.url}/sign-in`,
    ignoreExisting: true,
  });
}

export async function approveApplicationAction(id) {
  const { userId } = await requireArea("content");
  const r = await approveApplication(getDb(), id, { userId, invite: inviteMember });
  revalidatePath("/admin/applications");
  if (!r.ok) return r;
  return { ok: true, invited: r.invited, inviteError: r.inviteError, memberName: r.member.name };
}

export async function declineApplicationAction(id, note) {
  const { userId } = await requireArea("content");
  const r = await declineApplication(getDb(), id, { userId, note });
  revalidatePath("/admin/applications");
  return r;
}
```

`app/admin/events/actions.js`:

```js
"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db.js";
import { requireArea } from "@/lib/auth.js";
import { pathsForEvent, revalidateAll } from "@/lib/revalidate.js";
import { saveEvent, setAttendance, moveToGoing, getEvent, listRsvps } from "@/lib/engagement/events.js";

export async function saveEventAction(input) {
  await requireArea("content");
  const r = await saveEvent(getDb(), input);
  if (r.ok) revalidateAll(pathsForEvent(r.event.slug));
  return r;
}

export async function setAttendanceAction(rsvpId, attended) {
  const { userId } = await requireArea("content");
  return setAttendance(getDb(), rsvpId, attended, { userId });
}

export async function moveToGoingAction(rsvpId, eventId) {
  await requireArea("content");
  const db = getDb();
  const r = await moveToGoing(db, rsvpId);
  if (r.ok) {
    const event = await getEvent(db, eventId);
    if (event) revalidateAll(pathsForEvent(event.slug));
    revalidatePath(`/admin/events/${eventId}`);
  }
  return r;
}

export async function rsvpsForEvent(eventId) {
  await requireArea("content");
  return listRsvps(getDb(), eventId);
}
```

`app/admin/payments/actions.js`:

```js
"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db.js";
import { requireArea } from "@/lib/auth.js";
import { SUPPORT_PATHS, revalidateAll } from "@/lib/revalidate.js";
import { confirmPayment, rejectPayment, saveCampaign, recordExpense } from "@/lib/engagement/money.js";

function refreshMoney() {
  revalidateAll(SUPPORT_PATHS);
  revalidatePath("/projects/[slug]", "page");
  revalidatePath("/admin/payments");
}

export async function confirmPaymentAction(id) {
  const { userId } = await requireArea("content");
  const r = await confirmPayment(getDb(), id, { userId });
  if (r.ok) refreshMoney();
  return r;
}

export async function rejectPaymentAction(id, note) {
  const { userId } = await requireArea("content");
  const r = await rejectPayment(getDb(), id, { userId, note });
  revalidatePath("/admin/payments");
  return r;
}

export async function saveCampaignAction(input) {
  await requireArea("content");
  const r = await saveCampaign(getDb(), input);
  if (r.ok) {
    refreshMoney();
    revalidatePath("/admin/campaigns");
  }
  return r;
}

export async function recordExpenseAction(input) {
  const { userId } = await requireArea("content");
  const r = await recordExpense(getDb(), input, { userId });
  if (r.ok) revalidatePath("/admin/expenses");
  return r;
}
```

In `app/admin/articles/actions.js`, add `import { logEvent } from "@/lib/evidence.js";` and change `publishArticleAction` to:

```js
export async function publishArticleAction(id, expectedUpdatedAt) {
  const { userId } = await requireArea("content");
  const db = getDb();
  const r = await publishArticle(db, id, { expectedUpdatedAt }, { userId });
  if (r.ok) {
    await logEvent(db, { type: "article_published", actor: userId, refTable: "articles", refId: r.article.id });
    revalidateAll(pathsForArticle(r.article.slug));
  }
  return r;
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add app/admin test
git commit -m "Add admin actions for applications, events and payments; log article publishing"
```

---

### Task 8: Public engagement pages and forms

**Files:**
- Create: `components/forms/Turnstile.jsx`, `components/forms/useSubmit.js`, `components/forms/FormStatus.jsx`, `components/forms/ApplicationForm.jsx`, `components/forms/RsvpForm.jsx`, `components/forms/VolunteerForm.jsx`, `components/forms/PledgeForm.jsx`, `components/ProgressBar.jsx`, `components/EventCard.jsx`, `app/events/page.jsx`, `app/events/[slug]/page.jsx`, `app/events/[slug]/ics/route.js`, `app/support/page.jsx`, `test/public-forms.test.jsx`
- Modify: `lib/seo.js`, `test/seo.test.js`, `lib/routes.js`, `app/sitemap.js`, `app/join/page.jsx`, `app/projects/[slug]/page.jsx`, `app/page.jsx`, `app/globals.css`

**Interfaces:**
- Produces: `eventLd(event)`; `buildSitemap({ routes, articles, projects, events })`; `<ProgressBar raisedCentavos goalCentavos label />`; form components.

- [ ] **Step 1: Write the failing tests**

`test/seo.test.js` (append; add `eventLd` to the import):

```js
describe("eventLd", () => {
  it("describes an in-person event in Roxas City with PH times", () => {
    const ld = eventLd({ slug: "ga", title: "General Assembly", description: "<p>Hi</p>", startAt: "2027-01-15T18:00", endAt: null, venue: "Capiz Gym", coverUrl: null });
    expect(ld).toMatchObject({
      "@type": "Event",
      name: "General Assembly",
      startDate: "2027-01-15T18:00:00+08:00",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      location: { "@type": "Place", name: "Capiz Gym", address: { addressLocality: "Roxas City" } },
      url: `${SITE.url}/events/ga`,
      description: "Hi",
    });
  });
});

describe("buildSitemap with events", () => {
  it("adds event pages", () => {
    const entries = buildSitemap({ routes: [], events: [{ slug: "ga", updatedAt: "2026-11-01T00:00:00.000Z" }] });
    expect(entries[0].url).toBe(`${SITE.url}/events/ga`);
  });
});
```

`test/public-forms.test.jsx`:

```jsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

const h = vi.hoisted(() => ({ rsvp: vi.fn() }));
vi.mock("@/app/actions/engagement.js", () => ({ rsvpAction: (i) => h.rsvp(i), applyAction: vi.fn(), volunteerAction: vi.fn(), pledgeAction: vi.fn() }));
vi.mock("next/script", () => ({ default: () => null }));

const { default: RsvpForm } = await import("@/components/forms/RsvpForm.jsx");
const { default: ProgressBar } = await import("@/components/ProgressBar.jsx");

afterEach(cleanup);

function fill() {
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ana Cruz" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@x.ph" } });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: /RSVP/ }));
}

describe("RsvpForm", () => {
  it("shows the confirmation and hides the form on success", async () => {
    h.rsvp.mockResolvedValue({ ok: true, message: "You're going!" });
    render(<RsvpForm eventId={3} full={false} />);
    fill();
    expect((await screen.findByRole("status")).textContent).toBe("You're going!");
    expect(screen.queryByLabelText("Name")).toBeNull();
    expect(h.rsvp.mock.calls[0][0]).toMatchObject({ eventId: 3, name: "Ana Cruz", email: "a@x.ph", consent: true });
  });

  it("keeps the form and shows errors on failure", async () => {
    h.rsvp.mockResolvedValue({ ok: false, errors: ["You're already on the list for this event"] });
    render(<RsvpForm eventId={3} full={false} />);
    fill();
    expect((await screen.findByRole("alert")).textContent).toContain("already on the list");
    expect(screen.getByLabelText("Name").value).toBe("Ana Cruz");
  });

  it("says when you are joining the waitlist", () => {
    render(<RsvpForm eventId={3} full />);
    expect(screen.getByRole("button", { name: "RSVP — join the waitlist" })).toBeTruthy();
  });
});

describe("ProgressBar", () => {
  it("reports progress accessibly and caps at 100%", () => {
    render(<ProgressBar raisedCentavos={3000000} goalCentavos={2000000} label="Coastal fund" />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("100");
    expect(screen.getByText("₱30,000 raised of ₱20,000")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run test/seo.test.js test/public-forms.test.jsx`
Expected: FAIL — `eventLd` missing; components not found.

- [ ] **Step 3: SEO helpers, routes and sitemap**

In `lib/seo.js`, replace the `buildSitemap` signature line and body with:

```js
export function buildSitemap({ routes, articles = [], projects = [], events = [] }) {
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
    ...events.map((e) => entry(`/events/${e.slug}`, e.updatedAt, 0.7)),
  ];
}
```

`lib/seo.js` (append):

```js
export function eventLd(event) {
  const ph = (local) => (local ? `${local.slice(0, 16)}:00+08:00` : undefined);
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: (event.description ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || undefined,
    startDate: ph(event.startAt),
    endDate: ph(event.endAt),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: event.venue ?? "Roxas City, Capiz",
      address: { "@type": "PostalAddress", addressLocality: SITE.address.locality, addressRegion: SITE.address.region, addressCountry: SITE.address.country },
    },
    image: event.coverUrl ?? absoluteUrl(SITE.ogImage),
    organizer: { "@type": "Organization", name: SITE.name, url: absoluteUrl("/") },
    url: absoluteUrl(`/events/${event.slug}`),
  };
}
```

`lib/routes.js`:

```js
export const STATIC_ROUTES = ["/", "/about", "/officers", "/projects", "/articles", "/events", "/resources", "/support", "/join"];

export const NAV_LINKS = [
  { href: "/about", label: "About" },
  { href: "/projects", label: "Projects" },
  { href: "/events", label: "Events" },
  { href: "/articles", label: "Articles" },
  { href: "/officers", label: "Officers" },
  { href: "/join", label: "Join" },
];
```

`app/sitemap.js`:

```js
import { STATIC_ROUTES } from "@/lib/routes.js";
import { buildSitemap } from "@/lib/seo.js";
import { getDb } from "@/lib/db.js";
import { listPublishedArticles } from "@/lib/content/articles.js";
import { listProjects } from "@/lib/queries.js";
import { listEvents } from "@/lib/engagement/events.js";

export const revalidate = 3600;

export default async function sitemap() {
  const db = getDb();
  const [articles, projects, { upcoming, past }] = await Promise.all([listPublishedArticles(db), listProjects(db), listEvents(db)]);
  return buildSitemap({ routes: STATIC_ROUTES, articles, projects, events: [...upcoming, ...past] });
}
```

- [ ] **Step 4: Form building blocks**

`components/forms/useSubmit.js`:

```js
"use client";

import { useState, useTransition } from "react";

export function useSubmit(action) {
  const [result, setResult] = useState(null);
  const [pending, start] = useTransition();
  const submit = (input) =>
    start(async () => {
      try {
        setResult(await action(input));
      } catch (e) {
        setResult({ ok: false, errors: [`Something went wrong (${e.message}). Please try again.`] });
      }
    });
  return { submit, pending, result };
}
```

`components/forms/FormStatus.jsx`:

```jsx
export default function FormStatus({ result }) {
  if (!result || result.ok) return null;
  return (
    <div className="form-errors" role="alert">
      <ul>{result.errors.map((e) => <li key={e}>{e}</li>)}</ul>
    </div>
  );
}
```

`components/forms/Turnstile.jsx`:

```jsx
"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

// Renders the Cloudflare Turnstile check when a site key is configured.
// Without one (local development) it renders nothing and the server skips the check.
export default function Turnstile({ onToken }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const ref = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!siteKey || !ready || !ref.current || !window.turnstile) return undefined;
    const id = window.turnstile.render(ref.current, {
      sitekey: siteKey,
      callback: (token) => onToken(token),
      "expired-callback": () => onToken(""),
    });
    return () => window.turnstile.remove(id);
  }, [siteKey, ready, onToken]);

  if (!siteKey) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="lazyOnload" onReady={() => setReady(true)} />
      <div ref={ref} className="turnstile" />
    </>
  );
}
```

`components/ProgressBar.jsx`:

```jsx
import { formatPesos } from "@/lib/format.js";

export default function ProgressBar({ raisedCentavos, goalCentavos, label }) {
  const pct = goalCentavos > 0 ? Math.min(100, Math.round((raisedCentavos / goalCentavos) * 100)) : 0;
  const text = `${formatPesos(raisedCentavos)} raised of ${formatPesos(goalCentavos)}`;
  return (
    <div className="progress-wrap">
      <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${label}: ${text}`}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="progress__text">{text}</p>
    </div>
  );
}
```

`components/forms/RsvpForm.jsx`:

```jsx
"use client";

import { useState } from "react";
import Turnstile from "./Turnstile.jsx";
import FormStatus from "./FormStatus.jsx";
import { useSubmit } from "./useSubmit.js";
import { rsvpAction } from "@/app/actions/engagement.js";

export default function RsvpForm({ eventId, full }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", consent: false });
  const [token, setToken] = useState("");
  const { submit, pending, result } = useSubmit(rsvpAction);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  if (result?.ok) return <p className="form-ok" role="status">{result.message}</p>;
  return (
    <form className="public-form" onSubmit={(e) => { e.preventDefault(); submit({ ...form, eventId, turnstileToken: token }); }}>
      <div className="field"><label htmlFor="rsvp-name">Name</label><input id="rsvp-name" value={form.name} onChange={set("name")} required autoComplete="name" /></div>
      <div className="field"><label htmlFor="rsvp-email">Email</label><input id="rsvp-email" type="email" value={form.email} onChange={set("email")} required autoComplete="email" /></div>
      <div className="field"><label htmlFor="rsvp-phone">Mobile (optional)</label><input id="rsvp-phone" value={form.phone} onChange={set("phone")} autoComplete="tel" /></div>
      <label className="consent"><input type="checkbox" checked={form.consent} onChange={set("consent")} required /> I agree that JCI Roxas Halaran may use these details for this event, under the Data Privacy Act of 2012.</label>
      <Turnstile onToken={setToken} />
      <FormStatus result={result} />
      <button className="btn" type="submit" disabled={pending}>{pending ? "Sending…" : full ? "RSVP — join the waitlist" : "RSVP"}</button>
    </form>
  );
}
```

`components/forms/ApplicationForm.jsx`:

```jsx
"use client";

import { useState } from "react";
import Turnstile from "./Turnstile.jsx";
import FormStatus from "./FormStatus.jsx";
import { useSubmit } from "./useSubmit.js";
import { applyAction } from "@/app/actions/engagement.js";

const EMPTY = { name: "", email: "", phone: "", birthdate: "", barangay: "", whyJoin: "", referredBy: "", consent: false };

export default function ApplicationForm() {
  const [form, setForm] = useState(EMPTY);
  const [token, setToken] = useState("");
  const { submit, pending, result } = useSubmit(applyAction);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  if (result?.ok) return <p className="form-ok" role="status">{result.message}</p>;
  return (
    <form className="public-form" onSubmit={(e) => { e.preventDefault(); submit({ ...form, turnstileToken: token }); }}>
      <div className="field"><label htmlFor="ap-name">Full name</label><input id="ap-name" value={form.name} onChange={set("name")} required autoComplete="name" /></div>
      <div className="field"><label htmlFor="ap-email">Email</label><input id="ap-email" type="email" value={form.email} onChange={set("email")} required autoComplete="email" /></div>
      <div className="field"><label htmlFor="ap-phone">Mobile</label><input id="ap-phone" value={form.phone} onChange={set("phone")} autoComplete="tel" /></div>
      <div className="field"><label htmlFor="ap-birth">Birthdate</label><input id="ap-birth" type="date" value={form.birthdate} onChange={set("birthdate")} required /></div>
      <div className="field"><label htmlFor="ap-brgy">Barangay</label><input id="ap-brgy" value={form.barangay} onChange={set("barangay")} /></div>
      <div className="field"><label htmlFor="ap-why">Why do you want to join?</label><textarea id="ap-why" rows={4} value={form.whyJoin} onChange={set("whyJoin")} /></div>
      <div className="field"><label htmlFor="ap-ref">Referred by (optional)</label><input id="ap-ref" value={form.referredBy} onChange={set("referredBy")} /></div>
      <label className="consent"><input type="checkbox" checked={form.consent} onChange={set("consent")} required /> I agree that JCI Roxas Halaran may use these details to process my application, under the Data Privacy Act of 2012.</label>
      <Turnstile onToken={setToken} />
      <FormStatus result={result} />
      <button className="btn" type="submit" disabled={pending}>{pending ? "Sending…" : "Apply"}</button>
    </form>
  );
}
```

`components/forms/VolunteerForm.jsx`:

```jsx
"use client";

import { useState } from "react";
import Turnstile from "./Turnstile.jsx";
import FormStatus from "./FormStatus.jsx";
import { useSubmit } from "./useSubmit.js";
import { volunteerAction } from "@/app/actions/engagement.js";

export default function VolunteerForm({ projectId = null, eventId = null }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", skills: "", consent: false });
  const [token, setToken] = useState("");
  const { submit, pending, result } = useSubmit(volunteerAction);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  if (result?.ok) return <p className="form-ok" role="status">{result.message}</p>;
  return (
    <form className="public-form" onSubmit={(e) => { e.preventDefault(); submit({ ...form, projectId, eventId, turnstileToken: token }); }}>
      <div className="field"><label htmlFor="vo-name">Name</label><input id="vo-name" value={form.name} onChange={set("name")} required autoComplete="name" /></div>
      <div className="field"><label htmlFor="vo-email">Email</label><input id="vo-email" type="email" value={form.email} onChange={set("email")} required autoComplete="email" /></div>
      <div className="field"><label htmlFor="vo-phone">Mobile (optional)</label><input id="vo-phone" value={form.phone} onChange={set("phone")} autoComplete="tel" /></div>
      <div className="field"><label htmlFor="vo-skills">How can you help? (optional)</label><input id="vo-skills" value={form.skills} onChange={set("skills")} placeholder="Photography, logistics, first aid…" /></div>
      <label className="consent"><input type="checkbox" checked={form.consent} onChange={set("consent")} required /> I agree that JCI Roxas Halaran may contact me about volunteering, under the Data Privacy Act of 2012.</label>
      <Turnstile onToken={setToken} />
      <FormStatus result={result} />
      <button className="btn" type="submit" disabled={pending}>{pending ? "Sending…" : "Volunteer"}</button>
    </form>
  );
}
```

`components/forms/PledgeForm.jsx`:

```jsx
"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";
import Turnstile from "./Turnstile.jsx";
import FormStatus from "./FormStatus.jsx";
import { useSubmit } from "./useSubmit.js";
import { pledgeAction } from "@/app/actions/engagement.js";
import { checkUpload } from "@/lib/uploads.js";

const MAX_PROOF = 5 * 1024 * 1024;

export default function PledgeForm({ campaigns, defaultCampaignId = "" }) {
  const [form, setForm] = useState({ campaignId: defaultCampaignId, type: "donation", payerName: "", payerEmail: "", amountPesos: "", method: "gcash", referenceNo: "", proofUrl: "", consent: false });
  const [token, setToken] = useState("");
  const [proofError, setProofError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const { submit, pending, result } = useSubmit(pledgeAction);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  async function attach(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const problem = checkUpload({ type: file.type, size: file.size }) ?? (file.type === "application/pdf" ? "Upload a screenshot image (JPG, PNG or WebP)." : null) ?? (file.size > MAX_PROOF ? "Screenshots must be 5 MB or smaller." : null);
    if (problem) { setProofError(problem); return; }
    setProofError(null);
    setUploading(true);
    try {
      const blob = await upload(file.name, file, { access: "public", handleUploadUrl: "/api/upload-proof", clientPayload: JSON.stringify({ turnstileToken: token }) });
      setForm((f) => ({ ...f, proofUrl: blob.url }));
    } catch (err) {
      setProofError(`Upload failed (${err.message}). You can still submit without a screenshot.`);
    } finally {
      setUploading(false);
    }
  }

  if (result?.ok) return <p className="form-ok" role="status">{result.message}</p>;
  return (
    <form className="public-form" onSubmit={(e) => { e.preventDefault(); submit({ ...form, turnstileToken: token }); }}>
      <div className="field">
        <label htmlFor="pl-for">What is this payment for?</label>
        <select id="pl-for" value={form.type === "donation" ? form.campaignId : form.type} onChange={(e) => {
          const v = e.target.value;
          setForm((f) => (v === "membership_fee" || v === "sponsorship" ? { ...f, type: v, campaignId: "" } : { ...f, type: "donation", campaignId: v }));
        }}>
          {campaigns.map((c) => <option key={c.id} value={c.id}>Donation: {c.title}</option>)}
          <option value="">General donation</option>
          <option value="sponsorship">Sponsorship</option>
          <option value="membership_fee">Membership fee</option>
        </select>
      </div>
      <div className="field"><label htmlFor="pl-name">Name</label><input id="pl-name" value={form.payerName} onChange={set("payerName")} required autoComplete="name" /></div>
      <div className="field"><label htmlFor="pl-email">Email</label><input id="pl-email" type="email" value={form.payerEmail} onChange={set("payerEmail")} required autoComplete="email" /></div>
      <div className="field"><label htmlFor="pl-amount">Amount (₱)</label><input id="pl-amount" type="number" min="1" step="0.01" value={form.amountPesos} onChange={set("amountPesos")} required inputMode="decimal" /></div>
      <div className="field">
        <label htmlFor="pl-method">Paid with</label>
        <select id="pl-method" value={form.method} onChange={set("method")}>
          <option value="gcash">GCash</option><option value="maya">Maya</option><option value="bank">Bank transfer</option>
        </select>
      </div>
      <div className="field"><label htmlFor="pl-ref">Reference number</label><input id="pl-ref" value={form.referenceNo} onChange={set("referenceNo")} required /></div>
      <div className="field">
        <label htmlFor="pl-proof">Receipt screenshot (optional)</label>
        <input id="pl-proof" type="file" accept="image/jpeg,image/png,image/webp" onChange={attach} />
        {uploading && <span className="count">Uploading…</span>}
        {form.proofUrl && <span className="count">Screenshot attached.</span>}
        {proofError && <p className="form-error" role="alert">{proofError}</p>}
      </div>
      <label className="consent"><input type="checkbox" checked={form.consent} onChange={set("consent")} required /> I agree that JCI Roxas Halaran may use these details to confirm my payment, under the Data Privacy Act of 2012.</label>
      <Turnstile onToken={setToken} />
      <FormStatus result={result} />
      <button className="btn" type="submit" disabled={pending || uploading}>{pending ? "Sending…" : "Submit payment details"}</button>
    </form>
  );
}
```

`components/EventCard.jsx`:

```jsx
import Link from "next/link";
import Image from "next/image";
import Contours from "@/components/Contours.jsx";
import { formatDateTime } from "@/lib/format.js";

export default function EventCard({ event }) {
  const spots = event.capacity ? Math.max(event.capacity - event.going, 0) : null;
  return (
    <article className="project">
      <Link href={`/events/${event.slug}`} className="article-card__link">
        <figure>
          {event.coverUrl ? (
            <Image src={event.coverUrl} alt={event.coverAlt ?? ""} fill sizes="(max-width: 900px) 100vw, 33vw" style={{ objectFit: "cover" }} />
          ) : (
            <div className="project__placeholder" aria-hidden="true"><Contours variant="quote" /><span>Event</span></div>
          )}
        </figure>
        <div className="project__meta">
          <h3>{event.title}</h3>
          <time className="label label--sm" dateTime={event.startAt}>{formatDateTime(event.startAt)}</time>
        </div>
        <p className="article-card__excerpt">
          {event.venue ?? "Roxas City"} · {spots === null ? "Open to all" : spots > 0 ? `${spots} spots left` : "Full — waitlist open"}
        </p>
      </Link>
    </article>
  );
}
```

- [ ] **Step 5: Pages**

`app/events/page.jsx`:

```jsx
import EventCard from "@/components/EventCard.jsx";
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import { getDb } from "@/lib/db.js";
import { listEvents } from "@/lib/engagement/events.js";
import { pageMetadata, breadcrumbLd } from "@/lib/seo.js";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: "Events",
  description: "Upcoming JCI Roxas Halaran events in Roxas City, Capiz: trainings, community projects and general assemblies. RSVP online.",
  path: "/events",
});

export default async function Events() {
  const { upcoming, past } = await listEvents(getDb());
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Events", path: "/events" }])} />
      <header className="page-hero">
        <h1>Events</h1>
        <p>Join us at our next training, project or assembly. Most events are open to guests.</p>
      </header>
      <section className="section">
        <div className="section__bar"><h2>Upcoming</h2><span className="label">RSVP online</span></div>
        {upcoming.length === 0 ? <p>New events are coming soon — follow our Facebook page for announcements.</p> : (
          <div className="projects">{upcoming.map((e) => <EventCard key={e.id} event={e} />)}</div>
        )}
      </section>
      {past.length > 0 && (
        <section className="section">
          <div className="section__bar"><h2>Past events</h2><span className="label">Archive</span></div>
          <div className="projects">{past.slice(0, 6).map((e) => <EventCard key={e.id} event={e} />)}</div>
        </section>
      )}
      <SiteFooter />
    </>
  );
}
```

`app/events/[slug]/page.jsx`:

```jsx
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import { SafeHtml } from "@/components/SafeHtml.jsx";
import RsvpForm from "@/components/forms/RsvpForm.jsx";
import VolunteerForm from "@/components/forms/VolunteerForm.jsx";
import { getDb } from "@/lib/db.js";
import { getEventBySlug, listEvents } from "@/lib/engagement/events.js";
import { formatDateTime, phNow } from "@/lib/format.js";
import { pageMetadata, breadcrumbLd, eventLd } from "@/lib/seo.js";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const { upcoming, past } = await listEvents(getDb());
  return [...upcoming, ...past].map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const event = await getEventBySlug(getDb(), slug);
  if (!event) return { title: "Page not found", robots: { index: false } };
  return pageMetadata({
    title: event.title,
    description: `${event.title} — ${formatDateTime(event.startAt)}${event.venue ? `, ${event.venue}` : ""}. RSVP to this JCI Roxas Halaran event.`,
    path: `/events/${slug}`,
  });
}

export default async function EventPage({ params }) {
  const { slug } = await params;
  const event = await getEventBySlug(getDb(), slug);
  if (!event) notFound();
  const isPast = (event.endAt || event.startAt) < phNow();
  const full = Boolean(event.capacity) && event.going >= event.capacity;
  return (
    <>
      <JsonLd data={eventLd(event)} />
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Events", path: "/events" }, { name: event.title, path: `/events/${slug}` }])} />
      <header className="page-hero">
        <p className="label">{formatDateTime(event.startAt)}{event.venue ? ` · ${event.venue}` : ""}</p>
        <h1>{event.title}</h1>
        <p><a href={`/events/${slug}/ics`}>Add to calendar</a>{event.capacity ? ` · ${Math.max(event.capacity - event.going, 0)} of ${event.capacity} spots left` : ""}</p>
      </header>
      {event.coverUrl && (
        <figure className="article__cover">
          <Image src={event.coverUrl} alt={event.coverAlt ?? event.title} fill sizes="100vw" style={{ objectFit: "cover" }} priority />
        </figure>
      )}
      <section className="section">
        {event.description ? <SafeHtml className="article-body" html={event.description} /> : null}
      </section>
      {!isPast && event.rsvpOpen && (
        <section className="section section--line-top" id="rsvp">
          <div className="section__bar"><h2>RSVP</h2><span className="label">{full ? "Waitlist" : "Free"}</span></div>
          <RsvpForm eventId={event.id} full={full} />
        </section>
      )}
      {!isPast && (
        <section className="section" id="volunteer">
          <div className="section__bar"><h2>Volunteer</h2><span className="label">Help out</span></div>
          <VolunteerForm eventId={event.id} />
        </section>
      )}
      <p className="section"><Link className="btn" href="/events">All events</Link></p>
      <SiteFooter />
    </>
  );
}
```

`app/events/[slug]/ics/route.js`:

```js
import { getDb } from "@/lib/db.js";
import { getEventBySlug } from "@/lib/engagement/events.js";
import { buildIcs } from "@/lib/ics.js";
import { SITE } from "@/lib/site.js";

export async function GET(_request, { params }) {
  const { slug } = await params;
  const event = await getEventBySlug(getDb(), slug);
  if (!event) return new Response("Not found", { status: 404 });
  return new Response(buildIcs(event, { siteUrl: SITE.url }), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.ics"`,
    },
  });
}
```

`app/support/page.jsx`:

```jsx
import Image from "next/image";
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import ProgressBar from "@/components/ProgressBar.jsx";
import PledgeForm from "@/components/forms/PledgeForm.jsx";
import { getDb } from "@/lib/db.js";
import { listCampaigns } from "@/lib/engagement/money.js";
import { pageMetadata, breadcrumbLd } from "@/lib/seo.js";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: "Support our projects",
  description: "Donate or sponsor JCI Roxas Halaran community projects in Capiz via GCash, Maya or bank transfer. See how much each campaign has raised.",
  path: "/support",
});

export default async function Support() {
  const campaigns = await listCampaigns(getDb(), { openOnly: true });
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Support our projects", path: "/support" }])} />
      <header className="page-hero">
        <h1>Support our projects</h1>
        <p>Every peso goes to community projects in Capiz. Only payments our treasurer has confirmed count toward each goal.</p>
      </header>
      {campaigns.map((c) => (
        <section className="section section--line-top campaign" id={c.slug} key={c.id}>
          <div className="section__bar"><h2>{c.title}</h2><span className="label">Campaign</span></div>
          <div className="campaign__grid">
            <div>
              {c.description && <p>{c.description}</p>}
              <ProgressBar raisedCentavos={c.raisedCentavos} goalCentavos={c.goalCentavos} label={c.title} />
              {c.paymentInstructions && <p className="campaign__how">{c.paymentInstructions}</p>}
            </div>
            {c.qrImageUrl && (
              <figure className="campaign__qr">
                <Image src={c.qrImageUrl} alt={c.qrImageAlt ?? `QR code for ${c.title}`} width={260} height={260} style={{ objectFit: "contain", height: "auto" }} />
              </figure>
            )}
          </div>
        </section>
      ))}
      <section className="section section--line-top" id="pledge">
        <div className="section__bar"><h2>Tell us you paid</h2><span className="label">Pledge</span></div>
        <p>After paying with the QR code, send us your reference number so we can confirm it.</p>
        <PledgeForm campaigns={campaigns.map((c) => ({ id: c.id, title: c.title }))} defaultCampaignId={campaigns[0] ? String(campaigns[0].id) : ""} />
      </section>
      <SiteFooter />
    </>
  );
}
```

In `app/join/page.jsx`, add the import `import ApplicationForm from "@/components/forms/ApplicationForm.jsx";` and insert before the `<section id="contact" …>` line:

```jsx
      <section id="apply" className="section">
        <div className="section__bar"><h2>Apply online</h2><span className="label">Membership</span></div>
        <p>Open to anyone aged 18 to 40. We'll review your application and contact you about orientation and dues.</p>
        <ApplicationForm />
      </section>
```

In `app/projects/[slug]/page.jsx`, add imports:

```jsx
import ProgressBar from "@/components/ProgressBar.jsx";
import VolunteerForm from "@/components/forms/VolunteerForm.jsx";
import { getCampaignForProject } from "@/lib/engagement/money.js";
```

load the campaign next to the stories:

```jsx
  const [stories, campaign] = await Promise.all([listArticlesForProject(db, project.id), getCampaignForProject(db, project.id)]);
```

(replacing `const stories = await listArticlesForProject(db, project.id);`), and insert before `<p className="section"><Link className="btn" href="/projects">All projects</Link></p>`:

```jsx
      {campaign && (
        <section className="section section--line-top">
          <div className="section__bar"><h2>Support this project</h2><span className="label">{campaign.title}</span></div>
          <ProgressBar raisedCentavos={campaign.raisedCentavos} goalCentavos={campaign.goalCentavos} label={campaign.title} />
          <p className="section__more"><Link className="btn" href={`/support#${campaign.slug}`}>Donate</Link></p>
        </section>
      )}
      <section className="section" id="volunteer">
        <div className="section__bar"><h2>Volunteer</h2><span className="label">Help out</span></div>
        <VolunteerForm projectId={project.id} />
      </section>
```

In `app/page.jsx`, add imports `import EventCard from "@/components/EventCard.jsx";` and `import { listEvents } from "@/lib/engagement/events.js";`, extend the `Promise.all` with `listEvents(db)` as a fourth item destructured to `events`, and insert after the projects section:

```jsx
      {events.upcoming.length > 0 && (
        <section className="section">
          <div className="section__bar">
            <h2>Upcoming events</h2>
            <span className="label">RSVP</span>
          </div>
          <div className="projects">{events.upcoming.slice(0, 3).map((e) => <EventCard key={e.id} event={e} />)}</div>
          <p className="section__more"><Link className="btn" href="/events">All events</Link></p>
        </section>
      )}
```

`app/globals.css` (append):

```css
/* ============================================================
   Engagement (Phase 3)
   ============================================================ */
.public-form { display: flex; flex-direction: column; gap: 16px; max-width: 560px; }
.consent { display: flex; gap: 10px; align-items: flex-start; font-size: 0.9rem; line-height: 1.5; color: rgba(237, 232, 223, 0.75); }
.consent input { margin-top: 4px; }
.progress-wrap { display: flex; flex-direction: column; gap: 8px; margin: 16px 0; }
.progress { height: 12px; background: rgba(237, 232, 223, 0.12); overflow: hidden; }
.progress span { display: block; height: 100%; background: var(--ochre); }
.progress__text { font-family: var(--font-space-grotesk), monospace; font-size: 0.85rem; letter-spacing: 0.06em; color: var(--dune); }
.campaign__grid { display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: 40px; align-items: start; }
.campaign__qr { margin: 0; background: #fff; padding: 12px; }
.campaign__how { margin-top: 16px; color: rgba(237, 232, 223, 0.8); white-space: pre-line; }
@media (max-width: 760px) { .campaign__grid { grid-template-columns: 1fr; } .campaign__qr { max-width: 260px; } }
```

- [ ] **Step 6: Run tests and build**

Run: `npx vitest run && NEXT_DIST_DIR=.next-check npx next build`
Expected: all PASS; build lists `/events`, `/events/[slug]`, `/events/[slug]/ics`, `/support`.

- [ ] **Step 7: Commit**

```bash
git add components app lib test
git commit -m "Add events, support and application pages with RSVP, volunteer and pledge forms"
```

---

### Task 9: Admin engagement screens

**Files:**
- Create: `components/admin/ApplicationActions.jsx`, `components/admin/EventEditor.jsx`, `components/admin/RsvpTable.jsx`, `components/admin/PaymentActions.jsx`, `components/admin/CampaignForm.jsx`, `components/admin/ExpenseForm.jsx`, `app/admin/applications/page.jsx`, `app/admin/events/page.jsx`, `app/admin/events/new/page.jsx`, `app/admin/events/[id]/page.jsx`, `app/admin/events/[id]/rsvps.csv/route.js`, `app/admin/payments/page.jsx`, `app/admin/campaigns/page.jsx`, `app/admin/expenses/page.jsx`
- Modify: `components/admin/AdminNav.jsx`, `app/admin/page.jsx`

**Interfaces:**
- Consumes: Task 3–7 stores and actions; `FileUpload`, `RichTextEditor`.

This task wires UI to tested stores and actions; its checks are the build, the signed-out e2e redirects (Task 10) and the manual run-through (Task 11).

- [ ] **Step 1: Navigation and dashboard**

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
          <Link href="/admin/events">Events</Link>
          <Link href="/admin/applications">Applications</Link>
          <Link href="/admin/payments">Payments</Link>
          <Link href="/admin/campaigns">Campaigns</Link>
          <Link href="/admin/expenses">Expenses</Link>
          <Link href="/admin/resources">Resources</Link>
          <Link href="/admin/seo-plan">SEO plan</Link>
        </>
      )}
    </nav>
  );
}
```

In `app/admin/page.jsx`, add imports:

```jsx
import { listApplications } from "@/lib/engagement/applications.js";
import { listPayments } from "@/lib/engagement/money.js";
import { listEvents } from "@/lib/engagement/events.js";
import { formatDateTime } from "@/lib/format.js";
```

replace the data loading with:

```jsx
  const [progress, drafts, apps, pendingPayments, events] = isAdmin
    ? await Promise.all([
        monthProgress(db, month),
        listArticlesAdmin(db, { status: "draft" }),
        listApplications(db),
        listPayments(db, { status: "pending" }),
        listEvents(db),
      ])
    : [null, [], [], [], { upcoming: [] }];
  const pendingApps = apps.filter((a) => a.status === "pending").length;
  const next = events.upcoming[0];
```

and insert, inside the `isAdmin` fragment before the SEO plan section:

```jsx
          <section>
            <h2 className="syne">To do</h2>
            <ul>
              <li><Link href="/admin/applications">{pendingApps} pending application{pendingApps === 1 ? "" : "s"}</Link></li>
              <li><Link href="/admin/payments">{pendingPayments.length} payment{pendingPayments.length === 1 ? "" : "s"} to confirm</Link></li>
              <li>{next ? <Link href={`/admin/events/${next.id}`}>Next event: {next.title}, {formatDateTime(next.startAt)} — {next.going} going</Link> : <Link href="/admin/events/new">No upcoming events — create one</Link>}</li>
            </ul>
          </section>
```

- [ ] **Step 2: Applications**

`components/admin/ApplicationActions.jsx`:

```jsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveApplicationAction, declineApplicationAction } from "@/app/admin/applications/actions.js";

export default function ApplicationActions({ id }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [message, setMessage] = useState(null);
  const [pending, start] = useTransition();

  const run = (fn) => start(async () => {
    try {
      const r = await fn();
      if (!r.ok) { setMessage(r.errors.join(" ")); return; }
      setMessage(r.inviteError ? `Approved — the invitation email failed (${r.inviteError}); resend it from Clerk.` : r.invited ? "Approved — invitation sent." : "Done.");
      router.refresh();
    } catch (e) {
      setMessage(`Couldn't save (${e.message}).`);
    }
  });

  return (
    <div className="actions">
      <button type="button" className="btn" disabled={pending} onClick={() => run(() => approveApplicationAction(id))}>Approve</button>
      <input aria-label="Reason for declining (optional)" placeholder="Reason (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <button type="button" className="btn btn--ghost" disabled={pending} onClick={() => run(() => declineApplicationAction(id, note))}>Decline</button>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
```

`app/admin/applications/page.jsx`:

```jsx
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listApplications } from "@/lib/engagement/applications.js";
import { formatDate } from "@/lib/format.js";
import AdminNav from "@/components/admin/AdminNav.jsx";
import ApplicationActions from "@/components/admin/ApplicationActions.jsx";

export const metadata = { title: "Applications — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminApplications() {
  await requireArea("content");
  const list = await listApplications(getDb());
  return (
    <div className="admin">
      <h1>Applications</h1>
      <AdminNav isAdmin />
      <table className="admin-table">
        <thead><tr><th>Applicant</th><th>Details</th><th>Received</th><th>Status</th></tr></thead>
        <tbody>
          {list.map((a) => (
            <tr key={a.id}>
              <td><strong>{a.name}</strong><br />{a.email}{a.phone ? <><br />{a.phone}</> : null}</td>
              <td>Born {a.birthdate}{a.barangay ? `, ${a.barangay}` : ""}{a.whyJoin ? <><br />“{a.whyJoin}”</> : null}{a.referredBy ? <><br />Referred by {a.referredBy}</> : null}</td>
              <td>{formatDate(a.createdAt)}</td>
              <td>{a.status === "pending" ? <ApplicationActions id={a.id} /> : `${a.status}${a.note ? ` — ${a.note}` : ""}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.length === 0 && <p>No applications yet.</p>}
    </div>
  );
}
```

- [ ] **Step 3: Events**

`components/admin/EventEditor.jsx`:

```jsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import RichTextEditor from "./RichTextEditor.jsx";
import FileUpload from "./FileUpload.jsx";
import { saveEventAction } from "@/app/admin/events/actions.js";

export default function EventEditor({ event, projects }) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: event?.title ?? "",
    slug: "",
    startAt: event?.startAt ?? "",
    endAt: event?.endAt ?? "",
    venue: event?.venue ?? "",
    capacity: event?.capacity ?? "",
    rsvpOpen: event?.rsvpOpen ?? true,
    projectId: event?.projectId ?? "",
    coverUrl: event?.coverUrl ?? "",
    coverAlt: event?.coverAlt ?? "",
    descriptionJson: event?.descriptionJson ?? "",
    descriptionHtml: event?.description ?? "",
  });
  const [meta, setMeta] = useState(event ? { id: event.id, updatedAt: event.updatedAt, slug: event.slug } : null);
  const [errors, setErrors] = useState([]);
  const [notice, setNotice] = useState(null);
  const [pending, start] = useTransition();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const save = () => start(async () => {
    try {
      const r = await saveEventAction({ ...form, id: meta?.id, expectedUpdatedAt: meta?.updatedAt });
      if (!r.ok) { setErrors(r.errors); return; }
      setErrors([]);
      setNotice("Saved — live now.");
      setMeta({ id: r.event.id, updatedAt: r.event.updatedAt, slug: r.event.slug });
      if (!event) router.replace(`/admin/events/${r.event.id}`);
    } catch (e) {
      setErrors([`Couldn't save (${e.message}). Your changes are still here — try again.`]);
    }
  });

  return (
    <div className="editor">
      <div>
        <input className="title-input" aria-label="Title" placeholder="Event title" value={form.title} onChange={set("title")} />
        {errors.length > 0 && <div className="form-errors" role="alert"><ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul></div>}
        {notice && <p className="form-ok" role="status">{notice}</p>}
        <RichTextEditor initialJson={event?.descriptionJson ?? null} onChange={({ json, html }) => setForm((f) => ({ ...f, descriptionJson: json, descriptionHtml: html }))} />
      </div>
      <aside className="editor__side">
        <div className="actions">
          <button type="button" className="btn" disabled={pending} onClick={save}>Save</button>
          {meta && <a href={`/events/${meta.slug}`} target="_blank" rel="noreferrer">View</a>}
        </div>
        {!event && <div className="field"><label htmlFor="ev-slug">Address (optional)</label><input id="ev-slug" value={form.slug} onChange={set("slug")} placeholder="made from the title" /></div>}
        <div className="field"><label htmlFor="ev-start">Starts (Philippine time)</label><input id="ev-start" type="datetime-local" value={form.startAt} onChange={set("startAt")} /></div>
        <div className="field"><label htmlFor="ev-end">Ends (optional)</label><input id="ev-end" type="datetime-local" value={form.endAt} onChange={set("endAt")} /></div>
        <div className="field"><label htmlFor="ev-venue">Venue</label><input id="ev-venue" value={form.venue} onChange={set("venue")} /></div>
        <div className="field"><label htmlFor="ev-cap">Capacity (empty = unlimited)</label><input id="ev-cap" type="number" min="1" value={form.capacity} onChange={set("capacity")} /></div>
        <label className="consent"><input type="checkbox" checked={form.rsvpOpen} onChange={set("rsvpOpen")} /> RSVPs open</label>
        <div className="field">
          <label htmlFor="ev-proj">Related project</label>
          <select id="ev-proj" value={form.projectId} onChange={set("projectId")}>
            <option value="">None</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
        {form.coverUrl ? (
          <div className="field">
            <span className="count">Cover image</span>
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

`components/admin/RsvpTable.jsx`:

```jsx
"use client";

import { useState, useTransition } from "react";
import { setAttendanceAction, moveToGoingAction } from "@/app/admin/events/actions.js";

export default function RsvpTable({ eventId, rsvps: initial }) {
  const [rsvps, setRsvps] = useState(initial);
  const [error, setError] = useState(null);
  const [pending, start] = useTransition();
  const update = (id, patch) => setRsvps((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const attend = (r, attended) => start(async () => {
    try {
      const res = await setAttendanceAction(r.id, attended);
      if (res.ok) update(r.id, { attended }); else setError(res.errors.join(" "));
    } catch (e) { setError(`Couldn't save (${e.message}).`); }
  });
  const promote = (r) => start(async () => {
    try {
      const res = await moveToGoingAction(r.id, eventId);
      if (res.ok) update(r.id, { status: "going" }); else setError(res.errors.join(" "));
    } catch (e) { setError(`Couldn't save (${e.message}).`); }
  });

  const count = (s) => rsvps.filter((r) => r.status === s).length;
  return (
    <section>
      <h2 className="syne">RSVPs — {count("going")} going, {count("waitlist")} waitlist</h2>
      <p><a href={`/admin/events/${eventId}/rsvps.csv`}>Download CSV</a></p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <table className="admin-table">
        <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Attended</th></tr></thead>
        <tbody>
          {rsvps.map((r) => (
            <tr key={r.id}>
              <td>{r.name}{r.phone ? <><br />{r.phone}</> : null}</td>
              <td>{r.email}</td>
              <td>{r.status}{r.status === "waitlist" && <> <button type="button" className="tool" disabled={pending} onClick={() => promote(r)}>Move to going</button></>}</td>
              <td><input type="checkbox" aria-label={`${r.name} attended`} checked={r.attended} disabled={pending} onChange={(e) => attend(r, e.target.checked)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
```

`app/admin/events/page.jsx`:

```jsx
import Link from "next/link";
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listEvents } from "@/lib/engagement/events.js";
import { formatDateTime } from "@/lib/format.js";
import AdminNav from "@/components/admin/AdminNav.jsx";

export const metadata = { title: "Events — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminEvents() {
  await requireArea("content");
  const { upcoming, past } = await listEvents(getDb());
  const row = (e) => (
    <tr key={e.id}>
      <td><Link href={`/admin/events/${e.id}`}>{e.title}</Link></td>
      <td>{formatDateTime(e.startAt)}</td>
      <td>{e.going}{e.capacity ? ` / ${e.capacity}` : ""}{e.waitlist ? ` (+${e.waitlist} waitlist)` : ""}</td>
      <td>{e.rsvpOpen ? "Open" : "Closed"}</td>
    </tr>
  );
  return (
    <div className="admin">
      <h1>Events</h1>
      <AdminNav isAdmin />
      <p><Link className="btn" href="/admin/events/new">New event</Link></p>
      <table className="admin-table">
        <thead><tr><th>Event</th><th>When</th><th>Going</th><th>RSVP</th></tr></thead>
        <tbody>{upcoming.map(row)}{past.map(row)}</tbody>
      </table>
    </div>
  );
}
```

`app/admin/events/new/page.jsx`:

```jsx
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listProjects } from "@/lib/queries.js";
import AdminNav from "@/components/admin/AdminNav.jsx";
import EventEditor from "@/components/admin/EventEditor.jsx";

export const metadata = { title: "New event — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NewEvent() {
  await requireArea("content");
  const projects = await listProjects(getDb());
  return (
    <div className="admin">
      <AdminNav isAdmin />
      <h1>New event</h1>
      <EventEditor event={null} projects={projects} />
    </div>
  );
}
```

`app/admin/events/[id]/page.jsx`:

```jsx
import { notFound } from "next/navigation";
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listProjects } from "@/lib/queries.js";
import { getEvent, listRsvps } from "@/lib/engagement/events.js";
import AdminNav from "@/components/admin/AdminNav.jsx";
import EventEditor from "@/components/admin/EventEditor.jsx";
import RsvpTable from "@/components/admin/RsvpTable.jsx";

export const metadata = { title: "Edit event — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function EditEvent({ params }) {
  await requireArea("content");
  const { id } = await params;
  const db = getDb();
  const event = await getEvent(db, id);
  if (!event) notFound();
  const [projects, rsvps] = await Promise.all([listProjects(db), listRsvps(db, event.id)]);
  return (
    <div className="admin">
      <AdminNav isAdmin />
      <h1>Edit event</h1>
      <EventEditor event={event} projects={projects} />
      <RsvpTable eventId={event.id} rsvps={rsvps} />
    </div>
  );
}
```

`app/admin/events/[id]/rsvps.csv/route.js`:

```js
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { getEvent, listRsvps } from "@/lib/engagement/events.js";

const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export async function GET(_request, { params }) {
  await requireArea("content");
  const { id } = await params;
  const db = getDb();
  const event = await getEvent(db, id);
  if (!event) return new Response("Not found", { status: 404 });
  const rows = await listRsvps(db, event.id);
  const csv = [
    ["Name", "Email", "Phone", "Status", "Attended", "RSVP time"].map(cell).join(","),
    ...rows.map((r) => [r.name, r.email, r.phone, r.status, r.attended ? "yes" : "no", r.createdAt].map(cell).join(",")),
  ].join("\r\n");
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${event.slug}-rsvps.csv"` },
  });
}
```

- [ ] **Step 4: Payments, campaigns and expenses**

`components/admin/PaymentActions.jsx`:

```jsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmPaymentAction, rejectPaymentAction } from "@/app/admin/payments/actions.js";

export default function PaymentActions({ id }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [message, setMessage] = useState(null);
  const [pending, start] = useTransition();
  const run = (fn) => start(async () => {
    try {
      const r = await fn();
      if (!r.ok) { setMessage(r.errors.join(" ")); return; }
      router.refresh();
    } catch (e) {
      setMessage(`Couldn't save (${e.message}).`);
    }
  });
  return (
    <div className="actions">
      <button type="button" className="btn" disabled={pending} onClick={() => run(() => confirmPaymentAction(id))}>Confirm</button>
      <input aria-label="Reason for rejecting" placeholder="Reason" value={note} onChange={(e) => setNote(e.target.value)} />
      <button type="button" className="btn btn--ghost" disabled={pending} onClick={() => run(() => rejectPaymentAction(id, note))}>Reject</button>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
```

`app/admin/payments/page.jsx`:

```jsx
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listPayments, listCampaigns } from "@/lib/engagement/money.js";
import { formatDate, formatPesos } from "@/lib/format.js";
import AdminNav from "@/components/admin/AdminNav.jsx";
import PaymentActions from "@/components/admin/PaymentActions.jsx";

export const metadata = { title: "Payments — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const TYPE = { donation: "Donation", sponsorship: "Sponsorship", membership_fee: "Membership fee" };

export default async function AdminPayments() {
  await requireArea("content");
  const db = getDb();
  const [list, campaigns] = await Promise.all([listPayments(db), listCampaigns(db)]);
  const campaignName = (id) => campaigns.find((c) => c.id === id)?.title ?? "General";
  const table = (rows, actions) => (
    <table className="admin-table">
      <thead><tr><th>Payer</th><th>Amount</th><th>For</th><th>Reference</th><th>Date</th><th>{actions ? "Review" : "Status"}</th></tr></thead>
      <tbody>
        {rows.map((p) => (
          <tr key={p.id}>
            <td>{p.payerName}<br />{p.payerEmail}</td>
            <td>{formatPesos(p.amountCentavos)}</td>
            <td>{TYPE[p.type]}{p.type === "donation" ? `: ${campaignName(p.campaignId)}` : ""}</td>
            <td>{p.method.toUpperCase()} {p.referenceNo}{p.proofUrl ? <><br /><a href={p.proofUrl} target="_blank" rel="noreferrer">Screenshot</a></> : null}</td>
            <td>{formatDate(p.createdAt)}</td>
            <td>{actions ? <PaymentActions id={p.id} /> : `${p.status}${p.note ? ` — ${p.note}` : ""}`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  const pending = list.filter((p) => p.status === "pending");
  return (
    <div className="admin">
      <h1>Payments</h1>
      <AdminNav isAdmin />
      <p>Check each reference number in the GCash, Maya or bank app before confirming. Only confirmed payments count toward campaign goals.</p>
      <h2 className="syne">To confirm ({pending.length})</h2>
      {pending.length ? table(pending, true) : <p>Nothing to confirm.</p>}
      <h2 className="syne">Reviewed</h2>
      {table(list.filter((p) => p.status !== "pending"), false)}
    </div>
  );
}
```

`components/admin/CampaignForm.jsx`:

```jsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import FileUpload from "./FileUpload.jsx";
import { saveCampaignAction } from "@/app/admin/payments/actions.js";

export default function CampaignForm({ campaign, projects }) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: campaign?.title ?? "",
    description: campaign?.description ?? "",
    projectId: campaign?.projectId ?? "",
    goalPesos: campaign ? campaign.goalCentavos / 100 : "",
    qrImageUrl: campaign?.qrImageUrl ?? "",
    qrImageAlt: campaign?.qrImageAlt ?? "",
    paymentInstructions: campaign?.paymentInstructions ?? "",
    open: campaign?.open ?? true,
  });
  const [errors, setErrors] = useState([]);
  const [pending, start] = useTransition();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const save = () => start(async () => {
    try {
      const r = await saveCampaignAction({ ...form, id: campaign?.id });
      if (!r.ok) { setErrors(r.errors); return; }
      setErrors([]);
      router.replace("/admin/campaigns");
      router.refresh();
    } catch (e) {
      setErrors([`Couldn't save (${e.message}).`]);
    }
  });

  return (
    <section className="editor__side">
      <h2 className="syne">{campaign ? `Edit: ${campaign.title}` : "New campaign"}</h2>
      {errors.length > 0 && <div className="form-errors" role="alert"><ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul></div>}
      <div className="field"><label htmlFor="ca-title">Title</label><input id="ca-title" value={form.title} onChange={set("title")} /></div>
      <div className="field"><label htmlFor="ca-desc">Description</label><textarea id="ca-desc" rows={3} value={form.description} onChange={set("description")} /></div>
      <div className="field"><label htmlFor="ca-goal">Goal (₱)</label><input id="ca-goal" type="number" min="1" value={form.goalPesos} onChange={set("goalPesos")} /></div>
      <div className="field">
        <label htmlFor="ca-proj">Project</label>
        <select id="ca-proj" value={form.projectId} onChange={set("projectId")}>
          <option value="">None</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </div>
      <div className="field"><label htmlFor="ca-how">Payment instructions</label><textarea id="ca-how" rows={3} value={form.paymentInstructions} onChange={set("paymentInstructions")} placeholder="GCash 0917 000 0000 — Juan Dela Cruz" /></div>
      {form.qrImageUrl ? (
        <div className="field">
          <span className="count">QR image</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={form.qrImageUrl} alt={form.qrImageAlt} style={{ maxWidth: 200 }} />
          <input aria-label="QR alt text" value={form.qrImageAlt} onChange={set("qrImageAlt")} />
          <button type="button" className="tool" onClick={() => setForm((f) => ({ ...f, qrImageUrl: "", qrImageAlt: "" }))}>Remove QR</button>
        </div>
      ) : (
        <FileUpload accept="image/jpeg,image/png,image/webp" requireAlt label="QR image" onUploaded={({ url, alt }) => setForm((f) => ({ ...f, qrImageUrl: url, qrImageAlt: alt }))} />
      )}
      <label className="consent"><input type="checkbox" checked={form.open} onChange={set("open")} /> Open for donations</label>
      <button type="button" className="btn" disabled={pending} onClick={save}>Save campaign</button>
    </section>
  );
}
```

`app/admin/campaigns/page.jsx`:

```jsx
import Link from "next/link";
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listProjects } from "@/lib/queries.js";
import { listCampaigns } from "@/lib/engagement/money.js";
import { formatPesos } from "@/lib/format.js";
import AdminNav from "@/components/admin/AdminNav.jsx";
import CampaignForm from "@/components/admin/CampaignForm.jsx";

export const metadata = { title: "Campaigns — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminCampaigns({ searchParams }) {
  await requireArea("content");
  const { id } = await searchParams;
  const db = getDb();
  const [campaigns, projects] = await Promise.all([listCampaigns(db), listProjects(db)]);
  const editing = campaigns.find((c) => String(c.id) === id) ?? null;
  return (
    <div className="admin">
      <h1>Campaigns</h1>
      <AdminNav isAdmin />
      <table className="admin-table">
        <thead><tr><th>Campaign</th><th>Raised</th><th>Goal</th><th>Status</th></tr></thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={c.id}>
              <td><Link href={`/admin/campaigns?id=${c.id}`}>{c.title}</Link></td>
              <td>{formatPesos(c.raisedCentavos)}</td>
              <td>{formatPesos(c.goalCentavos)}</td>
              <td>{c.open ? "Open" : "Closed"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p><Link href="/admin/campaigns">New campaign</Link></p>
      <CampaignForm key={editing?.id ?? "new"} campaign={editing} projects={projects} />
    </div>
  );
}
```

`components/admin/ExpenseForm.jsx`:

```jsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import FileUpload from "./FileUpload.jsx";
import { recordExpenseAction } from "@/app/admin/payments/actions.js";

const EMPTY = { amountPesos: "", description: "", spentOn: "", projectId: "", campaignId: "", receiptUrl: "" };

export default function ExpenseForm({ projects, campaigns }) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState([]);
  const [pending, start] = useTransition();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = () => start(async () => {
    try {
      const r = await recordExpenseAction(form);
      if (!r.ok) { setErrors(r.errors); return; }
      setErrors([]);
      setForm(EMPTY);
      router.refresh();
    } catch (e) {
      setErrors([`Couldn't save (${e.message}).`]);
    }
  });
  return (
    <section className="editor__side">
      <h2 className="syne">Record an expense</h2>
      {errors.length > 0 && <div className="form-errors" role="alert"><ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul></div>}
      <div className="field"><label htmlFor="ex-amt">Amount (₱)</label><input id="ex-amt" type="number" min="0.01" step="0.01" value={form.amountPesos} onChange={set("amountPesos")} /></div>
      <div className="field"><label htmlFor="ex-desc">What was it for?</label><input id="ex-desc" value={form.description} onChange={set("description")} /></div>
      <div className="field"><label htmlFor="ex-date">Date</label><input id="ex-date" type="date" value={form.spentOn} onChange={set("spentOn")} /></div>
      <div className="field">
        <label htmlFor="ex-proj">Project</label>
        <select id="ex-proj" value={form.projectId} onChange={set("projectId")}>
          <option value="">None</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="ex-camp">Campaign</label>
        <select id="ex-camp" value={form.campaignId} onChange={set("campaignId")}>
          <option value="">None</option>
          {campaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </div>
      {form.receiptUrl ? <p>Receipt attached.</p> : (
        <FileUpload accept="image/jpeg,image/png,image/webp,application/pdf" label="Receipt (optional)" onUploaded={({ url }) => setForm((f) => ({ ...f, receiptUrl: url }))} />
      )}
      <button type="button" className="btn" disabled={pending} onClick={save}>Record expense</button>
    </section>
  );
}
```

`app/admin/expenses/page.jsx`:

```jsx
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listProjects } from "@/lib/queries.js";
import { listCampaigns, listExpenses } from "@/lib/engagement/money.js";
import { formatDate, formatPesos } from "@/lib/format.js";
import AdminNav from "@/components/admin/AdminNav.jsx";
import ExpenseForm from "@/components/admin/ExpenseForm.jsx";

export const metadata = { title: "Expenses — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminExpenses() {
  await requireArea("content");
  const db = getDb();
  const [expenses, projects, campaigns] = await Promise.all([listExpenses(db), listProjects(db), listCampaigns(db)]);
  const total = expenses.reduce((s, e) => s + e.amountCentavos, 0);
  return (
    <div className="admin">
      <h1>Expenses</h1>
      <AdminNav isAdmin />
      <ExpenseForm projects={projects} campaigns={campaigns} />
      <p>Total recorded: {formatPesos(total)}</p>
      <table className="admin-table">
        <thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Receipt</th></tr></thead>
        <tbody>
          {expenses.map((e) => (
            <tr key={e.id}>
              <td>{formatDate(e.spentOn)}</td>
              <td>{e.description}</td>
              <td>{formatPesos(e.amountCentavos)}</td>
              <td>{e.receiptUrl ? <a href={e.receiptUrl} target="_blank" rel="noreferrer">View</a> : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: Build**

Run: `npx vitest run && NEXT_DIST_DIR=.next-check npx next build`
Expected: tests PASS; build lists the new `/admin/*` routes.

- [ ] **Step 6: Commit**

```bash
git add components/admin app/admin
git commit -m "Add admin screens for applications, events, payments, campaigns and expenses"
```

---

### Task 10: End-to-end checks for engagement

**Files:**
- Modify: `scripts/prepare-e2e-db.mjs`, `playwright.config.js`, `e2e/site.spec.js`

- [ ] **Step 1: Seed an event and a campaign; disable Turnstile and email for e2e**

In `scripts/prepare-e2e-db.mjs`, add imports:

```js
import { saveEvent } from "../lib/engagement/events.js";
import { saveCampaign } from "../lib/engagement/money.js";
```

and before the final `console.log("e2e.db ready.");`:

```js
await saveEvent(db, { title: "General Assembly 2027", startAt: "2099-01-15T18:00", venue: "Capiz Provincial Gym", capacity: 1 });
await saveCampaign(db, {
  title: "Coastal Cleanup Fund",
  goalPesos: 20000,
  qrImageUrl: "/assets/img/logo-site.png",
  qrImageAlt: "GCash QR code for the Coastal Cleanup Fund",
  paymentInstructions: "GCash 0917 000 0000 — JCI Roxas Halaran",
});
```

In `playwright.config.js`, extend `webServer.env`:

```js
    env: {
      TURSO_DATABASE_URL: "file:e2e.db",
      TURSO_AUTH_TOKEN: "",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3100",
      TURNSTILE_SECRET_KEY: "",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
      RESEND_API_KEY: "",
    },
```

- [ ] **Step 2: Add the tests**

`e2e/site.spec.js` (append):

```js
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
  await expect(page.getByRole("status")).toContainText("You're going!");
  await rsvp("Ana Cruz", "ANA.E2E@example.ph");
  await expect(page.getByRole("alert")).toContainText("already on the list");
  await rsvp("Ben Reyes", "ben.e2e@example.ph");
  await expect(page.getByRole("status")).toContainText("waitlist");
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
```

- [ ] **Step 3: Run the whole e2e suite**

Run: `npx playwright test`
Expected: all PASS — including `/events` and `/support` in the per-route checks (one h1, unique title, canonical, no clipping at 375px, no broken images, no Clerk script).

- [ ] **Step 4: Commit**

```bash
git add scripts/prepare-e2e-db.mjs playwright.config.js e2e/site.spec.js
git commit -m "Add end-to-end checks for events, RSVPs, applications and pledges"
```

---

### Task 11: Migrate, deploy the preview and hand over

**Files:**
- Modify: Obsidian `Projects/JCI Roxas Halaran/JCI Roxas Halaran — Bid Evidence Log.md`

- [ ] **Step 1: Migrate Turso**

Run: `npm run db:migrate`
Expected: `Migrations applied.` Check: `node --env-file=.env.local -e 'import("@libsql/client").then(async ({createClient}) => { const c = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN }); console.log((await c.execute("select name from sqlite_master where type=\"table\" and name in (\"events\",\"rsvps\",\"payments\",\"events_log\")")).rows.length); })'` → `4`.

- [ ] **Step 2: Push and check the preview**

Run: `git push`, wait for the Preview to be Ready (`vercel ls jci-roxas-halaran`), then `vercel curl /events --deployment <url>` and `/support` → 200; `/admin/applications` → 307 to sign-in.

- [ ] **Step 3: Record and hand over**

Add a milestone row to the Bid Evidence Log ("Phase 3 engagement built: applications, events/RSVP, volunteers, pledges, evidence log"). Hand the user the manual run-through: create an event, RSVP from a phone, approve a test application (invitation email arrives), create a campaign with the chapter's QR, pledge, confirm, see the progress bar move. Remind: Turnstile and Resend keys (spec §7).
