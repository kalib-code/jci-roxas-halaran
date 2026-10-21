# Halaran Online — Design Pass Spec

**Date:** 2026-10-21
**Status:** Design approved in conversation; awaiting written-spec review
**Builds on:** Phases 1–5 (deployed). Visual direction unchanged: mellon.org-style layout; Syne, Space Grotesk and Inter; basalt / dune / sage / ochre palette.
**Research:** live-site screenshots (desktop 1440px, phone 390px) and Mobbin references cited below.

## 1. Purpose

Lift the "Layout & presentation" Temiong criterion and make the admin easier for non-technical officers, without a rebrand.

### Success criteria

- No page shows a wall of identical placeholders: a project without a cover photo is still recognisable from its card.
- The main navigation reaches Support and Impact; nothing in it is duplicated.
- Public pages never show a "0" statistic.
- Support and Join use the full page width on desktop and stack cleanly on phones.
- The admin has one grouped sidebar with counts of waiting work, a task-oriented dashboard, and status badges on every list.
- Every public page passes the clipping check at 375, 768 and 1440 px.

### Decisions

| Decision | Choice |
|---|---|
| Styling | Plain CSS in `app/globals.css`, extending the existing tokens; no UI library |
| Photoless project cards | Typographic tile: title, pillar label, barangay; tint by pillar (pattern: [Tailscale](https://mobbin.com/sites/sections/15ad3271-0071-4cdd-95e1-32a5d2386184), [Shade](https://mobbin.com/sites/sections/2d100fc2-36d8-4f1f-94e5-f1a21ea17c98)) |
| Admin navigation | Grouped sidebar rendered once in `app/admin/layout.jsx` (pattern: [Shopify](https://mobbin.com/screens/2dd4c10c-bd51-4fe4-8fe3-a13182e2129d), [Whop](https://mobbin.com/screens/b3d17af6-37c1-45bd-aaa7-7aa86c9b4dbc)) |
| Admin dashboard | "Things to do" cards + quick actions (pattern: [Remote](https://mobbin.com/screens/425014d9-aea0-4c7e-a217-d062da016d7f)) |
| Payments list | Tabs with count and total (pattern: [Deel](https://mobbin.com/screens/2b18ac2e-4083-483c-84b5-e955b2a2b5d1), [Melio](https://mobbin.com/screens/bf5a95bf-1d81-4017-ac17-0e35ad2c2885)) |
| Support page | QR card beside the form (pattern: [PayPal](https://mobbin.com/sites/sections/2f23cc73-591e-4345-acc1-eeb55f468187)) |

## 2. Public site

### 2.1 Navigation (`lib/routes.js`, `components/Nav.jsx`)

- `NAV_LINKS`: About, Projects, Events, Impact, Articles, Support. The gold "Become a member" button (→ `/join`) stays last. "Officers" and "Join" leave the main nav (Officers is linked from `/about` and the footer).
- The mobile menu shows the same links.

### 2.2 Footer (`components/SiteFooter.jsx`)

Three link columns above a bottom row:

| Chapter | Get involved | Accountability |
|---|---|---|
| About, Officers, Projects, Articles | Join, Events, Support | Impact, Transparency, Free resources |

Bottom row: chapter name and address, email, Facebook, the Hiligaynon/English switch (when enabled), © year. Columns stack on phones.

### 2.3 Project cards (`components/ProjectCard.jsx`)

- With a cover photo: unchanged.
- Without: a tile in the photo's place showing the pillar label (Space Grotesk, uppercase), the project title (Syne, large, up to 3 lines), and the barangay when set. Background tint by pillar: leadership = deep sage, community = the current green, global = basalt with a sage border. Contour lines stay.
- The tile is decorative (`aria-hidden`); the card's real title and link stay as they are.

### 2.4 Impact page (`app/impact/page.jsx`)

- Stats with value 0 are not rendered.
- No located projects: an empty-state panel with the contour pattern, "N projects are being mapped", and a link to the list.
- "Projects by place": a responsive grid of barangay groups (2 columns desktop, 1 phone) without bullet points.

### 2.5 Support page (`components/pages/SupportPage.jsx`, `components/forms/PledgeForm.jsx`)

- Desktop: two columns. Left, a sticky card for the selected campaign: title, progress bar, QR image, three numbered steps (Scan the QR → Pay with GCash/Maya/bank → Send your reference number below). Right, the form.
- Campaign without a QR image: the card shows "Ask us for payment details" with the chapter email.
- Several open campaigns: each gets a summary card above; the QR card follows the campaign chosen in the form's "What is this payment for?" select.
- Phone (≤ 900px): one column, card first.

### 2.6 Join page (`components/pages/JoinPage.jsx`)

Two columns on desktop: left, why join, fees and what happens next; right, the application form. One column ≤ 900px.

### 2.7 Form controls (`app/globals.css`, `PledgeForm`, `FileUpload`)

- `select`: custom chevron, same height and border as inputs.
- File inputs: visually hidden native input behind a styled "Choose file" button showing the chosen file name (still a real `<label>`/`<input type="file">`, keyboard accessible).
- Checkboxes: `accent-color` ochre, 18px.

### 2.8 Home page (`components/pages/HomePage.jsx`)

- Heritage section: the empty right column lists all awards as tiles (year, title, recipient).
- Hero: the contour background is kept; no new imagery.
- The stats and project grids use the 2.3/2.4 rules (no zeros, typographic tiles).

## 3. Admin

### 3.1 Shell (`components/admin/AdminShell.jsx`, `app/admin/layout.jsx`)

- The layout renders `AdminShell` around every admin page; each page's own `<AdminNav />` is removed.
- Sidebar groups (admins):
  - Dashboard
  - **Content:** Articles, Projects, Resources, SEO plan
  - **People:** Applications (badge: pending count), Members, Passport (badge: requested count)
  - **Money:** Payments (badge: pending count), Campaigns, Expenses
  - **Proof:** Events, Evidence
  - Footer: "View site", signed-in role
- Non-admin roles (officer, treasurer) see Dashboard only (same rule as today's `isAdmin`).
- Current section highlighted (`aria-current="page"`, matching by path prefix).
- ≤ 900px: the sidebar becomes a horizontally scrolling bar of links above the content.
- Counts load in the layout with one query each; a failed count shows no badge rather than breaking the page.

### 3.2 Dashboard (`app/admin/page.jsx`)

- "Things to do": cards for pending applications, payments to confirm, passport requests, next event (title, date, going/capacity), and this month's SEO plan (published of total, as a bar). Each card links to its screen; a card with nothing to do says so ("All caught up").
- "Quick actions": New article, New event, Add project, Record expense.

### 3.3 Lists

- `components/admin/StatusBadge.jsx`: pending/requested/draft → ochre; confirmed/approved/published/verified/attended → sage; rejected/declined/cancelled → muted red; anything else → neutral.
- Payments (`app/admin/payments/page.jsx`): tabs Pending / Confirmed / Rejected via `?tab=`, each with count and peso total; status shown as a badge.
- Applications: tabs Pending / Approved / Declined via `?tab=`.
- All admin tables: wrapped in a horizontally scrollable container on phones; an empty table shows a short message instead of a header-only table.

## 4. Error handling

- Badge/count queries failing in the admin layout: log and render the sidebar without that badge.
- Unknown `?tab=` values fall back to the first tab.
- Missing campaign QR: fallback card (2.5).

## 5. Testing

- **Unit:** `NAV_LINKS` content and order; project tile renders title, pillar and barangay when there's no cover, and the photo when there is; impact stats drop zeros; `StatusBadge` class per status; admin sidebar groups, badge counts, and non-admins seeing only Dashboard; payments tab parsing and totals.
- **End-to-end:** clipping check on every public page at 375, 768 and 1440px; support page shows the QR card for the seeded campaign and the fallback when no QR; admin routes still redirect signed-out visitors; nav contains Support and Impact.
- **Manual:** sign in as admin, walk every sidebar link on desktop and phone.

## 6. Out of scope

- New photography (adding cover photos in admin improves cards more than design can).
- Light/dark theme switch.
- Admin global search or command palette.
- Changes to member-area pages beyond the shared form controls.
