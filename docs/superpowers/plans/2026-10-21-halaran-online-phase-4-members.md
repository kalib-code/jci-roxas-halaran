# Halaran Online — Phase 4: Members Area and Hiligaynon — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Signed-in members get a home, a profile, a member directory, a Leadership Passport, a library and their event history; admins manage member records and verify passport entries; home/join/support/events get Hiligaynon twins hidden behind a flag.

**Architecture:** Same layering as Phases 2–3. Stores in `lib/members/*` take `db` and are tested on in-memory SQLite. `currentMember()` resolves the signed-in Clerk user to a member record (by id, else by email, then stores the link). Members pages live under `app/members` behind `requireArea("members")`; admin screens use `requireArea("content")`. Public pages that get Hiligaynon twins move their body into `components/pages/*Page.jsx` with a `lang` prop; `app/<route>/page.jsx` and `app/hil/<route>/page.jsx` are thin wrappers.

**Tech Stack:** Next.js 15 App Router (JS), Drizzle + Turso, Clerk v6, Vercel Blob 1, Zod 3, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-21-halaran-online-phase-4-design.md` (parent: `docs/superpowers/specs/2026-10-21-halaran-online-design.md`).

**Code blocks:** whole files are introduced by `` `path`: ``; appends by `` `path` (append): ``; other edits are exact old/new text.

## Global Constraints

- JavaScript only; `.jsx` for JSX. Stores return `{ ok: true, … } | { ok: false, errors: string[] }`.
- Members area: `requireArea("members")` (roles member/officer/treasurer/admin). Admin screens: `requireArea("content")` (admin only).
- A member can only change their own record: actions resolve the member from the session, never from client input.
- Linking by email only claims a member record whose `clerk_user_id` is empty.
- No member email or phone appears in the directory or any public page.
- Passport default points: training 2, project_led 5, project_joined 1, award 5, position 3. Officer terms count as positions (3 points each) and are read from `officer_terms`, not stored as entries.
- Hiligaynon routes exist only when `NEXT_PUBLIC_HILIGAYNON === "on"`; otherwise they 404 and no `hreflang` is emitted. All Hiligaynon text is a draft for a native speaker to check.
- English labels on forms stay exactly as today (e2e tests match them).
- Phase 1–3 page rules apply to new public pages (one h1, unique title/description/canonical, alt text, no clipping at 375px, no Clerk on public pages).

## Review Focus

- **Two Clerk accounts with the same email** (or an admin re-using a member's email): the second account must not take over a member record that is already linked. → Task 2 test.
- **A member edits their profile while another member's id is sent from the browser:** only their own record changes. → Task 4 test.
- **Directory search with `%` or `_` in the query:** treated literally, not as wildcards. → Task 2 test.
- **Attendance unticked after being ticked:** the automatic passport entry disappears; ticking twice adds only one. → Task 3 test.
- **Hiligaynon flag off in production:** `/hil` pages 404 and English pages carry no `hreflang`. → Task 7 test.

---

### Task 1: Passport table

**Files:**
- Modify: `db/schema.js`, `test/schema.test.js`
- Create: `db/migrations/0004_passport.sql` (generated)

**Interfaces:**
- Produces: table `passportEntries` (`passport_entries`).

- [ ] **Step 1: Write the failing test**

Append inside the top `describe("schema", …)` of `test/schema.test.js` (add `passportEntries` to its schema import):

```js
  it("allows one passport entry per source record", async () => {
    const db = await testDb();
    const [m] = await db.insert(members).values({ slug: "x", name: "X" }).returning();
    const e = { memberId: m.id, kind: "project_joined", title: "GA", date: "2026-11-01", points: 1, refTable: "rsvps", refId: 7, status: "verified", createdAt: "x", updatedAt: "x" };
    await db.insert(passportEntries).values(e);
    await expect(db.insert(passportEntries).values(e)).rejects.toThrow();
    await db.insert(passportEntries).values({ ...e, refTable: null, refId: null });
    await db.insert(passportEntries).values({ ...e, refTable: null, refId: null });
  });
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run test/schema.test.js`
Expected: FAIL — `passportEntries` undefined.

- [ ] **Step 3: Add the table**

`db/schema.js` (append):

```js
export const passportEntries = sqliteTable(
  "passport_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    memberId: integer("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["training", "project_led", "project_joined", "award", "position"] }).notNull(),
    title: text("title").notNull(),
    date: text("date").notNull(),
    points: integer("points").notNull(),
    note: text("note"),
    refTable: text("ref_table"),
    refId: integer("ref_id"),
    status: text("status", { enum: ["requested", "verified", "declined"] }).notNull().default("requested"),
    requestedBy: text("requested_by"),
    verifiedBy: text("verified_by"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [uniqueIndex("passport_entries_ref").on(t.refTable, t.refId)],
);
```

Run: `npx drizzle-kit generate --name passport`
Expected: `db/migrations/0004_passport.sql` with `CREATE TABLE passport_entries` and the unique index.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --exclude test/import-articles.test.js`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add db test/schema.test.js
git commit -m "Add the passport entries table"
```

---

### Task 2: Member linking, profiles and directory

**Files:**
- Create: `lib/members/link.js`, `lib/members/profile.js`, `test/members.test.js`
- Modify: `lib/engagement/events.js`

**Interfaces:**
- Produces: `memberForUser(db, { clerkUserId, email })`; `profileInput`, `normalizeSkills(text)`, `updateProfile(db, memberId, raw)`, `adminMemberInput`, `adminUpdateMember(db, id, raw)`, `listMembersAdmin(db)`, `listDirectory(db, { q? })`; `listRsvpsForEmail(db, email)` (in `lib/engagement/events.js`).

- [ ] **Step 1: Write the failing tests**

`test/members.test.js`:

```js
import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { members } from "@/db/schema.js";
import { memberForUser } from "@/lib/members/link.js";
import { updateProfile, listDirectory, normalizeSkills, adminUpdateMember } from "@/lib/members/profile.js";
import { saveEvent, submitRsvp, listRsvpsForEmail } from "@/lib/engagement/events.js";

let db;
const judy = async () => (await db.select().from(members).where(eq(members.slug, "judy-daliva")))[0];
beforeEach(async () => {
  db = await testDb();
  await seed(db);
  await db.update(members).set({ email: "judy@x.ph" }).where(eq(members.slug, "judy-daliva"));
});

describe("memberForUser", () => {
  it("links by email on first sign-in, then finds by Clerk id", async () => {
    const linked = await memberForUser(db, { clerkUserId: "user_j", email: "Judy@X.ph" });
    expect(linked).toMatchObject({ slug: "judy-daliva", clerkUserId: "user_j" });
    expect((await memberForUser(db, { clerkUserId: "user_j", email: null })).slug).toBe("judy-daliva");
  });

  it("never lets a second account take over a linked record", async () => {
    await memberForUser(db, { clerkUserId: "user_j", email: "judy@x.ph" });
    expect(await memberForUser(db, { clerkUserId: "user_other", email: "judy@x.ph" })).toBeNull();
    expect((await judy()).clerkUserId).toBe("user_j");
  });

  it("returns null without a match", async () => {
    expect(await memberForUser(db, { clerkUserId: "user_z", email: "nobody@x.ph" })).toBeNull();
  });
});

describe("profiles", () => {
  it("cleans up skills", () => {
    expect(normalizeSkills(" Photography, logistics ,, Photography, first aid ")).toBe("Photography, logistics, first aid");
  });

  it("updates only the given member and keeps the photo unless a new one is sent", async () => {
    const before = await judy();
    const r = await updateProfile(db, before.id, { profession: "Teacher", skills: "Public speaking", bio: "Hi", inDirectory: true });
    expect(r.member).toMatchObject({ profession: "Teacher", skills: "Public speaking", inDirectory: true, photoUrl: before.photoUrl });
    expect((await db.select().from(members).where(eq(members.slug, "manuel-luis-luna")))[0].profession).toBeNull();
  });

  it("refuses photos from other hosts", async () => {
    const r = await updateProfile(db, (await judy()).id, { photoUrl: "https://evil.example/x.jpg" });
    expect(r).toEqual({ ok: false, errors: ["Upload a photo"] });
  });

  it("lets admins edit email, status and directory flag", async () => {
    const r = await adminUpdateMember(db, (await judy()).id, { email: " NEW@x.ph ", status: "alumni", inDirectory: false });
    expect(r.member).toMatchObject({ email: "new@x.ph", status: "alumni", inDirectory: false });
  });
});

describe("directory", () => {
  beforeEach(async () => {
    await updateProfile(db, (await judy()).id, { profession: "Teacher", skills: "Photography", inDirectory: true });
  });

  it("lists only opted-in active members", async () => {
    expect((await listDirectory(db)).map((m) => m.name)).toEqual(["Judy Daliva"]);
  });

  it("searches name, profession, business and skills, case-insensitively", async () => {
    expect((await listDirectory(db, { q: "PHOTO" })).length).toBe(1);
    expect((await listDirectory(db, { q: "teach" })).length).toBe(1);
    expect((await listDirectory(db, { q: "welding" })).length).toBe(0);
  });

  it("treats % and _ literally", async () => {
    expect((await listDirectory(db, { q: "%" })).length).toBe(0);
    expect((await listDirectory(db, { q: "_" })).length).toBe(0);
  });

  it("never returns email or phone", async () => {
    const [row] = await listDirectory(db);
    expect(row.email).toBeUndefined();
  });
});

describe("listRsvpsForEmail", () => {
  it("returns a member's RSVPs with their events", async () => {
    const { event } = await saveEvent(db, { title: "GA", startAt: "2099-01-15T18:00" });
    await submitRsvp(db, { eventId: event.id, name: "Judy Daliva", email: "JUDY@x.ph", consent: true });
    const rows = await listRsvpsForEmail(db, "judy@x.ph");
    expect(rows).toEqual([expect.objectContaining({ title: "GA", slug: "ga", status: "going", attended: false })]);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run test/members.test.js`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`lib/members/link.js`:

```js
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { members } from "../../db/schema.js";

// The member record for a signed-in Clerk user: by stored Clerk id, else by
// email on a record nobody has linked yet (then the link is stored).
export async function memberForUser(db, { clerkUserId, email }) {
  if (!clerkUserId) return null;
  const [byId] = await db.select().from(members).where(eq(members.clerkUserId, clerkUserId));
  if (byId) return byId;
  if (!email) return null;
  const [byEmail] = await db
    .select()
    .from(members)
    .where(and(sql`lower(${members.email}) = ${email.trim().toLowerCase()}`, isNull(members.clerkUserId)))
    .orderBy(asc(members.id));
  if (!byEmail) return null;
  const [linked] = await db.update(members).set({ clerkUserId }).where(eq(members.id, byEmail.id)).returning();
  return linked;
}
```

`lib/members/profile.js`:

```js
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { members } from "../../db/schema.js";

const PHOTO = /^(https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/|\/assets\/)/i;
const text = (max) => z.string().trim().max(max).default("");
const issues = (r) => r.error.issues.map((i) => i.message);

export function normalizeSkills(input) {
  const seen = new Set();
  const out = [];
  for (const raw of (input ?? "").split(",")) {
    const s = raw.trim().slice(0, 40);
    if (s && !seen.has(s.toLowerCase())) {
      seen.add(s.toLowerCase());
      out.push(s);
    }
  }
  return out.slice(0, 15).join(", ");
}

export const profileInput = z.object({
  photoUrl: z.string().trim().regex(PHOTO, "Upload a photo").or(z.literal("")).optional(),
  profession: text(120),
  business: text(120),
  skills: text(400),
  bio: text(1000),
  inDirectory: z.boolean().default(false),
});

export async function updateProfile(db, memberId, raw) {
  const parsed = profileInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: issues(parsed) };
  const d = parsed.data;
  const values = {
    profession: d.profession || null,
    business: d.business || null,
    skills: normalizeSkills(d.skills) || null,
    bio: d.bio || null,
    inDirectory: d.inDirectory,
  };
  if (d.photoUrl !== undefined) values.photoUrl = d.photoUrl || null;
  const [member] = await db.update(members).set(values).where(eq(members.id, Number(memberId))).returning();
  return member ? { ok: true, member } : { ok: false, errors: ["Member not found"] };
}

export const adminMemberInput = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address").or(z.literal("")).default(""),
  status: z.enum(["active", "inactive", "senator", "alumni"]),
  inDirectory: z.boolean(),
});

export async function adminUpdateMember(db, id, raw) {
  const parsed = adminMemberInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: issues(parsed) };
  const d = parsed.data;
  const [member] = await db
    .update(members)
    .set({ email: d.email || null, status: d.status, inDirectory: d.inDirectory })
    .where(eq(members.id, Number(id)))
    .returning();
  return member ? { ok: true, member } : { ok: false, errors: ["Member not found"] };
}

