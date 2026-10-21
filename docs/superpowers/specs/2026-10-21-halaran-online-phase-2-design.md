# Halaran Online — Phase 2 Design Spec: Content Engine and Domain Switch

**Date:** 2026-10-21
**Status:** Approved in brainstorming; awaiting written-spec review
**Parent spec:** `docs/superpowers/specs/2026-10-21-halaran-online-design.md` (sections 4, 6 and 9, Phase 2)
**Builds on:** Phase 1 (branch `halaran-online`, PR #1)

## 1. Purpose

Let the chapter publish the monthly SEO articles and project stories on its own site, then move `jciroxashalaran.com` from Webflow to the new site.

### Success criteria

- An admin can write, preview and publish an article with images in the site's admin, and it is live on the public site within seconds, with no redeploy.
- The November SEO articles can be published by mid-November 2026.
- Public pages load no Clerk script; Lighthouse mobile on `/` and an article page: LCP under 2.5s, Best Practices ≥ 90, SEO ≥ 90, Accessibility ≥ 90.
- After the domain switch, every old Webflow URL redirects and Search Console has the sitemap.

### Decisions made

| Decision | Choice |
|---|---|
| Who publishes | **Admins only** (`admin` role). Officers keep the read-only `/admin` home |
| Editor | Rich text with **Tiptap** |
| Admin architecture | Server components + **server actions**; only the editor and uploader are client components |
| File storage | **Vercel Blob**, uploaded from the browser with a short-lived token |
| Refreshing public pages | `revalidatePath` on every save for the affected pages; one-hour `revalidate` as a safety net |
| Bylines | Author picked from `members`; none chosen → "JCI Roxas Halaran" |

Changes from the parent spec: publishing is admin-only (parent: officers); refreshing uses `revalidatePath` instead of `revalidateTag` (simpler, same effect).

## 2. Speed fix (first)

`ClerkProvider` moves from `app/layout.jsx` into the layouts for `/sign-in`, `/admin` and `/members`. Public pages render without Clerk's script and its third-party cookies. `middleware.js` is unchanged (it runs on the server and adds nothing to page weight).

## 3. Data model (migration `0001`)

### New tables

- **articles**: id, slug (unique), title, meta_description, target_keyword, category (`capiz`/`holidays`/`leadership`/`business`/`community`), body_json (Tiptap JSON as text), body_html (cleaned HTML), cover_url, cover_alt, author_id → members (nullable), project_id → projects (nullable), status (`draft`/`published`, default `draft`), published_at, updated_at, updated_by (Clerk user id).
- **seo_plan**: id, month (`YYYY-MM`), keyword, volume, kd, working_title, status (`idea`/`drafting`/`published`, default `idea`), article_id → articles (nullable). Unique (month, keyword). Seeded with the 30 November 2026 – January 2027 keywords from the Obsidian note "JCI Roxas Halaran — SEO Keyword Plan (10 per month)".
- **resources**: id, title, description, file_url, kind (`template`/`training`/`bylaws`/`other`), visibility (`public`/`members`), created_at.

### Changed table

- **projects**: add body_json (text) and updated_at (text). The existing `body` column stores the cleaned HTML.

### Rules

- **Slug:** generated from the title with `slugify`; editable while the item has never been published; read-only after the first publish. Duplicates are rejected with a suggestion (`<slug>-2`).
- **Publish requirements:** title, meta description (1–160 characters), target keyword (articles), non-empty body. A cover or gallery photo must have alt text. Drafts may be saved incomplete.
- **SEO plan link:** publishing an article whose `target_keyword` matches a `seo_plan.keyword` (case-insensitive) sets that row's status to `published` and its `article_id`.
- **Visibility:** public queries return only `published` items. Drafts 404 publicly; admins preview at `/admin/articles/[id]/preview`.
- **Concurrent edits:** the edit form carries the `updated_at` it loaded; a save whose `updated_at` no longer matches is refused with "This was changed since you opened it — reload".

## 4. Admin (role `admin`)

| Route | Purpose |
|---|---|
| `/admin` | Dashboard: current month's SEO plan progress (published / 10), latest drafts, links. Officers see the read-only version |
| `/admin/articles` | List: title, status, category, keyword, updated; filter by status; "New article" |
| `/admin/articles/new`, `/admin/articles/[id]` | Editor: title, Tiptap body (H2, H3, bold, italic, bullet and numbered lists, link, blockquote, image), sidebar with slug, category, target keyword (from the plan or typed), meta description with character count, Google result preview, cover + alt, author, linked project; Save draft / Publish / Unpublish |
| `/admin/articles/[id]/preview` | Draft rendered as the public page |
| `/admin/projects`, `/admin/projects/new`, `/admin/projects/[id]` | Title, slug, dates, barangay, pillar, cover + alt, story in Tiptap, gallery upload (alt required per photo) |
| `/admin/resources` | Upload (title, description, kind, visibility), list, delete |
| `/admin/seo-plan` | Month columns of keyword cards (keyword, volume, KD, working title, status); add keyword; change status; "Write article" opens a new draft with the keyword filled in |

All writes are server actions that call `requireRole("admin")`, validate with Zod, write, and call `revalidatePath`:

- article → `/articles`, `/articles/<slug>`, `/`, `/sitemap.xml`
- project → `/projects`, `/projects/<slug>`, `/`, `/sitemap.xml`
- resource → `/resources`

**Uploads:** `POST /api/upload` issues a Vercel Blob client-upload token after `requireRole("admin")`; allowed types `image/jpeg`, `image/png`, `image/webp`, `application/pdf`; maximum 10 MB. The editor will not insert an image without alt text.

**HTML cleaning:** article and project bodies are cleaned on the server with an allow-list: `h2 h3 p br strong em ul ol li a blockquote img`; `a[href]` (http, https, mailto only; external links get `rel="noopener noreferrer"`), `img[src alt]` (src must be a Vercel Blob or site URL). Everything else, including scripts, event handlers, inline styles and `javascript:` URLs, is removed.

## 5. Public pages

| Route | Content |
|---|---|
| `/articles` | Page title; category filter (`?category=`); newest article featured large; cards with cover or placeholder, category, date, title, excerpt (first 160 characters of the meta description) |
| `/articles/[slug]` | Category and date, h1 title, byline, cover, body at reading width (~68ch), related articles (same category, up to 3), linked project, join CTA. JSON-LD `Article` (headline, description, image, datePublished, dateModified, author, publisher) and `BreadcrumbList` |
| `/projects/[slug]` | Title, date, barangay, cover, story, gallery, articles linked to the project, CTA. `BreadcrumbList` |
| `/resources` | Public resources grouped by kind, with description and download link |
| `/` | Adds "From the blog" (latest 3 articles) after project stories |
| `/projects` | Cards link to `/projects/[slug]` |
| Navigation | Adds "Articles". Resources linked from the footer and `/join` |

`/articles/[slug]` and `/projects/[slug]` use `generateStaticParams` for published items and `dynamicParams = true`. Pages keep Phase 1 rules: one h1, unique title/description/canonical, alt text, no clipping at 375px. Sitemap lists static routes plus published articles and projects with `lastModified` = `updated_at` (static routes omit `lastModified`).

## 6. Error handling

- Non-admins calling any content action or `/api/upload` get 404 (pages) or 403 (route).
- Publish refused with the list of missing fields; drafts always save.
- Duplicate slug, concurrent edit and oversized/wrong-type upload each give a specific message; the editor keeps its content and offers retry.
- Leaving the editor with unsaved changes asks for confirmation (`beforeunload`).

## 7. Testing

- **Unit (Vitest):** HTML cleaning; publish validation; slug generation, uniqueness and lock; SEO-plan link on publish; `requireRole`; sitemap (published only, real dates); Article JSON-LD.
- **Database (in-memory SQLite):** unique slug; unique (month, keyword); public queries never return drafts.
- **Server actions:** called directly in tests with the role check given a stubbed session; verify writes, refusals and the paths revalidated.
- **End-to-end (Playwright):** new public pages pass the Phase 1 checks; a draft slug returns 404; `/admin/articles` redirects signed-out visitors to sign-in; public pages make no request to Clerk domains.
- **Manual (with the chapter's admin, before the switch):** write, upload, preview, publish, unpublish.
- **Lighthouse:** `/` and one article page; results recorded in the Obsidian "Bid Evidence Log".

## 8. Domain switch (last step)

1. Clerk production instance: add its DNS records, disable public sign-up, set the session-token claim `{ "metadata": "{{user.public_metadata}}" }`, put `pk_live_`/`sk_live_` keys in Vercel Production.
2. Merge PR #1 and the Phase 2 PR to `main`; deploy production.
3. Point `jciroxashalaran.com` and `www` DNS from Webflow to Vercel; keep Webflow published 48 hours.
4. Set `NEXT_PUBLIC_SITE_URL=https://jciroxashalaran.com` (Production) and redeploy.
5. Verify live: old Webflow URLs redirect, HTTPS on apex and `www`, sitemap and canonicals use the real domain.
6. Search Console: verify the domain, submit `/sitemap.xml`, request indexing of `/` and the first articles.
7. GA4 property linked to Search Console; record the start date in the Bid Evidence Log.

## 9. Out of scope

- Officer publishing or review workflow.
- Article scheduling and revision history.
- Resource download counting (Phase 3 `events_log`).
- Members-only resources UI (Phase 4 library).
