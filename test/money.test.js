import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { members, eventsLog } from "@/db/schema.js";
import { saveCampaign, listCampaigns, submitPledge, confirmPayment, rejectPayment, recordExpense } from "@/lib/engagement/money.js";

const now = "2026-11-01T00:00:00.000Z";
let db;
let fund;
beforeEach(async () => {
  db = await testDb();
  await seed(db);
  fund = (await saveCampaign(db, { title: "Coastal Cleanup Fund", goalPesos: 20000, qrImageUrl: "/assets/img/logo-site.png", qrImageAlt: "GCash QR" }, { now })).campaign;
});

const pledge = (extra = {}) =>
  submitPledge(db, { campaignId: fund.id, payerName: "Ana Cruz", payerEmail: "a@x.ph", amountPesos: 500, method: "gcash", referenceNo: "ABC12345", consent: true, ...extra }, { now });

describe("campaigns and pledges", () => {
  it("counts only confirmed payments toward the goal", async () => {
    const a = await pledge();
    await pledge({ referenceNo: "XYZ99999" });
    await confirmPayment(db, a.payment.id, { userId: "admin", now });
    const [c] = await listCampaigns(db, { openOnly: true });
    expect(c).toMatchObject({ goalCentavos: 2000000, raisedCentavos: 50000 });
  });

  it("refuses a reused reference number regardless of case, per method", async () => {
    await pledge();
    expect(await pledge({ referenceNo: "abc12345" })).toEqual({ ok: false, errors: ["That reference number was already submitted"] });
    expect((await pledge({ referenceNo: "abc12345", method: "maya" })).ok).toBe(true);
  });

  it("refuses pledges to a closed campaign", async () => {
    await saveCampaign(db, { id: fund.id, title: fund.title, goalPesos: 20000, open: false }, { now });
    expect(await pledge()).toEqual({ ok: false, errors: ["This campaign is closed"] });
  });

  it("marks a member's fee as paid when a membership fee is confirmed", async () => {
    await db.update(members).set({ email: "a@x.ph" }).where(eq(members.slug, "judy-daliva"));
    const p = await pledge({ type: "membership_fee", campaignId: "" });
    await confirmPayment(db, p.payment.id, { userId: "admin", now });
    const [judy] = await db.select().from(members).where(eq(members.slug, "judy-daliva"));
    expect(judy.feePaidYear).toBe(2026);
  });

  it("refuses to confirm twice and lets admins reject with a note", async () => {
    const a = await pledge();
    await confirmPayment(db, a.payment.id, { userId: "admin", now });
    expect(await confirmPayment(db, a.payment.id, { userId: "admin", now })).toEqual({ ok: false, errors: ["This payment was already reviewed"] });
    const b = await pledge({ referenceNo: "NOPE0001" });
    expect((await rejectPayment(db, b.payment.id, { userId: "admin", now, note: "Not found in GCash" })).ok).toBe(true);
  });
});

describe("expenses", () => {
  it("records and logs an expense", async () => {
    const r = await recordExpense(db, { amountPesos: 1250, description: "Trash bags", spentOn: "2026-11-02", campaignId: fund.id }, { userId: "admin", now });
    expect(r.expense.amountCentavos).toBe(125000);
    expect((await db.select().from(eventsLog)).map((l) => l.type)).toEqual(["expense_recorded"]);
  });
});
