"use server";

import { getDb } from "@/lib/db.js";
import { verifyTurnstile } from "@/lib/turnstile.js";
import { sendEmail } from "@/lib/email.js";
import { SITE } from "@/lib/site.js";
import { formatDateTime, formatPesos } from "@/lib/format.js";
import { pathsForEvent, revalidateAll } from "@/lib/revalidate.js";
import { submitApplication } from "@/lib/engagement/applications.js";
import { submitRsvp, submitVolunteer } from "@/lib/engagement/events.js";
import { submitPledge } from "@/lib/engagement/money.js";

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
    sendEmail({
      to: SITE.email,
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
  await sendEmail({
    to: r.rsvp.email,
    subject: `${r.status === "waitlist" ? "Waitlist" : "RSVP"}: ${r.event.title}`,
    text: `Hi ${r.rsvp.name},\n\n${message}\n\n${r.event.title}\n${when}${r.event.venue ? `\n${r.event.venue}` : ""}\n${SITE.url}/events/${r.event.slug}`,
  });
  return { ok: true, message };
}

export async function volunteerAction(input) {
  if (!(await verifyTurnstile(input?.turnstileToken))) return BOT;
  const r = await submitVolunteer(getDb(), input);
  if (!r.ok) return r;
  await sendEmail({
    to: SITE.email,
    subject: `New volunteer: ${r.signup.name}`,
    text: `${r.signup.name} (${r.signup.email}) signed up to volunteer.${r.signup.skills ? `\nSkills: ${r.signup.skills}` : ""}`,
  });
  return { ok: true, message: "Thank you for volunteering! We'll contact you with details." };
}

export async function pledgeAction(input) {
  if (!(await verifyTurnstile(input?.turnstileToken))) return BOT;
  const r = await submitPledge(getDb(), input);
  if (!r.ok) return r;
  const p = r.payment;
  await sendEmail({
    to: SITE.email,
    subject: `New pledge to confirm: ${formatPesos(p.amountCentavos)} via ${p.method.toUpperCase()}`,
    text: `${p.payerName} (${p.payerEmail}) reported ${formatPesos(p.amountCentavos)} via ${p.method.toUpperCase()}, reference ${p.referenceNo}.\nConfirm it at ${SITE.url}/admin/payments`,
  });
  return { ok: true, message: "Thank you! Our team will confirm your payment within a few days." };
}
