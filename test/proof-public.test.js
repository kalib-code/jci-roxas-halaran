import { SITE } from "@/lib/site.js";
import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { projects } from "@/db/schema.js";
import { impactTotals, impactStats, mapProjects, projectsByBarangay, homeStats } from "@/lib/proof/impact.js";
import { transparencyYears, transparencyForYear } from "@/lib/proof/transparency.js";
import { setProjectMetrics } from "@/lib/proof/metrics.js";
import { saveEvent, submitVolunteer } from "@/lib/engagement/events.js";
import { saveCampaign, submitPledge, confirmPayment, recordExpense } from "@/lib/engagement/money.js";

let db;
beforeEach(async () => {
  db = await testDb();
  await seed(db);
});
const coastline = async () => (await db.select().from(projects).where(eq(projects.slug, "coastline-cuts")))[0];

describe("impactTotals", () => {
  it("counts done projects, active members, volunteers, past events and sums metrics", async () => {
    const p = await coastline();
    await setProjectMetrics(db, p.id, [{ metric: "trees_planted", value: 120 }]);
    const { event } = await saveEvent(db, { title: "Assembly", startAt: "2026-10-01T18:00" });
    await saveEvent(db, { title: "Future", startAt: "2099-01-01T18:00" });
    await submitVolunteer(db, { eventId: event.id, name: "Ana Cruz", email: "a@x.ph", consent: true });
    const t = await impactTotals(db, { now: new Date("2026-11-01T00:00:00Z") });
    expect(t).toMatchObject({ projectsDone: 11, activeMembers: 17, volunteers: 1, eventsHeld: 1, metrics: { trees_planted: 120 } });
  });
});

describe("map and list", () => {
  it("returns only located projects for the map and groups all projects by barangay", async () => {
    await db.update(projects).set({ lat: 11.6, lng: 122.73, barangay: "Baybay" }).where(eq(projects.slug, "coastline-cuts"));
    expect((await mapProjects(db)).map((p) => p.slug)).toEqual(["coastline-cuts"]);
    const groups = await projectsByBarangay(db);
    expect(groups[0]).toMatchObject({ barangay: "Baybay" });
    expect(groups.at(-1).barangay).toBe("Location to be added");
  });
});

describe("homeStats", () => {
  const fallback = [
    { value: "3+", label: "Years of activity" },
    { value: "50+", label: "Successful projects" },
    { value: "10+", label: "Communities helped" },
    { value: "25+", label: "Members" },
  ];
  it("uses a live number only when it beats the stated figure", () => {
    const s = homeStats({ projectsDone: 11, activeMembers: 30, metrics: { barangays: 0 } }, fallback);
    expect(s.map((x) => x.value)).toEqual(["3+", "50+", "10+", "30"]);
  });
});

describe("transparency", () => {
  it("counts confirmed money by Philippine year and splits it by type, campaign and project", async () => {
    const p = await coastline();
    const { campaign } = await saveCampaign(db, { title: "Fund", goalPesos: 10000, projectId: p.id });
    const a = await submitPledge(db, { campaignId: campaign.id, payerName: "Ana Cruz", payerEmail: "a@x.ph", amountPesos: 1000, method: "gcash", referenceNo: "REF00001", consent: true });
    await confirmPayment(db, a.payment.id, { userId: "admin", now: "2026-12-31T17:00:00.000Z" }); // 2027-01-01 01:00 PH
    const b = await submitPledge(db, { type: "membership_fee", payerName: "Ben Reyes", payerEmail: "b@x.ph", amountPesos: 500, method: "gcash", referenceNo: "REF00002", consent: true });
    await confirmPayment(db, b.payment.id, { userId: "admin", now: "2027-03-01T00:00:00.000Z" });
    await submitPledge(db, { payerName: "Cy Lim", payerEmail: "c@x.ph", amountPesos: 999, method: "maya", referenceNo: "REF00003", consent: true }); // pending: ignored
    await recordExpense(db, { amountPesos: 300, description: "Trash bags", spentOn: "2027-01-05", campaignId: campaign.id, projectId: p.id }, { userId: "admin" });

    expect(await transparencyYears(db)).toEqual(["2027"]);
    const y = await transparencyForYear(db, "2027");
    expect(y.income).toEqual({ donation: 100000, sponsorship: 0, membership_fee: 50000, total: 150000 });
    expect(y).toMatchObject({ expensesTotal: 30000, balance: 120000 });
    expect(y.campaigns).toEqual([expect.objectContaining({ title: "Fund", raised: 100000, spent: 30000, goalCentavos: 1000000 })]);
    expect(y.projects).toEqual([expect.objectContaining({ title: "Coastline Cuts", spent: 30000 })]);
    expect(y.items[0]).toMatchObject({ description: "Trash bags", amountCentavos: 30000, projectTitle: "Coastline Cuts" });
    expect(JSON.stringify(y)).not.toContain("a@x.ph");
    expect(JSON.stringify(y)).not.toContain("Ana Cruz");
  });
});

describe("impactStats", () => {
  it("drops figures that are zero", () => {
    expect(impactStats({ projectsDone: 11, activeMembers: 18, volunteers: 0, eventsHeld: 0, metrics: { trees_planted: 120, schools: 0 } }, { memberFloor: 0 })).toEqual([
      ["Projects completed", 11],
      ["Active members", 18],
      ["Trees planted", 120],
    ]);
  });
  it("shows the chapter's stated member count until the members list catches up", () => {
    const members = (active) => impactStats({ projectsDone: 0, activeMembers: active, volunteers: 0, eventsHeld: 0, metrics: {} });
    expect(members(18)).toEqual([["Active members", 48]]);
    expect(members(52)).toEqual([["Active members", 52]]);
  });
  it("states 48 members on the About page", () => {
    expect(SITE.stats.find((s) => s.label === "Members").value).toBe("48");
  });
});
