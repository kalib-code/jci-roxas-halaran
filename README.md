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

Vercel builds on every push. Old Webflow URLs redirect permanently (see `lib/redirects.js`).

Checklist before the first deploy (and for any new environment):

1. **Clerk session token.** In the Clerk dashboard → Sessions → Customize session token, set
   `{ "metadata": "{{user.public_metadata}}" }`. Without it every officer and admin gets a 404 at `/admin`.
   Give users their role in public metadata, e.g. `{ "role": "admin" }`.
2. **Turso schema and content first.** Pages are pre-rendered from the database during `next build`, so
   run `npm run db:migrate && npm run db:seed` against the production database before the first build
   (the build does not migrate). The Turso URL must start with `libsql://`.
3. **Vercel environment variables** (Production and Preview; they are also used at build time):
   `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`,
   `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`, and optionally `NEXT_PUBLIC_GA_ID`.
   Preview deployments read the same database as production unless you give Preview its own Turso URL.
4. **Vercel Blob.** Create a Blob store in Vercel → Storage and connect it to the project, so
   `BLOB_READ_WRITE_TOKEN` exists for Production and Preview. Admin image and file uploads need it.
5. **Turnstile and Resend (Phase 3).** Create a Cloudflare Turnstile widget for the site's hostnames and set
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`. Without the secret, public forms skip the bot check.
   For email receipts, verify the sending domain in Resend and set `RESEND_API_KEY` and `EMAIL_FROM`.

## Design archive (`static/`)

The pre-React static build and earlier design explorations, kept for reference:
`static/index.html`, `static/leadership.html`, `static/join.html` (final static
version) plus `meetyourlegend.html`, `kindsight-a/b.html`, `coastal-basalt.html`
(explorations). Not part of the deployed site. The brand guide PDF lives in the
Claude Design project's `uploads/`.
