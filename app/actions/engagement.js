"use server";

import { getDb } from "@/lib/db.js";
import { verifyTurnstile } from "@/lib/turnstile.js";
import { sendEmail } from "@/lib/email.js";
import { notifyAdmins } from "@/lib/notify-admins.js";
import { SITE } from "@/lib/site.js";
import { formatDateTime, formatPesos } from "@/lib/format.js";
import { pathsForEvent, revalidateAll } from "@/lib/revalidate.js";
import { submitApplication } from "@/lib/engagement/applications.js";
import { submitRsvp, submitVolunteer } from "@/lib/engagement/events.js";
import { submitPledge } from "@/lib/engagement/money.js";
import { submitDriveSignup } from "@/lib/engagement/volunteers.js";

const BOT = { ok: false, errors: ["Please complete the check and try again"] };

export async function applyAction(input) {
  if (!(await verifyTurnstile(input?.turnstileToken))) return BOT;
  const r = await submitApplication(getDb(), input);
  if (!r.ok) return r;
  const { name, email } = r.application;
  await Promise.all([
    sendEmail({
      to: email,
      subject: "We received your JCI Roxas Halaran application",
      text: `Hi ${name},\n\nThank you for applying to JCI Roxas Halaran. Our team will review your application and contact you soon.\n\nJCI Roxas Halaran\n${SITE.url}`,
    }),
    notifyAdmins({
      subject: `New membership application: ${name}`,
      text: `${name} (${email}) applied to join.\nReview it at ${SITE.url}/admin/applications`,
    }),
  ]);
  return { ok: true, message: "Thank you! We received your application and will contact you soon." };
}

export async function rsvpAction(input) {
  if (!(await verifyTurnstile(input?.turnstileToken))) return BOT;
  const r = await submitRsvp(getDb(), input);
  if (!r.ok) return r;
  revalidateAll(pathsForEvent(r.event.slug));
  const when = formatDateTime(r.event.startAt);
  const message =
    r.status === "waitlist"
      ? "The event is full — you're on the waitlist. We'll email you if a spot opens."
      : `You're going! See you on ${when}.`;
  await Promise.all([
    sendEmail({
      to: r.rsvp.email,
      subject: `${r.status === "waitlist" ? "Waitlist" : "RSVP"}: ${r.event.title}`,
      text: `Hi ${r.rsvp.name},\n\n${message}\n\n${r.event.title}\n${when}${r.event.venue ? `\n${r.event.venue}` : ""}\n${SITE.url}/events/${r.event.slug}`,
    }),
    notifyAdmins({
      subject: `New ${r.status === "waitlist" ? "waitlist signup" : "RSVP"}: ${r.event.title}`,
      text: `${r.rsvp.name} (${r.rsvp.email}) ${r.status === "waitlist" ? "joined the waitlist for" : "RSVP'd to"} ${r.event.title} on ${when}.\nSee the list at ${SITE.url}/admin/events`,
    }),
  ]);
  return { ok: true, message };
}

export async function volunteerAction(input) {
  if (!(await verifyTurnstile(input?.turnstileToken))) return BOT;
  const r = await submitVolunteer(getDb(), input);
  if (!r.ok) return r;
  await notifyAdmins({
    subject: `New volunteer: ${r.signup.name}`,
    text: `${r.signup.name} (${r.signup.email}) signed up to volunteer.${r.signup.skills ? `\nSkills: ${r.signup.skills}` : ""}\nSee volunteers at ${SITE.url}/admin/volunteers`,
  });
  return { ok: true, message: "Thank you for volunteering! We'll contact you with details." };
}

// A sign-up through a volunteer registration (/volunteer/<slug>).
export async function driveSignupAction(input) {
  if (!(await verifyTurnstile(input?.turnstileToken))) return BOT;
  const r = await submitDriveSignup(getDb(), input);
  if (!r.ok) return r;
  const { signup, drive, role, status } = r;
  const what = role ? `${role.label} — ${drive.title}` : drive.title;
  const message =
    status === "waitlist"
      ? `${role.label} is full, so you're on the waitlist. We'll email you if a spot opens.`
      : `You're signed up${role ? ` as ${role.label}` : ""}. We'll contact you with details.`;
  const details = [what, drive.startsAt && formatDateTime(drive.startsAt), drive.venue].filter(Boolean).join("\n");
  await Promise.all([
    sendEmail({
      to: signup.email,
      subject: `${status === "waitlist" ? "Volunteer waitlist" : "You're volunteering"}: ${drive.title}`,
      text: `Hi ${signup.name},\n\nThank you for volunteering with JCI Roxas Halaran! ${message}\n\n${details}\n${SITE.url}/volunteer/${drive.slug}`,
    }),
    notifyAdmins({
      subject: `New volunteer${status === "waitlist" ? " (waitlist)" : ""}: ${what}`,
      text: `${signup.name} (${signup.email}${signup.phone ? `, ${signup.phone}` : ""}) signed up for ${what}.${signup.skills ? `\nNote: ${signup.skills}` : ""}\nSee the list at ${SITE.url}/admin/volunteers/${drive.id}`,
    }),
  ]);
  return { ok: true, message: `Thank you, ${signup.name.split(" ")[0]}! ${message}` };
}

export async function pledgeAction(input) {
  if (!(await verifyTurnstile(input?.turnstileToken))) return BOT;
  const r = await submitPledge(getDb(), input);
  if (!r.ok) return r;
  const p = r.payment;
  await notifyAdmins({
    subject: `New pledge to confirm: ${formatPesos(p.amountCentavos)} via ${p.method.toUpperCase()}`,
    text: `${p.payerName} (${p.payerEmail}) reported ${formatPesos(p.amountCentavos)} via ${p.method.toUpperCase()}, reference ${p.referenceNo}.\nConfirm it at ${SITE.url}/admin/payments`,
  });
  return { ok: true, message: "Thank you! Our team will confirm your payment within a few days." };
}
