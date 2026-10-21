# JCI Roxas Halaran — Website

Official site for JCI Roxas Halaran (Roxas City, Capiz). The design was
approved in a Claude Design canvas ("JCI Roxas Halaran" project, Coastal Canopy
& Basalt brand system) and implemented as a Next.js site (Halaran Online).

## Stack

- **Next.js 15 (App Router) + React 19**, JavaScript
- **Turso** (SQLite) via **Drizzle ORM** — schema in `db/schema.js`, migrations in `db/migrations`
- **Clerk** for sign-in; roles (`member`, `officer`, `treasurer`, `admin`) in each user's public metadata
- Design system: Coastal Canopy & Basalt tokens at the top of `app/globals.css`; fonts Syne / Space Grotesk / Inter via `next/font`
- Logo: `public/assets/img/logo-site.png` (white wordmark — use on dark backgrounds only)
- Spec: `docs/superpowers/specs/2026-10-21-halaran-online-design.md`

## Develop

```bash
cp .env.example .env.local   # fill in Turso and Clerk keys (Turso URL must start with libsql://)
npm install
npm run db:migrate && npm run db:seed
npm run dev                  # http://localhost:5174
```

## Test

```bash
npm test            # unit and component tests (Vitest)
npm run test:e2e    # end-to-end checks (Playwright, uses its own e2e.db and .next-e2e build)
```

`NEXT_DIST_DIR` lets a production build use its own folder, so checks don't clash with a running `npm run dev`.

## Database changes

Edit `db/schema.js`, then `npm run db:generate` and `npm run db:migrate`.
The seed (`npm run db:seed`) only inserts missing rows; it never overwrites edits.

## Deploy

Vercel builds on every push. Environment variables are listed in `.env.example`.
Old Webflow URLs redirect permanently (see `lib/redirects.js`).

## Design archive (`static/`)

The pre-React static build and earlier design explorations, kept for reference:
`static/index.html`, `static/leadership.html`, `static/join.html` (final static
version) plus `meetyourlegend.html`, `kindsight-a/b.html`, `coastal-basalt.html`
(explorations). Not part of the deployed site. The brand guide PDF lives in the
Claude Design project's `uploads/`.
