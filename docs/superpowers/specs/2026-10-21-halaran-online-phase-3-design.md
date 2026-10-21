# Halaran Online — Phase 3 Design Spec: Engagement

**Date:** 2026-10-21
**Status:** Drafted from the approved parent spec; awaiting written-spec review
**Parent spec:** `docs/superpowers/specs/2026-10-21-halaran-online-design.md` (sections 3 "People", "Engagement", "Money", "Proof"; 4 "Public forms"; 6 "Payment flow"; 9 Phase 3)
**Builds on:** Phases 1–2 (branch `halaran-online`)

## 1. Purpose

Turn visitors into members, attendees, volunteers and donors, and record every one of those actions as evidence for the Temiong "Interactivity and services" and "Planning, execution and finance" criteria.

### Success criteria

- A visitor can apply for membership, RSVP to an event, sign up to volunteer and pledge a donation without an account, and gets an on-screen confirmation (and an email receipt once email is configured).
- An admin can approve an application, which creates the member and sends a Clerk invitation.
- An admin can create events, see RSVPs, mark attendance, and confirm or reject payments; campaign progress counts confirmed payments only.
- Every application, RSVP, volunteer sign-up, pledge, confirmation and approval writes one `events_log` row.
- Public forms reject bots (Cloudflare Turnstile) and duplicates (database constraints).

### Decisions

| Decision | Choice |
|---|---|
| Who runs Phase 3 admin screens | **Admins only** (`admin` role, same `content` area as Phase 2). Officer and treasurer roles gain nothing new |
| Payments | GCash/Maya/bank QR + manual confirmation by an admin (parent spec) |
| Spam protection | Cloudflare Turnstile on every public form |
| Email | Resend. Optional: if `RESEND_API_KEY` is unset, emails are skipped and logged, never blocking a submission |
| Invitations | Clerk invitations with `publicMetadata.role = "member"` |

Change from the parent spec: officer/treasurer duties in Phase 3 are done by admins.

## 2. Data model (migration `0002`)

All amounts are integer centavos; timestamps ISO-8601 text.

- **applications**: id, name, email, phone, birthdate, barangay, why_join, referred_by, consent (bool, must be true), status (`pending`/`approved`/`declined`), reviewed_by, reviewed_at, member_id → members (nullable), created_at. A partial unique index allows only one `pending` application per email (lower-cased).
- **members**: unchanged schema; approval fills `email` and `joined_at`.
- **events**: id, slug (unique), title, description (cleaned HTML), start_at, end_at, venue, capacity (nullable = unlimited), rsvp_open (bool), project_id → projects (nullable), cover_url, cover_alt, updated_at.
- **rsvps**: id, event_id → events, name, email (lower-cased), phone, consent, status (`going`/`waitlist`/`cancelled`), attended (bool), created_at. Unique (event_id, email).
- **volunteer_signups**: id, project_id (nullable), event_id (nullable), name, email, phone, skills, consent, created_at. At least one of project_id/event_id.
- **campaigns**: id, slug (unique), title, description, project_id (nullable), goal_centavos, qr_image_url, qr_image_alt, payment_instructions (e.g. "GCash 0917…, Juan D."), open (bool), created_at.
- **payments**: id, campaign_id (nullable), type (`donation`/`sponsorship`/`membership_fee`), payer_name, payer_email, member_id (nullable), amount_centavos (> 0), method (`gcash`/`maya`/`bank`), reference_no, proof_url (nullable), consent, status (`pending`/`confirmed`/`rejected`), confirmed_by, confirmed_at, note, created_at. Unique (method, lower(reference_no)).
- **expenses**: id, project_id (nullable), campaign_id (nullable), amount_centavos, description, spent_on, receipt_url (nullable), recorded_by, created_at.
- **events_log**: id, type, criterion (`planning`/`layout`/`interactivity`/`member_value`), actor (Clerk user id or `public`), ref_table, ref_id, meta (JSON text), created_at.

### Log types and criteria

| type | criterion |
|---|---|
| `application_submitted`, `rsvp_created`, `volunteer_signed_up`, `pledge_submitted` | interactivity |
| `member_approved`, `attendance_marked` | member_value |
| `payment_confirmed`, `expense_recorded` | planning |
| `article_published` (Phase 2 publishes start logging too) | planning |

## 3. Public pages and forms

