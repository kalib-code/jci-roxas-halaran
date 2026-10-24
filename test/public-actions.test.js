import { describe, it, expect, vi, beforeEach } from "vitest";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { saveEvent } from "@/lib/engagement/events.js";

const h = vi.hoisted(() => ({ db: null, human: true, emails: [], revalidated: [] }));
vi.mock("@/lib/db.js", async (orig) => ({ ...(await orig()), getDb: () => h.db }));
vi.mock("@/lib/turnstile.js", () => ({ verifyTurnstile: async () => h.human }));
vi.mock("@/lib/email.js", () => ({ sendEmail: async (m) => { h.emails.push(m); return { sent: true }; } }));
vi.mock("@/lib/notify-admins.js", () => ({ notifyAdmins: async (m) => { h.emails.push({ ...m, to: "admins" }); return { sent: true }; } }));
vi.mock("next/cache", () => ({ revalidatePath: (p) => h.revalidated.push(p) }));

const { applyAction, rsvpAction, pledgeAction } = await import("@/app/actions/engagement.js");

let ga;
beforeEach(async () => {
  h.db = await testDb();
  await seed(h.db);
  h.human = true;
  h.emails = [];
  h.revalidated = [];
  ga = (await saveEvent(h.db, { title: "General Assembly", startAt: "2027-01-15T18:00", capacity: 1 })).event;
});

describe("public actions", () => {
  it("turn bots away", async () => {
    h.human = false;
    expect(await applyAction({ name: "Ana Cruz", email: "a@x.ph", birthdate: "1998-01-01", consent: true })).toEqual({
      ok: false,
      errors: ["Please complete the check and try again"],
    });
  });

  it("confirm an application and email both the applicant and the admins", async () => {
    const r = await applyAction({ name: "Ana Cruz", email: "a@x.ph", birthdate: "1998-01-01", consent: true });
    expect(r).toEqual({ ok: true, message: "Thank you! We received your application and will contact you soon." });
    expect(h.emails.map((m) => m.to)).toEqual(["a@x.ph", "admins"]);
  });

  it("alert the admins about every RSVP", async () => {
    await rsvpAction({ eventId: ga.id, name: "Ana Cruz", email: "a@x.ph", consent: true });
    const alert = h.emails.find((m) => m.to === "admins");
    expect(alert.subject).toBe("New RSVP: General Assembly");
    expect(alert.text).toContain("Ana Cruz (a@x.ph) RSVP'd to General Assembly");
  });

  it("tell a late RSVP they are on the waitlist and refresh the event pages", async () => {
    await rsvpAction({ eventId: ga.id, name: "Ana Cruz", email: "a@x.ph", consent: true });
    const r = await rsvpAction({ eventId: ga.id, name: "Ben Reyes", email: "b@x.ph", consent: true });
    expect(r.message).toBe("The event is full — you're on the waitlist. We'll email you if a spot opens.");
    expect(h.revalidated).toContain("/events/general-assembly");
  });

  it("acknowledge a pledge without counting it yet", async () => {
    const r = await pledgeAction({ payerName: "Ana Cruz", payerEmail: "a@x.ph", amountPesos: 500, method: "gcash", referenceNo: "ABC12345", consent: true });
    expect(r).toEqual({ ok: true, message: "Thank you! Our team will confirm your payment within a few days." });
  });
});
