# Halaran Online — Members Area Redesign and E-Calling Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every active member can publish a public e-calling card (`/card/<slug>`) with call, text, email, save-contact (vCard), social links, a QR code and a downloadable PNG. The members area moves onto the shared sidebar shell, with a home dashboard, a profile editor with live card preview, and redesigned directory, passport, events and library pages.

**Architecture:** Pure card logic lives in `lib/members/card.js` (validation) and `lib/members/card-view.js` (view model, role line, vCard, completeness); both are client-safe. Database reads live in `lib/members/ecard.js`, and the QR helpers in `lib/members/qr.js` (server only). One `ECard` component renders the public page, the member's own card page and the live preview. The admin sidebar becomes a shared `SideNav`.

**Tech Stack:** Next.js 15 App Router (JS), Drizzle + Turso, Zod 3, `qrcode` (new), `next/og` `ImageResponse`, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-21-halaran-online-members-and-ecard-design.md`.

**Spec corrections (decided while reading the code):**
- §3.1: the card page is dynamic (`headers()`), not `revalidate = 300`. The QR code then encodes the host the visitor actually used, so cards work on the Vercel URL before the domain switch (`SITE.url` still points at the old Webflow domain). It also means unpublishing takes effect immediately. The vCard and PNG routes take their origin from the request in the same way.
- §3.1 social "icons": shown as labelled pills (Facebook, LinkedIn, Instagram, Website). The project has no icon set, and labels are clearer to screen readers.
- §4.3 `cardView(member, positions, { forPublic })`: the switches always apply, so the `forPublic` flag isn't needed and is dropped. The member's own preview shows exactly what the public will see.
- Migration 0006 runs on Turso in Task 1, not at deploy. Prerendered pages such as `/officers` select every `members` column, so local check builds against Turso fail until the columns exist. The change is additive.

**Code blocks:** a whole new file is introduced by `` `path`: ``; other edits are given as exact old and new text or as a short script.

## Global Constraints

- Public card rule: `status === "active" && cardPublished`. Anything else returns 404 (the page, the vCard and the PNG alike).
- Phone and email reach a card only through `cardShowPhone` and `cardShowEmail`. The phone never appears in the directory.
- Links are `https://` only, at most 300 characters. Phones are stored as `+63…`.
- Card pages carry `robots: { index: false, follow: false }`.
- No new UI library. The only new dependency is `qrcode`.
- Stage files by explicit path; don't run `git add -A`.
- Unit test command: `npx vitest run`.

## Review Focus

- **A member types `0917-123-4567`, `+63 917 123 4567` or `(033) 621 1234`:** all are accepted and stored as `+63…`. `12345` and `+1 415 555 0100` are refused with the Philippine-number message. → Task 2 test.
- **A name or business containing `,` `;` or a newline (e.g. "Cruz, Ana; CPA"):** the vCard stays valid and the characters are escaped. → Task 3 test.
- **A member switches their phone off:** it disappears from the card, the vCard and the PNG, and the Call/Text buttons vanish. → Task 3 (`cardView`) and Task 4 tests.
- **A published member who is then set to inactive:** the card page, vCard and PNG all return 404. → Task 3 and Task 9 tests.
- **Publishing without ticking consent, or entering an `http://` link:** refused, with the spec's messages. → Task 2 test.

---

### Task 1: Card columns on members

**Files:**
- Modify: `db/schema.js`, `test/schema.test.js`
- Create: `db/migrations/0006_ecard.sql` (generated)

- [ ] **Step 1: Write the failing test**

Append inside `describe("schema", …)` in `test/schema.test.js`:

```js
  it("gives members card fields with private defaults", async () => {
    const db = await testDb();
    await db.insert(members).values({ slug: "ana", name: "Ana" });
    const [row] = await db.select().from(members);
    expect(row).toMatchObject({ phone: null, websiteUrl: null, facebookUrl: null, linkedinUrl: null, instagramUrl: null, cardPublished: false, cardShowPhone: false, cardShowEmail: true });
  });
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run test/schema.test.js`
Expected: FAIL. `cardPublished` is undefined.

- [ ] **Step 3: Add the columns and migrate**

In `db/schema.js`, replace

```js
  feePaidYear: integer("fee_paid_year"),
});
```

(the end of the `members` table) with

```js
  feePaidYear: integer("fee_paid_year"),
  phone: text("phone"),
  websiteUrl: text("website_url"),
  facebookUrl: text("facebook_url"),
  linkedinUrl: text("linkedin_url"),
  instagramUrl: text("instagram_url"),
  cardPublished: integer("card_published", { mode: "boolean" }).notNull().default(false),
  cardShowPhone: integer("card_show_phone", { mode: "boolean" }).notNull().default(false),
  cardShowEmail: integer("card_show_email", { mode: "boolean" }).notNull().default(true),
});
```

Run: `npx drizzle-kit generate --name ecard && npm run db:migrate`
Expected: `db/migrations/0006_ecard.sql` with eight `ALTER TABLE members ADD …` statements, then "Migrations applied."

- [ ] **Step 4: Run the tests**

Run: `npx vitest run`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add db/schema.js db/migrations test/schema.test.js
git commit -m "Add e-calling card fields to members"
```

---

### Task 2: Card field validation and saving

**Files:**
- Create: `lib/members/card.js`, `test/ecard-input.test.js`
- Modify: `lib/members/profile.js`

**Interfaces:**
- Produces: `normalizePhone(text) → "" | "+63…" | null`, `PHONE_MESSAGE`, `LINK_MESSAGE`, `CONSENT_MESSAGE`. `profileInput` gains `phone`, `websiteUrl`, `facebookUrl`, `linkedinUrl`, `instagramUrl`, `cardPublished`, `cardShowPhone`, `cardShowEmail` and `cardConsent`; `updateProfile` stores them.

- [ ] **Step 1: Write the failing tests**

`test/ecard-input.test.js`:

```js
import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { members } from "@/db/schema.js";
import { normalizePhone } from "@/lib/members/card.js";
import { updateProfile } from "@/lib/members/profile.js";

describe("normalizePhone", () => {
  it("accepts Philippine mobiles and landlines in any common format", () => {
    expect(normalizePhone("0917-123-4567")).toBe("+639171234567");
    expect(normalizePhone("+63 917 123 4567")).toBe("+639171234567");
    expect(normalizePhone("639171234567")).toBe("+639171234567");
    expect(normalizePhone("(033) 621 1234")).toBe("+63336211234");
    expect(normalizePhone("(02) 8123 4567")).toBe("+63281234567");
    expect(normalizePhone("")).toBe("");
  });

  it("refuses numbers that aren't Philippine", () => {
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("+1 415 555 0100")).toBeNull();
    expect(normalizePhone("0917 123 45678")).toBeNull();
  });
});

