# Halaran Online — Design Spec

**Date:** 2026-10-21
**Status:** Approved in brainstorming; awaiting written-spec review
**Program title (for the bid):** *Halaran Online: Our Offering to Capiz, One Click Away*

## 1. Purpose

Rebuild jciroxashalaran.com so that JCI Roxas Halaran wins **D.15 Best JCI Local Organization Website** at the next JCI Philippines Temiong Awards, and so that the site produces measurable evidence for the bid throughout the award year (about October 2026 to September 2027).

"Halaran" means "offering" in Hiligaynon. The bid frames the website as the chapter's offering to its members and to Capiz.

### Award criteria this design targets

From the JCI Philippines Awards Manual (2010 edition; confirm against the current manual):

| Criterion | Points |
|---|---|
| General planning, execution and finance | 25 |
| Layout and presentation | 25 |
| Interactivity and services provided | 25 |
| Value to own JCI Local Organization members | 25 |

Every feature below names the criterion it serves. Every countable user action is logged so the bid can report 12 months of usage.

### Success criteria

- All five phases live before the bid deadline (bids are due 15 days before the conference or convention opens).
- Twelve months of evidence: applications, RSVPs, downloads, confirmed payments, published articles, organic visitors.
- Lighthouse 90+ for SEO and accessibility on key pages; LCP under 2.5s on mobile.
- 10 SEO articles published per month (plan in the Obsidian note "JCI Roxas Halaran — SEO Keyword Plan (10 per month)").
- No old Webflow URL returns 404 after migration.

### Decisions made

| Decision | Choice |
|---|---|
| Platform | Next.js (App Router) on Vercel |
| Database | Turso (libSQL) with Drizzle ORM |
| Auth | Clerk (roles via public metadata) |
| Content editing | Admin dashboard inside the site, stored in Turso |
| Payments | GCash/Maya QR with manual confirmation by the treasurer |
| Migration | Move from Webflow to Next.js on Vercel. Switch the domain after Phase 2 (content engine) so the SEO articles publish on the new site |

## 2. Architecture

- **Next.js App Router** on Vercel. Server components by default; server actions for all mutations.
- **Turso** via `@libsql/client` + **Drizzle** for schema, migrations and queries.
- **Clerk** for sign-in, invitations and roles. Roles: `member`, `officer`, `treasurer`, `admin` (stored in Clerk `publicMetadata.role`).
- **Vercel Blob** for uploaded images and files.
- **Resend** for transactional email (receipts, treasurer notifications).
- **Cloudflare Turnstile** on all public forms.
- **Tiptap** rich-text editor in the admin area.
- **Analytics:** Vercel Analytics, GA4 and Google Search Console from day one.
- Existing React components, images and the Coastal Canopy & Basalt design tokens (`src/site.css`) are carried over from the current Vite app.

### Areas and routes

| Area | Routes | Access |
|---|---|---|
| Public | `/`, `/about`, `/officers`, `/projects`, `/projects/[slug]`, `/articles`, `/articles/[slug]`, `/events`, `/events/[slug]`, `/join`, `/support`, `/resources`, `/impact`, `/transparency` | Everyone |
| Members | `/members`, `/members/profile`, `/members/directory`, `/members/passport`, `/members/library`, `/members/events` | Signed-in members |
| Admin | `/admin`, `/admin/articles`, `/admin/projects`, `/admin/events`, `/admin/resources`, `/admin/sponsors`, `/admin/seo-plan`, `/admin/applications`, `/admin/members`, `/admin/passport`, `/admin/payments`, `/admin/expenses`, `/admin/campaigns`, `/admin/evidence` | By role (see section 6) |

### Webflow redirects (301, in `next.config`)

| Old | New |
|---|---|
| `/about-us` | `/about` |
| `/our-officers` | `/officers` |
| `/contact` | `/join#contact` |
| `/projects` | `/projects` (same) |

The live Webflow site exposes only these five paths (checked 2026-10-21; its sitemap returns 404).

### Design direction

Layout reference: **mellon.org** (editorial, story-led). Secondary reference: fordfoundation.org. Keep the existing brand system; borrow Mellon's layout and restraint, not its fonts.

- **Fonts unchanged:** Syne (display), Space Grotesk (labels), Inter (body).
- **Palette unchanged, used with restraint:** mostly Basalt `#121314` and Dune `#EDE8DF`; Canopy `#1C3B2B`, Sage `#3A6B4F` and Ochre `#E5A823` as occasional accents. Project photography carries the color.
- **Large type:** headlines about 40–82px on desktop; impact numbers set at headline size.
- **Story-led homepage:** big statement headline → stories from projects → latest articles → upcoming events → history ("Since 2023") → join CTA.
- **Generous white space, strict grid, large images;** carousels only for story collections.

## 3. Data model

Clerk owns identity (login, email, role). Turso owns everything else, linked by `clerk_user_id`. Money is stored as integer centavos. Timestamps are ISO-8601 text.

