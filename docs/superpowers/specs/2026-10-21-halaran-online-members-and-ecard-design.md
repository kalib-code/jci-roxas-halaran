# Halaran Online — Members Area Redesign and E-Calling Card Spec

**Date:** 2026-10-21
**Status:** Design approved in conversation; awaiting written-spec review
**Builds on:** Phase 4 members area and the design pass (admin sidebar, badges, form controls).
**Research (Mobbin):**
- Card and share sheet: [GroupMe](https://mobbin.com/screens/33679314-0b8a-4f3c-9dab-86dd610cb797), [TikTok](https://mobbin.com/screens/f2b5dcb3-421a-4a8d-9f70-6d6275910090), [Delphi](https://mobbin.com/screens/dd166aee-61a2-496b-8277-e8c2be9034be), [Turo](https://mobbin.com/screens/6b423e78-f0e0-4174-b581-5fc4ffc04964)
- Members home: [Contra](https://mobbin.com/screens/60e1c6c4-9036-46cd-aab6-63926ad41d60), [Uxcel](https://mobbin.com/screens/4358f550-897a-46ad-8d26-2508da69ebfd)
- Editor with live preview: [Linktree](https://mobbin.com/screens/acbf2ace-9f4e-4800-985d-89dbe3afeaae)

## 1. Purpose

Give every active member a digital calling card they can hand out at networking events and to clients. Make the members area worth opening: a clear home, an editor with a live preview, and readable passport, events and directory pages. This supports the Temiong "Value to members" criterion.

### Success criteria

- An active member turns on "Publish my e-calling card" and immediately has a working `/card/<slug>`. The page has call, text, email, save-contact, social links, a QR code and a downloadable image.
- Someone scanning the QR code on a phone can save the member as a contact in two taps.
- Unpublished cards, and cards of members who aren't active, return 404.
- Phone numbers and emails appear only where the member switched them on.
- Every members page uses one sidebar shell. All of them pass the clipping check at 375, 768 and 1440px; the card page is checked in e2e.

### Decisions

| Decision | Choice |
|---|---|
| Card visibility | Public link + QR, `noindex`; opt-in per member |
| Who qualifies | `status = "active"` and `card_published = true` |
| Card actions | Save contact (vCard), call, text, email, social links, download PNG |
| QR | `qrcode` npm package; QR encodes the absolute card URL |
| PNG | `next/og` `ImageResponse` (built into Next) |
| Phone format | Philippine mobile or landline; stored as `+63…` |
| Links | `https://` only (existing `safeHttpsUrl` rule) |

## 2. Data model (migration `0006`)

New `members` columns, all nullable unless stated:

| Column | Type | Rule |
|---|---|---|
| `phone` | text | Accepts `09XXXXXXXXX`, `+639XXXXXXXXX`, `639XXXXXXXXX`, or a landline `(0XX) XXX XXXX`; spaces and dashes are ignored; stored as `+63` + digits |
| `website_url`, `facebook_url`, `linkedin_url`, `instagram_url` | text | `https://` URL ≤ 300 chars, or empty |
| `card_published` | boolean, not null, default false | |
| `card_show_phone` | boolean, not null, default false | |
| `card_show_email` | boolean, not null, default true | |

## 3. E-calling card

### 3.1 `/card/[slug]` (public, `robots: noindex`)

Loaded by `getPublicCard(db, slug)`. It returns `null` unless the member exists, `status === "active"` and `cardPublished`. A `null` result renders `notFound()`. The card shows, in order:

1. Brand bar: JCI Roxas Halaran logo.
2. Photo, or initials on canopy green when there is none.
3. Name (Syne). Role line: the latest officer term as "<role> <year>"; otherwise "Member since <year of joinedAt>"; otherwise "Member".
4. Profession · business.
5. Action buttons, shown only for data that is present and allowed: **Call** (`tel:`), **Text** (`sms:`), **Email** (`mailto:`), **Save contact** (`/card/<slug>/vcard`).
6. Social icons (Facebook, LinkedIn, Instagram, Website), each only when set.
7. QR code (inline SVG, generated on the server) for the absolute card URL, with "Scan to save my card".
8. Bio (max 1000 chars, plain text).
9. Footer: "Member of JCI Roxas Halaran" → `/`, and "Download card image" → `/card/<slug>/image.png`.

`revalidate = 300`. Saving the profile revalidates `/card/<slug>`.

### 3.2 `/card/[slug]/vcard`

`text/vcard; charset=utf-8`, `Content-Disposition: attachment; filename="<slug>.vcf"`. vCard 3.0 with:
- `FN`, `N`
- `ORG:<business or "JCI Roxas Halaran">`, `TITLE:<profession>`
- `TEL;TYPE=CELL` (only if allowed), `EMAIL` (only if allowed)
- `URL` (the card URL)
- `X-SOCIALPROFILE` for each social link set
- `NOTE:Member of JCI Roxas Halaran`

Values escape `\`, `,`, `;` and newlines. Returns 404 under the same rule as the page.

### 3.3 `/card/[slug]/image.png`

1200×630 PNG via `ImageResponse`. Basalt background, the name, role line, profession · business, the allowed phone and email, the QR code as a data URI, and the chapter name. Returns 404 under the same rule. `Cache-Control: public, max-age=300`.

## 4. Members area

### 4.1 Shell

- `components/admin/AdminSidebar.jsx` becomes the shared `components/SideNav.jsx`. It is the same component with an `ariaLabel` prop and an optional footer.
- Admin keeps using it via `lib/admin/nav.js`.
- `lib/members/nav.js` gives the members groups: Home, My card, Profile, Passport, My events, Directory, Library.
- `app/members/layout.jsx` renders `.admin-shell` with the members nav and replaces `MembersNav`. The footer has "View site", plus "View my card" when the card is published.

### 4.2 Pages

| Route | Content |
|---|---|
| `/members` | Header (photo, name, status, completeness bar plus the list of missing fields); passport tile (points, up to 4 badges, link); next-event card; card tile (preview thumbnail, Copy link, Share via `navigator.share` with copy fallback, Download image), or a "Set up your e-calling card" prompt when unpublished |
| `/members/card` | Large card preview, Copy link, Share, Download image, Save contact (test the vCard), and links to edit |
| `/members/profile` | Two columns: the form (About you; Contact & card) and a live `CardPreview` that updates as they type; one column ≤ 900px. Publishing needs the consent checkbox: "I agree to show the details I switched on to anyone with my card link." |
| `/members/directory` | Grid of member tiles (photo or initials, name, profession, business, up to 4 skill chips, "View card" when published and active); search unchanged; phone never shown |
| `/members/passport` | Points header, badges as `.passport-badge` tiles, timeline rows with a coloured kind tag and date; pending requests listed separately; request form unchanged |
| `/members/events` | Upcoming and past cards with a `StatusBadge` (going, waitlist, attended) |
| `/members/library` | Resource cards grouped by kind, with a download link |

### 4.3 Shared card component

`components/members/ECard.jsx` renders the card from a plain object `{ name, roleLine, profession, business, photoUrl, phone, email, links, slug }`. It is used by the public page, the `/members/card` preview and the live `CardPreview`, which is a client wrapper fed from the form state. `cardView(member, positions, { forPublic })` builds that object and applies the show/hide switches, so every surface agrees.

## 5. Admin

`/admin/members` gets a "Card" column: "View" (opens `/card/<slug>`) when the card is published and the member is active, otherwise "—".

## 6. Error handling

- Invalid phone: "Enter a Philippine number, e.g. 0917 123 4567".
- Invalid link: "Use a full https:// link".
- Publishing without consent: "Tick the consent box to publish your card".
- QR generation failure: render the card without the QR (logged).
- A card with no contact actions allowed still renders, showing Save contact with the name and card URL only.

## 7. Testing

- **Unit:**
  - phone normalisation (valid and invalid forms)
  - link validation
  - `profileInput` with the card fields and the consent rule
  - `cardView` switches (phone hidden unless `card_show_phone`, email shown unless switched off)
  - role line (officer term vs member since vs member)
  - `getPublicCard` returns `null` for inactive, unpublished or unknown members
  - `vcard()` escaping and omitted fields
  - members nav groups; directory "View card" only for published active members
  - `CardPreview` updates from form state
- **End-to-end:**
  - the seeded published card loads with Save contact, the QR and the right `noindex`
  - an unpublished member's card returns 404
  - the vCard route returns `text/vcard` with `FN:`
  - the image route returns `image/png`
  - the card page passes the clipping check at 375, 768 and 1440px
  - `/members/card` redirects signed-out visitors
- **Manual:** scan the QR with an iPhone and an Android phone, then tap Save contact.

## 8. Out of scope

- NFC cards, view or scan analytics, custom card colours per member.
- Members editing their officer terms.
- Showing cards of senators or alumni (possible later by widening the status rule).