describe("updateProfile card fields", () => {
  let db;
  let id;
  beforeEach(async () => {
    db = await testDb();
    await seed(db);
    id = (await db.select().from(members).where(eq(members.slug, "judy-daliva")))[0].id;
  });
  const row = async () => (await db.select().from(members).where(eq(members.id, id)))[0];

  it("stores contact details and switches", async () => {
    const r = await updateProfile(db, id, {
      phone: "0917 123 4567", websiteUrl: "https://judy.ph", facebookUrl: "https://facebook.com/judy",
      cardPublished: true, cardConsent: true, cardShowPhone: true, cardShowEmail: false,
    });
    expect(r.ok).toBe(true);
    expect(await row()).toMatchObject({ phone: "+639171234567", websiteUrl: "https://judy.ph", facebookUrl: "https://facebook.com/judy", linkedinUrl: null, cardPublished: true, cardShowPhone: true, cardShowEmail: false });
  });

  it("refuses a foreign phone, an http link, and publishing without consent", async () => {
    expect(await updateProfile(db, id, { phone: "+1 415 555 0100" })).toEqual({ ok: false, errors: ["Enter a Philippine number, e.g. 0917 123 4567"] });
    expect(await updateProfile(db, id, { websiteUrl: "http://judy.ph" })).toEqual({ ok: false, errors: ["Use a full https:// link"] });
    expect(await updateProfile(db, id, { cardPublished: true })).toEqual({ ok: false, errors: ["Tick the consent box to publish your card"] });
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run test/ecard-input.test.js`
Expected: FAIL. `@/lib/members/card.js` is not found.

- [ ] **Step 3: Implement**

`lib/members/card.js`:

```js
import { z } from "zod";

export const PHONE_MESSAGE = "Enter a Philippine number, e.g. 0917 123 4567";
export const LINK_MESSAGE = "Use a full https:// link";
export const CONSENT_MESSAGE = "Tick the consent box to publish your card";

const MOBILE = /^(?:\+?63|0)(9\d{9})$/;
const LANDLINE = /^(?:\+?63|0)([2-8]\d{7,9})$/;

// "0917 123 4567", "+63 917-123-4567", "(033) 621 1234" → "+639171234567" / "+63336211234".
// Returns "" for blank input and null for anything that isn't a Philippine number.
export function normalizePhone(input) {
  const digits = String(input ?? "").replace(/[\s\-().]/g, "");
  if (!digits) return "";
  const m = digits.match(MOBILE) ?? digits.match(LANDLINE);
  return m ? `+63${m[1]}` : null;
}

export const phoneField = z
  .string()
  .trim()
  .max(30)
  .default("")
  .transform((v, ctx) => {
    const phone = normalizePhone(v);
    if (phone === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: PHONE_MESSAGE });
      return z.NEVER;
    }
    return phone;
  });

export const linkField = z
  .string()
  .trim()
  .max(300, LINK_MESSAGE)
  .refine((v) => v === "" || /^https:\/\/\S+$/i.test(v), LINK_MESSAGE)
  .default("");
```

In `lib/members/profile.js`:

1. Add `import { phoneField, linkField, CONSENT_MESSAGE } from "./card.js";` after the existing imports.
2. Replace the whole `export const profileInput = z.object({ … });` with:

```js
export const profileInput = z
  .object({
    photoUrl: z.string().trim().regex(PHOTO, "Upload a photo").or(z.literal("")).optional(),
    profession: text(120),
    business: text(120),
    skills: text(400),
    bio: text(1000),
    inDirectory: z.boolean().default(false),
    phone: phoneField,
    websiteUrl: linkField,
    facebookUrl: linkField,
    linkedinUrl: linkField,
    instagramUrl: linkField,
    cardPublished: z.boolean().default(false),
    cardShowPhone: z.boolean().default(false),
    cardShowEmail: z.boolean().default(true),
    cardConsent: z.boolean().default(false),
  })
  .refine((d) => !d.cardPublished || d.cardConsent, { message: CONSENT_MESSAGE });
```

3. In `updateProfile`, replace

```js
    inDirectory: d.inDirectory,
  };
```

with

```js
    inDirectory: d.inDirectory,
    phone: d.phone || null,
    websiteUrl: d.websiteUrl || null,
    facebookUrl: d.facebookUrl || null,
    linkedinUrl: d.linkedinUrl || null,
    instagramUrl: d.instagramUrl || null,
    cardPublished: d.cardPublished,
    cardShowPhone: d.cardShowPhone,
    cardShowEmail: d.cardShowEmail,
  };
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run`
Expected: all PASS, including the existing `members.test.js` and `member-actions.test.js` (partial inputs fall back to the private defaults).

- [ ] **Step 5: Commit**

```bash
git add lib/members/card.js lib/members/profile.js test/ecard-input.test.js
git commit -m "Validate and save members' phone, links and card switches"
```

---

### Task 3: Card view model, public lookup, vCard and QR

**Files:**
- Create: `lib/members/card-view.js`, `lib/members/ecard.js`, `lib/members/qr.js`, `test/ecard-view.test.js`
- Modify: `package.json`, `package-lock.json` (`qrcode`)

**Interfaces:**
- Produces:
  - `cardIsPublic(member) → boolean`
  - `roleLine(member, positions) → string`
  - `cardView(member, positions) → { slug, name, roleLine, profession, business, photoUrl, bio, phone, email, links: [{ label, url }] }`
  - `vcard(card, url) → string`
  - `profileCompleteness(member) → { pct, missing: string[] }`
  - `listPositions(db, memberId)`
  - `getPublicCard(db, slug) → card | null`
  - `qrSvg(text) → string | null`
  - `qrDataUrl(text) → string | null`
  - `cardUrl(origin, slug)`
  - `originFrom(headers) → "https://host"`

- [ ] **Step 1: Install qrcode**

Run: `npm install qrcode@1.5.4`
(If `package.json` has other uncommitted edits, stage only the `qrcode` line, as in Phase 5 Task 6.)

- [ ] **Step 2: Write the failing tests**

`test/ecard-view.test.js`:

```js
import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { members } from "@/db/schema.js";
import { cardIsPublic, roleLine, cardView, vcard, profileCompleteness } from "@/lib/members/card-view.js";
import { getPublicCard } from "@/lib/members/ecard.js";
import { qrSvg, cardUrl, originFrom } from "@/lib/members/qr.js";

const base = {
  slug: "ana-cruz", name: "Ana Cruz", email: "ana@x.ph", phone: "+639171234567", status: "active",
  profession: "Architect", business: "Cruz, Ana; Design Studio", photoUrl: null, bio: "Hi", joinedAt: "2024-03-01",
  websiteUrl: "https://ana.ph", facebookUrl: null, linkedinUrl: "https://linkedin.com/in/ana", instagramUrl: null,
  cardPublished: true, cardShowPhone: false, cardShowEmail: true,
};

describe("cardIsPublic", () => {
  it("needs an active member who published", () => {
    expect(cardIsPublic(base)).toBe(true);
    expect(cardIsPublic({ ...base, status: "inactive" })).toBe(false);
    expect(cardIsPublic({ ...base, cardPublished: false })).toBe(false);
    expect(cardIsPublic(undefined)).toBe(false);
  });
});

describe("roleLine", () => {
  it("prefers the latest officer term, then the join year", () => {
    expect(roleLine(base, [{ role: "Director", year: 2025 }, { role: "Vice President", year: 2026 }])).toBe("Vice President 2026");
    expect(roleLine(base, [])).toBe("Member since 2024");
    expect(roleLine({ ...base, joinedAt: null }, [])).toBe("Member");
  });
});

describe("cardView", () => {
  it("applies the show/hide switches and keeps only set links", () => {
    const card = cardView(base, []);
    expect(card.phone).toBeNull();
    expect(card.email).toBe("ana@x.ph");
    expect(card.links).toEqual([{ label: "LinkedIn", url: "https://linkedin.com/in/ana" }, { label: "Website", url: "https://ana.ph" }]);
    expect(cardView({ ...base, cardShowPhone: true, cardShowEmail: false }, []).phone).toBe("+639171234567");
    expect(cardView({ ...base, cardShowEmail: false }, []).email).toBeNull();
  });
});

describe("vcard", () => {
  it("escapes special characters and leaves hidden fields out", () => {
    const text = vcard(cardView(base, []), "https://site.ph/card/ana-cruz");
    const lines = text.trim().split("\r\n");
    expect(lines[0]).toBe("BEGIN:VCARD");
    expect(lines).toContain("N:Cruz;Ana;;;");
    expect(lines).toContain("FN:Ana Cruz");
    expect(lines).toContain("ORG:Cruz\\, Ana\\; Design Studio");
    expect(lines).toContain("EMAIL;TYPE=INTERNET:ana@x.ph");
    expect(lines).toContain("URL:https://site.ph/card/ana-cruz");
    expect(lines.some((l) => l.startsWith("TEL"))).toBe(false);
    expect(lines.at(-1)).toBe("END:VCARD");
  });
});

describe("profileCompleteness", () => {
  it("lists what is missing", () => {
    expect(profileCompleteness({ photoUrl: null, profession: "x", skills: "", bio: "y", phone: null })).toEqual({ pct: 40, missing: ["photo", "skills", "phone"] });
  });
});

describe("getPublicCard", () => {
  let db;
  beforeEach(async () => {
    db = await testDb();
    await seed(db);
  });
  const set = (values) => db.update(members).set(values).where(eq(members.slug, "lemuel-capa"));

  it("returns the card only for an active member who published", async () => {
    expect(await getPublicCard(db, "lemuel-capa")).toBeNull();
    await set({ cardPublished: true });
    const card = await getPublicCard(db, "lemuel-capa");
    expect(card).toMatchObject({ slug: "lemuel-capa", name: "Lemuel J. Capa" });
    expect(card.roleLine).toMatch(/\d{4}$/);
    await set({ status: "inactive" });
    expect(await getPublicCard(db, "lemuel-capa")).toBeNull();
    expect(await getPublicCard(db, "nobody")).toBeNull();
  });
});

