import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { members } from "@/db/schema.js";
import { submitApplication, approveApplication } from "@/lib/engagement/applications.js";
import { submitPledge, confirmPayment, rejectPayment } from "@/lib/engagement/money.js";
import { verifyTurnstile } from "@/lib/turnstile.js";

let db;
beforeEach(async () => {
  db = await testDb();
  await seed(db);
});

const pledge = (extra = {}) =>
  submitPledge(db, { payerName: "Ana Cruz", payerEmail: "a@x.ph", amountPesos: 500, method: "gcash", referenceNo: "REF12345", consent: true, ...extra }, { now: "2026-11-01T00:00:00.000Z" });

describe("Philippine dates", () => {
  it("accepts someone who turned 18 today in the Philippines before 8 AM", async () => {
    // 2026-11-01T20:00Z is 2026-11-02 04:00 in the Philippines.
    const r = await submitApplication(db, { name: "Ana Cruz", email: "a@x.ph", birthdate: "2008-11-02", consent: true }, { now: "2026-11-01T20:00:00.000Z" });
    expect(r.ok).toBe(true);
  });

  it("records the join date in Philippine time", async () => {
    const { application } = await submitApplication(db, { name: "Ana Cruz", email: "a@x.ph", birthdate: "2000-01-01", consent: true }, { now: "2026-11-01T20:00:00.000Z" });
    const r = await approveApplication(db, application.id, { userId: "admin", now: "2026-11-01T20:00:00.000Z" });
    expect(r.member.joinedAt).toBe("2026-11-02");
  });

  it("records a fee confirmed early on 1 January for the new year", async () => {
    await db.update(members).set({ email: "a@x.ph" }).where(eq(members.slug, "judy-daliva"));
    const p = await pledge({ type: "membership_fee" });
    await confirmPayment(db, p.payment.id, { userId: "admin", now: "2026-12-31T17:00:00.000Z" });
    const [judy] = await db.select().from(members).where(eq(members.slug, "judy-daliva"));
    expect(judy.feePaidYear).toBe(2027);
  });
});

describe("Clerk accounts on approval", () => {
  it("links an existing Clerk account instead of only inviting", async () => {
    const { application } = await submitApplication(db, { name: "Ana Cruz", email: "a@x.ph", birthdate: "2000-01-01", consent: true });
    const r = await approveApplication(db, application.id, { userId: "admin", invite: async () => ({ clerkUserId: "user_existing", invited: false }) });
    expect(r).toMatchObject({ ok: true, invited: false, linkedAccount: true });
    expect(r.member.clerkUserId).toBe("user_existing");
  });
});

describe("membership fees", () => {
  it("say which member the fee was recorded on, or that none matched", async () => {
    const unmatched = await pledge({ type: "membership_fee" });
    expect((await confirmPayment(db, unmatched.payment.id, { userId: "admin" })).linkedMember).toBeNull();
    await db.update(members).set({ email: "b@x.ph" }).where(eq(members.slug, "judy-daliva"));
    const matched = await pledge({ type: "membership_fee", payerEmail: "b@x.ph", referenceNo: "REF99999" });
    expect((await confirmPayment(db, matched.payment.id, { userId: "admin" })).linkedMember).toBe("Judy J. Daliva");
  });
});

describe("rejected payments", () => {
  it("free the reference number for a corrected resubmission", async () => {
    const first = await pledge();
    await rejectPayment(db, first.payment.id, { userId: "admin", note: "Wrong amount" });
    expect((await pledge({ amountPesos: 600 })).ok).toBe(true);
  });
});

describe("Turnstile without a secret", () => {
  it("fails closed in production and stays open elsewhere", async () => {
    expect(await verifyTurnstile("", { secret: "", environment: "production" })).toBe(false);
    expect(await verifyTurnstile("", { secret: "", environment: "preview" })).toBe(true);
  });
});