export function listMembersAdmin(db) {
  return db.select().from(members).orderBy(asc(members.name));
}

const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export function listDirectory(db, { q = "" } = {}) {
  const term = q.trim().toLowerCase();
  const conds = [eq(members.inDirectory, true), eq(members.status, "active")];
  if (term) {
    const like = `%${escapeLike(term)}%`;
    conds.push(sql`(
      lower(${members.name}) like ${like} escape '\\'
      or lower(coalesce(${members.profession}, '')) like ${like} escape '\\'
      or lower(coalesce(${members.business}, '')) like ${like} escape '\\'
      or lower(coalesce(${members.skills}, '')) like ${like} escape '\\'
    )`);
  }
  return db
    .select({
      id: members.id,
      slug: members.slug,
      name: members.name,
      photoUrl: members.photoUrl,
      profession: members.profession,
      business: members.business,
      skills: members.skills,
    })
    .from(members)
    .where(and(...conds))
    .orderBy(asc(members.name));
}
```

`lib/engagement/events.js` (append):

```js
export function listRsvpsForEmail(db, email) {
  return db
    .select({
      id: rsvps.id,
      status: rsvps.status,
      attended: rsvps.attended,
      title: events.title,
      slug: events.slug,
      startAt: events.startAt,
      venue: events.venue,
    })
    .from(rsvps)
    .innerJoin(events, eq(rsvps.eventId, events.id))
    .where(eq(rsvps.email, (email ?? "").trim().toLowerCase()))
    .orderBy(asc(events.startAt));
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run test/members.test.js`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/members/link.js lib/members/profile.js lib/engagement/events.js test/members.test.js
git commit -m "Add member linking, profiles, directory search and member RSVPs"
```

---

### Task 3: Leadership Passport

**Files:**
- Create: `lib/members/passport.js`, `test/passport.test.js`

**Interfaces:**
- Produces: `DEFAULT_POINTS`, `KIND_LABELS`, `entryInput`; `requestEntry(db, memberId, raw, { userId, now? })`; `addVerifiedEntry(db, memberId, raw, { userId, now?, points? })`; `verifyEntry(db, id, { userId, now?, points? })`; `declineEntry(db, id, { userId, now? })`; `listRequestedEntries(db)`; `computeBadges(verifiedEntries, positionCount)`; `getPassport(db, memberId)` → `{ entries, pending, positions, points, badges }`; `syncAttendanceEntry(db, rsvp, attended, { now? })`.

- [ ] **Step 1: Write the failing tests**

`test/passport.test.js`:

```js
import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { members, passportEntries } from "@/db/schema.js";
import { requestEntry, verifyEntry, declineEntry, addVerifiedEntry, getPassport, computeBadges, syncAttendanceEntry, listRequestedEntries } from "@/lib/members/passport.js";
import { saveEvent, submitRsvp } from "@/lib/engagement/events.js";
import { listProjects } from "@/lib/queries.js";

const now = "2026-11-01T00:00:00.000Z";
let db;
let judy;
beforeEach(async () => {
  db = await testDb();
  await seed(db);
  [judy] = await db.update(members).set({ email: "judy@x.ph" }).where(eq(members.slug, "judy-daliva")).returning();
});

describe("passport entries", () => {
  it("lets a member request an entry that an admin verifies with adjusted points", async () => {
    const { entry } = await requestEntry(db, judy.id, { kind: "training", title: "Effective Communication", date: "2026-10-05" }, { userId: "user_j", now });
    expect(entry).toMatchObject({ status: "requested", points: 2 });
    expect((await listRequestedEntries(db))[0]).toMatchObject({ memberName: "Judy Daliva" });
    const r = await verifyEntry(db, entry.id, { userId: "admin", points: 3, now });
    expect(r.entry).toMatchObject({ status: "verified", points: 3, verifiedBy: "admin" });
  });

  it("refuses to review an entry twice", async () => {
    const { entry } = await requestEntry(db, judy.id, { kind: "award", title: "Star Member", date: "2026-10-05" }, { userId: "user_j", now });
    await declineEntry(db, entry.id, { userId: "admin", now });
    expect(await verifyEntry(db, entry.id, { userId: "admin", now })).toEqual({ ok: false, errors: ["This entry was already reviewed"] });
  });

  it("validates the request", async () => {
    expect((await requestEntry(db, judy.id, { kind: "training", title: "x", date: "" }, { userId: "u", now })).ok).toBe(false);
  });
});

describe("getPassport", () => {
  it("adds officer positions, totals points and computes badges", async () => {
    await addVerifiedEntry(db, judy.id, { kind: "project_led", title: "Coastal Cleanup", date: "2026-06-20" }, { userId: "admin", now });
    await addVerifiedEntry(db, judy.id, { kind: "training", title: "Leadership 101", date: "2026-05-01" }, { userId: "admin", now });
    const p = await getPassport(db, judy.id);
    expect(p.positions).toEqual([{ role: "Director", year: 2026 }]);
    expect(p.points).toBe(5 + 2 + 3);
    expect(p.badges.map((b) => b.label)).toEqual(["First steps", "Trained ×1", "Project chair ×1", "Officer"]);
    expect(p.entries.map((e) => e.title)).toEqual(["Coastal Cleanup", "Leadership 101"]);
  });

  it("awards Ten trainings at ten", () => {
    const ten = Array.from({ length: 10 }, () => ({ kind: "training" }));
    expect(computeBadges(ten, 0).map((b) => b.key)).toContain("ten-trainings");
  });
});

describe("syncAttendanceEntry", () => {
  it("adds one entry for attending a project event and removes it when unticked", async () => {
    const [project] = await listProjects(db, { limit: 1 });
    const { event } = await saveEvent(db, { title: "Mural Painting", startAt: "2026-08-07T08:00", projectId: project.id }, { now });
    const { rsvp } = await submitRsvp(db, { eventId: event.id, name: "Judy Daliva", email: "judy@x.ph", consent: true }, { now });
    await syncAttendanceEntry(db, rsvp, true, { now });
    await syncAttendanceEntry(db, rsvp, true, { now });
    let rows = await db.select().from(passportEntries);
    expect(rows).toEqual([expect.objectContaining({ kind: "project_joined", title: "Mural Painting", date: "2026-08-07", status: "verified" })]);
    await syncAttendanceEntry(db, rsvp, false, { now });
    rows = await db.select().from(passportEntries);
    expect(rows).toEqual([]);
  });

  it("does nothing for events without a project or attendees who are not members", async () => {
    const { event } = await saveEvent(db, { title: "Social Night", startAt: "2026-08-07T18:00" }, { now });
    const { rsvp } = await submitRsvp(db, { eventId: event.id, name: "Judy Daliva", email: "judy@x.ph", consent: true }, { now });
    expect((await syncAttendanceEntry(db, rsvp, true, { now })).added).toBe(false);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run test/passport.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`lib/members/passport.js`:

```js
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { passportEntries, members, officerTerms, events } from "../../db/schema.js";

export const DEFAULT_POINTS = { training: 2, project_led: 5, project_joined: 1, award: 5, position: 3 };
export const KIND_LABELS = {
  training: "Training",
  project_led: "Project led",
  project_joined: "Project joined",
  award: "Award",
  position: "Position",
};

export const entryInput = z.object({
  kind: z.enum(["training", "project_led", "project_joined", "award", "position"], { errorMap: () => ({ message: "Choose a kind" }) }),
  title: z.string().trim().min(2, "Describe the entry").max(160),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the date"),
  note: z.string().trim().max(500).default(""),
});

const issues = (r) => r.error.issues.map((i) => i.message);

async function insertEntry(db, memberId, raw, { status, userId, now, points }) {
  const parsed = entryInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: issues(parsed) };
  const d = parsed.data;
  const [entry] = await db
    .insert(passportEntries)
    .values({
      memberId: Number(memberId),
      kind: d.kind,
      title: d.title,
      date: d.date,
      points: Number.isInteger(points) ? points : DEFAULT_POINTS[d.kind],
      note: d.note || null,
      status,
      requestedBy: status === "requested" ? userId : null,
      verifiedBy: status === "verified" ? userId : null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return { ok: true, entry };
}

export function requestEntry(db, memberId, raw, { userId, now = new Date().toISOString() }) {
  return insertEntry(db, memberId, raw, { status: "requested", userId, now });
}

export function addVerifiedEntry(db, memberId, raw, { userId, now = new Date().toISOString(), points } = {}) {
  return insertEntry(db, memberId, raw, { status: "verified", userId, now, points });
}

async function review(db, id, status, { userId, now, points }) {
  const [current] = await db.select().from(passportEntries).where(eq(passportEntries.id, Number(id)));
  if (!current) return { ok: false, errors: ["Entry not found"] };
  if (current.status !== "requested") return { ok: false, errors: ["This entry was already reviewed"] };
  const values = { status, verifiedBy: userId, updatedAt: now };
  if (status === "verified" && Number.isInteger(points) && points >= 0) values.points = points;
  const [entry] = await db.update(passportEntries).set(values).where(eq(passportEntries.id, current.id)).returning();
  return { ok: true, entry };
}

export function verifyEntry(db, id, { userId, now = new Date().toISOString(), points } = {}) {
  return review(db, id, "verified", { userId, now, points });
}

export function declineEntry(db, id, { userId, now = new Date().toISOString() } = {}) {
  return review(db, id, "declined", { userId, now });
}

export function listRequestedEntries(db) {
  return db
    .select({
      id: passportEntries.id,
      kind: passportEntries.kind,
      title: passportEntries.title,
      date: passportEntries.date,
      points: passportEntries.points,
      note: passportEntries.note,
      memberId: passportEntries.memberId,
      memberName: members.name,
    })
    .from(passportEntries)
    .innerJoin(members, eq(passportEntries.memberId, members.id))
    .where(eq(passportEntries.status, "requested"))
    .orderBy(asc(passportEntries.createdAt), asc(passportEntries.id));
}

export function computeBadges(entries, positionCount) {
  const n = (kind) => entries.filter((e) => e.kind === kind).length;
  const badges = [];
  if (n("project_joined") + n("training") > 0) badges.push({ key: "first-steps", label: "First steps" });
  if (n("training") > 0) badges.push({ key: "trained", label: `Trained ×${n("training")}` });
  if (n("project_led") > 0) badges.push({ key: "chair", label: `Project chair ×${n("project_led")}` });
  if (positionCount > 0) badges.push({ key: "officer", label: "Officer" });
  if (n("award") > 0) badges.push({ key: "awardee", label: "Awardee" });
  if (n("training") >= 10) badges.push({ key: "ten-trainings", label: "Ten trainings" });
  return badges;
}

export async function getPassport(db, memberId) {
  const id = Number(memberId);
  const [all, positions] = await Promise.all([
    db.select().from(passportEntries).where(eq(passportEntries.memberId, id)).orderBy(desc(passportEntries.date), desc(passportEntries.id)),
    db.select({ role: officerTerms.role, year: officerTerms.year }).from(officerTerms).where(eq(officerTerms.memberId, id)).orderBy(desc(officerTerms.year)),
  ]);
  const entries = all.filter((e) => e.status === "verified");
  const pending = all.filter((e) => e.status === "requested");
  const points = entries.reduce((s, e) => s + e.points, 0) + DEFAULT_POINTS.position * positions.length;
  return { entries, pending, positions, points, badges: computeBadges(entries, positions.length) };
}

// Attendance at an event that belongs to a project becomes a verified
// "project joined" entry for the member with the RSVP's email.
export async function syncAttendanceEntry(db, rsvp, attended, { now = new Date().toISOString() } = {}) {
  if (!attended) {
    await db.delete(passportEntries).where(and(eq(passportEntries.refTable, "rsvps"), eq(passportEntries.refId, rsvp.id)));
    return { ok: true, added: false };
  }
  const [event] = await db.select().from(events).where(eq(events.id, rsvp.eventId));
  if (!event?.projectId) return { ok: true, added: false };
  const [member] = await db
    .select()
    .from(members)
    .where(sql`lower(${members.email}) = ${rsvp.email.toLowerCase()}`)
    .orderBy(asc(members.id));
  if (!member) return { ok: true, added: false };
  await db
    .insert(passportEntries)
    .values({
      memberId: member.id,
      kind: "project_joined",
      title: event.title,
      date: event.startAt.slice(0, 10),
      points: DEFAULT_POINTS.project_joined,
      refTable: "rsvps",
      refId: rsvp.id,
      status: "verified",
      verifiedBy: "system",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();
  return { ok: true, added: true };
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run test/passport.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/members/passport.js test/passport.test.js
git commit -m "Add the Leadership Passport: requests, verification, badges and attendance entries"
```

---

### Task 4: Member and admin actions, avatar upload

**Files:**
- Create: `lib/members/current.js`, `app/members/actions.js`, `app/admin/members/actions.js`, `app/api/upload-avatar/route.js`, `test/member-actions.test.js`
- Modify: `app/admin/events/actions.js`

**Interfaces:**
- Produces: `currentMember()` → `{ userId, role, member | null }`; `updateProfileAction(input)`, `requestEntryAction(input)`; `updateMemberAction(id, input)`, `verifyEntryAction(id, points)`, `declineEntryAction(id)`, `addEntryAction(memberId, input)`; `setAttendanceAction` now syncs the passport; `POST /api/upload-avatar`.

- [ ] **Step 1: Write the failing tests**

`test/member-actions.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { members, passportEntries } from "@/db/schema.js";

const h = vi.hoisted(() => ({ db: null, claims: null, email: null, revalidated: [] }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: h.claims ? "user_j" : null, sessionClaims: h.claims }),
  clerkClient: async () => ({ users: { getUser: async () => ({ publicMetadata: {}, primaryEmailAddress: h.email ? { emailAddress: h.email } : null, emailAddresses: [] }) } }),
}));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
vi.mock("next/cache", () => ({ revalidatePath: (p) => h.revalidated.push(p) }));
vi.mock("@/lib/db.js", async (orig) => ({ ...(await orig()), getDb: () => h.db }));

const { updateProfileAction, requestEntryAction } = await import("@/app/members/actions.js");
const { verifyEntryAction } = await import("@/app/admin/members/actions.js");

beforeEach(async () => {
  h.db = await testDb();
  await seed(h.db);
  await h.db.update(members).set({ email: "judy@x.ph" }).where(eq(members.slug, "judy-daliva"));
  h.claims = { metadata: { role: "member" } };
  h.email = "judy@x.ph";
  h.revalidated = [];
});

const bySlug = async (slug) => (await h.db.select().from(members).where(eq(members.slug, slug)))[0];

describe("member actions", () => {
  it("update the signed-in member's own profile, ignoring any id sent from the browser", async () => {
    const other = await bySlug("manuel-luis-luna");
    const r = await updateProfileAction({ id: other.id, memberId: other.id, profession: "Engineer", inDirectory: true });
    expect(r).toEqual({ ok: true });
    expect((await bySlug("judy-daliva")).profession).toBe("Engineer");
    expect((await bySlug("manuel-luis-luna")).profession).toBeNull();
  });

  it("explain when the account has no member profile", async () => {
    h.email = "stranger@x.ph";
    expect(await updateProfileAction({ profession: "x" })).toEqual({ ok: false, errors: ["Your account isn't linked to a member profile yet — ask an admin."] });
  });

  it("refuse signed-out callers", async () => {
    h.claims = null;
    await expect(updateProfileAction({})).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("let members request passport entries but not verify them", async () => {
    expect((await requestEntryAction({ kind: "training", title: "Leadership 101", date: "2026-10-01" })).ok).toBe(true);
    const [entry] = await h.db.select().from(passportEntries);
    await expect(verifyEntryAction(entry.id)).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run test/member-actions.test.js`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`lib/members/current.js`:

```js
import { requireArea } from "../auth.js";
import { getDb } from "../db.js";
import { loadClerkUser } from "../clerk-user.js";
import { memberForUser } from "./link.js";

// The signed-in user's member record (linked on first sign-in by email).
export async function currentMember() {
  const { userId, role } = await requireArea("members");
  let email = null;
  try {
    const user = await loadClerkUser(userId);
    email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? null;
  } catch {
    email = null;
  }
  return { userId, role, member: await memberForUser(getDb(), { clerkUserId: userId, email }) };
}
```

`app/members/actions.js`:

```js
"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db.js";
import { currentMember } from "@/lib/members/current.js";
import { updateProfile } from "@/lib/members/profile.js";
import { requestEntry } from "@/lib/members/passport.js";

const NO_PROFILE = { ok: false, errors: ["Your account isn't linked to a member profile yet — ask an admin."] };

export async function updateProfileAction(input) {
  const { member } = await currentMember();
  if (!member) return NO_PROFILE;
  const r = await updateProfile(getDb(), member.id, input);
  if (!r.ok) return r;
  revalidatePath("/members", "layout");
  revalidatePath("/officers");
  return { ok: true };
}

export async function requestEntryAction(input) {
  const { userId, member } = await currentMember();
  if (!member) return NO_PROFILE;
  const r = await requestEntry(getDb(), member.id, input, { userId });
  if (!r.ok) return r;
  revalidatePath("/members/passport");
  return { ok: true };
}
```

`app/admin/members/actions.js`:

```js
"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db.js";
import { requireArea } from "@/lib/auth.js";
import { adminUpdateMember } from "@/lib/members/profile.js";
import { verifyEntry, declineEntry, addVerifiedEntry } from "@/lib/members/passport.js";

export async function updateMemberAction(id, input) {
  await requireArea("content");
  const r = await adminUpdateMember(getDb(), id, input);
  if (r.ok) {
    revalidatePath("/admin/members");
    revalidatePath("/members/directory");
  }
  return r.ok ? { ok: true } : r;
}

export async function verifyEntryAction(id, points) {
  const { userId } = await requireArea("content");
  const r = await verifyEntry(getDb(), id, { userId, points: points === "" || points == null ? undefined : Number(points) });
  revalidatePath("/admin/passport");
  return r.ok ? { ok: true } : r;
}

export async function declineEntryAction(id) {
  const { userId } = await requireArea("content");
  const r = await declineEntry(getDb(), id, { userId });
  revalidatePath("/admin/passport");
  return r.ok ? { ok: true } : r;
}

export async function addEntryAction(memberId, input) {
  const { userId } = await requireArea("content");
  const points = input?.points === "" || input?.points == null ? undefined : Number(input.points);
  const r = await addVerifiedEntry(getDb(), memberId, input, { userId, points });
  revalidatePath("/admin/passport");
  return r.ok ? { ok: true } : r;
}
```

In `app/admin/events/actions.js`, add `import { syncAttendanceEntry } from "@/lib/members/passport.js";` and replace `setAttendanceAction` with:

```js
export async function setAttendanceAction(rsvpId, attended) {
  const { userId } = await requireArea("content");
  const db = getDb();
  const r = await setAttendance(db, rsvpId, attended, { userId });
  if (r.ok) await syncAttendanceEntry(db, r.rsvp, attended);
  return r;
}
```

`app/api/upload-avatar/route.js`:

```js
import { handleUpload } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { canAccess } from "@/lib/roles.js";
import { resolveRole } from "@/lib/role-lookup.js";
import { loadClerkUser } from "@/lib/clerk-user.js";

const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

async function isMember() {
  const { userId, sessionClaims } = await auth();
  return Boolean(userId) && canAccess(await resolveRole({ userId, sessionClaims }, loadClerkUser), "members");
}

// Profile photos: signed-in members only, images up to 5 MB.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (body?.type === "blob.generate-client-token" && !(await isMember())) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        if (!(await isMember())) throw new Error("Not allowed");
        return { allowedContentTypes: AVATAR_TYPES, maximumSizeInBytes: MAX_AVATAR_BYTES, addRandomSuffix: true };
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

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run --exclude test/import-articles.test.js`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/members/current.js app/members/actions.js app/admin/members/actions.js app/admin/events/actions.js app/api/upload-avatar test/member-actions.test.js
git commit -m "Add member and admin actions, attendance-to-passport sync and avatar uploads"
```

---

### Task 5: Members area pages

**Files:**
- Create: `app/members/layout.jsx`, `app/members/page.jsx`, `app/members/profile/page.jsx`, `app/members/directory/page.jsx`, `app/members/passport/page.jsx`, `app/members/library/page.jsx`, `app/members/events/page.jsx`, `components/members/MembersNav.jsx`, `components/members/ProfileForm.jsx`, `components/members/PassportRequestForm.jsx`, `components/members/MemberCard.jsx`
- Modify: `components/admin/FileUpload.jsx`, `app/sign-in/[[...sign-in]]/page.jsx`, `app/globals.css`

**Interfaces:**
- Consumes: `currentMember`, `getPassport`, `listDirectory`, `listResources`, `listRsvpsForEmail`, actions from Task 4.
- Produces: `FileUpload` gains `handleUploadUrl` (default `/api/upload`).

This task wires UI to tested stores and actions; its checks are the build and the e2e sign-in redirects (Task 8).

- [ ] **Step 1: FileUpload upload route prop and sign-in landing**

In `components/admin/FileUpload.jsx` change the signature and the upload call:

```jsx
export default function FileUpload({ accept, requireAlt = false, label, onUploaded, handleUploadUrl = "/api/upload" }) {
```

```jsx
      const blob = await upload(file.name, file, { access: "public", handleUploadUrl });
```

In `app/sign-in/[[...sign-in]]/page.jsx` change `<SignIn />` to `<SignIn fallbackRedirectUrl="/members" />`.

- [ ] **Step 2: Layout, nav and shared components**

`app/members/layout.jsx`:

```jsx
import { ClerkProvider } from "@clerk/nextjs";
import { requireArea } from "@/lib/auth.js";
import MembersNav from "@/components/members/MembersNav.jsx";

export const metadata = { robots: { index: false } };

export default async function MembersLayout({ children }) {
  await requireArea("members");
  return (
    <ClerkProvider>
      <div className="admin members-area">
        <MembersNav />
        {children}
      </div>
    </ClerkProvider>
  );
}
```

`components/members/MembersNav.jsx`:

```jsx
import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";

export default function MembersNav() {
  return (
    <nav className="admin-nav" aria-label="Members">
      <Link href="/members">Home</Link>
      <Link href="/members/profile">Profile</Link>
      <Link href="/members/directory">Directory</Link>
      <Link href="/members/passport">Passport</Link>
      <Link href="/members/library">Library</Link>
      <Link href="/members/events">My events</Link>
      <SignOutButton redirectUrl="/"><button type="button" className="tool">Sign out</button></SignOutButton>
    </nav>
  );
}
```

`components/members/MemberCard.jsx`:

```jsx
import Image from "next/image";
import { initials } from "@/lib/format.js";

export default function MemberCard({ member }) {
  return (
    <div className="officer member-card">
      <figure>
        {member.photoUrl ? (
          <Image src={member.photoUrl} alt={member.name} fill sizes="(max-width: 560px) 100vw, 25vw" style={{ objectFit: "cover", objectPosition: "top" }} />
        ) : (
          <div className="initials" aria-hidden="true">{initials(member.name)}</div>
        )}
      </figure>
      <div className="officer__meta">
        <span className="name">{member.name}</span>
        {(member.profession || member.business) && <span className="role">{[member.profession, member.business].filter(Boolean).join(" · ")}</span>}
        {member.skills && <span className="member-card__skills">{member.skills}</span>}
      </div>
    </div>
  );
}
```

`components/members/ProfileForm.jsx`:

```jsx
"use client";

import { useState, useTransition } from "react";
import FileUpload from "@/components/admin/FileUpload.jsx";
import { updateProfileAction } from "@/app/members/actions.js";

export default function ProfileForm({ member }) {
  const [form, setForm] = useState({
    photoUrl: undefined,
    profession: member.profession ?? "",
    business: member.business ?? "",
    skills: member.skills ?? "",
    bio: member.bio ?? "",
    inDirectory: member.inDirectory,
  });
  const [preview, setPreview] = useState(member.photoUrl);
  const [result, setResult] = useState(null);
  const [pending, start] = useTransition();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const save = () => start(async () => {
    try {
      setResult(await updateProfileAction(form));
    } catch (e) {
      setResult({ ok: false, errors: [`Couldn't save (${e.message}). Try again.`] });
    }
  });

  return (
    <form className="public-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <div className="field">
        <span className="count">Photo</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview && <img src={preview} alt={member.name} style={{ maxWidth: 160 }} />}
        <FileUpload accept="image/jpeg,image/png,image/webp" label="Upload a new photo" handleUploadUrl="/api/upload-avatar" onUploaded={({ url }) => { setForm((f) => ({ ...f, photoUrl: url })); setPreview(url); }} />
      </div>
      <div className="field"><label htmlFor="pr-prof">Profession</label><input id="pr-prof" value={form.profession} onChange={set("profession")} /></div>
      <div className="field"><label htmlFor="pr-biz">Business</label><input id="pr-biz" value={form.business} onChange={set("business")} /></div>
      <div className="field"><label htmlFor="pr-skills">Skills (separate with commas)</label><input id="pr-skills" value={form.skills} onChange={set("skills")} placeholder="Photography, event planning, accounting" /></div>
      <div className="field"><label htmlFor="pr-bio">About you</label><textarea id="pr-bio" rows={5} value={form.bio} onChange={set("bio")} /></div>
      <label className="consent"><input type="checkbox" checked={form.inDirectory} onChange={set("inDirectory")} /> Show me in the member directory (name, photo, profession, business and skills — never your email or phone)</label>
      {result && !result.ok && <div className="form-errors" role="alert"><ul>{result.errors.map((e) => <li key={e}>{e}</li>)}</ul></div>}
      {result?.ok && <p className="form-ok" role="status">Profile saved.</p>}
      <button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
    </form>
  );
}
```

`components/members/PassportRequestForm.jsx`:

```jsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestEntryAction } from "@/app/members/actions.js";

const EMPTY = { kind: "training", title: "", date: "", note: "" };

export default function PassportRequestForm() {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [result, setResult] = useState(null);
  const [pending, start] = useTransition();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = () => start(async () => {
    try {
      const r = await requestEntryAction(form);
      setResult(r);
      if (r.ok) { setForm(EMPTY); router.refresh(); }
    } catch (e) {
      setResult({ ok: false, errors: [`Couldn't send (${e.message}). Try again.`] });
    }
  });
  return (
    <form className="public-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div className="field">
        <label htmlFor="pp-kind">What kind?</label>
        <select id="pp-kind" value={form.kind} onChange={set("kind")}>
          <option value="training">Training</option>
          <option value="project_led">Project I led</option>
          <option value="project_joined">Project I joined</option>
          <option value="award">Award</option>
          <option value="position">Position</option>
        </select>
      </div>
      <div className="field"><label htmlFor="pp-title">Title</label><input id="pp-title" value={form.title} onChange={set("title")} placeholder="e.g. Effective Communication training" /></div>
      <div className="field"><label htmlFor="pp-date">Date</label><input id="pp-date" type="date" value={form.date} onChange={set("date")} /></div>
      <div className="field"><label htmlFor="pp-note">Note for the admin (optional)</label><textarea id="pp-note" rows={3} value={form.note} onChange={set("note")} /></div>
      {result && !result.ok && <div className="form-errors" role="alert"><ul>{result.errors.map((e) => <li key={e}>{e}</li>)}</ul></div>}
      {result?.ok && <p className="form-ok" role="status">Sent — an admin will verify it.</p>}
      <button className="btn" type="submit" disabled={pending}>{pending ? "Sending…" : "Request entry"}</button>
    </form>
  );
}
```

- [ ] **Step 3: Pages**

`app/members/page.jsx`:

```jsx
import Link from "next/link";
import { currentMember } from "@/lib/members/current.js";
import { getDb } from "@/lib/db.js";
import { getPassport, KIND_LABELS } from "@/lib/members/passport.js";
import { listRsvpsForEmail } from "@/lib/engagement/events.js";
import { formatDate, formatDateTime, phNow } from "@/lib/format.js";
import MemberCard from "@/components/members/MemberCard.jsx";

export const metadata = { title: "Members" };
export const dynamic = "force-dynamic";

const NotLinked = () => (
  <>
    <h1>Members</h1>
    <p>Your account isn't linked to a member profile yet — ask an admin to add your email to your member record.</p>
  </>
);

export default async function MembersHome() {
  const { member } = await currentMember();
  if (!member) return <NotLinked />;
  const db = getDb();
  const [passport, rsvps] = await Promise.all([getPassport(db, member.id), listRsvpsForEmail(db, member.email)]);
  const next = rsvps.find((r) => r.startAt >= phNow() && r.status !== "cancelled");
  const missing = [["photo", member.photoUrl], ["profession", member.profession], ["skills", member.skills], ["bio", member.bio]].filter(([, v]) => !v).map(([k]) => k);
  return (
    <>
      <h1>Welcome, {member.name.split(" ")[0]}</h1>
      <div className="members-home">
        <MemberCard member={member} />
        <div>
          <section>
            <h2 className="syne">Your profile</h2>
            {missing.length ? <p>Add your {missing.join(", ")} so other members can find you. <Link href="/members/profile">Edit profile →</Link></p> : <p>Your profile is complete. <Link href="/members/profile">Edit →</Link></p>}
            <p>{member.inDirectory ? "You appear in the member directory." : "You're hidden from the member directory."}</p>
          </section>
          <section>
            <h2 className="syne">Leadership Passport — {passport.points} points</h2>
            <p className="badges">{passport.badges.map((b) => <span className="badge" key={b.key}>{b.label}</span>)}</p>
            <ul>{passport.entries.slice(0, 3).map((e) => <li key={e.id}>{KIND_LABELS[e.kind]}: {e.title} ({formatDate(e.date)})</li>)}</ul>
            <p><Link href="/members/passport">Open your passport →</Link></p>
          </section>
          <section>
            <h2 className="syne">Next event</h2>
            {next ? <p><Link href={`/events/${next.slug}`}>{next.title}</Link>, {formatDateTime(next.startAt)}{next.status === "waitlist" ? " (waitlist)" : ""}</p> : <p>No upcoming RSVPs. <Link href="/events">See events →</Link></p>}
          </section>
        </div>
      </div>
    </>
  );
}
```

`app/members/profile/page.jsx`:

```jsx
import { currentMember } from "@/lib/members/current.js";
import ProfileForm from "@/components/members/ProfileForm.jsx";

export const metadata = { title: "Your profile" };
export const dynamic = "force-dynamic";

export default async function Profile() {
  const { member } = await currentMember();
  if (!member) return <><h1>Your profile</h1><p>Your account isn't linked to a member profile yet — ask an admin.</p></>;
  return (
    <>
      <h1>Your profile</h1>
      <ProfileForm member={member} />
    </>
  );
}
```

`app/members/directory/page.jsx`:

```jsx
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listDirectory } from "@/lib/members/profile.js";
import MemberCard from "@/components/members/MemberCard.jsx";

export const metadata = { title: "Member directory" };
export const dynamic = "force-dynamic";

export default async function Directory({ searchParams }) {
  await requireArea("members");
  const { q = "" } = await searchParams;
  const list = await listDirectory(getDb(), { q: String(q).slice(0, 80) });
  return (
    <>
      <h1>Member directory</h1>
      <form className="actions" role="search">
        <label htmlFor="dir-q" className="count">Search by name, skill or business</label>
        <input id="dir-q" name="q" defaultValue={q} placeholder="e.g. photography" />
        <button className="btn" type="submit">Search</button>
      </form>
      <p>{list.length} member{list.length === 1 ? "" : "s"}{q ? ` matching “${q}”` : ""}. Only members who opted in are listed.</p>
      <div className="officers">{list.map((m) => <MemberCard key={m.id} member={m} />)}</div>
    </>
  );
}
```

`app/members/passport/page.jsx`:

```jsx
import { currentMember } from "@/lib/members/current.js";
import { getDb } from "@/lib/db.js";
import { getPassport, KIND_LABELS } from "@/lib/members/passport.js";
import { formatDate } from "@/lib/format.js";
import PassportRequestForm from "@/components/members/PassportRequestForm.jsx";

export const metadata = { title: "Leadership Passport" };
export const dynamic = "force-dynamic";

export default async function Passport() {
  const { member } = await currentMember();
  if (!member) return <><h1>Leadership Passport</h1><p>Your account isn't linked to a member profile yet — ask an admin.</p></>;
  const p = await getPassport(getDb(), member.id);
  const timeline = [
    ...p.entries.map((e) => ({ key: `e${e.id}`, date: e.date, text: `${KIND_LABELS[e.kind]}: ${e.title}`, points: e.points })),
    ...p.positions.map((pos) => ({ key: `p${pos.year}${pos.role}`, date: `${pos.year}-12-31`, text: `Position: ${pos.role} (${pos.year})`, points: 3 })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <h1>Leadership Passport</h1>
      <p className="passport__points"><strong>{p.points}</strong> points</p>
      <p className="badges">{p.badges.length ? p.badges.map((b) => <span className="badge" key={b.key}>{b.label}</span>) : "Your badges will appear here."}</p>
      <section>
        <h2 className="syne">Timeline</h2>
        {timeline.length ? (
          <ol className="list-rows passport__timeline">
            {timeline.map((t) => <li key={t.key}><span className="t">{t.text}</span><span className="y">{t.key.startsWith("p") ? "" : formatDate(t.date)} · {t.points} pts</span></li>)}
          </ol>
        ) : <p>No entries yet. Attend a project event or request your first entry below.</p>}
      </section>
      {p.pending.length > 0 && (
        <section>
          <h2 className="syne">Waiting for verification</h2>
          <ul>{p.pending.map((e) => <li key={e.id}>{KIND_LABELS[e.kind]}: {e.title} ({formatDate(e.date)})</li>)}</ul>
        </section>
      )}
      <section>
        <h2 className="syne">Request an entry</h2>
        <PassportRequestForm />
      </section>
    </>
  );
}
```

`app/members/library/page.jsx`:

```jsx
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listResources } from "@/lib/content/resources.js";
import { safeHttpsUrl } from "@/lib/safe.js";

export const metadata = { title: "Member library" };
export const dynamic = "force-dynamic";

const KIND_LABELS = { template: "Templates", training: "Training", bylaws: "Bylaws", other: "Other" };

export default async function Library() {
  await requireArea("members");
  const list = await listResources(getDb(), { visibility: "members" });
  const kinds = Object.keys(KIND_LABELS).filter((k) => list.some((r) => r.kind === k));
  return (
    <>
      <h1>Member library</h1>
      {list.length === 0 && <p>No members-only files yet.</p>}
      {kinds.map((k) => (
        <section key={k}>
          <h2 className="syne">{KIND_LABELS[k]}</h2>
          <div className="list-rows">
            {list.filter((r) => r.kind === k).map((r) => (
              <div key={r.id}>
                <span><span className="t">{r.title}</span>{r.description && <><br />{r.description}</>}</span>
                {safeHttpsUrl(r.fileUrl) && <a className="btn" href={safeHttpsUrl(r.fileUrl)} target="_blank" rel="noreferrer">Open</a>}
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
```

`app/members/events/page.jsx`:

```jsx
import Link from "next/link";
import { currentMember } from "@/lib/members/current.js";
import { getDb } from "@/lib/db.js";
import { listRsvpsForEmail } from "@/lib/engagement/events.js";
import { formatDateTime, phNow } from "@/lib/format.js";

export const metadata = { title: "My events" };
export const dynamic = "force-dynamic";

export default async function MyEvents() {
  const { member } = await currentMember();
  if (!member) return <><h1>My events</h1><p>Your account isn't linked to a member profile yet — ask an admin.</p></>;
  const rows = await listRsvpsForEmail(getDb(), member.email);
  const now = phNow();
  const upcoming = rows.filter((r) => r.startAt >= now);
  const past = rows.filter((r) => r.startAt < now).reverse();
  const row = (r) => (
    <tr key={r.id}>
      <td><Link href={`/events/${r.slug}`}>{r.title}</Link></td>
      <td>{formatDateTime(r.startAt)}</td>
      <td>{r.status}{r.attended ? " · attended" : ""}</td>
    </tr>
  );
  return (
    <>
      <h1>My events</h1>
      <h2 className="syne">Upcoming</h2>
      {upcoming.length ? <table className="admin-table"><tbody>{upcoming.map(row)}</tbody></table> : <p>None yet. <Link href="/events">See events →</Link></p>}
      <h2 className="syne">Past</h2>
      {past.length ? <table className="admin-table"><tbody>{past.map(row)}</tbody></table> : <p>No past events.</p>}
    </>
  );
}
```

`app/globals.css` (append):

```css
/* ============================================================
   Members area (Phase 4)
   ============================================================ */
.members-home { display: grid; grid-template-columns: 260px minmax(0, 1fr); gap: 40px; align-items: start; }
.members-home section { margin-bottom: 28px; }
@media (max-width: 760px) { .members-home { grid-template-columns: 1fr; } }
.member-card figure { height: 300px; }
.member-card__skills { font-size: 0.85rem; color: rgba(237, 232, 223, 0.7); }
.badges { display: flex; flex-wrap: wrap; gap: 8px; }
.badge { border: 1px solid var(--ochre); color: var(--ochre); padding: 4px 10px; font-family: var(--font-space-grotesk), monospace; font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase; }
.passport__points strong { font-family: var(--font-syne), sans-serif; font-size: 3rem; color: var(--ochre); }
.passport__timeline { list-style: none; padding: 0; margin: 0; }
.passport__timeline li { display: flex; justify-content: space-between; gap: 24px; flex-wrap: wrap; padding: 16px 0; border-top: 1px solid rgba(237, 232, 223, 0.12); }
```

- [ ] **Step 4: Build**

Run: `npx vitest run --exclude test/import-articles.test.js && NEXT_DIST_DIR=.next-check npx next build`
Expected: tests PASS; build lists `/members`, `/members/profile`, `/members/directory`, `/members/passport`, `/members/library`, `/members/events`, `/api/upload-avatar`.

- [ ] **Step 5: Commit**

```bash
git add app/members components/members components/admin/FileUpload.jsx "app/sign-in/[[...sign-in]]/page.jsx" app/globals.css
git commit -m "Add the members area: home, profile, directory, passport, library and my events"
```

---

### Task 6: Admin members and passport screens

**Files:**
- Create: `components/admin/MemberRow.jsx`, `components/admin/PassportReview.jsx`, `components/admin/AddEntryForm.jsx`, `app/admin/members/page.jsx`, `app/admin/passport/page.jsx`
- Modify: `components/admin/AdminNav.jsx`

- [ ] **Step 1: Components and pages**

`components/admin/MemberRow.jsx`:

```jsx
"use client";

import { useState, useTransition } from "react";
import { updateMemberAction } from "@/app/admin/members/actions.js";

export default function MemberRow({ member }) {
  const [form, setForm] = useState({ email: member.email ?? "", status: member.status, inDirectory: member.inDirectory });
  const [message, setMessage] = useState(null);
  const [pending, start] = useTransition();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const save = () => start(async () => {
    try {
      const r = await updateMemberAction(member.id, form);
      setMessage(r.ok ? "Saved" : r.errors.join(" "));
    } catch (e) {
      setMessage(`Couldn't save (${e.message})`);
    }
  });
  return (
    <tr>
      <td>{member.name}<br /><span className="count">{member.clerkUserId ? "Account linked" : "No account yet"}{member.feePaidYear ? ` · Fee paid ${member.feePaidYear}` : ""}</span></td>
      <td><input aria-label={`Email for ${member.name}`} type="email" value={form.email} onChange={set("email")} /></td>
      <td>
        <select aria-label={`Status for ${member.name}`} value={form.status} onChange={set("status")}>
          <option value="active">Active</option><option value="inactive">Inactive</option><option value="senator">Senator</option><option value="alumni">Alumni</option>
        </select>
      </td>
      <td><input aria-label={`${member.name} in directory`} type="checkbox" checked={form.inDirectory} onChange={set("inDirectory")} /></td>
      <td><button type="button" className="tool" disabled={pending} onClick={save}>Save</button> {message && <span role="status">{message}</span>}</td>
    </tr>
  );
}
```

`components/admin/PassportReview.jsx`:

```jsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { verifyEntryAction, declineEntryAction } from "@/app/admin/members/actions.js";

export default function PassportReview({ entry }) {
  const router = useRouter();
  const [points, setPoints] = useState(String(entry.points));
  const [message, setMessage] = useState(null);
  const [pending, start] = useTransition();
  const run = (fn) => start(async () => {
    try {
      const r = await fn();
      if (!r.ok) { setMessage(r.errors.join(" ")); return; }
      router.refresh();
    } catch (e) {
      setMessage(`Couldn't save (${e.message})`);
    }
  });
  return (
    <div className="actions">
      <input aria-label={`Points for ${entry.title}`} type="number" min="0" value={points} onChange={(e) => setPoints(e.target.value)} style={{ width: 80 }} />
      <button type="button" className="btn" disabled={pending} onClick={() => run(() => verifyEntryAction(entry.id, points))}>Verify</button>
      <button type="button" className="btn btn--ghost" disabled={pending} onClick={() => run(() => declineEntryAction(entry.id))}>Decline</button>
      {message && <span role="status">{message}</span>}
    </div>
  );
}
```

`components/admin/AddEntryForm.jsx`:

```jsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addEntryAction } from "@/app/admin/members/actions.js";

const EMPTY = { memberId: "", kind: "training", title: "", date: "", note: "", points: "" };

export default function AddEntryForm({ members }) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState([]);
  const [pending, start] = useTransition();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = () => start(async () => {
    try {
      if (!form.memberId) { setErrors(["Choose a member"]); return; }
      const r = await addEntryAction(form.memberId, form);
      if (!r.ok) { setErrors(r.errors); return; }
      setErrors([]);
      setForm(EMPTY);
      router.refresh();
    } catch (e) {
      setErrors([`Couldn't save (${e.message})`]);
    }
  });
  return (
    <section className="editor__side">
      <h2 className="syne">Add a verified entry</h2>
      {errors.length > 0 && <div className="form-errors" role="alert"><ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul></div>}
      <div className="field">
        <label htmlFor="ae-member">Member</label>
        <select id="ae-member" value={form.memberId} onChange={set("memberId")}>
          <option value="">Choose…</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="ae-kind">Kind</label>
        <select id="ae-kind" value={form.kind} onChange={set("kind")}>
          <option value="training">Training</option><option value="project_led">Project led</option><option value="project_joined">Project joined</option><option value="award">Award</option><option value="position">Position</option>
        </select>
      </div>
      <div className="field"><label htmlFor="ae-title">Title</label><input id="ae-title" value={form.title} onChange={set("title")} /></div>
      <div className="field"><label htmlFor="ae-date">Date</label><input id="ae-date" type="date" value={form.date} onChange={set("date")} /></div>
      <div className="field"><label htmlFor="ae-points">Points (empty = default)</label><input id="ae-points" type="number" min="0" value={form.points} onChange={set("points")} /></div>
      <div className="field"><label htmlFor="ae-note">Note</label><input id="ae-note" value={form.note} onChange={set("note")} /></div>
      <button type="button" className="btn" disabled={pending} onClick={save}>Add entry</button>
    </section>
  );
}
```

`app/admin/members/page.jsx`:

```jsx
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listMembersAdmin } from "@/lib/members/profile.js";
import AdminNav from "@/components/admin/AdminNav.jsx";
import MemberRow from "@/components/admin/MemberRow.jsx";

export const metadata = { title: "Members — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminMembers() {
  await requireArea("content");
  const list = await listMembersAdmin(getDb());
  return (
    <div className="admin">
      <h1>Members</h1>
      <AdminNav isAdmin />
      <p>A member's email links their sign-in account to this record on their first sign-in.</p>
      <table className="admin-table">
        <thead><tr><th>Member</th><th>Email</th><th>Status</th><th>Directory</th><th></th></tr></thead>
        <tbody>{list.map((m) => <MemberRow key={m.id} member={m} />)}</tbody>
      </table>
    </div>
  );
}
```

`app/admin/passport/page.jsx`:

```jsx
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listRequestedEntries, KIND_LABELS } from "@/lib/members/passport.js";
import { listMembersAdmin } from "@/lib/members/profile.js";
import { formatDate } from "@/lib/format.js";
import AdminNav from "@/components/admin/AdminNav.jsx";
import PassportReview from "@/components/admin/PassportReview.jsx";
import AddEntryForm from "@/components/admin/AddEntryForm.jsx";

export const metadata = { title: "Passport — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminPassport() {
  await requireArea("content");
  const db = getDb();
  const [requests, members] = await Promise.all([listRequestedEntries(db), listMembersAdmin(db)]);
  return (
    <div className="admin">
      <h1>Leadership Passport</h1>
      <AdminNav isAdmin />
      <h2 className="syne">Requests ({requests.length})</h2>
      {requests.length === 0 ? <p>No requests waiting.</p> : (
        <table className="admin-table">
          <thead><tr><th>Member</th><th>Entry</th><th>Date</th><th>Review</th></tr></thead>
          <tbody>
            {requests.map((e) => (
              <tr key={e.id}>
                <td>{e.memberName}</td>
                <td>{KIND_LABELS[e.kind]}: {e.title}{e.note ? <><br /><span className="count">{e.note}</span></> : null}</td>
                <td>{formatDate(e.date)}</td>
                <td><PassportReview entry={e} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <AddEntryForm members={members.map((m) => ({ id: m.id, name: m.name }))} />
    </div>
  );
}
```

In `components/admin/AdminNav.jsx`, add after the Expenses link:

```jsx
          <Link href="/admin/members">Members</Link>
          <Link href="/admin/passport">Passport</Link>
```

- [ ] **Step 2: Build**

Run: `NEXT_DIST_DIR=.next-check npx next build`
Expected: build lists `/admin/members` and `/admin/passport`.

- [ ] **Step 3: Commit**

```bash
git add components/admin/MemberRow.jsx components/admin/PassportReview.jsx components/admin/AddEntryForm.jsx components/admin/AdminNav.jsx app/admin/members/page.jsx app/admin/passport
git commit -m "Add admin screens for member records and passport verification"
```

---

### Task 7: Hiligaynon pages

**Files:**
- Create: `lib/i18n.js`, `test/i18n.test.js`, `components/pages/HomePage.jsx`, `components/pages/JoinPage.jsx`, `components/pages/EventsPage.jsx`, `components/pages/SupportPage.jsx`, `app/hil/page.jsx`, `app/hil/join/page.jsx`, `app/hil/events/page.jsx`, `app/hil/support/page.jsx`
- Modify: `lib/seo.js`, `test/seo.test.js`, `app/page.jsx`, `app/join/page.jsx`, `app/events/page.jsx`, `app/support/page.jsx`, `components/SiteFooter.jsx`, `components/forms/ApplicationForm.jsx`, `components/forms/PledgeForm.jsx`, `app/sitemap.js`

**Interfaces:**
- Produces: `hilEnabled()`, `HIL_PATHS`, `languageAlternates(enPath)`, `t(lang, key)`, `pathFor(lang, enPath)`; `pageMetadata({ …, languages, locale })`; page components taking `lang`.

- [ ] **Step 1: Write the failing tests**

`test/i18n.test.js`:

```js
import { describe, it, expect, afterEach } from "vitest";
import { t, hilEnabled, languageAlternates, pathFor, STRINGS } from "@/lib/i18n.js";

afterEach(() => { delete process.env.NEXT_PUBLIC_HILIGAYNON; });

describe("i18n", () => {
  it("translates and falls back to English", () => {
    expect(t("hil", "join.title")).toBe("Mangin miyembro");
    expect(t("en", "join.title")).toBe("Become a member");
    expect(t("hil", "no.such.key")).toBe("no.such.key");
  });

  it("has an English string for every Hiligaynon key", () => {
    for (const key of Object.keys(STRINGS.hil)) expect(STRINGS.en[key], key).toBeTypeOf("string");
  });

  it("keeps the English form labels the site already uses", () => {
    expect(["form.fullName", "form.email", "form.birthdate", "form.apply", "form.amount", "form.reference", "form.submitPayment"].map((k) => t("en", k))).toEqual([
      "Full name", "Email", "Birthdate", "Apply", "Amount (₱)", "Reference number", "Submit payment details",
    ]);
  });

  it("is off unless the flag is on", () => {
    expect(hilEnabled()).toBe(false);
    expect(languageAlternates("/join")).toBeUndefined();
    process.env.NEXT_PUBLIC_HILIGAYNON = "on";
    expect(hilEnabled()).toBe(true);
    expect(languageAlternates("/join")).toEqual({ en: "/join", hil: "/hil/join" });
  });

  it("maps paths between languages", () => {
    expect(pathFor("hil", "/")).toBe("/hil");
    expect(pathFor("en", "/support")).toBe("/support");
  });
});
```

`test/seo.test.js` (append):

```js
describe("pageMetadata languages", () => {
  it("adds hreflang alternates and a locale when given", () => {
    const m = pageMetadata({ title: "Mangin miyembro", description: "d", path: "/hil/join", languages: { en: "/join", hil: "/hil/join" }, locale: "hil_PH" });
    expect(m.alternates).toEqual({ canonical: "/hil/join", languages: { en: "/join", hil: "/hil/join" } });
    expect(m.openGraph.locale).toBe("hil_PH");
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run test/i18n.test.js test/seo.test.js`
Expected: FAIL — module not found; alternates lack `languages`.

- [ ] **Step 3: i18n dictionary and metadata**

`lib/i18n.js`:

```js
// English and Hiligaynon strings for the four public pages that have a
// Hiligaynon twin. ALL Hiligaynon text is a first draft written by Claude and
// must be checked by a native speaker before NEXT_PUBLIC_HILIGAYNON is set to "on".

export const hilEnabled = () => process.env.NEXT_PUBLIC_HILIGAYNON === "on";

export const HIL_PATHS = { "/": "/hil", "/join": "/hil/join", "/events": "/hil/events", "/support": "/hil/support" };

export function languageAlternates(enPath) {
  if (!hilEnabled() || !HIL_PATHS[enPath]) return undefined;
  return { en: enPath, hil: HIL_PATHS[enPath] };
}

export const pathFor = (lang, enPath) => (lang === "hil" ? HIL_PATHS[enPath] ?? enPath : enPath);

export const STRINGS = {
  en: {
    "cta.member": "Become a Member →",
    "home.title": "JCI Roxas Halaran | Leadership & Entrepreneurship in Roxas City, Capiz",
    "home.statement": "Our offering to Capiz: young leaders turning local needs into lasting action.",
    "home.metaBased": "Based in Roxas City, Capiz, 5800",
    "home.metaJci": "Part of JCI, in 100+ countries",
    "home.metaPillars": "Leadership · Entrepreneurship",
    "home.aboutLabel": "About Us",
    "home.aboutTitle": "We are a Capiz-based JCI chapter",
    "home.aboutBody": "Connecting members worldwide through shared values and empowering them to create positive change and opportunities on a global scale.",
    "home.projectsTitle": "Stories from our projects",
    "home.projectsLabel": "02 — Projects",
    "home.projectsMore": "See all projects",
    "home.eventsTitle": "Upcoming events",
    "home.eventsMore": "All events",
    "home.blogTitle": "From the blog",
    "home.blogLabel": "Articles",
    "home.blogMore": "All articles",
    "home.goalLabel": "03 — Our Goal",
    "home.quote": "Great leaders don't set out to be a leader… they set out to make a difference.",
    "home.impactLabel": "Impact",
    "home.impactEnd": "In numbers",
    "home.mission": "Our mission:",
    "home.since": "05 — Since",
    "home.history": "The Philippine Jaycees, now JCI Philippines, is the first nationally organized leadership development organization in Asia. JCI Roxas Halaran carries that tradition into Capiz.",
    "home.storyLink": "Our story and recognition →",
    "home.photoAlt": "JCI Roxas Halaran members at a chapter activity",
    "join.title": "Become a member",
    "join.description": "Join JCI Roxas Halaran: who can join, membership benefits, fees and how to contact us in Roxas City, Capiz.",
    "join.intro": "Join a worldwide network of young active citizens aged 18 to 40 creating positive change, starting right here in Roxas City.",
    "join.applyTitle": "Apply online",
    "join.applyLabel": "Membership",
    "join.applyIntro": "Open to anyone aged 18 to 40. We'll review your application and contact you about orientation and dues.",
    "join.contactTitle": "Get in touch",
    "join.contactLabel": "Contact",
    "join.location": "Location",
    "join.messagePage": "Message our page",
    "join.templatesLabel": "Free templates",
    "join.templates": "Download our resources",
    "join.faqTitle": "Frequently asked questions",
    "events.title": "Events",
    "events.description": "Upcoming JCI Roxas Halaran events in Roxas City, Capiz: trainings, community projects and general assemblies. RSVP online.",
    "events.intro": "Join us at our next training, project or assembly. Most events are open to guests.",
    "events.upcoming": "Upcoming",
    "events.rsvpLabel": "RSVP online",
    "events.none": "New events are coming soon — follow our Facebook page for announcements.",
    "events.past": "Past events",
    "events.archive": "Archive",
    "support.title": "Support our projects",
    "support.description": "Donate or sponsor JCI Roxas Halaran community projects in Capiz via GCash, Maya or bank transfer. See how much each campaign has raised.",
    "support.intro": "Every peso goes to community projects in Capiz. Only payments our treasurer has confirmed count toward each goal.",
    "support.campaign": "Campaign",
    "support.pledgeTitle": "Tell us you paid",
    "support.pledgeLabel": "Pledge",
    "support.pledgeIntro": "After paying with the QR code, send us your reference number so we can confirm it.",
    "form.fullName": "Full name",
    "form.name": "Name",
    "form.email": "Email",
    "form.mobile": "Mobile",
    "form.birthdate": "Birthdate",
    "form.barangay": "Barangay",
    "form.whyJoin": "Why do you want to join?",
    "form.referredBy": "Referred by (optional)",
    "form.apply": "Apply",
    "form.sending": "Sending…",
    "form.consentApply": "I agree that JCI Roxas Halaran may use these details to process my application, under the Data Privacy Act of 2012.",
    "form.paymentFor": "What is this payment for?",
    "form.donationPrefix": "Donation:",
    "form.generalDonation": "General donation",
    "form.sponsorship": "Sponsorship",
    "form.membershipFee": "Membership fee",
    "form.amount": "Amount (₱)",
    "form.paidWith": "Paid with",
    "form.bank": "Bank transfer",
    "form.reference": "Reference number",
    "form.screenshot": "Receipt screenshot (optional)",
    "form.uploading": "Uploading…",
    "form.attached": "Screenshot attached.",
    "form.consentPay": "I agree that JCI Roxas Halaran may use these details to confirm my payment, under the Data Privacy Act of 2012.",
    "form.submitPayment": "Submit payment details",
    "footer.switch": "Hiligaynon",
  },
  hil: {
    "cta.member": "Mangin miyembro →",
    "home.title": "JCI Roxas Halaran | Liderato kag Pangnegosyo sa Roxas City, Capiz",
    "home.statement": "Ang amon halad sa Capiz: mga pamatan-on nga lider nga nagabaylo sang mga kinahanglanon sang komunidad sa malawig nga aksyon.",
    "home.metaBased": "Nakabase sa Roxas City, Capiz, 5800",
    "home.metaJci": "Bahin sang JCI, sa sobra 100 ka pungsod",
    "home.metaPillars": "Liderato · Pangnegosyo",
    "home.aboutLabel": "Parte sa Amon",
    "home.aboutTitle": "Kami isa ka JCI chapter nga nakabase sa Capiz",
    "home.aboutBody": "Ginaangot namon ang mga miyembro sa bilog nga kalibutan paagi sa pareho nga mga balor, kag ginahatagan sila sang ikasarang nga maghimo sang maayo nga pagbag-o kag kahigayunan.",
    "home.projectsTitle": "Mga istorya halin sa amon mga proyekto",
    "home.projectsLabel": "02 — Mga Proyekto",
    "home.projectsMore": "Tan-awa ang tanan nga proyekto",
    "home.eventsTitle": "Mga masunod nga hitabo",
    "home.eventsMore": "Tanan nga hitabo",
    "home.blogTitle": "Halin sa amon blog",
    "home.blogLabel": "Mga Artikulo",
    "home.blogMore": "Tanan nga artikulo",
    "home.goalLabel": "03 — Amon Tulumuron",
    "home.quote": "Ang daku nga lider wala nagatinguha nga mangin lider… nagatinguha sila nga maghimo sang pagbag-o.",
    "home.impactLabel": "Epekto",
    "home.impactEnd": "Sa numero",
    "home.mission": "Amon misyon:",
    "home.since": "05 — Sugod sang",
    "home.history": "Ang Philippine Jaycees, nga karon JCI Philippines, amo ang una nga nasyonal nga organisasyon para sa pag-uswag sang liderato sa Asya. Ginadala sang JCI Roxas Halaran ini nga tradisyon sa Capiz.",
    "home.storyLink": "Amon istorya kag mga pagkilala →",
    "home.photoAlt": "Mga miyembro sang JCI Roxas Halaran sa isa ka aktibidad sang chapter",
    "join.title": "Mangin miyembro",
    "join.description": "Mag-intra sa JCI Roxas Halaran: sin-o ang puede mag-intra, mga benepisyo, bayad, kag paano kami makontak sa Roxas City, Capiz.",
    "join.intro": "Mag-intra sa kalibutan nga network sang mga aktibo nga pamatan-on nga edad 18 tubtob 40 nga nagahimo sang maayo nga pagbag-o, sugod diri sa Roxas City.",
    "join.applyTitle": "Mag-aplay online",
    "join.applyLabel": "Pagkamiyembro",
    "join.applyIntro": "Bukas para sa bisan sin-o nga edad 18 tubtob 40. Usisaon namon ang imo aplikasyon kag kontakon ka parte sa orientation kag bayad.",
    "join.contactTitle": "Kontaka kami",
    "join.contactLabel": "Kontak",
    "join.location": "Lugar",
    "join.messagePage": "Mag-message sa amon page",
    "join.templatesLabel": "Libre nga templates",
    "join.templates": "I-download ang amon mga resources",
    "join.faqTitle": "Masami nga mga pamangkot",
    "events.title": "Mga Hitabo",
    "events.description": "Mga masunod nga hitabo sang JCI Roxas Halaran sa Roxas City, Capiz: training, proyekto sang komunidad kag asembleya. Mag-RSVP online.",
    "events.intro": "Intra sa amon masunod nga training, proyekto ukon asembleya. Ang kalabanan nga hitabo bukas sa mga bisita.",
    "events.upcoming": "Masunod",
    "events.rsvpLabel": "Mag-RSVP online",
    "events.none": "May bag-o nga mga hitabo nga madali lang — sunda ang amon Facebook page para sa mga pahibalo.",
    "events.past": "Nagligad nga mga hitabo",
    "events.archive": "Arkibo",
    "support.title": "Suportahi ang amon mga proyekto",
    "support.description": "Mag-donar ukon mag-sponsor sa mga proyekto sang JCI Roxas Halaran sa Capiz paagi sa GCash, Maya ukon bank transfer.",
    "support.intro": "Ang kada piso nagakadto sa mga proyekto sang komunidad sa Capiz. Ang mga bayad lang nga ginkumpirma sang amon treasurer ang ginaisip sa kada tulumuron.",
    "support.campaign": "Kampanya",
    "support.pledgeTitle": "Ipahibalo sa amon nga nakabayad ka",
    "support.pledgeLabel": "Pledge",
    "support.pledgeIntro": "Pagkatapos magbayad paagi sa QR code, ipadala sa amon ang imo reference number agod makumpirma namon.",
    "form.fullName": "Bug-os nga ngalan",
    "form.name": "Ngalan",
    "form.email": "Email",
    "form.mobile": "Mobile",
    "form.birthdate": "Petsa sang pagkatawo",
    "form.barangay": "Barangay",
    "form.whyJoin": "Ngaa gusto mo mag-intra?",
    "form.referredBy": "Ginrekomenda ni (kon may ara)",
    "form.apply": "Mag-aplay",
    "form.sending": "Ginapadala…",
    "form.consentApply": "Nagasugot ako nga gamiton sang JCI Roxas Halaran ini nga mga detalye para sa akon aplikasyon, suno sa Data Privacy Act of 2012.",
    "form.paymentFor": "Para sa diin ini nga bayad?",
    "form.donationPrefix": "Donasyon:",
    "form.generalDonation": "Kinatibuk-an nga donasyon",
    "form.sponsorship": "Sponsorship",
    "form.membershipFee": "Bayad sa pagkamiyembro",
    "form.amount": "Kantidad (₱)",
    "form.paidWith": "Ginbayad paagi sa",
    "form.bank": "Bank transfer",
    "form.reference": "Reference number",
    "form.screenshot": "Screenshot sang resibo (kon gusto)",
    "form.uploading": "Ginaupload…",
    "form.attached": "Naka-attach na ang screenshot.",
    "form.consentPay": "Nagasugot ako nga gamiton sang JCI Roxas Halaran ini nga mga detalye agod makumpirma ang akon bayad, suno sa Data Privacy Act of 2012.",
    "form.submitPayment": "Ipadala ang detalye sang bayad",
    "footer.switch": "English",
  },
};

export function t(lang, key) {
  return STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
}
```

In `lib/seo.js`, replace the `pageMetadata` function with:

```js
export function pageMetadata({ title, description, path, languages, locale = "en_PH" }) {
  const ogTitle = typeof title === "string" ? `${title} | ${SITE.name}` : title.absolute;
  const image = absoluteUrl(SITE.ogImage);
  return {
    title,
    description,
    alternates: languages ? { canonical: path, languages } : { canonical: path },
    openGraph: {
      title: ogTitle,
      description,
      url: absoluteUrl(path),
      siteName: SITE.name,
      locale,
      type: "website",
      images: [{ url: image }],
    },
    twitter: { card: "summary_large_image", title: ogTitle, description, images: [image] },
  };
}
```

Run: `npx vitest run test/i18n.test.js test/seo.test.js`
Expected: PASS.

- [ ] **Step 4: Footer, forms and shared page components**

`components/SiteFooter.jsx`:

```jsx
import Link from "next/link";
import Image from "next/image";
import { SITE } from "@/lib/site.js";
import { hilEnabled, t } from "@/lib/i18n.js";

export default function SiteFooter({ cta = true, lang = "en", altHref = null }) {
  return (
    <footer className="cta-footer">
      {cta && (
        <div className="cta-footer__inner">
          <Image src={SITE.logo} alt="" width={149} height={72} />
          <p className="cta-footer__title">{lang === "hil" ? "Mangin" : "Become a"}<br />{lang === "hil" ? "miyembro" : "member"}</p>
          <Link className="btn btn--lg" href={lang === "hil" ? "/hil/join" : "/join"}>Join JCI Roxas Halaran</Link>
        </div>
      )}
      <div className="baseline">
        <span>{SITE.name} — {SITE.address.locality}, {SITE.address.region}, {SITE.address.postalCode}</span>
        <span>
          <a href={`mailto:${SITE.email}`}>{SITE.email}</a> ·{" "}
          <a href={SITE.facebookUrl} target="_blank" rel="noopener noreferrer">Facebook</a> ·{" "}
          <Link href="/resources">Free resources</Link>
          {hilEnabled() && altHref && <> · <Link href={altHref} hrefLang={lang === "hil" ? "en" : "hil"}>{t(lang, "footer.switch")}</Link></>}
        </span>
      </div>
    </footer>
  );
}
```

`components/forms/ApplicationForm.jsx`:

```jsx
"use client";

import { useEffect, useState } from "react";
import Turnstile, { turnstileEnabled } from "./Turnstile.jsx";
import FormStatus from "./FormStatus.jsx";
import { useSubmit } from "./useSubmit.js";
import { applyAction } from "@/app/actions/engagement.js";
import { t } from "@/lib/i18n.js";

const EMPTY = { name: "", email: "", phone: "", birthdate: "", barangay: "", whyJoin: "", referredBy: "", consent: false };

export default function ApplicationForm({ lang = "en" }) {
  const [form, setForm] = useState(EMPTY);
  const [token, setToken] = useState("");
  const { submit, pending, result } = useSubmit(applyAction);
  const [resetKey, setResetKey] = useState(0);
  // The server used up the token; get a fresh one so a retry can pass.
  useEffect(() => { if (result && !result.ok) setResetKey((k) => k + 1); }, [result]);
  const waitingForCheck = turnstileEnabled() && !token;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const L = (key) => t(lang, key);

  if (result?.ok) return <p className="form-ok" role="status">{result.message}</p>;
  return (
    <form className="public-form" onSubmit={(e) => { e.preventDefault(); submit({ ...form, turnstileToken: token }); }}>
      <div className="field"><label htmlFor="ap-name">{L("form.fullName")}</label><input id="ap-name" value={form.name} onChange={set("name")} required autoComplete="name" /></div>
      <div className="field"><label htmlFor="ap-email">{L("form.email")}</label><input id="ap-email" type="email" value={form.email} onChange={set("email")} required autoComplete="email" /></div>
      <div className="field"><label htmlFor="ap-phone">{L("form.mobile")}</label><input id="ap-phone" value={form.phone} onChange={set("phone")} autoComplete="tel" /></div>
      <div className="field"><label htmlFor="ap-birth">{L("form.birthdate")}</label><input id="ap-birth" type="date" value={form.birthdate} onChange={set("birthdate")} required /></div>
      <div className="field"><label htmlFor="ap-brgy">{L("form.barangay")}</label><input id="ap-brgy" value={form.barangay} onChange={set("barangay")} /></div>
      <div className="field"><label htmlFor="ap-why">{L("form.whyJoin")}</label><textarea id="ap-why" rows={4} value={form.whyJoin} onChange={set("whyJoin")} /></div>
      <div className="field"><label htmlFor="ap-ref">{L("form.referredBy")}</label><input id="ap-ref" value={form.referredBy} onChange={set("referredBy")} /></div>
      <label className="consent"><input type="checkbox" checked={form.consent} onChange={set("consent")} required /> {L("form.consentApply")}</label>
      <Turnstile onToken={setToken} resetKey={resetKey} />
      <FormStatus result={result} />
      <button className="btn" type="submit" disabled={pending || waitingForCheck}>{pending ? L("form.sending") : L("form.apply")}</button>
    </form>
  );
}
```

`components/forms/PledgeForm.jsx`:

```jsx
"use client";

import { useEffect, useState } from "react";
import { upload } from "@vercel/blob/client";
import Turnstile, { turnstileEnabled } from "./Turnstile.jsx";
import FormStatus from "./FormStatus.jsx";
import { useSubmit } from "./useSubmit.js";
import { pledgeAction } from "@/app/actions/engagement.js";
import { checkUpload } from "@/lib/uploads.js";
import { t } from "@/lib/i18n.js";

const MAX_PROOF = 5 * 1024 * 1024;

export default function PledgeForm({ campaigns, defaultCampaignId = "", lang = "en" }) {
  const [form, setForm] = useState({ campaignId: defaultCampaignId, type: "donation", payerName: "", payerEmail: "", amountPesos: "", method: "gcash", referenceNo: "", proofUrl: "", consent: false });
  const [token, setToken] = useState("");
  const [proofError, setProofError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const { submit, pending, result } = useSubmit(pledgeAction);
  const [resetKey, setResetKey] = useState(0);
  // The server used up the token; get a fresh one so a retry can pass.
  useEffect(() => { if (result && !result.ok) setResetKey((k) => k + 1); }, [result]);
  const waitingForCheck = turnstileEnabled() && !token;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const L = (key) => t(lang, key);

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
      setResetKey((k) => k + 1); // the upload check used the token
    }
  }

  if (result?.ok) return <p className="form-ok" role="status">{result.message}</p>;
  return (
    <form className="public-form" onSubmit={(e) => { e.preventDefault(); submit({ ...form, turnstileToken: token }); }}>
      <div className="field">
        <label htmlFor="pl-for">{L("form.paymentFor")}</label>
        <select id="pl-for" value={form.type === "donation" ? form.campaignId : form.type} onChange={(e) => {
          const v = e.target.value;
          setForm((f) => (v === "membership_fee" || v === "sponsorship" ? { ...f, type: v, campaignId: "" } : { ...f, type: "donation", campaignId: v }));
        }}>
          {campaigns.map((c) => <option key={c.id} value={c.id}>{L("form.donationPrefix")} {c.title}</option>)}
          <option value="">{L("form.generalDonation")}</option>
          <option value="sponsorship">{L("form.sponsorship")}</option>
          <option value="membership_fee">{L("form.membershipFee")}</option>
        </select>
      </div>
      <div className="field"><label htmlFor="pl-name">{L("form.name")}</label><input id="pl-name" value={form.payerName} onChange={set("payerName")} required autoComplete="name" /></div>
      <div className="field"><label htmlFor="pl-email">{L("form.email")}</label><input id="pl-email" type="email" value={form.payerEmail} onChange={set("payerEmail")} required autoComplete="email" /></div>
      <div className="field"><label htmlFor="pl-amount">{L("form.amount")}</label><input id="pl-amount" type="number" min="1" step="0.01" value={form.amountPesos} onChange={set("amountPesos")} required inputMode="decimal" /></div>
      <div className="field">
        <label htmlFor="pl-method">{L("form.paidWith")}</label>
        <select id="pl-method" value={form.method} onChange={set("method")}>
          <option value="gcash">GCash</option><option value="maya">Maya</option><option value="bank">{L("form.bank")}</option>
        </select>
      </div>
      <div className="field"><label htmlFor="pl-ref">{L("form.reference")}</label><input id="pl-ref" value={form.referenceNo} onChange={set("referenceNo")} required /></div>
      <div className="field">
        <label htmlFor="pl-proof">{L("form.screenshot")}</label>
        <input id="pl-proof" type="file" accept="image/jpeg,image/png,image/webp" onChange={attach} disabled={uploading || waitingForCheck} />
        {uploading && <span className="count">{L("form.uploading")}</span>}
        {form.proofUrl && <span className="count">{L("form.attached")}</span>}
        {proofError && <p className="form-error" role="alert">{proofError}</p>}
      </div>
      <label className="consent"><input type="checkbox" checked={form.consent} onChange={set("consent")} required /> {L("form.consentPay")}</label>
      <Turnstile onToken={setToken} resetKey={resetKey} />
      <FormStatus result={result} />
      <button className="btn" type="submit" disabled={pending || uploading || waitingForCheck}>{pending ? L("form.sending") : L("form.submitPayment")}</button>
    </form>
  );
}
```

`components/pages/HomePage.jsx`:

```jsx
import Link from "next/link";
import Image from "next/image";
import Contours from "@/components/Contours.jsx";
import ProjectCard from "@/components/ProjectCard.jsx";
import ArticleCard from "@/components/ArticleCard.jsx";
import EventCard from "@/components/EventCard.jsx";
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import { getDb } from "@/lib/db.js";
import { listProjects, listAwards } from "@/lib/queries.js";
import { listPublishedArticles } from "@/lib/content/articles.js";
import { listEvents } from "@/lib/engagement/events.js";
import { organizationLd } from "@/lib/seo.js";
import { SITE } from "@/lib/site.js";
import { t, pathFor } from "@/lib/i18n.js";

export default async function HomePage({ lang = "en" }) {
  const L = (key) => t(lang, key);
  const db = getDb();
  const [projects, awards, latest, events] = await Promise.all([
    listProjects(db, { limit: 3 }),
    listAwards(db),
    listPublishedArticles(db, { limit: 3 }),
    listEvents(db),
  ]);
  const [based, place] = L("home.metaBased").split(/, (?=Capiz)/);

  return (
    <div lang={lang === "hil" ? "hil" : undefined}>
      <JsonLd data={organizationLd()} />

      <header className="hero">
        <Contours variant="hero" />
        <div className="hero__inner">
          <h1 className="hero__title">JCI Roxas<br />Halaran<em>.</em></h1>
          <p className="hero__statement">{L("home.statement")}</p>
          <div className="hero__meta">
            <span>{based},<br />{place}</span>
            <span>{L("home.metaJci")}</span>
            <span>{L("home.metaPillars")}</span>
            <Link className="btn" href={pathFor(lang, "/join")}>{L("cta.member")}</Link>
          </div>
        </div>
      </header>

      <section id="about" className="section section--line-top">
        <div className="crumbs label">
          <span className="num">01</span><span className="mid">{L("home.aboutLabel")}</span><span className="end">{SITE.name}</span>
        </div>
        <div className="about__grid">
          <h2>{L("home.aboutTitle")}</h2>
          <p>{L("home.aboutBody")}</p>
        </div>
        <div className="pillars">
          {SITE.pillars.map((p) => (
            <div className="pillar" key={p.num} lang="en">
              <span className="num">{p.num}</span>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="projects" className="section">
        <div className="section__bar">
          <h2>{L("home.projectsTitle")}</h2>
          <span className="label">{L("home.projectsLabel")}</span>
        </div>
        <div className="projects">
          {projects.map((p) => <ProjectCard key={p.slug} project={p} />)}
        </div>
        <p className="section__more"><Link className="btn" href="/projects">{L("home.projectsMore")}</Link></p>
      </section>

      {events.upcoming.length > 0 && (
        <section className="section">
          <div className="section__bar">
            <h2>{L("home.eventsTitle")}</h2>
            <span className="label">RSVP</span>
          </div>
          <div className="projects">{events.upcoming.slice(0, 3).map((e) => <EventCard key={e.id} event={e} />)}</div>
          <p className="section__more"><Link className="btn" href={pathFor(lang, "/events")}>{L("home.eventsMore")}</Link></p>
        </section>
      )}

      {latest.length > 0 && (
        <section className="section">
          <div className="section__bar">
            <h2>{L("home.blogTitle")}</h2>
            <span className="label">{L("home.blogLabel")}</span>
          </div>
          <div className="projects">{latest.map((a) => <ArticleCard key={a.id} article={a} />)}</div>
          <p className="section__more"><Link className="btn" href="/articles">{L("home.blogMore")}</Link></p>
        </section>
      )}

      <section className="quote">
        <Contours variant="quote" />
        <div className="quote__inner">
          <span className="label">{L("home.goalLabel")}</span>
          <p className="quote__text">{L("home.quote")}</p>
        </div>
      </section>

      <section className="section section--line-bottom">
        <div className="crumbs label">
          <span className="num">04</span><span className="mid">{L("home.impactLabel")}</span><span className="end">{L("home.impactEnd")}</span>
        </div>
        <div className="stats">
          {SITE.stats.map((s) => (
            <div className="stat" key={s.label} lang="en">
              <span className="v">{s.value}</span>
              <span className="l">{s.label}</span>
            </div>
          ))}
        </div>
        <p className="stats__mission">{L("home.mission")} <span lang="en">{SITE.mission}</span></p>
      </section>

      <section className="dune section">
        <div className="dune__grid">
          <div className="dune__col">
            <span className="label">{L("home.since")} {SITE.foundedYear}</span>
            <p className="dune__lede">{L("home.history")}</p>
            <div className="dune__stats">
              {awards.slice(0, 2).map((a) => (
                <div className="dune__stat" key={a.id}>
                  <span className="v">{a.year}</span>
                  <span className="l" lang="en">{a.title}</span>
                </div>
              ))}
            </div>
            <p className="dune__note"><Link href="/about">{L("home.storyLink")}</Link></p>
          </div>
          <div className="dune__photo">
            <Image src={SITE.aboutPhoto} alt={L("home.photoAlt")} fill sizes="(max-width: 900px) 100vw, 50vw" style={{ objectFit: "cover" }} />
          </div>
        </div>
      </section>

      <SiteFooter lang={lang} altHref={lang === "hil" ? "/" : "/hil"} />
    </div>
  );
}
```

`components/pages/JoinPage.jsx`:

```jsx
import Link from "next/link";
import FaqList from "@/components/FaqList.jsx";
import ApplicationForm from "@/components/forms/ApplicationForm.jsx";
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import { getDb } from "@/lib/db.js";
import { listFaqs } from "@/lib/queries.js";
import { breadcrumbLd } from "@/lib/seo.js";
import { SITE } from "@/lib/site.js";
import { t, pathFor } from "@/lib/i18n.js";

export default async function JoinPage({ lang = "en" }) {
  const L = (key) => t(lang, key);
  const faqs = await listFaqs(getDb());
  return (
    <div lang={lang === "hil" ? "hil" : undefined}>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: pathFor(lang, "/") }, { name: L("join.title"), path: pathFor(lang, "/join") }])} />
      <header className="page-hero">
        <h1>{L("join.title")}</h1>
        <p>{L("join.intro")}</p>
      </header>

      <section id="apply" className="section">
        <div className="section__bar"><h2>{L("join.applyTitle")}</h2><span className="label">{L("join.applyLabel")}</span></div>
        <p>{L("join.applyIntro")}</p>
        <ApplicationForm lang={lang} />
      </section>

      <section id="contact" className="section">
        <div className="section__bar"><h2>{L("join.contactTitle")}</h2><span className="label">{L("join.contactLabel")}</span></div>
        <div className="contact">
          <div><span className="l">Email</span><a href={`mailto:${SITE.email}`}>{SITE.email}</a></div>
          <div><span className="l">Facebook</span><a href={SITE.facebookUrl} target="_blank" rel="noopener noreferrer">{L("join.messagePage")}</a></div>
          <div><span className="l">{L("join.location")}</span><span>{SITE.address.locality}, {SITE.address.region} {SITE.address.postalCode}</span></div>
          <div><span className="l">{L("join.templatesLabel")}</span><Link href="/resources">{L("join.templates")}</Link></div>
        </div>
      </section>

      <section id="faq" className="dune section">
        <div className="faq__grid">
          <div className="faq__head">
            <span className="label">FAQ</span>
            <h2>{L("join.faqTitle")}</h2>
          </div>
          <div lang="en"><FaqList faqs={faqs} /></div>
        </div>
      </section>

      <SiteFooter cta={false} lang={lang} altHref={lang === "hil" ? "/join" : "/hil/join"} />
    </div>
  );
}
```

`components/pages/EventsPage.jsx`:

```jsx
import EventCard from "@/components/EventCard.jsx";
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import { getDb } from "@/lib/db.js";
import { listEvents } from "@/lib/engagement/events.js";
import { breadcrumbLd } from "@/lib/seo.js";
import { t, pathFor } from "@/lib/i18n.js";

export default async function EventsPage({ lang = "en" }) {
  const L = (key) => t(lang, key);
  const { upcoming, past } = await listEvents(getDb());
  return (
    <div lang={lang === "hil" ? "hil" : undefined}>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: pathFor(lang, "/") }, { name: L("events.title"), path: pathFor(lang, "/events") }])} />
      <header className="page-hero">
        <h1>{L("events.title")}</h1>
        <p>{L("events.intro")}</p>
      </header>
      <section className="section">
        <div className="section__bar"><h2>{L("events.upcoming")}</h2><span className="label">{L("events.rsvpLabel")}</span></div>
        {upcoming.length === 0 ? <p>{L("events.none")}</p> : (
          <div className="projects">{upcoming.map((e) => <EventCard key={e.id} event={e} />)}</div>
        )}
      </section>
      {past.length > 0 && (
        <section className="section">
          <div className="section__bar"><h2>{L("events.past")}</h2><span className="label">{L("events.archive")}</span></div>
          <div className="projects">{past.slice(0, 6).map((e) => <EventCard key={e.id} event={e} />)}</div>
        </section>
      )}
      <SiteFooter lang={lang} altHref={lang === "hil" ? "/events" : "/hil/events"} />
    </div>
  );
}
```

`components/pages/SupportPage.jsx`:

```jsx
import Image from "next/image";
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import ProgressBar from "@/components/ProgressBar.jsx";
import PledgeForm from "@/components/forms/PledgeForm.jsx";
import { getDb } from "@/lib/db.js";
import { listCampaigns } from "@/lib/engagement/money.js";
import { breadcrumbLd } from "@/lib/seo.js";
import { t, pathFor } from "@/lib/i18n.js";

export default async function SupportPage({ lang = "en" }) {
  const L = (key) => t(lang, key);
  const campaigns = await listCampaigns(getDb(), { openOnly: true });
  return (
    <div lang={lang === "hil" ? "hil" : undefined}>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: pathFor(lang, "/") }, { name: L("support.title"), path: pathFor(lang, "/support") }])} />
      <header className="page-hero">
        <h1>{L("support.title")}</h1>
        <p>{L("support.intro")}</p>
      </header>
      {campaigns.map((c) => (
        <section className="section section--line-top campaign" id={c.slug} key={c.id}>
          <div className="section__bar"><h2 lang="en">{c.title}</h2><span className="label">{L("support.campaign")}</span></div>
          <div className="campaign__grid">
            <div>
              {c.description && <p lang="en">{c.description}</p>}
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
        <div className="section__bar"><h2>{L("support.pledgeTitle")}</h2><span className="label">{L("support.pledgeLabel")}</span></div>
        <p>{L("support.pledgeIntro")}</p>
        <PledgeForm lang={lang} campaigns={campaigns.map((c) => ({ id: c.id, title: c.title }))} defaultCampaignId={campaigns[0] ? String(campaigns[0].id) : ""} />
      </section>
      <SiteFooter lang={lang} altHref={lang === "hil" ? "/support" : "/hil/support"} />
    </div>
  );
}
```

- [ ] **Step 5: Thin route files**

`app/page.jsx`:

```jsx
import HomePage from "@/components/pages/HomePage.jsx";
import { pageMetadata } from "@/lib/seo.js";
import { SITE } from "@/lib/site.js";
import { languageAlternates, t } from "@/lib/i18n.js";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: { absolute: t("en", "home.title") },
  description: SITE.description,
  path: "/",
  languages: languageAlternates("/"),
});

export default function Home() {
  return <HomePage lang="en" />;
}
```

`app/join/page.jsx`:

```jsx
import JoinPage from "@/components/pages/JoinPage.jsx";
import { pageMetadata } from "@/lib/seo.js";
import { languageAlternates, t } from "@/lib/i18n.js";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: t("en", "join.title"),
  description: t("en", "join.description"),
  path: "/join",
  languages: languageAlternates("/join"),
});

export default function Join() {
  return <JoinPage lang="en" />;
}
```

`app/events/page.jsx`:

```jsx
import EventsPage from "@/components/pages/EventsPage.jsx";
import { pageMetadata } from "@/lib/seo.js";
import { languageAlternates, t } from "@/lib/i18n.js";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: t("en", "events.title"),
  description: t("en", "events.description"),
  path: "/events",
  languages: languageAlternates("/events"),
});

export default function Events() {
  return <EventsPage lang="en" />;
}
```

`app/support/page.jsx`:

```jsx
import SupportPage from "@/components/pages/SupportPage.jsx";
import { pageMetadata } from "@/lib/seo.js";
import { languageAlternates, t } from "@/lib/i18n.js";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: t("en", "support.title"),
  description: t("en", "support.description"),
  path: "/support",
  languages: languageAlternates("/support"),
});