describe("qr helpers", () => {
  it("draws an SVG QR code and builds card URLs", async () => {
    expect(await qrSvg("https://site.ph/card/ana")).toMatch(/^<svg/);
    expect(cardUrl("https://site.ph/", "ana-cruz")).toBe("https://site.ph/card/ana-cruz");
    expect(originFrom(new Map([["host", "localhost:3100"]]))).toBe("http://localhost:3100");
    expect(originFrom(new Map([["x-forwarded-host", "jci.ph"], ["x-forwarded-proto", "https"], ["host", "internal"]]))).toBe("https://jci.ph");
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run test/ecard-view.test.js`
Expected: FAIL. `@/lib/members/card-view.js` is not found.

- [ ] **Step 4: Implement**

`lib/members/card-view.js`:

```js
// Card logic with no database imports, so client components (the live preview) can use it.

export const cardIsPublic = (member) => Boolean(member && member.status === "active" && member.cardPublished);

export function roleLine(member, positions = []) {
  const [latest] = [...positions].sort((a, b) => b.year - a.year);
  if (latest) return `${latest.role} ${latest.year}`;
  if (member.joinedAt) return `Member since ${member.joinedAt.slice(0, 4)}`;
  return "Member";
}

const LINKS = [["Facebook", "facebookUrl"], ["LinkedIn", "linkedinUrl"], ["Instagram", "instagramUrl"], ["Website", "websiteUrl"]];

// The one shape every card surface renders. The member's switches always apply, so the
// preview a member sees is exactly what the public sees.
export function cardView(member, positions = []) {
  return {
    slug: member.slug,
    name: member.name,
    roleLine: roleLine(member, positions),
    profession: member.profession || null,
    business: member.business || null,
    photoUrl: member.photoUrl || null,
    bio: member.bio || null,
    phone: member.cardShowPhone && member.phone ? member.phone : null,
    email: member.cardShowEmail && member.email ? member.email : null,
    links: LINKS.filter(([, key]) => member[key]).map(([label, key]) => ({ label, url: member[key] })),
  };
}

const esc = (value) => String(value).replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

export function vcard(card, url) {
  const parts = card.name.trim().split(/\s+/);
  const first = parts.shift() ?? "";
  const last = parts.pop() ?? "";
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${esc(last)};${esc(first)};${esc(parts.join(" "))};;`,
    `FN:${esc(card.name)}`,
    `ORG:${esc(card.business ?? "JCI Roxas Halaran")}`,
    card.profession && `TITLE:${esc(card.profession)}`,
    card.phone && `TEL;TYPE=CELL:${card.phone}`,
    card.email && `EMAIL;TYPE=INTERNET:${esc(card.email)}`,
    `URL:${url}`,
    ...card.links.map((l) => `X-SOCIALPROFILE;TYPE=${l.label.toLowerCase()}:${l.url}`),
    "NOTE:Member of JCI Roxas Halaran",
    "END:VCARD",
  ].filter(Boolean);
  return `${lines.join("\r\n")}\r\n`;
}

const FIELDS = [["photo", "photoUrl"], ["profession", "profession"], ["skills", "skills"], ["bio", "bio"], ["phone", "phone"]];

export function profileCompleteness(member) {
  const missing = FIELDS.filter(([, key]) => !member[key]).map(([label]) => label);
  return { pct: Math.round((100 * (FIELDS.length - missing.length)) / FIELDS.length), missing };
}
```

`lib/members/ecard.js`:

```js
import { desc, eq } from "drizzle-orm";
import { members, officerTerms } from "../../db/schema.js";
import { cardIsPublic, cardView } from "./card-view.js";

export function listPositions(db, memberId) {
  return db
    .select({ role: officerTerms.role, year: officerTerms.year })
    .from(officerTerms)
    .where(eq(officerTerms.memberId, Number(memberId)))
    .orderBy(desc(officerTerms.year));
}

// The public card, or null unless the member is active and has published it.
export async function getPublicCard(db, slug) {
  const [member] = await db.select().from(members).where(eq(members.slug, String(slug)));
  if (!cardIsPublic(member)) return null;
  return cardView(member, await listPositions(db, member.id));
}
```

`lib/members/qr.js`:

```js
import QRCode from "qrcode";

const COLORS = { dark: "#121314", light: "#ede8df" };

export async function qrSvg(text) {
  try {
    return await QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: COLORS });
  } catch (e) {
    console.error("QR code failed", e);
    return null;
  }
}

export async function qrDataUrl(text) {
  try {
    return await QRCode.toDataURL(text, { margin: 1, width: 360, errorCorrectionLevel: "M", color: COLORS });
  } catch (e) {
    console.error("QR code failed", e);
    return null;
  }
}

export const cardUrl = (origin, slug) => `${origin.replace(/\/$/, "")}/card/${encodeURIComponent(slug)}`;

// The address the visitor used, so a QR code works on whichever domain served the page.
export function originFrom(headers) {
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost";
  const proto = headers.get("x-forwarded-proto") ?? (/^(localhost|127\.)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/members/card-view.js lib/members/ecard.js lib/members/qr.js test/ecard-view.test.js package.json package-lock.json
git commit -m "Add the e-calling card view, public lookup, vCard and QR helpers"
```

---

### Task 4: Public card page, vCard download and card image

**Files:**
- Create: `components/members/ECard.jsx`, `app/card/[slug]/page.jsx`, `app/card/[slug]/vcard/route.js`, `app/card/[slug]/image.png/route.jsx`, `test/ecard-component.test.jsx`
- Modify: `app/globals.css`

**Interfaces:**
- Produces: `<ECard card qrSvg? nameAs? />`.

- [ ] **Step 1: Write the failing test**

`test/ecard-component.test.jsx`:

```jsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: ({ fill, sizes, priority, ...props }) => <img {...props} />,
}));
const { default: ECard } = await import("@/components/members/ECard.jsx");

afterEach(cleanup);

const card = {
  slug: "ana-cruz", name: "Ana Cruz", roleLine: "Member since 2024", profession: "Architect", business: "Studio",
  photoUrl: null, bio: "Hi", phone: null, email: "ana@x.ph", links: [{ label: "LinkedIn", url: "https://linkedin.com/in/ana" }],
};

describe("ECard", () => {
  it("shows only the actions the member allowed", () => {
    render(<ECard card={card} />);
    expect(screen.queryByRole("link", { name: "Call" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Text" })).toBeNull();
    expect(screen.getByRole("link", { name: "Email" }).getAttribute("href")).toBe("mailto:ana@x.ph");
    expect(screen.getByRole("link", { name: "Save contact" }).getAttribute("href")).toBe("/card/ana-cruz/vcard");
    expect(screen.getByRole("link", { name: "LinkedIn" }).getAttribute("href")).toBe("https://linkedin.com/in/ana");
    expect(screen.getByText("AC")).toBeTruthy();
  });

  it("adds call and text when the phone is shown, and the QR when given", () => {
    render(<ECard card={{ ...card, phone: "+639171234567" }} qrSvg="<svg></svg>" nameAs="h1" />);
    expect(screen.getByRole("link", { name: "Call" }).getAttribute("href")).toBe("tel:+639171234567");
    expect(screen.getByRole("link", { name: "Text" }).getAttribute("href")).toBe("sms:+639171234567");
    expect(screen.getByRole("img", { name: "QR code for this card" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Ana Cruz" })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run test/ecard-component.test.jsx`
Expected: FAIL. `ECard.jsx` is not found.

- [ ] **Step 3: Implement**

`components/members/ECard.jsx`:

```jsx
import Image from "next/image";
import { SITE } from "@/lib/site.js";
import { initials } from "@/lib/format.js";

// One card design for the public page, the member's own card page and the live editor preview.
export default function ECard({ card, qrSvg = null, nameAs = "p" }) {
  const Name = nameAs;
  return (
    <article className="ecard" aria-label={`${card.name}, e-calling card`}>
      <div className="ecard__brand"><Image src={SITE.logo} alt="JCI Roxas Halaran" width={83} height={40} /></div>
      <div className="ecard__who">
        <div className="ecard__photo">
          {card.photoUrl ? (
            <Image src={card.photoUrl} alt={card.name} fill sizes="120px" style={{ objectFit: "cover", objectPosition: "top" }} />
          ) : (
            <span aria-hidden="true">{initials(card.name)}</span>
          )}
        </div>
        <Name className="ecard__name">{card.name}</Name>
        <p className="ecard__role">{card.roleLine}</p>
        {(card.profession || card.business) && <p className="ecard__work">{[card.profession, card.business].filter(Boolean).join(" · ")}</p>}
      </div>
      <nav className="ecard__actions" aria-label="Contact">
        {card.phone && <a href={`tel:${card.phone}`}>Call</a>}
        {card.phone && <a href={`sms:${card.phone}`}>Text</a>}
        {card.email && <a href={`mailto:${card.email}`}>Email</a>}
        <a className="ecard__save" href={`/card/${card.slug}/vcard`}>Save contact</a>
      </nav>
      {card.links.length > 0 && (
        <ul className="ecard__links">
          {card.links.map((l) => <li key={l.label}><a href={l.url} target="_blank" rel="noopener noreferrer">{l.label}</a></li>)}
        </ul>
      )}
      {qrSvg && (
        <figure className="ecard__qr">
          <div role="img" aria-label="QR code for this card" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <figcaption>Scan to save my card</figcaption>
        </figure>
      )}
      {card.bio && <p className="ecard__bio">{card.bio}</p>}
    </article>
  );
}
```

(`qrSvg` is generated on the server by the `qrcode` package from our own URL, never from user input, so injecting it as HTML is safe.)

`app/card/[slug]/page.jsx`:

```jsx
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import ECard from "@/components/members/ECard.jsx";
import { getDb } from "@/lib/db.js";
import { getPublicCard } from "@/lib/members/ecard.js";
import { qrSvg, cardUrl, originFrom } from "@/lib/members/qr.js";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const card = await getPublicCard(getDb(), slug);
  if (!card) return { title: "Card not found", robots: { index: false, follow: false } };
  return {
    title: `${card.name} — JCI Roxas Halaran`,
    description: [card.roleLine, card.profession, card.business].filter(Boolean).join(" · "),
    robots: { index: false, follow: false },
  };
}

export default async function CardPage({ params }) {
  const { slug } = await params;
  const card = await getPublicCard(getDb(), slug);
  if (!card) notFound();
  const svg = await qrSvg(cardUrl(originFrom(await headers()), card.slug));
  return (
    <main className="ecard-page">
      <ECard card={card} qrSvg={svg} nameAs="h1" />
      <p className="ecard-page__foot">
        <Link href="/">Member of JCI Roxas Halaran</Link> · <a href={`/card/${card.slug}/image.png`} download>Download card image</a>
      </p>
    </main>
  );
}
```

`app/card/[slug]/vcard/route.js`:

```js
import { getDb } from "@/lib/db.js";
import { getPublicCard } from "@/lib/members/ecard.js";
import { vcard } from "@/lib/members/card-view.js";
import { cardUrl } from "@/lib/members/qr.js";

export async function GET(request, { params }) {
  const { slug } = await params;
  const card = await getPublicCard(getDb(), slug);
  if (!card) return new Response("Not found", { status: 404 });
  return new Response(vcard(card, cardUrl(new URL(request.url).origin, card.slug)), {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${card.slug}.vcf"`,
      "Cache-Control": "no-store",
    },
  });
}
```

`app/card/[slug]/image.png/route.jsx`:

```jsx
import { ImageResponse } from "next/og";
import { getDb } from "@/lib/db.js";
import { getPublicCard } from "@/lib/members/ecard.js";
import { qrDataUrl, cardUrl } from "@/lib/members/qr.js";

export async function GET(request, { params }) {
  const { slug } = await params;
  const card = await getPublicCard(getDb(), slug);
  if (!card) return new Response("Not found", { status: 404 });
  const qr = await qrDataUrl(cardUrl(new URL(request.url).origin, card.slug));
  const work = [card.profession, card.business].filter(Boolean).join(" · ");
  const contact = [card.phone, card.email].filter(Boolean);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#121314", color: "#ede8df", padding: 64, gap: 48 }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", fontSize: 24, letterSpacing: 4, color: "#e5a823" }}>JCI ROXAS HALARAN</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", fontSize: 64, fontWeight: 800, lineHeight: 1.05 }}>{card.name}</div>
            <div style={{ display: "flex", fontSize: 28, color: "#e5a823" }}>{card.roleLine}</div>
            {work ? <div style={{ display: "flex", fontSize: 28 }}>{work}</div> : null}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 26, color: "#c9c4bb" }}>
            {contact.map((c) => <div key={c} style={{ display: "flex" }}>{c}</div>)}
          </div>
        </div>
        {qr ? <img src={qr} width={300} height={300} alt="" style={{ alignSelf: "center", borderRadius: 16 }} /> : null}
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=300" } },
  );
}
```

`app/globals.css` (append):

```css
/* ============================================================
   E-calling card
   ============================================================ */