| Route | Content |
|---|---|
| `/join` | Adds the **membership application** form (name, email, phone, birthdate, barangay, why join, referred by, consent). Age must be 18–40 on the submission date |
| `/events` | Upcoming events (start ≥ today) first, then past events; cards with date, venue, spots left |
| `/events/[slug]` | Details, cover, RSVP form (name, email, phone, consent) while `rsvp_open`; "Event full — join the waitlist" when going count ≥ capacity; "Add to calendar" link to `/events/[slug]/ics`; volunteer sign-up; JSON-LD `Event` |
| `/events/[slug]/ics` | iCalendar file for the event |
| `/support` | Open campaigns with progress bar (confirmed ÷ goal), QR image, instructions, pledge form (name, email, amount, method, reference number, optional proof screenshot upload, consent); sponsor tiers text |
| `/projects/[slug]` | Adds volunteer sign-up and, when a campaign is linked, its progress bar and a link to `/support#<campaign-slug>` |
| Nav / home | Adds "Events" to the nav; home shows the next 3 upcoming events after project stories |

### Public form rules

- Server actions; Zod validation; Turnstile token verified server-side (skipped only when `TURNSTILE_SECRET_KEY` is unset, i.e. local development).
- Required consent checkbox on every form (Data Privacy Act).
- Duplicates return a clear message: "You already have a pending application", "You're already on the list for this event", "That reference number was already submitted".
- On success: save, write `events_log`, try to send the receipt email, show a confirmation. Email failure is logged and never undoes the save.
- Proof screenshots for pledges upload to Vercel Blob through a separate public upload route that accepts images only (≤ 5 MB) and requires a valid Turnstile token.

## 4. Admin (role `admin`)

| Route | Purpose |
|---|---|
| `/admin/applications` | Pending first; approve (creates/links `members` row with email and joined_at, sends Clerk invitation with role `member`, logs) or decline with optional note |
| `/admin/events`, `/admin/events/new`, `/admin/events/[id]` | Create/edit events (title, slug locked after creation, dates, venue, capacity, RSVP open, linked project, cover + alt, description in Tiptap); RSVP list with going/waitlist/cancelled counts; mark attended; move waitlist → going; export CSV |
| `/admin/payments` | Pending pledges with amount, method, reference, proof link; confirm or reject (with note). Confirmed `membership_fee` sets `members.fee_paid_year` for the member with the payer's email |
| `/admin/campaigns` | Create/edit campaigns (goal, QR image upload + alt, instructions, open/closed, linked project) |
| `/admin/expenses` | Record expenses (amount, description, date, project/campaign, optional receipt upload) |
| `/admin` | Dashboard adds: pending applications, pending payments, next event with RSVP count |

Every admin action calls `requireArea("content")`, writes `events_log`, and revalidates affected public paths (`/events`, `/events/<slug>`, `/support`, `/projects/<slug>`, `/`).

## 5. Error handling

- Turnstile failure: "Please complete the check and try again" — form input kept.
- Full event: RSVP is saved as `waitlist` and the confirmation says so.
- Reference number reuse is case-insensitive per method.
- Approving an application whose email already belongs to a member links that member instead of creating a duplicate; a Clerk invitation is only sent if the member has no Clerk account yet.
- Clerk or Resend unavailable: the database write stands; the failure is logged and shown to the admin ("Approved — the invitation email failed, resend from Clerk").
- Admin screens use the Phase 2 inline-error pattern and `app/admin/error.jsx`.

## 6. Testing

- **Unit (Vitest):** age 18–40 check; application/RSVP/volunteer/pledge validation; capacity → waitlist; duplicate detection (pending application, RSVP per event, reference per method, case-insensitive); campaign totals count confirmed only; membership fee sets `fee_paid_year`; approval creates or links the member; `events_log` written for each action; ICS output; Turnstile verification (mocked fetch).
- **Server actions:** public actions with Turnstile mocked; admin actions refuse non-admins.
- **End-to-end (Playwright):** `/events`, `/events/[slug]`, `/support` pass Phase 1 page checks; submitting the application and RSVP forms with Turnstile disabled shows confirmations; a second RSVP with the same email shows the duplicate message; admin screens redirect signed-out visitors.
- **Manual (with the admin):** approve an application and receive the Clerk invitation; confirm a test pledge and see the progress bar move.

## 7. External setup (user)

- **Cloudflare Turnstile:** create a widget for `jciroxashalaran.com` and the vercel.app preview host; set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`.
- **Resend:** create an API key and verify the `jciroxashalaran.com` sending domain (DNS records, best done with the domain switch); set `RESEND_API_KEY` and `EMAIL_FROM` (e.g. `JCI Roxas Halaran <hello@jciroxashalaran.com>`).
- **QR codes:** the chapter's GCash/Maya QR images and account names for each campaign.

## 8. Out of scope

- Online payment processing (PayMongo).
- Member self-service (profile, directory, passport, library) — Phase 4.
- Evidence dashboard and transparency page — Phase 5 (Phase 3 only records the log and expenses).
- Automatic waitlist promotion when someone cancels (admins move people manually).