export default function Support() {
  return <SupportPage lang="en" />;
}
```

`app/hil/page.jsx`:

```jsx
import { notFound } from "next/navigation";
import HomePage from "@/components/pages/HomePage.jsx";
import { pageMetadata } from "@/lib/seo.js";
import { hilEnabled, languageAlternates, t } from "@/lib/i18n.js";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: { absolute: t("hil", "home.title") },
  description: t("hil", "home.statement"),
  path: "/hil",
  languages: languageAlternates("/"),
  locale: "hil_PH",
});

export default function HomeHil() {
  if (!hilEnabled()) notFound();
  return <HomePage lang="hil" />;
}
```

`app/hil/join/page.jsx`:

```jsx
import { notFound } from "next/navigation";
import JoinPage from "@/components/pages/JoinPage.jsx";
import { pageMetadata } from "@/lib/seo.js";
import { hilEnabled, languageAlternates, t } from "@/lib/i18n.js";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: t("hil", "join.title"),
  description: t("hil", "join.description"),
  path: "/hil/join",
  languages: languageAlternates("/join"),
  locale: "hil_PH",
});

export default function JoinHil() {
  if (!hilEnabled()) notFound();
  return <JoinPage lang="hil" />;
}
```

`app/hil/events/page.jsx`:

```jsx
import { notFound } from "next/navigation";
import EventsPage from "@/components/pages/EventsPage.jsx";
import { pageMetadata } from "@/lib/seo.js";
import { hilEnabled, languageAlternates, t } from "@/lib/i18n.js";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: t("hil", "events.title"),
  description: t("hil", "events.description"),
  path: "/hil/events",
  languages: languageAlternates("/events"),
  locale: "hil_PH",
});