### People

- **applications**: id, name, email, phone, birthdate, barangay, why_join, referred_by, consent (bool), status (`pending`/`approved`/`declined`), reviewed_by, reviewed_at, created_at. One pending application per email.
- **members**: id, clerk_user_id (unique, nullable until the invite is accepted), slug (unique), name, email, photo_url, profession, business, skills, bio, joined_at, status (`active`/`inactive`/`senator`/`alumni`), in_directory (bool, default false), fee_paid_year (int, nullable).
- **officer_terms**: id, member_id, role, year, sort.

### Content

- **articles**: id, slug (unique), title, meta_description, target_keyword, category (`capiz`/`holidays`/`leadership`/`business`/`community`), body (Tiptap JSON), body_html, cover_url, cover_alt, author_id, project_id (nullable), status (`draft`/`published`), published_at, updated_at.
- **projects**: id, slug (unique), title, summary, body, cover_url, cover_alt, start_date, end_date, barangay, lat, lng, pillar (`leadership`/`community`/`global`), status (`planned`/`ongoing`/`done`), featured (bool).
- **project_metrics**: id, project_id, metric (`people_reached`/`trees_planted`/`volunteers`/`schools`/`barangays`/custom), value (int).
- **project_photos**: id, project_id, url, caption, alt (required), kind (`gallery`/`before`/`after`), sort.
- **resources**: id, title, description, file_url, kind (`template`/`training`/`bylaws`/`other`), visibility (`public`/`members`).
- **sponsors**: id, name, logo_url, url, tier, year.
- **faqs**: id, question, answer, sort.
- **awards**: id, title, awarded_by, year.
- **seo_plan**: id, month (YYYY-MM), keyword, volume, kd, working_title, status (`idea`/`drafting`/`published`), article_id (nullable).

### Engagement

- **events**: id, slug (unique), title, description, start_at, end_at, venue, capacity (nullable), rsvp_open (bool), project_id (nullable), cover_url, cover_alt.
- **rsvps**: id, event_id, name, email, phone, member_id (nullable), status (`going`/`waitlist`/`cancelled`), attended (bool), created_at. Unique (event_id, email).
- **volunteer_signups**: id, project_id (nullable), event_id (nullable), name, email, phone, skills, created_at.

### Money

- **campaigns**: id, project_id (nullable), title, description, goal_centavos, qr_image_url, open (bool).
- **payments**: id, campaign_id (nullable), type (`donation`/`sponsorship`/`membership_fee`), payer_name, payer_email, member_id (nullable), amount_centavos, method (`gcash`/`maya`/`bank`), reference_no, proof_url (nullable), status (`pending`/`confirmed`/`rejected`), confirmed_by, confirmed_at, note, created_at. Unique (method, reference_no).
- **expenses**: id, project_id (nullable), amount_centavos, description, spent_on, receipt_url, recorded_by.

### Proof

- **passport_entries**: id, member_id, kind (`training`/`project_led`/`project_joined`/`award`/`position`), title, date, points (int), ref_id (nullable), status (`requested`/`verified`), verified_by.
- **events_log**: id, type (e.g. `application_submitted`, `rsvp_created`, `resource_downloaded`, `payment_confirmed`, `article_published`, `volunteer_signed_up`, `member_approved`), criterion (`planning`/`layout`/`interactivity`/`member_value`), actor (clerk_user_id or `public`), ref_id, meta (JSON text), created_at.

Badges are computed from verified `passport_entries`, never stored.

### Privacy (Data Privacy Act of 2012)

- Every public form has a required consent checkbox, stored on the record.
- Directory listing is opt-in (`in_directory`).
- Emails and phone numbers are never rendered on public pages.
- Payment proof images are readable only by `treasurer` and `admin`.

## 4. Public site and content

### Rendering and SEO

- Public pages are server-rendered and statically cached. Admin mutations call `revalidateTag` for the affected content, so changes appear within seconds without a redeploy.
- `generateMetadata` on every route: unique title, meta description, canonical URL, Open Graph and Twitter images.
- `app/sitemap.ts` generated from published articles, projects and events; `app/robots.ts`.
- JSON-LD: `NGO` + `Organization` (home), `Article` (articles), `Event` (events), `BreadcrumbList` (all nested pages).
- Exactly one H1 per page. Images through `next/image`.

### Pages

| Page | Content | Criterion |
|---|---|---|
| `/` | Hero, three pillars, live impact counter, featured projects, upcoming events, latest articles, sponsor wall, join CTA | layout |
| `/projects/[slug]` | Story, before/after photos, impact metrics, partners, gallery, volunteer button, campaign progress bar | layout, interactivity |
| `/articles/[slug]` | Article, category, related articles, linked project | planning |
| `/events/[slug]` | Details, RSVP form, waitlist when full, "add to calendar" `.ics` | interactivity |
| `/join` | Steps, fee, FAQ, application form, contact section | interactivity |
| `/support` | Open campaigns with progress, QR codes, pledge form, sponsor tiers | interactivity, planning (finance) |
| `/resources` | Public templates (project proposal, sponsorship letter, event proposal); downloads are not gated | interactivity |
| `/impact` | Map of project locations across Capiz, metric totals | layout |
| `/transparency` | Confirmed income vs expenses per project and per year | planning (finance) |
| `/officers`, `/about` | Current board, past presidents, history, awards | member_value |

