# Halaran Online — Design Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the public site (navigation, footer, photoless project tiles, impact, support, join, form controls) and give the admin a grouped sidebar, a task dashboard, status badges and status tabs.

**Architecture:** Plain CSS appended to `app/globals.css`, using the existing tokens. Pure helpers in `lib/admin/*` and `lib/proof/impact.js` carry the logic and are unit-tested; components stay thin. The admin sidebar renders once in `app/admin/layout.jsx`, replacing the `<AdminNav />` that 19 pages render today.

**Tech Stack:** Next.js 15 App Router (JS), Drizzle + Turso, Vitest (+ jsdom, Testing Library), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-21-halaran-online-design-pass-design.md`.

**Spec corrections (decided while reading the code):**
- §2.8: the home heritage section already renders `SITE.aboutPhoto`; it looked empty only because the full-page screenshot doesn't load lazy images. No change.
- §2.7 file inputs: styled with `::file-selector-button` instead of a hidden input plus a fake button. Same look, the browser still shows the chosen file name, and the input stays native and accessible.
- §3.3 empty states: the new styled empty message (`.admin-empty`) goes on the tabbed lists, Payments and Applications. The other admin tables keep their existing empty-state text.
- §2.5: the QR image and payment instructions move from each campaign section into the "How to pay" card beside the form. That avoids showing the same QR twice. The campaign sections keep their title, description and progress bar.

**Code blocks:** a whole new file is introduced by `` `path`: ``, an addition to the end of a file by `` `path` (append): ``. Other edits are given as exact old and new text.

## Global Constraints

- Keep the visual direction: the Syne, Space Grotesk and Inter fonts, and the tokens `--basalt`, `--canopy`, `--sage`, `--dune`, `--ochre` and `--ochre-hover`. No UI library.
- Every new public string goes into both the `en` and `hil` dictionaries in `lib/i18n.js`. The `hil` text is a draft and the file header already says so.
- Admin badges and counts come only from `requireArea`-gated server code. A count that fails to load shows no badge and never breaks the page.
- Public pages must pass the clipping check at 375, 768 and 1440px.
- Never stage the other session's files: `content/`, `db/import-articles.js`, `scripts/import-articles.mjs`, `public/assets/img/articles/`, `test/import-articles.test.js`, and the uncommitted edits in `components/admin/ArticleEditor.jsx`, `components/admin/RichTextEditor.jsx`, `package.json` and `.gitignore`.
- Run unit tests with `npx vitest run --exclude test/import-articles.test.js`.

## Review Focus

- **A very long project title on a photoless tile, e.g. 120 characters with no spaces:** it is clamped to 3 lines and nothing spills out of the card. → Task 2 test plus the Task 9 clipping run.
- **Choosing "Membership fee" or "General donation" in the pledge form:** the card drops the campaign QR and shows the "Ask us for payment details" fallback, not a stale QR. → Task 4 test.
- **`/admin/payments?tab=garbage`:** falls back to the first tab instead of an empty or broken page. → Task 8 test.
- **A nested admin path such as `/admin/payments/12` or `/admin/projects/new`:** highlights its section; Dashboard is highlighted only on `/admin` itself. → Task 6 test.
- **A database error while loading badge counts:** the sidebar still renders, with no badges. → Task 6 test.

---

### Task 1: Navigation and footer

**Files:**
- Modify: `lib/routes.js`, `components/SiteFooter.jsx`, `lib/i18n.js`, `app/globals.css`
- Create: `test/design-public.test.jsx`

**Interfaces:**
- Produces: `NAV_LINKS` (6 links), `FOOTER_COLUMNS` (`[{ key, links: [[href, label]] }]`), i18n keys `footer.chapter`, `footer.involved` and `footer.accountability`.

- [ ] **Step 1: Write the failing tests**

`test/design-public.test.jsx`:

```jsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { NAV_LINKS, FOOTER_COLUMNS, STATIC_ROUTES } from "@/lib/routes.js";
import { STRINGS } from "@/lib/i18n.js";

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: ({ fill, sizes, priority, ...props }) => <img {...props} />,
}));
const { default: SiteFooter } = await import("@/components/SiteFooter.jsx");

afterEach(cleanup);

const hasBoth = (keys) => {
  for (const lang of ["en", "hil"]) for (const k of keys) expect(STRINGS[lang][k], `${lang} ${k}`).toBeTypeOf("string");
};

describe("navigation", () => {
  it("reaches Support and Impact and no longer repeats Join", () => {
    expect(NAV_LINKS.map((l) => l.href)).toEqual(["/about", "/projects", "/events", "/impact", "/articles", "/support"]);
  });

  it("only links the footer to real public pages", () => {
    for (const col of FOOTER_COLUMNS) for (const [href] of col.links) expect(STATIC_ROUTES).toContain(href);
  });
});