.ecard-page { display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 48px 16px 96px; }
.ecard { width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 20px; padding: 28px; background: linear-gradient(160deg, #1c3b2b 0%, #121314 70%); border: 1px solid rgba(237, 232, 223, 0.12); border-radius: 20px; }
.ecard__brand img { height: 32px; width: auto; }
.ecard__who { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; }
.ecard__photo { position: relative; display: grid; place-items: center; width: 120px; height: 120px; overflow: hidden; border-radius: 50%; border: 3px solid var(--ochre); background: var(--canopy); font-family: var(--font-syne), sans-serif; font-size: 2.2rem; color: var(--dune); }
.ecard__name { margin: 10px 0 0; font-family: var(--font-syne), sans-serif; font-weight: 800; font-size: 1.7rem; line-height: 1.1; color: var(--dune); overflow-wrap: anywhere; }
.ecard__role { margin: 0; font-family: var(--font-space-grotesk), monospace; font-size: 0.75rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ochre); }
.ecard__work { margin: 0; color: rgba(237, 232, 223, 0.8); overflow-wrap: anywhere; }
.ecard__actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)); gap: 8px; }
.ecard__actions a { display: grid; place-items: center; min-height: 48px; padding: 8px; border: 1px solid rgba(237, 232, 223, 0.2); color: var(--dune); font-family: var(--font-space-grotesk), monospace; font-size: 0.75rem; letter-spacing: 0.1em; text-transform: uppercase; }
.ecard__actions a.ecard__save { grid-column: 1 / -1; background: var(--ochre); border-color: var(--ochre); color: var(--basalt); font-weight: 700; }
.ecard__links { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
.ecard__links a { display: inline-block; padding: 6px 12px; border-radius: 999px; background: rgba(237, 232, 223, 0.08); color: var(--dune); font-size: 0.85rem; }
.ecard__qr { margin: 0 auto; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.ecard__qr > div { width: 180px; height: 180px; padding: 10px; border-radius: 12px; background: var(--dune); }
.ecard__qr svg { display: block; width: 100%; height: 100%; }
.ecard__qr figcaption { font-size: 0.8rem; color: rgba(237, 232, 223, 0.6); }
.ecard__bio { margin: 0; line-height: 1.6; white-space: pre-line; color: rgba(237, 232, 223, 0.8); overflow-wrap: anywhere; }
.ecard-page__foot { margin: 0; text-align: center; font-size: 0.85rem; color: rgba(237, 232, 223, 0.6); }
```

- [ ] **Step 4: Run the tests and build**

Run: `npx vitest run && NEXT_DIST_DIR=.next-check npx next build`
Expected: all PASS; the build lists `/card/[slug]`, `/card/[slug]/vcard` and `/card/[slug]/image.png`.

- [ ] **Step 5: Commit**

```bash
git add components/members/ECard.jsx app/card test/ecard-component.test.jsx app/globals.css
git commit -m "Add the public e-calling card page, vCard download and card image"
```

---

### Task 5: Shared sidebar for the members area

**Files:**
- Create: `components/SideNav.jsx`, `lib/members/nav.js`
- Modify: `lib/admin/nav.js`, `app/admin/layout.jsx`, `app/members/layout.jsx`, `test/admin-sidebar.test.jsx`, `test/admin-shell.test.js`
- Delete: `components/admin/AdminSidebar.jsx`, `components/members/MembersNav.jsx`

**Interfaces:**
- Produces:
  - `<SideNav groups ariaLabel>{footer}</SideNav>`
  - `memberNav() → groups`
  - `isCurrent` now treats both `/admin` and `/members` as exact-match roots

- [ ] **Step 1: Write the failing tests**

Replace `test/admin-sidebar.test.jsx` with:

```jsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { adminNav } from "@/lib/admin/nav.js";
import { memberNav } from "@/lib/members/nav.js";

const h = vi.hoisted(() => ({ path: "/admin/payments/12" }));
vi.mock("next/navigation", () => ({ usePathname: () => h.path }));
const { default: SideNav } = await import("@/components/SideNav.jsx");

afterEach(cleanup);

describe("SideNav", () => {
  it("marks the current admin section and shows waiting counts", () => {
    h.path = "/admin/payments/12";
    render(<SideNav groups={adminNav("admin", { payments: 3 })} ariaLabel="Admin"><a href="/">View site</a></SideNav>);
    expect(screen.getByRole("navigation", { name: "Admin" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Payments 3 waiting" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Dashboard" }).getAttribute("aria-current")).toBeNull();
    expect(screen.getByText("Money")).toBeTruthy();
    expect(screen.getByRole("link", { name: "View site" }).getAttribute("href")).toBe("/");
  });

  it("renders the members links with Home current only on /members", () => {
    h.path = "/members/card";
    render(<SideNav groups={memberNav()} ariaLabel="Members" />);
    expect(screen.getByRole("link", { name: "My card" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Home" }).getAttribute("aria-current")).toBeNull();
  });
});
```

In `test/admin-shell.test.js`, inside `describe("isCurrent", …)`, add:

```js
  it("treats /members as an exact-match root too", () => {
    expect(isCurrent("/members", "/members")).toBe(true);
    expect(isCurrent("/members", "/members/profile")).toBe(false);
    expect(isCurrent("/members/profile", "/members/profile")).toBe(true);
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run test/admin-sidebar.test.jsx test/admin-shell.test.js`
Expected: FAIL. `SideNav.jsx` and `@/lib/members/nav.js` are not found, and `/members` matches `/members/profile`.

- [ ] **Step 3: Implement**

```bash
git mv components/admin/AdminSidebar.jsx components/SideNav.jsx
git rm -q components/members/MembersNav.jsx
```

`components/SideNav.jsx`:

```jsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isCurrent } from "@/lib/admin/nav.js";

// Grouped sidebar shared by the admin and members areas; children render in its footer.
export default function SideNav({ groups, ariaLabel, children }) {
  const pathname = usePathname() ?? "";
  return (
    <nav className="admin-side" aria-label={ariaLabel}>
      {groups.map((g) => (
        <div className="admin-side__group" key={g.label ?? "main"}>
          {g.label && <span className="admin-side__label">{g.label}</span>}
          {g.links.map((l) => {
            const current = isCurrent(l.href, pathname);
            return (
              <Link key={l.href} href={l.href} className={current ? "is-current" : undefined} aria-current={current ? "page" : undefined}>
                {l.label}
                {l.badge ? <span className="admin-side__badge" aria-label={`${l.badge} waiting`}>{l.badge}</span> : null}
              </Link>
            );
          })}
        </div>
      ))}
      {children && <div className="admin-side__foot">{children}</div>}
    </nav>
  );
}
```

In `lib/admin/nav.js`, replace the `isCurrent` export with:

```js
const ROOTS = new Set(["/admin", "/members"]);

export const isCurrent = (href, pathname) =>
  ROOTS.has(href) ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
```

`lib/members/nav.js`:

```js
const link = (href, label) => ({ href, label, badge: null });

export function memberNav() {
  return [
    { label: null, links: [link("/members", "Home"), link("/members/card", "My card"), link("/members/profile", "Profile")] },
    { label: "Growth", links: [link("/members/passport", "Passport"), link("/members/events", "My events")] },
    { label: "Chapter", links: [link("/members/directory", "Directory"), link("/members/library", "Library")] },
  ];
}
```

In `app/admin/layout.jsx`, replace the `AdminSidebar` import with `import SideNav from "@/components/SideNav.jsx";` and `import Link from "next/link";`, then replace `<AdminSidebar groups={adminNav(role, counts)} role={role} />` with:

```jsx
        <SideNav groups={adminNav(role, counts)} ariaLabel="Admin">
          <Link href="/">View site</Link>
          <span>Signed in as {role}</span>
        </SideNav>
```

`app/members/layout.jsx`:

```jsx
import Link from "next/link";
import { ClerkProvider, SignOutButton } from "@clerk/nextjs";
import { currentMember } from "@/lib/members/current.js";
import { memberNav } from "@/lib/members/nav.js";
import { cardIsPublic } from "@/lib/members/card-view.js";
import SideNav from "@/components/SideNav.jsx";

export const metadata = { robots: { index: false } };

// currentMember() runs requireArea("members") first, so the area never renders for visitors without a role.
export default async function MembersLayout({ children }) {
  const { member } = await currentMember();
  return (
    <ClerkProvider>
      <div className="admin-shell members-area">
        <SideNav groups={memberNav()} ariaLabel="Members">
          <Link href="/">View site</Link>
          {cardIsPublic(member) && <Link href={`/card/${member.slug}`}>View my card</Link>}
          <SignOutButton redirectUrl="/"><button type="button" className="tool">Sign out</button></SignOutButton>
        </SideNav>
        <div className="admin-main"><div className="admin">{children}</div></div>
      </div>
    </ClerkProvider>
  );
}
```

`app/globals.css` (append), so the footer can hold a button:

```css
.admin-side__foot .tool { align-self: flex-start; }
```

- [ ] **Step 4: Run the tests and build**

Run: `npx vitest run && NEXT_DIST_DIR=.next-check npx next build`
Expected: all PASS; the build succeeds.

- [ ] **Step 5: Commit**

```bash
git add components/SideNav.jsx lib/admin/nav.js lib/members/nav.js app/admin/layout.jsx app/members/layout.jsx test/admin-sidebar.test.jsx test/admin-shell.test.js app/globals.css
git add -u components/admin/AdminSidebar.jsx components/members/MembersNav.jsx
git commit -m "Share the grouped sidebar between the admin and members areas"
```

---

### Task 6: Profile editor with a live card preview

**Files:**
- Modify: `components/members/ProfileForm.jsx`, `app/members/profile/page.jsx`, `app/globals.css`
- Create: `test/profile-editor.test.jsx`

**Interfaces:**
- Consumes: `cardView` (Task 3), `normalizePhone` (Task 2), `ECard` (Task 4), `listPositions` (Task 3).

- [ ] **Step 1: Write the failing test**

`test/profile-editor.test.jsx`:

```jsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";

vi.mock("@/app/members/actions.js", () => ({ updateProfileAction: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/components/admin/FileUpload.jsx", () => ({ default: () => <div>upload</div> }));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: ({ fill, sizes, priority, ...props }) => <img {...props} />,
}));
const { default: ProfileForm } = await import("@/components/members/ProfileForm.jsx");

afterEach(cleanup);

const member = {
  id: 1, slug: "judy-daliva", name: "Judy Daliva", email: "judy@x.ph", status: "active", photoUrl: null,
  profession: null, business: null, skills: null, bio: null, inDirectory: false, joinedAt: "2024-01-01",
  phone: null, websiteUrl: null, facebookUrl: null, linkedinUrl: null, instagramUrl: null,
  cardPublished: false, cardShowPhone: false, cardShowEmail: true,
};

describe("ProfileForm live preview", () => {
  it("updates the card as the member types and switches details on and off", () => {
    render(<ProfileForm member={member} positions={[]} />);
    const preview = () => within(screen.getByRole("complementary", { name: "Card preview" }));
    fireEvent.change(screen.getByLabelText("Profession"), { target: { value: "Engineer" } });
    expect(preview().getByText("Engineer")).toBeTruthy();
    expect(preview().getByRole("link", { name: "Email" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Mobile or phone"), { target: { value: "0917 123 4567" } });
    expect(preview().queryByRole("link", { name: "Call" })).toBeNull();
    fireEvent.click(screen.getByLabelText("Show my phone on my card"));
    expect(preview().getByRole("link", { name: "Call" }).getAttribute("href")).toBe("tel:+639171234567");
    fireEvent.click(screen.getByLabelText("Show my email on my card"));
    expect(preview().queryByRole("link", { name: "Email" })).toBeNull();
  });

  it("asks for consent only when publishing", () => {
    render(<ProfileForm member={member} positions={[]} />);
    expect(screen.queryByLabelText(/I agree to show the details/)).toBeNull();
    fireEvent.click(screen.getByLabelText("Publish my e-calling card"));
    expect(screen.getByLabelText(/I agree to show the details/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run test/profile-editor.test.jsx`
Expected: FAIL. There's no "Card preview" region yet.

- [ ] **Step 3: Implement**

`components/members/ProfileForm.jsx`:

```jsx
"use client";

import { useState, useTransition } from "react";
import FileUpload from "@/components/admin/FileUpload.jsx";
import ECard from "@/components/members/ECard.jsx";
import { cardView } from "@/lib/members/card-view.js";
import { normalizePhone } from "@/lib/members/card.js";
import { updateProfileAction } from "@/app/members/actions.js";

const LINK_FIELDS = [["websiteUrl", "Website or business page"], ["facebookUrl", "Facebook"], ["linkedinUrl", "LinkedIn"], ["instagramUrl", "Instagram"]];

export default function ProfileForm({ member, positions = [] }) {
  const [form, setForm] = useState({
    photoUrl: undefined,
    profession: member.profession ?? "",
    business: member.business ?? "",
    skills: member.skills ?? "",
    bio: member.bio ?? "",
    inDirectory: member.inDirectory,
    phone: member.phone ?? "",
    websiteUrl: member.websiteUrl ?? "",
    facebookUrl: member.facebookUrl ?? "",
    linkedinUrl: member.linkedinUrl ?? "",
    instagramUrl: member.instagramUrl ?? "",
    cardPublished: member.cardPublished,
    cardShowPhone: member.cardShowPhone,
    cardShowEmail: member.cardShowEmail,
    cardConsent: member.cardPublished,
  });
  const [photo, setPhoto] = useState(member.photoUrl);
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

  const card = cardView({ ...member, ...form, photoUrl: photo, phone: normalizePhone(form.phone) || null }, positions);

  return (
    <div className="profile-editor">
      <form className="public-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <h2 className="syne">About you</h2>
        <div className="field">
          <span className="count">Photo</span>
          <FileUpload accept="image/jpeg,image/png,image/webp" label="Upload a new photo" handleUploadUrl="/api/upload-avatar" onUploaded={({ url }) => { setForm((f) => ({ ...f, photoUrl: url })); setPhoto(url); }} />
        </div>
        <div className="field"><label htmlFor="pr-prof">Profession</label><input id="pr-prof" value={form.profession} onChange={set("profession")} /></div>
        <div className="field"><label htmlFor="pr-biz">Business</label><input id="pr-biz" value={form.business} onChange={set("business")} /></div>
        <div className="field"><label htmlFor="pr-skills">Skills (separate with commas)</label><input id="pr-skills" value={form.skills} onChange={set("skills")} placeholder="Photography, event planning, accounting" /></div>
        <div className="field"><label htmlFor="pr-bio">About you</label><textarea id="pr-bio" rows={5} value={form.bio} onChange={set("bio")} /></div>
        <label className="consent"><input type="checkbox" checked={form.inDirectory} onChange={set("inDirectory")} /> Show me in the member directory (name, photo, profession, business and skills — never your email or phone)</label>

        <h2 className="syne" id="card">Contact &amp; e-calling card</h2>
        <div className="field"><label htmlFor="pr-phone">Mobile or phone</label><input id="pr-phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} placeholder="0917 123 4567" /></div>
        <label className="consent"><input type="checkbox" checked={form.cardShowPhone} onChange={set("cardShowPhone")} /> Show my phone on my card</label>
        <label className="consent"><input type="checkbox" checked={form.cardShowEmail} onChange={set("cardShowEmail")} /> Show my email on my card{member.email ? ` (${member.email})` : ""}</label>
        {LINK_FIELDS.map(([key, label]) => (
          <div className="field" key={key}><label htmlFor={`pr-${key}`}>{label}</label><input id={`pr-${key}`} type="url" value={form[key]} onChange={set(key)} placeholder="https://" /></div>
        ))}
        <label className="consent"><input type="checkbox" checked={form.cardPublished} onChange={set("cardPublished")} /> Publish my e-calling card</label>
        {form.cardPublished && (
          <label className="consent"><input type="checkbox" checked={form.cardConsent} onChange={set("cardConsent")} /> I agree to show the details I switched on to anyone with my card link.</label>
        )}

        {result && !result.ok && <div className="form-errors" role="alert"><ul>{result.errors.map((e) => <li key={e}>{e}</li>)}</ul></div>}
        {result?.ok && <p className="form-ok" role="status">Profile saved.</p>}
        <button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
      </form>
      <aside className="profile-editor__preview" aria-label="Card preview">
        <span className="label">Live preview</span>
        <ECard card={card} />
      </aside>
    </div>
  );
}
```

`app/members/profile/page.jsx`:

```jsx
import { currentMember } from "@/lib/members/current.js";
import { getDb } from "@/lib/db.js";
import { listPositions } from "@/lib/members/ecard.js";
import ProfileForm from "@/components/members/ProfileForm.jsx";

export const metadata = { title: "Your profile" };
export const dynamic = "force-dynamic";

export default async function Profile() {
  const { member } = await currentMember();
  if (!member) return <><h1>Your profile</h1><p>Your account isn't linked to a member profile yet — ask an admin.</p></>;
  const positions = await listPositions(getDb(), member.id);
  return (
    <>
      <h1>Your profile</h1>
      <ProfileForm member={member} positions={positions} />
    </>
  );
}
```

`app/globals.css` (append):

```css
.profile-editor { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 40px; align-items: start; }
.profile-editor__preview { position: sticky; top: 100px; display: flex; flex-direction: column; gap: 12px; }
.profile-editor h2 { margin: 16px 0 0; }
@media (max-width: 900px) { .profile-editor { grid-template-columns: 1fr; } .profile-editor__preview { position: static; } }
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add components/members/ProfileForm.jsx app/members/profile/page.jsx app/globals.css test/profile-editor.test.jsx
git commit -m "Edit card details beside a live preview of the e-calling card"
```

---

### Task 7: Members home and "My card"

**Files:**
- Create: `components/members/CardShare.jsx`, `app/members/card/page.jsx`, `test/card-share.test.jsx`
- Modify: `app/members/page.jsx`, `app/globals.css`

- [ ] **Step 1: Write the failing test**

`test/card-share.test.jsx`:

```jsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import CardShare from "@/components/members/CardShare.jsx";

afterEach(() => {
  cleanup();
  delete navigator.share;
});

describe("CardShare", () => {
  it("copies the link when the browser can't share", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<CardShare url="https://site.ph/card/ana" slug="ana" />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(await screen.findByRole("status")).toHaveProperty("textContent", "Link copied");
    expect(writeText).toHaveBeenCalledWith("https://site.ph/card/ana");
    expect(screen.getByRole("link", { name: "Download image" }).getAttribute("href")).toBe("/card/ana/image.png");
  });

  it("uses the phone's share sheet when there is one", async () => {
    navigator.share = vi.fn(async () => {});
    render(<CardShare url="https://site.ph/card/ana" slug="ana" />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await Promise.resolve();
    expect(navigator.share).toHaveBeenCalledWith({ title: "My e-calling card", url: "https://site.ph/card/ana" });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run test/card-share.test.jsx`
Expected: FAIL. `CardShare.jsx` is not found.

- [ ] **Step 3: Implement**

`components/members/CardShare.jsx`:

```jsx
"use client";

import { useState } from "react";

export default function CardShare({ url, slug }) {
  const [message, setMessage] = useState(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Link copied");
    } catch {
      setMessage(url);
    }
  };
  const share = async () => {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "My e-calling card", url });
      } catch {
        // the member closed the share sheet
      }
    } else {
      await copy();
    }
  };
  return (
    <div className="card-share">
      <button type="button" className="btn" onClick={share}>Share</button>
      <button type="button" className="tool" onClick={copy}>Copy link</button>
      <a className="tool" href={`/card/${slug}/image.png`} download>Download image</a>
      <a className="tool" href={`/card/${slug}/vcard`}>Save contact</a>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
```

`app/members/card/page.jsx`:

```jsx
import Link from "next/link";
import { headers } from "next/headers";
import { currentMember } from "@/lib/members/current.js";
import { getDb } from "@/lib/db.js";
import { listPositions } from "@/lib/members/ecard.js";
import { cardIsPublic, cardView } from "@/lib/members/card-view.js";
import { qrSvg, cardUrl, originFrom } from "@/lib/members/qr.js";
import ECard from "@/components/members/ECard.jsx";
import CardShare from "@/components/members/CardShare.jsx";

export const metadata = { title: "My e-calling card" };
export const dynamic = "force-dynamic";

export default async function MyCard() {
  const { member } = await currentMember();
  if (!member) return <><h1>My e-calling card</h1><p>Your account isn't linked to a member profile yet — ask an admin.</p></>;
  const card = cardView(member, await listPositions(getDb(), member.id));
  const url = cardUrl(originFrom(await headers()), member.slug);
  const live = cardIsPublic(member);
  return (
    <>
      <h1>My e-calling card</h1>
      {!live && (
        <p className="form-errors">
          {member.status !== "active" ? "E-calling cards are for active members — ask an admin about your membership status." : "Your card isn't published yet."}{" "}
          <Link href="/members/profile#card">Set it up →</Link>
        </p>
      )}
      <div className="mycard">
        <ECard card={card} qrSvg={live ? await qrSvg(url) : null} />
        <div className="mycard__side">
          {live && <p>Your card is live at <a href={url}>{url}</a></p>}
          {live && <CardShare url={url} slug={member.slug} />}
          <p><Link href="/members/profile#card">Edit card details →</Link></p>
        </div>
      </div>
    </>
  );
}
```

`app/members/page.jsx`:

```jsx
import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import { currentMember } from "@/lib/members/current.js";
import { getDb } from "@/lib/db.js";
import { getPassport } from "@/lib/members/passport.js";
import { listRsvpsForEmail } from "@/lib/engagement/events.js";
import { cardIsPublic, profileCompleteness } from "@/lib/members/card-view.js";
import { cardUrl, originFrom } from "@/lib/members/qr.js";
import { formatDateTime, initials, phNow } from "@/lib/format.js";
import CardShare from "@/components/members/CardShare.jsx";

export const metadata = { title: "Members" };
export const dynamic = "force-dynamic";

export default async function MembersHome() {
  const { member } = await currentMember();
  if (!member) {
    return (
      <>
        <h1>Members</h1>
        <p>Your account isn't linked to a member profile yet — ask an admin to add your email to your member record.</p>
      </>
    );
  }
  const db = getDb();
  const [passport, rsvps] = await Promise.all([getPassport(db, member.id), listRsvpsForEmail(db, member.email)]);
  const next = rsvps.find((r) => r.startAt >= phNow() && r.status !== "cancelled");
  const { pct, missing } = profileCompleteness(member);
  const live = cardIsPublic(member);
  const url = cardUrl(originFrom(await headers()), member.slug);
  return (
    <>
      <h1>Welcome, {member.name.split(" ")[0]}</h1>
      <section className="mhome__profile">
        <div className="mhome__avatar">
          {member.photoUrl ? <Image src={member.photoUrl} alt={member.name} fill sizes="88px" style={{ objectFit: "cover", objectPosition: "top" }} /> : <span aria-hidden="true">{initials(member.name)}</span>}
        </div>
        <div className="mhome__who">
          <p className="mhome__name">{member.name}</p>
          <p className="label">{member.status}{member.feePaidYear ? ` · dues paid ${member.feePaidYear}` : ""}</p>
          <div className="dash-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
          <p>Profile {pct}% complete{missing.length ? <> — add your {missing.join(", ")}. <Link href="/members/profile">Edit profile →</Link></> : "."}</p>
        </div>
      </section>
      <div className="mhome">
        <section className="dash-card mhome__tile">
          <span className="dash-card__title">Leadership Passport</span>
          <span className="mhome__points">{passport.points} points</span>
          <span className="badges">{passport.badges.slice(0, 4).map((b) => <span className="passport-badge" key={b.key}>{b.label}</span>)}</span>
          <Link href="/members/passport">Open your passport →</Link>
        </section>
        <section className="dash-card mhome__tile">
          <span className="dash-card__title">Next event</span>
          {next ? <span><Link href={`/events/${next.slug}`}>{next.title}</Link>, {formatDateTime(next.startAt)}{next.status === "waitlist" ? " (waitlist)" : ""}</span> : <span>No upcoming RSVPs. <Link href="/events">See events →</Link></span>}
        </section>
        <section className="dash-card mhome__tile mhome__card">
          <span className="dash-card__title">Your e-calling card</span>
          {live ? (
            <>
              <span>Live at <a href={url}>{url}</a></span>
              <CardShare url={url} slug={member.slug} />
            </>
          ) : (
            <>
              <span>{member.status === "active" ? "Share your contact details with a link or QR code." : "Cards are for active members."}</span>
              {member.status === "active" && <Link className="btn" href="/members/profile#card">Set up your e-calling card</Link>}
            </>
          )}
        </section>
      </div>
    </>
  );
}
```

Check that `initials` is exported from `lib/format.js` (it is: `export function initials(name)`).

`app/globals.css` (append):

```css
.mhome__profile { display: grid; grid-template-columns: 88px minmax(0, 1fr); gap: 20px; align-items: center; }
.mhome__avatar { position: relative; display: grid; place-items: center; width: 88px; height: 88px; overflow: hidden; border-radius: 50%; border: 2px solid var(--ochre); background: var(--canopy); font-family: var(--font-syne), sans-serif; font-size: 1.6rem; color: var(--dune); }
.mhome__who { display: flex; flex-direction: column; gap: 6px; }
.mhome__who p { margin: 0; }
.mhome__name { font-family: var(--font-syne), sans-serif; font-weight: 800; font-size: 1.4rem; color: var(--dune); }
.mhome { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.mhome__tile { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; }
.mhome__card { grid-column: 1 / -1; }
.mhome__points { font-family: var(--font-syne), sans-serif; font-weight: 800; font-size: 2rem; color: var(--ochre); }
.card-share { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.card-share p { flex-basis: 100%; margin: 4px 0 0; overflow-wrap: anywhere; }
.mycard { display: grid; grid-template-columns: minmax(0, 420px) minmax(0, 1fr); gap: 40px; align-items: start; }
.mycard__side { display: flex; flex-direction: column; gap: 14px; overflow-wrap: anywhere; }
@media (max-width: 900px) { .mhome, .mycard { grid-template-columns: 1fr; } }
```

- [ ] **Step 4: Run the tests and build**

Run: `npx vitest run && NEXT_DIST_DIR=.next-check npx next build`
Expected: all PASS; the build lists `/members/card`.

- [ ] **Step 5: Commit**

```bash
git add components/members/CardShare.jsx app/members/card/page.jsx app/members/page.jsx app/globals.css test/card-share.test.jsx
git commit -m "Add the members home dashboard and a My card page with share, copy and download"
```

---

### Task 8: Directory, passport, events, library and admin card column

**Files:**
- Modify: `components/members/MemberCard.jsx`, `lib/members/profile.js`, `app/members/directory/page.jsx`, `app/members/passport/page.jsx`, `app/members/events/page.jsx`, `app/members/library/page.jsx`, `components/admin/MemberRow.jsx`, `app/admin/members/page.jsx`, `app/globals.css`, `test/members.test.js`
- Create: `test/member-tile.test.jsx`

- [ ] **Step 1: Write the failing tests**

Append to `test/members.test.js` (it already imports `updateProfile` and `listDirectory`; reuse its `db` and `judy` helpers):

```js
describe("directory card links", () => {
  it("tells the directory which members have a published card", async () => {
    const id = (await judy()).id;
    await updateProfile(db, id, { profession: "Teacher", inDirectory: true, cardPublished: true, cardConsent: true });
    const [row] = await listDirectory(db, { q: "teacher" });
    expect(row).toMatchObject({ slug: "judy-daliva", cardPublished: true });
  });
});
```

(Place it inside the file's top-level `describe` that defines `db` and `judy`; if those are scoped to another `describe`, put the new `it` inside that block.)

`test/member-tile.test.jsx`:

```jsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: ({ fill, sizes, priority, ...props }) => <img {...props} />,
}));
const { default: MemberCard } = await import("@/components/members/MemberCard.jsx");

afterEach(cleanup);

describe("MemberCard tile", () => {
  it("shows up to four skill chips and a card link when published", () => {
    render(<MemberCard member={{ slug: "ana", name: "Ana Cruz", photoUrl: null, profession: "Architect", business: null, skills: "A, B, C, D, E", cardPublished: true }} />);
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["A", "B", "C", "D"]);
    expect(screen.getByRole("link", { name: "View Ana Cruz's card" }).getAttribute("href")).toBe("/card/ana");
  });

  it("has no card link when unpublished", () => {
    render(<MemberCard member={{ slug: "ana", name: "Ana Cruz", photoUrl: null, skills: null, cardPublished: false }} />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run test/members.test.js test/member-tile.test.jsx`
Expected: FAIL. `cardPublished` is not selected, and the skill chips don't exist yet.

- [ ] **Step 3: Implement**

In `lib/members/profile.js` `listDirectory`, after `skills: members.skills,` add `cardPublished: members.cardPublished,`. The directory already filters to `status = "active"`, so a published flag here means a live card.

`components/members/MemberCard.jsx`:

```jsx
import Image from "next/image";
import Link from "next/link";
import { initials } from "@/lib/format.js";

export default function MemberCard({ member }) {
  const skills = (member.skills ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 4);
  return (
    <article className="mtile">
      <div className="mtile__photo">
        {member.photoUrl ? (
          <Image src={member.photoUrl} alt={member.name} fill sizes="72px" style={{ objectFit: "cover", objectPosition: "top" }} />
        ) : (
          <span aria-hidden="true">{initials(member.name)}</span>
        )}
      </div>
      <div className="mtile__body">
        <h3 className="mtile__name">{member.name}</h3>
        {(member.profession || member.business) && <p className="mtile__work">{[member.profession, member.business].filter(Boolean).join(" · ")}</p>}
        {skills.length > 0 && <ul className="mtile__skills">{skills.map((s) => <li key={s}>{s}</li>)}</ul>}
        {member.cardPublished && <Link className="mtile__card" href={`/card/${member.slug}`} aria-label={`View ${member.name}'s card`}>View card</Link>}
      </div>
    </article>
  );
}
```

In `app/members/directory/page.jsx`, replace `<div className="officers">` with `<div className="mdir">`.

`app/members/passport/page.jsx`: replace the `timeline` construction and the render of badges and timeline with:

```jsx
  const timeline = [
    ...p.entries.map((e) => ({ key: `e${e.id}`, kind: e.kind, date: e.date, title: e.title, points: e.points, dated: true })),
    ...p.positions.map((pos) => ({ key: `p${pos.year}${pos.role}`, kind: "position", date: `${pos.year}-12-31`, title: `${pos.role} (${pos.year})`, points: 3, dated: false })),
  ].sort((a, b) => b.date.localeCompare(a.date));
```

```jsx
      <div className="passport-head">
        <p className="passport__points"><strong>{p.points}</strong> points</p>
        <p className="badges">{p.badges.length ? p.badges.map((b) => <span className="passport-badge" key={b.key}>{b.label}</span>) : "Your badges will appear here."}</p>
      </div>
      <section>
        <h2 className="syne">Timeline</h2>
        {timeline.length ? (
          <ol className="passport__timeline">
            {timeline.map((t) => (
              <li key={t.key}>
                <span className={`kind kind--${t.kind}`}>{KIND_LABELS[t.kind]}</span>
                <span className="t">{t.title}</span>
                <span className="y">{t.dated ? `${formatDate(t.date)} · ` : ""}{t.points} pts</span>
              </li>
            ))}
          </ol>
        ) : <p>No entries yet. Attend a project event or request your first entry below.</p>}
      </section>
```

`app/members/events/page.jsx`: add `import StatusBadge from "@/components/admin/StatusBadge.jsx";` and replace the `row` function and both `<table …>` renders with:

```jsx
  const card = (r) => (
    <li key={r.id} className="dash-card">
      <span className="dash-card__title"><Link href={`/events/${r.slug}`}>{r.title}</Link></span>
      <span className="dash-card__text">{formatDateTime(r.startAt)}</span>
      <span className="mevent__status"><StatusBadge status={r.status} />{r.attended ? <StatusBadge status="attended" /> : null}</span>
    </li>
  );
```

```jsx
      {upcoming.length ? <ul className="mevents">{upcoming.map(card)}</ul> : <p>None yet. <Link href="/events">See events →</Link></p>}
```

```jsx
      {past.length ? <ul className="mevents">{past.map(card)}</ul> : <p>No past events.</p>}
```

`app/members/library/page.jsx`: replace `<div className="list-rows">` … `</div>` inside each kind section with:

```jsx
          <div className="mlib">
            {list.filter((r) => r.kind === k).map((r) => (
              <article key={r.id} className="dash-card mlib__item">
                <span className="dash-card__title">{r.title}</span>
                {r.description && <span className="dash-card__text">{r.description}</span>}
                {safeHttpsUrl(r.fileUrl) && <a className="tool" href={safeHttpsUrl(r.fileUrl)} target="_blank" rel="noreferrer">Open</a>}
              </article>
            ))}
          </div>
```

`components/admin/MemberRow.jsx`: add `import { cardIsPublic } from "@/lib/members/card-view.js";`, and before the last `<td>` (the Save button cell) add:

```jsx
      <td>{cardIsPublic(member) ? <a href={`/card/${member.slug}`} target="_blank" rel="noreferrer">View</a> : "—"}</td>
```

`app/admin/members/page.jsx`: change the header row to `<thead><tr><th>Member</th><th>Email</th><th>Status</th><th>Directory</th><th>Card</th><th></th></tr></thead>`.

`app/globals.css` (append):

```css
.passport-badge { display: inline-block; padding: 6px 12px; border: 1px solid var(--ochre); background: rgba(229, 168, 35, 0.08); color: var(--ochre); font-family: var(--font-space-grotesk), monospace; font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; }
.passport-head { display: flex; flex-wrap: wrap; align-items: center; gap: 24px; }
.passport__timeline li { display: grid; grid-template-columns: 140px minmax(0, 1fr) auto; align-items: baseline; gap: 16px; }
.passport__timeline .t { color: var(--dune); overflow-wrap: anywhere; }
.passport__timeline .y { font-family: var(--font-space-grotesk), monospace; font-size: 0.78rem; color: var(--ochre); white-space: nowrap; }
.kind { justify-self: start; padding: 2px 8px; border-radius: 999px; font-family: var(--font-space-grotesk), monospace; font-size: 0.68rem; letter-spacing: 0.08em; text-transform: uppercase; background: rgba(237, 232, 223, 0.08); color: rgba(237, 232, 223, 0.8); }
.kind--training { background: rgba(58, 107, 79, 0.35); color: #a9d6b5; }
.kind--project_led, .kind--award { background: rgba(229, 168, 35, 0.16); color: var(--ochre); }
.kind--position { background: rgba(237, 232, 223, 0.14); color: var(--dune); }
.mdir { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.mtile { display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 16px; padding: 18px; background: rgba(237, 232, 223, 0.04); border: 1px solid rgba(237, 232, 223, 0.08); }
.mtile__photo { position: relative; display: grid; place-items: center; width: 72px; height: 72px; overflow: hidden; border-radius: 50%; background: var(--canopy); font-family: var(--font-syne), sans-serif; font-size: 1.3rem; color: var(--dune); }
.mtile__body { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; min-width: 0; }
.mtile__name { margin: 0; font-family: var(--font-syne), sans-serif; font-size: 1.05rem; color: var(--dune); overflow-wrap: anywhere; }
.mtile__work { margin: 0; font-size: 0.9rem; color: rgba(237, 232, 223, 0.75); overflow-wrap: anywhere; }
.mtile__skills { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.mtile__skills li { padding: 2px 8px; border-radius: 999px; background: rgba(237, 232, 223, 0.08); font-size: 0.78rem; color: rgba(237, 232, 223, 0.8); }
.mtile__card { font-size: 0.85rem; }
.mevents { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.mevent__status { grid-column: 2; grid-row: 1 / span 2; display: flex; gap: 6px; }
.mlib { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.mlib__item { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
@media (max-width: 600px) { .passport__timeline li { grid-template-columns: 1fr; gap: 4px; } }
```

- [ ] **Step 4: Run the tests and build**

Run: `npx vitest run && NEXT_DIST_DIR=.next-check npx next build`
Expected: all PASS; the build succeeds.

- [ ] **Step 5: Commit**

```bash
git add components/members/MemberCard.jsx lib/members/profile.js app/members/directory/page.jsx app/members/passport/page.jsx app/members/events/page.jsx app/members/library/page.jsx components/admin/MemberRow.jsx app/admin/members/page.jsx app/globals.css test/members.test.js test/member-tile.test.jsx
git commit -m "Redesign the directory, passport, events and library, and link published cards from admin"
```

---

### Task 9: End-to-end checks, push, review, deploy

**Files:**
- Modify: `scripts/prepare-e2e-db.mjs`, `e2e/site.spec.js`

- [ ] **Step 1: Seed a published card**

In `scripts/prepare-e2e-db.mjs`:
- Add `import { eq } from "drizzle-orm";` and `import { members } from "../db/schema.js";`.
- Before `console.log("e2e.db ready.");` add:

```js
// A published e-calling card (phone shown) and an unpublished member.
await db
  .update(members)
  .set({ email: "lemuel@example.ph", phone: "+639171234567", websiteUrl: "https://example.ph", cardPublished: true, cardShowPhone: true, cardShowEmail: true })
  .where(eq(members.slug, "lemuel-capa"));
```

- [ ] **Step 2: Add the tests**

Append to `e2e/site.spec.js`:

```js
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
```

- [ ] **Step 3: Run the whole e2e suite**

Run: `npx playwright test`
Expected: all PASS.

- [ ] **Step 4: Commit and push**

```bash
git add scripts/prepare-e2e-db.mjs e2e/site.spec.js
git commit -m "Check the e-calling card page, vCard, image and 404s end to end"
git push
```

- [ ] **Step 5: Final review, PR, deploy**

- Final whole-branch review (opus), then one test-first fix pass for Critical and Important findings.
- Open a PR from `halaran-online` into `main` and merge it to deploy.
- On production, check that `/card/<slug>` returns 404 for unpublished members.
- Add a Bid Evidence Log row: "Members area redesign + e-calling cards (QR, vCard, image)" (Value to members, Interactivity & services).
- Tell the user how members publish their card: Profile → Contact & e-calling card → Publish. The Save contact button needs a manual test on an iPhone and an Android phone.