### Public forms

Applications, RSVPs, volunteer sign-ups and payment pledges:

- Server actions with Zod validation on client and server.
- Cloudflare Turnstile verification.
- On success: save the record, write `events_log`, send a receipt email.
- Membership application validates age 18–40 from birthdate.

### Language

A Hiligaynon/Capiznon toggle on `/`, `/join`, `/support` and `/events` using a static dictionary file. Articles stay in English.

### Quality bar

- LCP under 2.5s on mobile; Lighthouse 90+ SEO and accessibility on key pages.
- Alt text required for every uploaded image (admin forms refuse to save without it).

## 5. Members area

| Feature | Behaviour |
|---|---|
| Joining | Application → officer approves → `members` row created → Clerk invitation email. No public sign-up |
| Profile | Member edits photo, profession, business, skills, bio, directory opt-in |
| Directory | Search members who opted in, by name, skill or business |
| Leadership Passport | Timeline of verified entries; computed badges; members can request an entry, officers verify |
| Library | `resources` with visibility `members` |
| My events | Member's RSVPs and attendance history |

## 6. Admin

| Section | Roles |
|---|---|
| Articles, projects, events, resources, sponsors, FAQs, awards | officer, admin |
| SEO plan board (`seo_plan`) | officer, admin |
| Applications, members, passport entries, RSVP attendance | officer, admin |
| Payments, expenses, campaigns | treasurer, admin |
| Evidence dashboard | officer, treasurer, admin |

- Rich-text editing with Tiptap; image uploads to Vercel Blob with required alt text.
- Draft and publish states for articles.
- **Evidence dashboard:** monthly counts from `events_log` grouped by criterion, totals per feature, CSV export, and a monthly snapshot field for analytics numbers (organic visitors, impressions) entered from GA4 and Search Console.

### Payment flow

1. Donor pays by scanning the GCash/Maya QR, then submits the pledge form with amount, reference number and optional screenshot.
2. Payment saved as `pending`; the treasurer is emailed.
3. Treasurer checks the reference number in the GCash/Maya app and marks the payment `confirmed` or `rejected`. Name and time are recorded.
4. Only `confirmed` payments count toward campaign progress and the transparency page. A confirmed `membership_fee` sets `members.fee_paid_year`.

## 7. Error handling

- Field-level validation messages; form input is kept on failure.
- Duplicates rejected by unique constraints and reported clearly: RSVP (event, email), payment (method, reference number), one pending application per email.
- Full events switch the RSVP form to a waitlist.
- Clerk middleware protects `/members` and `/admin`; every admin server action re-checks the role on the server.
- If email or Turnstile is unavailable, the record is still saved and the failure is logged; a submission is never lost because a notification failed.
- Custom 404 and error pages linking to projects and events.

## 8. Testing

- **Unit (Vitest):** badge computation, campaign totals (confirmed only), age check, slug generation, redirect map.
- **Database rules:** run the Drizzle schema against local SQLite to prove the unique constraints.
- **End-to-end (Playwright):** apply → approve → invite; RSVP → capacity reached → waitlist; pledge → confirm → progress bar updates; publish article → appears in sitemap.
- **Before each launch:** Lighthouse run, check every old Webflow URL redirects, submit sitemap in Search Console.

## 9. Phases

Each phase gets its own implementation plan and goes live when done.

1. **Foundation and migration:** Next.js app, Drizzle schema and Turso, Clerk with roles, design system carried over, current content migrated from `src/data/site.js` and Webflow, public pages (`/`, `/about`, `/officers`, `/projects`, `/join` without form), SEO plumbing (metadata, sitemap, robots, JSON-LD), redirects, analytics.
2. **Content engine:** admin for articles, projects, resources and the SEO plan board; `/articles`, `/projects/[slug]`, `/resources`. **Then switch the domain** from Webflow to Vercel.
3. **Engagement:** applications, events with RSVP and waitlist, volunteer sign-up, campaigns and pledges, treasurer payment confirmation, Turnstile, Resend, `events_log`.
4. **Members area:** invitations, profile, directory, Leadership Passport, library, my events; Hiligaynon toggle.
5. **Proof:** `/impact` map and counter, `/transparency`, evidence dashboard with CSV export.

## 10. Out of scope

- Online payment processing (PayMongo); revisit after Phase 5.
- Translating articles into Hiligaynon.
- A mobile app.
- Public member sign-up without approval.
