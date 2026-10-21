# Halaran Online — Phase 4 Design Spec: Members Area

**Date:** 2026-10-21
**Status:** Drafted from the approved parent spec; awaiting written-spec review
**Parent spec:** `docs/superpowers/specs/2026-10-21-halaran-online-design.md` (sections 3 "People"/"Proof", 5, 9 Phase 4)
**Builds on:** Phases 1–3 (branch `halaran-online`)

## 1. Purpose

Give members a reason to sign in: a profile, a directory of fellow members, a Leadership Passport that records their growth, a library of chapter documents, and their own event history. This is the evidence for the Temiong "Value to own JCI Local Organization members" criterion. Also add a Hiligaynon version of the key public pages.

### Success criteria

- A member invited in Phase 3 signs in and lands on `/members`, already linked to their member record.
- Members edit their own profile (photo, profession, business, skills, bio) and choose whether to appear in the directory.
- The directory lists only opted-in active members and can be searched by name, skill or business.
- Each member's Leadership Passport shows verified entries, their officer positions and computed badges; members can request entries and admins verify them.
- Attending an event that belongs to a project adds a verified "project joined" entry automatically.
- `/members/library` lists members-only resources.
- Hiligaynon pages exist for home, join, support and events, hidden until the chapter approves the translation.

### Decisions

| Decision | Choice |
|---|---|
| Who uses the members area | Any signed-in user with a role (`member`, `officer`, `treasurer`, `admin`) — the existing `members` area in `lib/roles.js` |
| Who verifies passport entries and edits member records | Admins (`content` area), consistent with Phases 2–3 |
| Linking a Clerk user to a member record | By `clerk_user_id`, else by matching the Clerk primary email to `members.email` (then `clerk_user_id` is stored) |
| Contact details in the directory | Not shown (Data Privacy Act); members see name, photo, profession, business and skills |
| Members-only files | Vercel Blob public URLs with random suffixes, listed only inside the members area (true private storage is out of scope) |
| Hiligaynon | Separate `/hil/...` routes for the four pages, statically rendered, with `hreflang` alternates; first draft written by Claude, shown only when `NEXT_PUBLIC_HILIGAYNON=on` |

## 2. Data model (migration `0004`)

- **passport_entries**: id, member_id → members (cascade), kind (`training`/`project_led`/`project_joined`/`award`/`position`), title, date (`YYYY-MM-DD`), points (int, default by kind: training 2, project_led 5, project_joined 1, award 5, position 3), note, ref_table, ref_id (e.g. `rsvps`, id — unique together so an attendance only adds one entry), status (`requested`/`verified`/`declined`), requested_by, verified_by, created_at, updated_at.
- **members**: unchanged columns; `clerk_user_id` now gets filled on first sign-in.

Officer positions are **not** stored as entries: the passport reads them from `officer_terms` and shows them as `position` items worth 3 points each.

### Badges (computed, never stored)

| Badge | Rule |
|---|---|
| First steps | at least 1 verified `project_joined` or `training` |
| Trained ×N | N = verified `training` entries, shown when N ≥ 1 |
| Project chair ×N | N = verified `project_led` entries, shown when N ≥ 1 |
| Officer | at least 1 officer term |
| Awardee | at least 1 verified `award` |
| Ten trainings | 10 or more verified `training` entries |

Total points = verified entry points + 3 × officer terms.

## 3. Members area (role `member` and above)

| Route | Content |
|---|---|
| `/members` | Welcome with the member's name and photo; profile completeness (photo, profession, skills, bio); passport summary (points, badges, latest 3 entries); next RSVP'd event; links to the other pages. If the signed-in user has no member record: "Your account isn't linked to a member profile yet — ask an admin." |
| `/members/profile` | Edit photo (upload, alt text = member name), profession, business, skills (comma-separated), bio; "Show me in the member directory" checkbox. |
| `/members/directory` | Opted-in active members, alphabetical; `?q=` searches name, profession, business and skills (case-insensitive). |
| `/members/passport` | Points, badges, timeline of verified entries and officer positions (newest first); pending requests listed separately; "Request an entry" form (kind, title, date, note). |
| `/members/library` | Resources with `visibility = members`, grouped by kind. |
| `/members/events` | The member's RSVPs (matched by email), upcoming then past, with attended/waitlist status. |

Navigation: the public nav stays unchanged; the members area has its own small nav. `/sign-in` sends members to `/members` after sign-in (`fallbackRedirectUrl`).

Uploads: `POST /api/upload-avatar` — signed-in members only, JPEG/PNG/WebP, ≤ 5 MB.

## 4. Admin (role `admin`)

| Route | Purpose |
|---|---|
| `/admin/members` | List all members (name, email, status, linked account yes/no, in directory, fee paid year); edit email, status and directory flag. |
| `/admin/passport` | Requested entries first: verify (optionally adjusting points) or decline; add a verified entry for any member. |

Attendance marked in Phase 3 adds a verified `project_joined` entry (title = event title, date = event date) when the RSVP email matches a member and the event has a project; unmarking removes that entry.

## 5. Hiligaynon pages

- `lib/i18n.js`: a dictionary with `en` and `hil` strings for the hero, section headings, form labels and buttons used on home, join, support and events. Every `hil` string is Claude's draft; the file header says it needs a native speaker's check.
- `app/hil/page.jsx`, `app/hil/join/page.jsx`, `app/hil/support/page.jsx`, `app/hil/events/page.jsx` render the same components with `lang="hil"` content; they call `notFound()` unless `NEXT_PUBLIC_HILIGAYNON=on`.
- Each English page and its Hiligaynon twin declare each other in `alternates.languages` (`en`, `hil`) when the flag is on; the Hiligaynon pages' content is wrapped in `<div lang="hil">`.
- A "Hiligaynon / English" link appears in the footer when the flag is on.
- Database content (event titles, campaign descriptions, FAQs) stays in English.

## 6. Error handling

- Members-area pages call `requireArea("members")`; admin pages keep `requireArea("content")`.
- Profile and passport-request saves use the Phase 2 inline-error pattern; a member can only edit their own record (the server ignores any member id from the client).
- Linking by email only links a member record that has no `clerk_user_id` yet, so one person can't claim another's linked profile.
- Directory search is a parameterised `LIKE` over lower-cased fields.

## 7. Testing

- **Unit:** linking a Clerk user (by id, by email, never stealing a linked record); profile validation (lengths, skills normalisation); directory filtering (opt-in, active, search); badges and points; passport request/verify/decline; attendance → passport entry (and removal); i18n fallback to English for missing keys.
- **Server actions:** members can only update their own profile; non-admins cannot verify entries.
- **End-to-end:** `/members/*` redirect signed-out visitors to sign-in; `/hil/*` return 404 while the flag is off; with the flag on (e2e env), `/hil` passes the Phase 1 page checks and declares `hreflang`.
- **Manual:** sign in as an invited member, complete the profile, request a passport entry, verify it as admin.

## 8. Out of scope

- Private (signed) file storage for members-only resources.
- Member-to-member messaging or contact details in the directory.
- Translating database content into Hiligaynon.
- Members editing officer terms (admins do it in the database for now).