export default function EventsHil() {
  if (!hilEnabled()) notFound();
  return <EventsPage lang="hil" />;
}
```

`app/hil/support/page.jsx`:

```jsx
import { notFound } from "next/navigation";
import SupportPage from "@/components/pages/SupportPage.jsx";
import { pageMetadata } from "@/lib/seo.js";
import { hilEnabled, languageAlternates, t } from "@/lib/i18n.js";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: t("hil", "support.title"),
  description: t("hil", "support.description"),
  path: "/hil/support",
  languages: languageAlternates("/support"),
  locale: "hil_PH",
});

export default function SupportHil() {
  if (!hilEnabled()) notFound();
  return <SupportPage lang="hil" />;
}
```

In `app/sitemap.js`, import `{ hilEnabled, HIL_PATHS }` from `@/lib/i18n.js` and change the `buildSitemap` call to:

```js
  const routes = hilEnabled() ? [...STATIC_ROUTES, ...Object.values(HIL_PATHS)] : STATIC_ROUTES;
  return buildSitemap({ routes, articles, projects, events: [...upcoming, ...past] });
```

- [ ] **Step 6: Run tests and build**

Run: `npx vitest run --exclude test/import-articles.test.js && NEXT_DIST_DIR=.next-check npx next build`
Expected: all PASS; build lists `/hil`, `/hil/join`, `/hil/events`, `/hil/support`.

- [ ] **Step 7: Commit**

```bash
git add lib/i18n.js lib/seo.js test/i18n.test.js test/seo.test.js components/pages components/SiteFooter.jsx components/forms/ApplicationForm.jsx components/forms/PledgeForm.jsx app/page.jsx app/join/page.jsx app/events/page.jsx app/support/page.jsx app/hil app/sitemap.js
git commit -m "Add Hiligaynon twins of home, join, events and support behind a flag (draft translations)"
```

---

### Task 8: End-to-end checks, migrate and deploy

**Files:**
- Modify: `playwright.config.js`, `e2e/site.spec.js`

- [ ] **Step 1: Turn the Hiligaynon flag on for e2e**

In `playwright.config.js`, add to `webServer.env`:

```js
      NEXT_PUBLIC_HILIGAYNON: "on",
```

- [ ] **Step 2: Add the tests**

`e2e/site.spec.js` (append):

```js
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
```

- [ ] **Step 3: Run the whole e2e suite**

Run: `npx playwright test`
Expected: all PASS (the English pages still pass their checks; the new tests pass).

- [ ] **Step 4: Commit, migrate Turso, push**

```bash
git add playwright.config.js e2e/site.spec.js
git commit -m "Add end-to-end checks for Hiligaynon pages and the members area"
npm run db:migrate
git push
```

Expected: `Migrations applied.`; preview builds Ready; `vercel curl /hil --deployment <url>` → 404 (flag off in Vercel), `/members` → 307 to sign-in.

- [ ] **Step 5: Hand over**

Add a Bid Evidence Log row ("Phase 4 members area: profiles, directory, Leadership Passport, library, my events; Hiligaynon pages drafted"). Ask the user to: have a native speaker check `lib/i18n.js` (`hil` block) before setting `NEXT_PUBLIC_HILIGAYNON=on` in Vercel; sign in as an invited member and complete a profile; request a passport entry and verify it as admin; add emails to existing officers' member records in `/admin/members` so their accounts link.
