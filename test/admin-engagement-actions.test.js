import { describe, it, expect, vi, beforeEach } from "vitest";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { submitApplication } from "@/lib/engagement/applications.js";
import { saveCampaign, submitPledge } from "@/lib/engagement/money.js";

const h = vi.hoisted(() => ({ db: null, claims: null, revalidated: [], invites: [] }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: h.claims ? "user_admin" : null, sessionClaims: h.claims }),
  clerkClient: async () => ({
    users: { getUser: async () => ({ publicMetadata: {} }) },
    invitations: { createInvitation: async (p) => { h.invites.push(p); return {}; } },
  }),
}));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
vi.mock("next/cache", () => ({ revalidatePath: (p) => h.revalidated.push(p) }));
vi.mock("@/lib/db.js", async (orig) => ({ ...(await orig()), getDb: () => h.db }));

const { approveApplicationAction } = await import("@/app/admin/applications/actions.js");
const { confirmPaymentAction } = await import("@/app/admin/payments/actions.js");

beforeEach(async () => {
  h.db = await testDb();
  await seed(h.db);
  h.revalidated = [];
  h.invites = [];
});

describe("admin engagement actions", () => {
  it("refuse officers", async () => {
    h.claims = { metadata: { role: "officer" } };
    await expect(approveApplicationAction(1)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("approve an application and send a Clerk invitation as a member", async () => {
    h.claims = { metadata: { role: "admin" } };
    const { application } = await submitApplication(h.db, { name: "Ana Cruz", email: "a@x.ph", birthdate: "1998-01-01", consent: true });
    const r = await approveApplicationAction(application.id);
    expect(r).toMatchObject({ ok: true, invited: true, memberName: "Ana Cruz" });
    expect(h.invites[0]).toMatchObject({ emailAddress: "a@x.ph", publicMetadata: { role: "member" }, ignoreExisting: true });
  });

  it("refresh the support page when a payment is confirmed", async () => {
    h.claims = { metadata: { role: "admin" } };
    const { campaign } = await saveCampaign(h.db, { title: "Fund", goalPesos: 1000 });
    const { payment } = await submitPledge(h.db, { campaignId: campaign.id, payerName: "Ana Cruz", payerEmail: "a@x.ph", amountPesos: 100, method: "gcash", referenceNo: "REF00001", consent: true });
    expect((await confirmPaymentAction(payment.id)).ok).toBe(true);
    expect(h.revalidated).toEqual(expect.arrayContaining(["/support", "/"]));
  });
});
