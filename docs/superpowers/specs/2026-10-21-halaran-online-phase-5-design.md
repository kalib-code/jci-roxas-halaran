# Halaran Online — Phase 5 Design Spec: Proof

**Date:** 2026-10-21
**Status:** Drafted from the approved parent spec; awaiting written-spec review
**Parent spec:** `docs/superpowers/specs/2026-10-21-halaran-online-design.md` (sections 3 "Proof", 4 `/impact` and `/transparency`, 6 evidence dashboard, 9 Phase 5)
**Builds on:** Phases 1–4 (branch `halaran-online`, deployed to Production)

## 1. Purpose

Turn the data the site already collects into proof: where the chapter works, what it achieved, where the money went, and month-by-month evidence for every Temiong criterion, exportable for the bid document.

### Success criteria

- `/impact` shows an interactive map of Capiz with a pin for every project that has a location, live impact totals, and an accessible list of the same projects.
- `/transparency` shows, per year and per campaign/project, confirmed money in and money out, with expense line items and no personal data.
- The home page "In numbers" section uses live totals.
- `/admin/evidence` shows monthly counts per award criterion for the last 12 months, lets admins record monthly analytics numbers (Search Console / GA4), and exports both as CSV.
- Admins can set each project's coordinates and impact metrics in the project editor.

### Decisions

| Decision | Choice |
|---|---|
| Map | Leaflet 1.9 with OpenStreetMap tiles (with attribution), loaded only on `/impact` in a client component; pins are circle markers (no image assets) |
| Who edits locations, metrics and analytics snapshots | Admins (`content` area) |
| Money shown publicly | Totals and expense line items only; never payer names, emails or receipt files |
| Analytics numbers | Entered by hand monthly (Search Console clicks/impressions, GA4 visitors) — no API integration |

## 2. Data model (migration `0005`)

- **project_metrics** (exists since Phase 1): id, project_id, metric, value. Used now. `metric` is one of `people_reached`, `trees_planted`, `volunteers`, `schools`, `barangays`, `kilos_collected`, `meals_served`. One row per project and metric (unique index added).
- **projects** (exists): `lat`, `lng`, `barangay` now edited in admin. Coordinates must fall inside the Philippines (lat 4–22, lng 116–127).
- **analytics_snapshots** (new): id, month (`YYYY-MM`, unique), organic_clicks, impressions, visitors (all nullable ints), note, updated_by, updated_at.

## 3. Public pages

### `/impact`

- Headline and live totals: projects completed, members (active), volunteers signed up (Phase 3), events held, people reached, trees planted, and other metrics with non-zero totals.
- Map centred on Capiz (≈ 11.4, 122.6, zoom 9), one pin per located project; a pin's popup shows the title, date, barangay and a link to the project page.
- Below the map, the same projects listed by barangay (keyboard and screen-reader friendly; also the fallback if map tiles fail).
- JSON-LD `BreadcrumbList`; Phase 1 page rules apply.

### `/transparency`

- Year selector (years with any confirmed payment or expense; default the current year).
- Summary: confirmed income by type (donations, sponsorships, membership fees), total expenses, balance.
- Per campaign: goal, confirmed raised, spent (expenses linked to the campaign).
- Per project: spent (expenses linked to the project).
- Expense list: date, description, amount, project or campaign. No receipts, no names.
- Note: "Only payments our treasurer confirmed are counted."

### Home

"In numbers" shows live values: projects, active members, volunteers, people reached. If a value is zero it falls back to the static figure in `SITE.stats` for that label.

### Navigation

Footer adds "Impact" and "Transparency". `/impact` and `/transparency` join `STATIC_ROUTES` (sitemap and e2e checks).

## 4. Admin

| Route | Purpose |
|---|---|
| `/admin/projects/[id]` | Adds latitude, longitude (or paste "lat, lng" from Google Maps) and an impact metrics editor (metric + value rows) |
| `/admin/evidence` | Table of the last 12 months × criteria (planning, layout, interactivity, member value) from `events_log`, with per-type totals; analytics snapshot form per month; links to `/admin/evidence.csv` (monthly counts + snapshots) and `/admin/evidence/log.csv` (every log row) |

Saving metrics or coordinates revalidates `/impact`, `/projects/<slug>` and `/`; saving a snapshot revalidates `/admin/evidence`.

## 5. Error handling

- Coordinates outside the Philippines or not numbers: "Use coordinates inside the Philippines, e.g. 11.5853, 122.7511".
- Metric values: whole numbers 0–10,000,000; duplicate metric rows for one project are merged (last value wins).
- Map tiles failing to load: the list below still shows every project.
- CSV cells pass through `csvCell` (formula-safe).

## 6. Testing

- **Unit:** coordinate parsing and bounds; metric upsert; impact totals (only done projects count as completed; metrics summed); transparency aggregation per year (confirmed only, expenses by project/campaign, balance); evidence monthly matrix (12 months, zero-filled, by criterion); snapshot upsert; CSV output.
- **Server actions:** non-admins cannot save metrics, coordinates or snapshots.
- **End-to-end:** `/impact` and `/transparency` pass the Phase 1 page checks; `/impact` renders the list fallback with the seeded projects; `/admin/evidence` and its CSV routes redirect signed-out visitors.
- **Lighthouse:** `/impact` stays ≥ 90 on Accessibility and Best Practices (map loaded only on that page).

## 7. Out of scope

- Automatic Search Console / GA4 import.
- Geocoding barangay names to coordinates.
- Exporting the evidence as a formatted PDF bid document (CSV only).