describe("SiteFooter", () => {
  it("groups links into three labelled columns", () => {
    render(<SiteFooter cta={false} />);
    const accountability = screen.getByRole("navigation", { name: "Accountability" });
    expect(within(accountability).getByRole("link", { name: "Transparency" }).getAttribute("href")).toBe("/transparency");
    expect(screen.getByRole("navigation", { name: "Get involved" })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Chapter" })).toBeTruthy();
  });

  it("has the column headings in both languages", () => {
    hasBoth(["footer.chapter", "footer.involved", "footer.accountability"]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run test/design-public.test.jsx`
Expected: FAIL. `FOOTER_COLUMNS` is undefined and the nav hrefs differ.

- [ ] **Step 3: Implement**

In `lib/routes.js`, replace the whole `NAV_LINKS` array with:

```js
export const NAV_LINKS = [
  { href: "/about", label: "About" },
  { href: "/projects", label: "Projects" },
  { href: "/events", label: "Events" },
  { href: "/impact", label: "Impact" },
  { href: "/articles", label: "Articles" },
  { href: "/support", label: "Support" },
];

export const FOOTER_COLUMNS = [
  { key: "footer.chapter", links: [["/about", "About"], ["/officers", "Officers"], ["/projects", "Projects"], ["/articles", "Articles"]] },
  { key: "footer.involved", links: [["/join", "Join"], ["/events", "Events"], ["/support", "Support"]] },
  { key: "footer.accountability", links: [["/impact", "Impact"], ["/transparency", "Transparency"], ["/resources", "Free resources"]] },
];
```

In `lib/i18n.js`, after the line `    "footer.switch": "Hiligaynon",` add:

```js
    "footer.chapter": "Chapter",
    "footer.involved": "Get involved",
    "footer.accountability": "Accountability",
```

and after the line `    "footer.switch": "English",` add:

```js
    "footer.chapter": "Kapitulo",
    "footer.involved": "Mag-intra",
    "footer.accountability": "Pagkamay-salabton",
```

`components/SiteFooter.jsx`:

```jsx
import Link from "next/link";
import Image from "next/image";
import { SITE } from "@/lib/site.js";
import { FOOTER_COLUMNS } from "@/lib/routes.js";
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
      <div className="footer-cols">
        {FOOTER_COLUMNS.map((col) => (
          <nav key={col.key} aria-label={t(lang, col.key)}>
            <span className="label">{t(lang, col.key)}</span>
            <ul>{col.links.map(([href, label]) => <li key={href}><Link href={href}>{label}</Link></li>)}</ul>
          </nav>
        ))}
      </div>
      <div className="baseline">
        <span>{SITE.name} — {SITE.address.locality}, {SITE.address.region}, {SITE.address.postalCode}</span>
        <span>
          <a href={`mailto:${SITE.email}`}>{SITE.email}</a> ·{" "}
          <a href={SITE.facebookUrl} target="_blank" rel="noopener noreferrer">Facebook</a>
          {hilEnabled() && altHref && <> · <Link href={altHref} hrefLang={lang === "hil" ? "en" : "hil"}>{t(lang, "footer.switch")}</Link></>}
          {" "}· © {new Date().getFullYear()}
        </span>
      </div>
    </footer>
  );
}
```

`app/globals.css` (append):

```css
/* ============================================================
   Design pass
   ============================================================ */
.footer-cols { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 32px; text-align: left; }
.cta-footer__inner + .footer-cols { margin-top: 96px; }
.footer-cols ul { list-style: none; margin: 14px 0 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.footer-cols a { color: var(--dune); }
.footer-cols a:hover { color: var(--ochre); }
.footer-cols + .baseline { margin-top: 56px; }
@media (max-width: 600px) { .footer-cols { grid-template-columns: 1fr; gap: 28px; } }
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --exclude test/import-articles.test.js`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/routes.js components/SiteFooter.jsx lib/i18n.js app/globals.css test/design-public.test.jsx
git commit -m "Link Support and Impact from the main nav and group the footer into columns"
```

---

### Task 2: Typographic tiles for projects without photos

**Files:**
- Modify: `components/ProjectCard.jsx`, `test/components.test.jsx`, `app/globals.css`

- [ ] **Step 1: Write the failing test**

In `test/components.test.jsx`, inside `describe("ProjectCard", …)`, add:

```jsx
  it("shows the title, pillar and barangay on a photoless tile", () => {
    const { container } = render(
      <ProjectCard project={{ slug: "x", title: "SA DAGAT", pillar: "leadership", barangay: "Baybay", startDate: null, coverUrl: null }} />,
    );
    const tile = container.querySelector(".project__placeholder");
    expect(tile.classList.contains("project__placeholder--leadership")).toBe(true);
    expect(tile.getAttribute("aria-hidden")).toBe("true");
    expect(tile.querySelector(".project__tile-title").textContent).toBe("SA DAGAT");
    expect(tile.querySelector(".project__pillar").textContent).toBe("Leadership");
    expect(tile.querySelector(".project__place").textContent).toBe("Baybay");
  });

  it("falls back to the community tile when the pillar is missing", () => {
    const { container } = render(<ProjectCard project={{ slug: "x", title: "T", coverUrl: null }} />);
    expect(container.querySelector(".project__placeholder--community")).toBeTruthy();
    expect(container.querySelector(".project__place")).toBeNull();
  });
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run test/components.test.jsx`
Expected: FAIL. `.project__tile-title` doesn't exist yet.

- [ ] **Step 3: Implement**

In `components/ProjectCard.jsx`, add above the component:

```jsx
const PILLARS = { leadership: "Leadership", community: "Community", global: "Global" };
```

and replace the placeholder block

```jsx
            <div className="project__placeholder" aria-hidden="true">
              <Contours variant="quote" />
              <span>JCI Roxas Halaran</span>
            </div>
```

with

```jsx
            <div className={`project__placeholder project__placeholder--${PILLARS[project.pillar] ? project.pillar : "community"}`} aria-hidden="true">
              <Contours variant="quote" />
              <span className="project__pillar">{PILLARS[project.pillar] ?? PILLARS.community}</span>
              <strong className="project__tile-title">{project.title}</strong>
              {project.barangay && <span className="project__place">{project.barangay}</span>}
            </div>
```

`app/globals.css` (append):

```css
.project__placeholder { display: flex; flex-direction: column; justify-content: flex-end; gap: 10px; padding: 24px; }
.project__placeholder--leadership { background: #2a4f3b; }
.project__placeholder--global { background: var(--basalt); box-shadow: inset 0 0 0 1px var(--sage); }
.project__placeholder .project__pillar { margin-bottom: auto; color: var(--ochre); }
.project__placeholder .project__place { color: rgba(237, 232, 223, 0.6); }
.project__tile-title {
  position: relative; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
  font-family: var(--font-syne), sans-serif; font-weight: 800; font-size: clamp(1.3rem, 2.2vw, 1.9rem); line-height: 1.05;
  color: var(--dune); overflow-wrap: anywhere;
}
```

(The existing `.project__placeholder span` rule already styles both labels in Space Grotesk.)

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --exclude test/import-articles.test.js`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add components/ProjectCard.jsx test/components.test.jsx app/globals.css
git commit -m "Show the title, pillar and barangay on project cards without a photo"
```

---

### Task 3: Impact page without zeros, an empty-map panel and a place grid

**Files:**
- Modify: `lib/proof/impact.js`, `app/impact/page.jsx`, `test/proof-public.test.js`, `app/globals.css`, `e2e/site.spec.js`

**Interfaces:**
- Produces: `impactStats(totals) → [[label, value]]`, containing only values above 0.

- [ ] **Step 1: Write the failing test**

In `test/proof-public.test.js`, add `impactStats` to the `@/lib/proof/impact.js` import, then append:

```js
describe("impactStats", () => {
  it("drops figures that are zero", () => {
    expect(impactStats({ projectsDone: 11, activeMembers: 18, volunteers: 0, eventsHeld: 0, metrics: { trees_planted: 120, schools: 0 } })).toEqual([
      ["Projects completed", 11],
      ["Active members", 18],
      ["Trees planted", 120],
    ]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run test/proof-public.test.js`
Expected: FAIL. `impactStats` is not a function.

- [ ] **Step 3: Implement**

In `lib/proof/impact.js`, add `import { METRICS } from "./metric-labels.js";` and append:

```js
// Public impact figures; zeros are left out so the page never advertises "0 volunteers".
export function impactStats(totals) {
  return [
    ["Projects completed", totals.projectsDone],
    ["Active members", totals.activeMembers],
    ["Volunteers signed up", totals.volunteers],
    ["Events held", totals.eventsHeld],
    ...Object.entries(METRICS).map(([key, label]) => [label, totals.metrics?.[key] ?? 0]),
  ].filter(([, value]) => value > 0);
}
```

In `app/impact/page.jsx`:

1. Imports: replace `import { impactTotals, mapProjects, projectsByBarangay } from "@/lib/proof/impact.js";` with `import { impactTotals, impactStats, mapProjects, projectsByBarangay } from "@/lib/proof/impact.js";`, remove the `METRICS` import, and add `import Contours from "@/components/Contours.jsx";`.
2. Replace the whole `const stats = [ … ];` statement with:

```jsx
  const stats = impactStats(totals);
  const projectCount = groups.reduce((n, g) => n + g.projects.length, 0);
```

3. Wrap the stats `<section className="section">…</section>` as `{stats.length > 0 && (` … `)}`.
4. Replace `{points.length ? <ImpactMap points={points} /> : <p>Project locations are being added — see the list below.</p>}` with:

```jsx
        {points.length ? <ImpactMap points={points} /> : (
          <div className="map-empty">
            <Contours variant="quote" />
            <p><strong>{projectCount} projects</strong> are being mapped.</p>
            <a href="#by-place">See them by place</a>
          </div>
        )}
```

5. Replace the "Projects by place" section with:

```jsx
      <section className="section" id="by-place">
        <div className="section__bar"><h2>Projects by place</h2><span className="label">List</span></div>
        <div className="impact-groups">
          {groups.map((g) => (
            <div key={g.barangay} className="impact-group">
              <h3 className="syne">{g.barangay}</h3>
              <ul className="impact-list">{g.projects.map((p) => <li key={p.id}><Link href={`/projects/${p.slug}`}>{p.title}</Link></li>)}</ul>
            </div>
          ))}
        </div>
      </section>
```

`app/globals.css` (append):

```css
.map-empty { position: relative; overflow: hidden; display: grid; place-content: center; justify-items: center; gap: 12px; min-height: 280px; padding: 40px 24px; text-align: center; background: var(--canopy); }
.map-empty .contours { opacity: 0.25; }
.map-empty p, .map-empty a { position: relative; margin: 0; }
.map-empty strong { display: block; font-family: var(--font-syne), sans-serif; font-size: 1.8rem; color: var(--dune); }
.impact-groups { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 32px 48px; }
.impact-groups .impact-group { margin: 0; }
.impact-groups .impact-list { list-style: none; margin: 12px 0 0; padding: 12px 0 0; display: flex; flex-direction: column; gap: 8px; border-top: 1px solid rgba(237, 232, 223, 0.12); }
@media (max-width: 900px) { .impact-groups { grid-template-columns: 1fr; } }
```

In `e2e/site.spec.js`, in the test "impact page lists projects by place even without map locations", replace `await expect(page.getByText("Project locations are being added")).toBeVisible();` with `await expect(page.getByText("are being mapped")).toBeVisible();`. The e2e suite runs in Task 9.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --exclude test/import-articles.test.js`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/proof/impact.js app/impact/page.jsx test/proof-public.test.js app/globals.css e2e/site.spec.js
git commit -m "Hide zero figures on /impact and give the map and place list proper empty and grid layouts"
```

---

### Task 4: Support page — how-to-pay card beside the form

**Files:**
- Create: `components/forms/PaymentCard.jsx`, `components/forms/PledgePanel.jsx`, `test/support-panel.test.jsx`
- Modify: `components/forms/PledgeForm.jsx`, `components/pages/SupportPage.jsx`, `lib/i18n.js`, `app/globals.css`

**Interfaces:**
- Produces: `<PledgePanel campaigns lang />`, where `campaigns` is `[{ id, title, qrImageUrl, qrImageAlt, paymentInstructions }]`. `PledgeForm` takes a new optional prop `onCampaignChange(campaignId: string)`, called with `""` for non-campaign choices.

- [ ] **Step 1: Write the failing test**

`test/support-panel.test.jsx`:

```jsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { STRINGS } from "@/lib/i18n.js";

vi.mock("@/app/actions/engagement.js", () => ({ rsvpAction: vi.fn(), applyAction: vi.fn(), volunteerAction: vi.fn(), pledgeAction: vi.fn() }));
vi.mock("next/script", () => ({ default: () => null }));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: ({ fill, sizes, priority, ...props }) => <img {...props} />,
}));
const { default: PledgePanel } = await import("@/components/forms/PledgePanel.jsx");

afterEach(cleanup);

const campaigns = [
  { id: 1, title: "Coastal Fund", qrImageUrl: "/qr.png", qrImageAlt: "GCash QR for Coastal Fund", paymentInstructions: "GCash 0917 000 0000" },
  { id: 2, title: "School Kits", qrImageUrl: null, qrImageAlt: null, paymentInstructions: null },
];

describe("PledgePanel", () => {
  it("shows the chosen campaign's QR and switches to the fallback for one without a QR", () => {
    render(<PledgePanel campaigns={campaigns} />);
    expect(screen.getByRole("img", { name: "GCash QR for Coastal Fund" })).toBeTruthy();
    expect(screen.getByText("GCash 0917 000 0000")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/payment for/i), { target: { value: "2" } });
    expect(screen.queryByRole("img", { name: "GCash QR for Coastal Fund" })).toBeNull();
    expect(screen.getByText(/Ask us for payment details/)).toBeTruthy();
  });

  it("drops the campaign QR when paying a membership fee", () => {
    render(<PledgePanel campaigns={campaigns} />);
    fireEvent.change(screen.getByLabelText(/payment for/i), { target: { value: "membership_fee" } });
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText(/Ask us for payment details/)).toBeTruthy();
  });

  it("has the card text in both languages", () => {
    for (const lang of ["en", "hil"]) {
      for (const k of ["support.howTitle", "support.step1", "support.step2", "support.step3", "support.noQr"]) expect(STRINGS[lang][k], `${lang} ${k}`).toBeTypeOf("string");
    }
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run test/support-panel.test.jsx`
Expected: FAIL. `PledgePanel.jsx` is not found.

- [ ] **Step 3: Implement**

`lib/i18n.js`: after `    "footer.switch": "Hiligaynon",` add

```js
    "support.howTitle": "How to pay",
    "support.step1": "Scan the QR code with GCash, Maya or your bank app.",
    "support.step2": "Pay any amount you can give.",
    "support.step3": "Send your reference number with the form.",
    "support.noQr": "Ask us for payment details:",
```

and after `    "footer.switch": "English",` add

```js
    "support.howTitle": "Paano magbayad",
    "support.step1": "I-scan ang QR code paagi sa GCash, Maya ukon sa app sang imo bangko.",
    "support.step2": "Ibayad ang bisan ano nga kantidad nga masarangan mo.",
    "support.step3": "Ipadala ang imo reference number paagi sa form.",
    "support.noQr": "Pangayua sa amon ang detalye sang pagbayad:",
```

`components/forms/PaymentCard.jsx`:

```jsx
import Image from "next/image";
import { SITE } from "@/lib/site.js";
import { t } from "@/lib/i18n.js";

// The "how to pay" card beside the pledge form; it follows the campaign chosen in the form.
export default function PaymentCard({ campaign, lang = "en" }) {
  const L = (key) => t(lang, key);
  return (
    <aside className="pay-card" aria-label={L("support.howTitle")}>
      <span className="label">{L("support.howTitle")}</span>
      {campaign && <h3 lang="en">{campaign.title}</h3>}
      {campaign?.qrImageUrl ? (
        <figure className="pay-card__qr">
          <Image src={campaign.qrImageUrl} alt={campaign.qrImageAlt ?? `QR code for ${campaign.title}`} width={220} height={220} style={{ objectFit: "contain", height: "auto" }} />
        </figure>
      ) : (
        <p className="pay-card__note">{L("support.noQr")} <a href={`mailto:${SITE.email}`}>{SITE.email}</a></p>
      )}
      <ol className="pay-card__steps">
        <li>{L("support.step1")}</li>
        <li>{L("support.step2")}</li>
        <li>{L("support.step3")}</li>
      </ol>
      {campaign?.paymentInstructions && <p className="pay-card__note" lang="en">{campaign.paymentInstructions}</p>}
    </aside>
  );
}
```

`components/forms/PledgePanel.jsx`:

```jsx
"use client";

import { useState } from "react";
import PledgeForm from "./PledgeForm.jsx";
import PaymentCard from "./PaymentCard.jsx";

export default function PledgePanel({ campaigns, lang = "en" }) {
  const [campaignId, setCampaignId] = useState(campaigns[0] ? String(campaigns[0].id) : "");
  const campaign = campaigns.find((c) => String(c.id) === campaignId) ?? null;
  return (
    <div className="pledge-grid">
      <PaymentCard campaign={campaign} lang={lang} />
      <PledgeForm
        lang={lang}
        campaigns={campaigns.map((c) => ({ id: c.id, title: c.title }))}
        defaultCampaignId={campaigns[0] ? String(campaigns[0].id) : ""}
        onCampaignChange={setCampaignId}
      />
    </div>
  );
}
```

In `components/forms/PledgeForm.jsx`, change the signature to `export default function PledgeForm({ campaigns, defaultCampaignId = "", lang = "en", onCampaignChange }) {`. In the `#pl-for` select's `onChange`, after `const v = e.target.value;` add:

```jsx
          onCampaignChange?.(v === "membership_fee" || v === "sponsorship" ? "" : v);
```

In `components/pages/SupportPage.jsx`:

1. Replace `import PledgeForm from "@/components/forms/PledgeForm.jsx";` with `import PledgePanel from "@/components/forms/PledgePanel.jsx";` and remove the `next/image` import.
2. Replace the campaign `<div className="campaign__grid">…</div>` with:

```jsx
          <div className="campaign__grid">
            <div>
              {c.description && <p lang="en">{c.description}</p>}
              <ProgressBar raisedCentavos={c.raisedCentavos} goalCentavos={c.goalCentavos} label={c.title} />
            </div>
          </div>
```

3. Replace the `<PledgeForm … />` line with:

```jsx
        <PledgePanel lang={lang} campaigns={campaigns.map((c) => ({ id: c.id, title: c.title, qrImageUrl: c.qrImageUrl, qrImageAlt: c.qrImageAlt, paymentInstructions: c.paymentInstructions }))} />
```

`app/globals.css` (append):

```css
.pledge-grid { display: grid; grid-template-columns: minmax(0, 360px) minmax(0, 1fr); gap: 48px; align-items: start; margin-top: 24px; }
.pay-card { position: sticky; top: 100px; display: flex; flex-direction: column; gap: 16px; padding: 28px; background: var(--canopy); }
.pay-card h3 { margin: 0; font-family: var(--font-syne), sans-serif; font-size: 1.3rem; color: var(--dune); overflow-wrap: anywhere; }
.pay-card__qr { margin: 0; width: fit-content; max-width: 100%; padding: 12px; background: var(--dune); }
.pay-card__qr img { display: block; max-width: 100%; }
.pay-card__steps { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 8px; color: rgba(237, 232, 223, 0.85); }
.pay-card__note { margin: 0; color: rgba(237, 232, 223, 0.75); overflow-wrap: anywhere; }
@media (max-width: 900px) { .pledge-grid { grid-template-columns: 1fr; } .pay-card { position: static; } }
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --exclude test/import-articles.test.js`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add components/forms/PaymentCard.jsx components/forms/PledgePanel.jsx components/forms/PledgeForm.jsx components/pages/SupportPage.jsx lib/i18n.js app/globals.css test/support-panel.test.jsx
git commit -m "Put a how-to-pay card with the chosen campaign's QR beside the pledge form"
```

---

### Task 5: Join page layout and form controls

**Files:**
- Modify: `components/pages/JoinPage.jsx`, `lib/i18n.js`, `app/globals.css`, `test/design-public.test.jsx`

- [ ] **Step 1: Write the failing test**

Append to `test/design-public.test.jsx`:

```jsx
describe("join steps", () => {
  it("are written in both languages", () => {
    hasBoth(["join.stepsTitle", "join.step1", "join.step2", "join.step3", "join.step4"]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run test/design-public.test.jsx`
Expected: FAIL on `en join.stepsTitle`.

- [ ] **Step 3: Implement**

`lib/i18n.js`: after `    "footer.switch": "Hiligaynon",` add

```js
    "join.stepsTitle": "How joining works",
    "join.step1": "Apply online — it takes about three minutes.",
    "join.step2": "We contact you about orientation.",
    "join.step3": "Pay the annual membership fee.",
    "join.step4": "Join your first project as a member.",
```

and after `    "footer.switch": "English",` add

```js
    "join.stepsTitle": "Paano mag-intra",
    "join.step1": "Mag-aplay online — mga tatlo ka minuto lang.",
    "join.step2": "Kontakon ka namon parte sa orientation.",
    "join.step3": "Bayari ang tinuig nga membership fee.",
    "join.step4": "Mag-upod sa imo una nga proyekto bilang miyembro.",
```

In `components/pages/JoinPage.jsx`, replace

```jsx
        <p>{L("join.applyIntro")}</p>
        <ApplicationForm lang={lang} />
```

with

```jsx
        <div className="apply-grid">
          <div>
            <p>{L("join.applyIntro")}</p>
            <h3 className="syne">{L("join.stepsTitle")}</h3>
            <ol className="join-steps">
              {["join.step1", "join.step2", "join.step3", "join.step4"].map((k) => <li key={k}>{L(k)}</li>)}
            </ol>
          </div>
          <ApplicationForm lang={lang} />
        </div>
```

`app/globals.css` (append):

```css
.apply-grid { display: grid; grid-template-columns: minmax(0, 360px) minmax(0, 1fr); gap: 48px; align-items: start; }
.join-steps { list-style: none; counter-reset: step; margin: 16px 0 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
.join-steps li { counter-increment: step; display: grid; grid-template-columns: 32px minmax(0, 1fr); gap: 12px; color: rgba(237, 232, 223, 0.85); }
.join-steps li::before { content: counter(step, decimal-leading-zero); padding-top: 2px; font-family: var(--font-space-grotesk), monospace; font-size: 0.78rem; color: var(--ochre); }
@media (max-width: 900px) { .apply-grid { grid-template-columns: 1fr; } }

/* form controls */
.field select, .public-form select {
  appearance: none; -webkit-appearance: none; padding-right: 40px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%23e5a823' stroke-width='1.6'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 14px center;
}
input[type="file"] { max-width: 100%; color: rgba(237, 232, 223, 0.7); font: inherit; font-size: 0.85rem; }
input[type="file"]::file-selector-button {
  margin-right: 14px; padding: 9px 16px; border: 1px solid var(--ochre); background: transparent; color: var(--ochre); cursor: pointer;
  font-family: var(--font-space-grotesk), monospace; font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase;
}
input[type="file"]::file-selector-button:hover { background: var(--ochre); color: var(--basalt); }
input[type="checkbox"] { accent-color: var(--ochre); width: 18px; height: 18px; }
```

- [ ] **Step 4: Run the tests and build**

Run: `npx vitest run --exclude test/import-articles.test.js && NEXT_DIST_DIR=.next-check npx next build`
Expected: all PASS; the build succeeds.

- [ ] **Step 5: Commit**

```bash
git add components/pages/JoinPage.jsx lib/i18n.js app/globals.css test/design-public.test.jsx
git commit -m "Put joining steps beside the application form and style selects, file pickers and checkboxes"
```

---

### Task 6: Admin navigation model, badge counts and status tones

**Files:**
- Create: `lib/admin/nav.js`, `lib/admin/counts.js`, `lib/admin/status.js`, `components/admin/StatusBadge.jsx`, `test/admin-shell.test.js`

**Interfaces:**
- Produces:
  - `ADMIN_GROUPS`
  - `adminNav(role, counts) → [{ label, links: [{ href, label, badge }] }]`
  - `isCurrent(href, pathname) → boolean`
  - `adminCounts(db) → { applications, payments, passport }`
  - `safeAdminCounts(db) → counts | {}`
  - `badgeTone(status) → "wait" | "ok" | "bad" | "neutral"`
  - `<StatusBadge status />`

- [ ] **Step 1: Write the failing tests**

`test/admin-shell.test.js`:

```js
import { describe, it, expect, beforeEach } from "vitest";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { adminNav, isCurrent } from "@/lib/admin/nav.js";
import { adminCounts, safeAdminCounts } from "@/lib/admin/counts.js";
import { badgeTone } from "@/lib/admin/status.js";
import { submitPledge } from "@/lib/engagement/money.js";

describe("adminNav", () => {
  it("groups admin links and shows only non-zero badges", () => {
    const groups = adminNav("admin", { applications: 0, payments: 3, passport: 1 });
    expect(groups.map((g) => g.label)).toEqual([null, "Content", "People", "Money", "Proof"]);
    const links = groups.flatMap((g) => g.links);
    expect(links.find((l) => l.href === "/admin/payments").badge).toBe(3);
    expect(links.find((l) => l.href === "/admin/passport").badge).toBe(1);
    expect(links.find((l) => l.href === "/admin/applications").badge).toBeNull();
    expect(links.find((l) => l.href === "/admin/articles").badge).toBeNull();
  });

  it("gives officers and treasurers only the dashboard", () => {
    for (const role of ["officer", "treasurer"]) {
      expect(adminNav(role, { payments: 3 }).flatMap((g) => g.links).map((l) => l.href)).toEqual(["/admin"]);
    }
  });
});

describe("isCurrent", () => {
  it("matches nested pages to their section and the dashboard only exactly", () => {
    expect(isCurrent("/admin/payments", "/admin/payments/12")).toBe(true);
    expect(isCurrent("/admin/projects", "/admin/projects/new")).toBe(true);
    expect(isCurrent("/admin", "/admin/payments")).toBe(false);
    expect(isCurrent("/admin", "/admin")).toBe(true);
    expect(isCurrent("/admin/events", "/admin/evidence")).toBe(false);
  });
});

describe("adminCounts", () => {
  let db;
  beforeEach(async () => {
    db = await testDb();
    await seed(db);
  });

  it("counts pending applications, payments and passport requests", async () => {
    await submitPledge(db, { payerName: "Ana Cruz", payerEmail: "a@x.ph", amountPesos: 500, method: "gcash", referenceNo: "REF00009", consent: true });
    expect(await adminCounts(db)).toEqual({ applications: 0, payments: 1, passport: 0 });
  });

  it("returns no counts instead of failing when the database errors", async () => {
    const broken = { select: () => { throw new Error("offline"); } };
    expect(await safeAdminCounts(broken)).toEqual({});
  });
});

describe("badgeTone", () => {
  it("maps statuses to tones", () => {
    expect(["pending", "requested", "draft"].map(badgeTone)).toEqual(["wait", "wait", "wait"]);
    expect(["confirmed", "approved", "published", "verified", "attended"].map(badgeTone)).toEqual(["ok", "ok", "ok", "ok", "ok"]);
    expect(["rejected", "declined", "cancelled"].map(badgeTone)).toEqual(["bad", "bad", "bad"]);
    expect(badgeTone("archived")).toBe("neutral");
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run test/admin-shell.test.js`
Expected: FAIL. The modules are not found.

- [ ] **Step 3: Implement**

`lib/admin/nav.js`:

```js
export const ADMIN_GROUPS = [
  { label: null, links: [{ href: "/admin", label: "Dashboard" }] },
  { label: "Content", links: [{ href: "/admin/articles", label: "Articles" }, { href: "/admin/projects", label: "Projects" }, { href: "/admin/resources", label: "Resources" }, { href: "/admin/seo-plan", label: "SEO plan" }] },
  { label: "People", links: [{ href: "/admin/applications", label: "Applications", count: "applications" }, { href: "/admin/members", label: "Members" }, { href: "/admin/passport", label: "Passport", count: "passport" }] },
  { label: "Money", links: [{ href: "/admin/payments", label: "Payments", count: "payments" }, { href: "/admin/campaigns", label: "Campaigns" }, { href: "/admin/expenses", label: "Expenses" }] },
  { label: "Proof", links: [{ href: "/admin/events", label: "Events" }, { href: "/admin/evidence", label: "Evidence" }] },
];

// Officers and treasurers can open the admin area but only admins edit, so they get the dashboard alone.
export function adminNav(role, counts = {}) {
  const groups = role === "admin" ? ADMIN_GROUPS : ADMIN_GROUPS.slice(0, 1);
  return groups.map((g) => ({
    label: g.label,
    links: g.links.map(({ count, ...link }) => ({ ...link, badge: count && counts[count] > 0 ? counts[count] : null })),
  }));
}

export const isCurrent = (href, pathname) =>
  href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
```

`lib/admin/counts.js`:

```js
import { count, eq } from "drizzle-orm";
import { applications, payments, passportEntries } from "../../db/schema.js";

export async function adminCounts(db) {
  const n = async (table, column, value) => (await db.select({ n: count() }).from(table).where(eq(column, value)))[0].n;
  const [apps, pays, passport] = await Promise.all([
    n(applications, applications.status, "pending"),
    n(payments, payments.status, "pending"),
    n(passportEntries, passportEntries.status, "requested"),
  ]);
  return { applications: apps, payments: pays, passport };
}

// Badges are a convenience: a failed count hides them rather than breaking every admin page.
export async function safeAdminCounts(db) {
  try {
    return await adminCounts(db);
  } catch (e) {
    console.error("Admin counts failed", e);
    return {};
  }
}
```

`lib/admin/status.js`:

```js
const TONES = {
  pending: "wait", requested: "wait", draft: "wait",
  confirmed: "ok", approved: "ok", published: "ok", verified: "ok", attended: "ok",
  rejected: "bad", declined: "bad", cancelled: "bad",
};

export const badgeTone = (status) => TONES[status] ?? "neutral";
```

`components/admin/StatusBadge.jsx`:

```jsx
import { badgeTone } from "@/lib/admin/status.js";

export default function StatusBadge({ status }) {
  return <span className={`badge badge--${badgeTone(status)}`}>{String(status).replace(/_/g, " ")}</span>;
}
```

`app/globals.css` (append):

```css
.badge { display: inline-block; padding: 3px 10px; border-radius: 999px; white-space: nowrap; font-family: var(--font-space-grotesk), monospace; font-size: 0.68rem; letter-spacing: 0.1em; text-transform: uppercase; }
.badge--wait { background: rgba(229, 168, 35, 0.16); color: var(--ochre); }
.badge--ok { background: rgba(58, 107, 79, 0.35); color: #a9d6b5; }
.badge--bad { background: rgba(242, 184, 162, 0.14); color: #f2b8a2; }
.badge--neutral { background: rgba(237, 232, 223, 0.08); color: rgba(237, 232, 223, 0.75); }
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --exclude test/import-articles.test.js`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/nav.js lib/admin/counts.js lib/admin/status.js components/admin/StatusBadge.jsx test/admin-shell.test.js app/globals.css
git commit -m "Add the admin navigation model, waiting-work counts and status badge tones"
```

---

### Task 7: Admin shell with a grouped sidebar

**Files:**
- Create: `components/admin/AdminSidebar.jsx`, `test/admin-sidebar.test.jsx`
- Modify: `app/admin/layout.jsx`, `app/globals.css`, the 19 admin pages that render `<AdminNav … />`
- Delete: `components/admin/AdminNav.jsx`

**Interfaces:**
- Consumes: `adminNav`, `isCurrent` and `safeAdminCounts` (Task 6).

- [ ] **Step 1: Write the failing test**

`test/admin-sidebar.test.jsx`:

```jsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { adminNav } from "@/lib/admin/nav.js";

const h = vi.hoisted(() => ({ path: "/admin/payments/12" }));
vi.mock("next/navigation", () => ({ usePathname: () => h.path }));
const { default: AdminSidebar } = await import("@/components/admin/AdminSidebar.jsx");

afterEach(cleanup);

describe("AdminSidebar", () => {
  it("marks the current section and shows waiting counts", () => {
    render(<AdminSidebar groups={adminNav("admin", { payments: 3 })} role="admin" />);
    const payments = screen.getByRole("link", { name: "Payments 3 waiting" });
    expect(payments.getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Dashboard" }).getAttribute("aria-current")).toBeNull();
    expect(screen.getByText("Money")).toBeTruthy();
    expect(screen.getByRole("link", { name: "View site" }).getAttribute("href")).toBe("/");
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run test/admin-sidebar.test.jsx`
Expected: FAIL. `AdminSidebar.jsx` is not found.

- [ ] **Step 3: Implement**

`components/admin/AdminSidebar.jsx`:

```jsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isCurrent } from "@/lib/admin/nav.js";

export default function AdminSidebar({ groups, role }) {
  const pathname = usePathname() ?? "";
  return (
    <nav className="admin-side" aria-label="Admin">
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
      <div className="admin-side__foot">
        <Link href="/">View site</Link>
        <span>Signed in as {role}</span>
      </div>
    </nav>
  );
}
```

`app/admin/layout.jsx`:

```jsx
import { ClerkProvider } from "@clerk/nextjs";
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { adminNav } from "@/lib/admin/nav.js";
import { safeAdminCounts } from "@/lib/admin/counts.js";
import AdminSidebar from "@/components/admin/AdminSidebar.jsx";

// Second gate behind middleware.js: the admin area never renders for
// someone without an admin-area role, even if middleware is bypassed.
export default async function AdminLayout({ children }) {
  const { role } = await requireArea("admin");
  const counts = role === "admin" ? await safeAdminCounts(getDb()) : {};
  return (
    <ClerkProvider>
      <div className="admin-shell">
        <AdminSidebar groups={adminNav(role, counts)} role={role} />
        <div className="admin-main">{children}</div>
      </div>
    </ClerkProvider>
  );
}
```

Remove the per-page nav from every admin page, then delete the component:

```bash
python3 - <<'EOF'
import pathlib, re
for p in pathlib.Path("app/admin").rglob("*.jsx"):
    s = p.read_text()
    if "AdminNav" not in s:
        continue
    s = re.sub(r'^import AdminNav from "@/components/admin/AdminNav\.jsx";\n', "", s, flags=re.M)
    s = re.sub(r'^\s*<AdminNav[^>]*/>\n', "", s, flags=re.M)
    p.write_text(s)
    print("updated", p)
EOF
git rm -q components/admin/AdminNav.jsx
grep -rn "AdminNav" app components || echo "no AdminNav left"
```

Expected: 19 "updated" lines, then "no AdminNav left".

`app/globals.css` (append):

```css
.admin-shell { display: grid; grid-template-columns: 232px minmax(0, 1fr); min-height: calc(100vh - 81px); }
.admin-side { position: sticky; top: 81px; align-self: start; height: calc(100vh - 81px); overflow-y: auto; display: flex; flex-direction: column; gap: 22px; padding: 32px 16px; border-right: 1px solid rgba(237, 232, 223, 0.1); }
.admin-side__group { display: flex; flex-direction: column; gap: 2px; }
.admin-side__label { padding: 0 10px 6px; font-family: var(--font-space-grotesk), monospace; font-size: 0.68rem; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(237, 232, 223, 0.45); }
.admin-side a { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; font-size: 0.92rem; color: rgba(237, 232, 223, 0.85); }
.admin-side a:hover { background: rgba(237, 232, 223, 0.05); color: var(--dune); }
.admin-side a.is-current { background: rgba(229, 168, 35, 0.12); color: var(--ochre); }
.admin-side__badge { min-width: 22px; padding: 1px 7px; border-radius: 999px; background: var(--ochre); color: var(--basalt); font-size: 0.72rem; font-weight: 700; text-align: center; }
.admin-side__foot { margin-top: auto; display: flex; flex-direction: column; gap: 6px; padding: 0 10px; font-size: 0.8rem; color: rgba(237, 232, 223, 0.5); }
.admin-main .admin { padding-top: 40px; }
@media (max-width: 900px) {
  .admin-shell { grid-template-columns: 1fr; }
  .admin-side { position: static; height: auto; flex-direction: row; gap: 4px; overflow-x: auto; padding: 10px var(--pad-x); border-right: 0; border-bottom: 1px solid rgba(237, 232, 223, 0.1); }
  .admin-side__group { flex-direction: row; gap: 4px; }
  .admin-side__label, .admin-side__foot { display: none; }
  .admin-side a { white-space: nowrap; }
  .admin-table { display: block; overflow-x: auto; }
}
```

- [ ] **Step 4: Run the tests and build**

Run: `npx vitest run --exclude test/import-articles.test.js && NEXT_DIST_DIR=.next-check npx next build`
Expected: all PASS; the build succeeds.

- [ ] **Step 5: Commit**

```bash
git add components/admin/AdminSidebar.jsx test/admin-sidebar.test.jsx app/admin app/globals.css
git commit -m "Replace the per-page admin link row with one grouped sidebar showing waiting work"
```

(`git add app/admin` is safe here: the other session's uncommitted files are not under `app/admin`. Check `git status --short app/admin` before committing.)

---

### Task 8: Admin dashboard, status tabs and badges

**Files:**
- Create: `lib/admin/tabs.js`, `lib/admin/dashboard.js`, `components/admin/AdminTabs.jsx`, `test/admin-pages.test.js`
- Modify: `app/admin/page.jsx`, `app/admin/payments/page.jsx`, `app/admin/applications/page.jsx`, `app/globals.css`

**Interfaces:**
- Produces:
  - `pickTab(value, keys) → key`
  - `statusTabs(rows, defs, { amount }) → [{ key, label, count, total, rows }]`
  - `todoCards(counts, drafts) → [{ href, title, text, badge }]`

- [ ] **Step 1: Write the failing tests**

`test/admin-pages.test.js`:

```js
import { describe, it, expect } from "vitest";
import { pickTab, statusTabs } from "@/lib/admin/tabs.js";
import { todoCards } from "@/lib/admin/dashboard.js";

const rows = [
  { id: 1, status: "pending", amountCentavos: 50000 },
  { id: 2, status: "pending", amountCentavos: 25000 },
  { id: 3, status: "confirmed", amountCentavos: 100000 },
];
const DEFS = [["pending", "To confirm"], ["confirmed", "Confirmed"], ["rejected", "Rejected"]];

describe("statusTabs", () => {
  it("splits rows by status with counts and peso totals", () => {
    const tabs = statusTabs(rows, DEFS, { amount: true });
    expect(tabs.map(({ key, count, total }) => ({ key, count, total }))).toEqual([
      { key: "pending", count: 2, total: 75000 },
      { key: "confirmed", count: 1, total: 100000 },
      { key: "rejected", count: 0, total: 0 },
    ]);
    expect(tabs[0].rows.map((r) => r.id)).toEqual([1, 2]);
  });

  it("leaves totals out when amounts don't apply", () => {
    expect(statusTabs(rows, DEFS)[0].total).toBeNull();
  });
});

describe("pickTab", () => {
  it("falls back to the first tab for unknown or missing values", () => {
    expect(pickTab("confirmed", ["pending", "confirmed"])).toBe("confirmed");
    expect(pickTab("garbage", ["pending", "confirmed"])).toBe("pending");
    expect(pickTab(undefined, ["pending", "confirmed"])).toBe("pending");
  });
});

describe("todoCards", () => {
  it("says what is waiting and 'All caught up' when nothing is", () => {
    const cards = todoCards({ applications: 2, payments: 0, passport: 1 }, 3);
    expect(cards.map((c) => [c.href, c.text, c.badge])).toEqual([
      ["/admin/applications", "2 waiting for review", 2],
      ["/admin/payments", "All caught up", null],
      ["/admin/passport", "1 to verify", 1],
      ["/admin/articles", "3 drafts in progress", null],
    ]);
  });

  it("copes with missing counts", () => {
    expect(todoCards({}, 0).every((c) => c.text === "All caught up" || c.text === "No drafts")).toBe(true);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run test/admin-pages.test.js`
Expected: FAIL. The modules are not found.

- [ ] **Step 3: Implement the helpers**

`lib/admin/tabs.js`:

```js
export const pickTab = (value, keys) => (keys.includes(value) ? value : keys[0]);

// One tab per status in `defs` ([key, label] pairs), with its rows, count and optional peso total.
export function statusTabs(rows, defs, { amount = false } = {}) {
  return defs.map(([key, label]) => {
    const list = rows.filter((r) => r.status === key);
    return { key, label, count: list.length, total: amount ? list.reduce((s, r) => s + r.amountCentavos, 0) : null, rows: list };
  });
}
```

`lib/admin/dashboard.js`:

```js
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function todoCards(counts, drafts) {
  const card = (href, title, n, text) => ({ href, title, text: n > 0 ? text(n) : "All caught up", badge: n > 0 ? n : null });
  return [
    card("/admin/applications", "Applications", counts.applications ?? 0, (n) => `${n} waiting for review`),
    card("/admin/payments", "Payments", counts.payments ?? 0, (n) => `${n} to confirm`),
    card("/admin/passport", "Passport requests", counts.passport ?? 0, (n) => `${n} to verify`),
    { href: "/admin/articles", title: "Drafts", text: drafts > 0 ? `${plural(drafts, "draft")} in progress` : "No drafts", badge: null },
  ];
}
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run test/admin-pages.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Use them in the pages**

`components/admin/AdminTabs.jsx`:

```jsx
import Link from "next/link";
import { formatPesos } from "@/lib/format.js";

export default function AdminTabs({ base, tabs, current }) {
  return (
    <nav className="admin-tabs" aria-label="Filter by status">
      {tabs.map((t) => (
        <Link key={t.key} href={`${base}?tab=${t.key}`} className={t.key === current ? "is-current" : undefined} aria-current={t.key === current ? "page" : undefined}>
          {t.label} <span className="admin-tabs__count">{t.count}</span>
          {t.total !== null && <span className="admin-tabs__total">{formatPesos(t.total)}</span>}
        </Link>
      ))}
    </nav>
  );
}
```

`app/admin/payments/page.jsx`:

```jsx
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listPayments, listCampaigns } from "@/lib/engagement/money.js";
import { formatDate, formatPesos } from "@/lib/format.js";
import { safeHttpsUrl } from "@/lib/safe.js";
import { pickTab, statusTabs } from "@/lib/admin/tabs.js";
import PaymentActions from "@/components/admin/PaymentActions.jsx";
import AdminTabs from "@/components/admin/AdminTabs.jsx";
import StatusBadge from "@/components/admin/StatusBadge.jsx";

export const metadata = { title: "Payments — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const TYPE = { donation: "Donation", sponsorship: "Sponsorship", membership_fee: "Membership fee" };
const TABS = [["pending", "To confirm"], ["confirmed", "Confirmed"], ["rejected", "Rejected"]];
const EMPTY = { pending: "Nothing to confirm — all caught up.", confirmed: "No confirmed payments yet.", rejected: "No rejected payments." };

export default async function AdminPayments({ searchParams }) {
  await requireArea("content");
  const db = getDb();
  const [list, campaigns, { tab: asked }] = await Promise.all([listPayments(db), listCampaigns(db), searchParams]);
  const tabs = statusTabs(list, TABS, { amount: true });
  const tab = pickTab(asked, tabs.map((t) => t.key));
  const rows = tabs.find((t) => t.key === tab).rows;
  const campaignName = (id) => campaigns.find((c) => c.id === id)?.title ?? "General";
  return (
    <div className="admin">
      <h1>Payments</h1>
      <p>Check each reference number in the GCash, Maya or bank app before confirming. Only confirmed payments count toward campaign goals.</p>
      <AdminTabs base="/admin/payments" tabs={tabs} current={tab} />
      {rows.length === 0 ? <p className="admin-empty">{EMPTY[tab]}</p> : (
        <table className="admin-table">
          <thead><tr><th>Payer</th><th>Amount</th><th>For</th><th>Reference</th><th>Date</th><th>{tab === "pending" ? "Review" : "Status"}</th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>{p.payerName}<br />{p.payerEmail}</td>
                <td>{formatPesos(p.amountCentavos)}</td>
                <td>{TYPE[p.type]}{p.type === "donation" ? `: ${campaignName(p.campaignId)}` : ""}</td>
                <td>{p.method.toUpperCase()} {p.referenceNo}{safeHttpsUrl(p.proofUrl) ? <><br /><a href={safeHttpsUrl(p.proofUrl)} target="_blank" rel="noreferrer">Screenshot</a></> : null}</td>
                <td>{formatDate(p.createdAt)}</td>
                <td>{tab === "pending" ? <PaymentActions id={p.id} /> : <><StatusBadge status={p.status} />{p.note ? <><br />{p.note}</> : null}</>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
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
import { pickTab, statusTabs } from "@/lib/admin/tabs.js";
import ApplicationActions from "@/components/admin/ApplicationActions.jsx";
import AdminTabs from "@/components/admin/AdminTabs.jsx";
import StatusBadge from "@/components/admin/StatusBadge.jsx";

export const metadata = { title: "Applications — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const TABS = [["pending", "Pending"], ["approved", "Approved"], ["declined", "Declined"]];
const EMPTY = { pending: "No applications waiting — all caught up.", approved: "No approved applications yet.", declined: "No declined applications." };

export default async function AdminApplications({ searchParams }) {
  await requireArea("content");
  const [list, { tab: asked }] = await Promise.all([listApplications(getDb()), searchParams]);
  const tabs = statusTabs(list, TABS);
  const tab = pickTab(asked, tabs.map((t) => t.key));
  const rows = tabs.find((t) => t.key === tab).rows;
  return (
    <div className="admin">
      <h1>Applications</h1>
      <AdminTabs base="/admin/applications" tabs={tabs} current={tab} />
      {rows.length === 0 ? <p className="admin-empty">{EMPTY[tab]}</p> : (
        <table className="admin-table">
          <thead><tr><th>Applicant</th><th>Details</th><th>Received</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td><strong>{a.name}</strong><br />{a.email}{a.phone ? <><br />{a.phone}</> : null}</td>
                <td>Born {a.birthdate}{a.barangay ? `, ${a.barangay}` : ""}{a.whyJoin ? <><br />“{a.whyJoin}”</> : null}{a.referredBy ? <><br />Referred by {a.referredBy}</> : null}</td>
                <td>{formatDate(a.createdAt)}</td>
                <td>{a.status === "pending" ? <ApplicationActions id={a.id} /> : <><StatusBadge status={a.status} />{a.note ? <><br />{a.note}</> : null}</>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

`app/admin/page.jsx`:

```jsx
import Link from "next/link";
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { monthProgress } from "@/lib/content/seoPlan.js";
import { listArticlesAdmin } from "@/lib/content/articles.js";
import { listEvents } from "@/lib/engagement/events.js";
import { safeAdminCounts } from "@/lib/admin/counts.js";
import { todoCards } from "@/lib/admin/dashboard.js";
import { formatDateTime, phNow } from "@/lib/format.js";

export const metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const QUICK = [["/admin/articles/new", "New article"], ["/admin/events/new", "New event"], ["/admin/projects/new", "Add project"], ["/admin/expenses", "Record expense"]];

export default async function Admin() {
  const { role } = await requireArea("admin");
  if (role !== "admin") {
    return (
      <div className="admin">
        <h1>Dashboard</h1>
        <p>Signed in as <strong>{role}</strong>. Only admins can edit content.</p>
      </div>
    );
  }
  const db = getDb();
  const month = phNow().slice(0, 7);
  const [progress, drafts, events, counts] = await Promise.all([
    monthProgress(db, month),
    listArticlesAdmin(db, { status: "draft" }),
    listEvents(db),
    safeAdminCounts(db),
  ]);
  const next = events.upcoming[0];
  const pct = progress.total ? Math.round((100 * progress.published) / progress.total) : 0;
  return (
    <div className="admin">
      <h1>Dashboard</h1>
      <div className="dash">
        <section className="dash__todo" aria-labelledby="todo-h">
          <h2 id="todo-h" className="syne">Things to do</h2>
          {todoCards(counts, drafts.length).map((c) => (
            <Link key={c.href} href={c.href} className="dash-card">
              <span className="dash-card__title">{c.title}</span>
              <span className="dash-card__text">{c.text}</span>
              {c.badge && <span className="admin-side__badge">{c.badge}</span>}
            </Link>
          ))}
          <Link href={next ? `/admin/events/${next.id}` : "/admin/events/new"} className="dash-card">
            <span className="dash-card__title">Next event</span>
            <span className="dash-card__text">{next ? `${next.title} · ${formatDateTime(next.startAt)} · ${next.going}${next.capacity ? ` of ${next.capacity}` : ""} going` : "No upcoming events — create one"}</span>
          </Link>
          <Link href="/admin/seo-plan" className="dash-card">
            <span className="dash-card__title">SEO plan {month}</span>
            <span className="dash-card__text">{progress.published} of {progress.total} articles published</span>
            <span className="dash-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
          </Link>
        </section>
        <section className="dash__quick" aria-labelledby="quick-h">
          <h2 id="quick-h" className="syne">Quick actions</h2>
          {QUICK.map(([href, label]) => <Link key={href} href={href} className="btn">{label}</Link>)}
        </section>
      </div>
    </div>
  );
}
```

`app/globals.css` (append):

```css
.admin-tabs { display: flex; flex-wrap: wrap; gap: 4px; border-bottom: 1px solid rgba(237, 232, 223, 0.12); }
.admin-tabs a { display: inline-flex; align-items: center; gap: 8px; padding: 10px 14px; margin-bottom: -1px; border-bottom: 2px solid transparent; color: rgba(237, 232, 223, 0.7); }
.admin-tabs a.is-current { border-bottom-color: var(--ochre); color: var(--dune); }
.admin-tabs__count { padding: 0 7px; border-radius: 999px; background: rgba(237, 232, 223, 0.1); font-size: 0.75rem; }
.admin-tabs__total { font-size: 0.8rem; color: rgba(237, 232, 223, 0.5); }
.admin-empty { padding: 32px; border: 1px dashed rgba(237, 232, 223, 0.18); text-align: center; color: rgba(237, 232, 223, 0.65); }
.dash { display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: 32px; align-items: start; }
.dash__todo, .dash__quick { display: flex; flex-direction: column; gap: 10px; }
.dash__quick .btn { text-align: center; }
.dash-card { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 12px; align-items: center; padding: 16px 18px; background: rgba(237, 232, 223, 0.04); border: 1px solid rgba(237, 232, 223, 0.08); color: var(--dune); }
.dash-card:hover { border-color: rgba(229, 168, 35, 0.5); }
.dash-card__title { font-weight: 600; }
.dash-card__text { grid-column: 1; color: rgba(237, 232, 223, 0.7); font-size: 0.9rem; }
.dash-card .admin-side__badge { grid-column: 2; grid-row: 1 / span 2; }
.dash-bar { grid-column: 1 / -1; height: 6px; margin-top: 6px; background: rgba(237, 232, 223, 0.1); }
.dash-bar span { display: block; height: 100%; background: var(--ochre); }
@media (max-width: 900px) { .dash { grid-template-columns: 1fr; } }
```

- [ ] **Step 6: Run the tests and build**

Run: `npx vitest run --exclude test/import-articles.test.js && NEXT_DIST_DIR=.next-check npx next build`
Expected: all PASS; the build succeeds.

- [ ] **Step 7: Commit**

```bash
git add lib/admin/tabs.js lib/admin/dashboard.js components/admin/AdminTabs.jsx test/admin-pages.test.js app/admin/page.jsx app/admin/payments/page.jsx app/admin/applications/page.jsx app/globals.css
git commit -m "Add a things-to-do admin dashboard and status tabs with badges for payments and applications"
```

---

### Task 9: End-to-end checks at three widths, push, review, deploy

**Files:**
- Modify: `e2e/site.spec.js`

- [ ] **Step 1: Widen the clipping check and add the design checks**

In `e2e/site.spec.js`, replace the per-route test `` test(`${path} has no text or images cut off on a 375px phone`, async ({ page }) => { … }); `` with:

```js
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
```

Append:

```js
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
```

- [ ] **Step 2: Run the whole e2e suite**

Run: `npx playwright test`
Expected: all PASS. Any clipping failure is fixed in CSS, with a ledgered ruling.

- [ ] **Step 3: Commit and push**

```bash
git add e2e/site.spec.js
git commit -m "Check every public page at 375, 768 and 1440px and cover the new nav, footer, support card and tiles"
git push
```

- [ ] **Step 4: Final review, PR, deploy**

Final whole-branch review (opus); one fix pass for Critical/Important findings, test-first. Then open a PR from `halaran-online` into `main` and merge it to deploy, as with PR #3. Check `/`, `/projects`, `/support` and `/impact` on production. Add a row to the Bid Evidence Log: "Design pass: grouped admin sidebar and dashboard, photoless project tiles, how-to-pay card, three-column footer" (Layout & presentation). Then ask the user to sign in and walk through the admin sidebar on desktop and phone.
