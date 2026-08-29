# JCI Roxas Halaran — Website

Official site for JCI Roxas Halaran (Roxas City, Capiz). The design was
approved in a Claude Design canvas ("JCI Roxas Halaran" project, Coastal Canopy
& Basalt brand system) and implemented as a React single-page app.

## Stack

- **React 19 + Vite 7 + React Router 7** (JavaScript, no TypeScript)
- Routes: `/` (landing), `/leadership` (president + Board 2025), `/join` (CTA + FAQ)
- `src/site.css` — the design system (Coastal Canopy & Basalt tokens at the top:
  Basalt `#121314`, Canopy `#1C3B2B`, Sage `#3A6B4F`, Dune `#EDE8DF`,
  Ochre `#E5A823`; fonts Syne / Space Grotesk / Inter)
- `src/data/site.js` — **all editable content in one place**: officers,
  projects, FAQs, awards, stats, the Facebook contact URL
- `public/assets/img/` — photos; `logo-dc.png` is the logo from the design canvas

## Develop

```bash
npm install
npm run dev
```

Opens at http://localhost:5174.

## Build & deploy

```bash
npm run build
```

Deployed on Vercel (SPA rewrites in `vercel.json`). Pushing to the GitHub
repo's default branch redeploys automatically once the repo is linked in
Vercel; `vercel --prod` deploys manually.

## Common edits

- New officer / project / FAQ: edit the arrays in `src/data/site.js`
- New photos: drop into `public/assets/img/` and reference by filename
- Colors/typography: tokens at the top of `src/site.css`

## Design archive (`static/`)

The pre-React static build and earlier design explorations, kept for reference:
`static/index.html`, `static/leadership.html`, `static/join.html` (final static
version) plus `meetyourlegend.html`, `kindsight-a/b.html`, `coastal-basalt.html`
(explorations). Not part of the deployed site. The brand guide PDF lives in the
Claude Design project's `uploads/`.
