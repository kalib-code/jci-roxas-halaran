import { describe, it, expect, beforeEach } from "vitest";
import { testDb } from "./helpers/db.js";
import { logEvent } from "@/lib/evidence.js";
import { lastMonths, monthlyEvidence, typeTotals, upsertSnapshot, listSnapshots, evidenceCsv, logCsv } from "@/lib/proof/evidence.js";

let db;
beforeEach(async () => {
  db = await testDb();
});

describe("months", () => {
  it("lists the last N Philippine months, oldest first", () => {
    expect(lastMonths(new Date("2026-12-31T17:00:00Z"), 3)).toEqual(["2026-11", "2026-12", "2027-01"]);
  });
});

describe("monthlyEvidence", () => {
  it("counts rows per criterion by Philippine month and zero-fills the rest", async () => {
    await logEvent(db, { type: "rsvp_created", now: "2026-10-31T23:30:00.000Z" }); // 2026-11-01 07:30 PH
    await logEvent(db, { type: "payment_confirmed", now: "2026-11-15T00:00:00.000Z" });
    await logEvent(db, { type: "member_approved", now: "2026-09-01T00:00:00.000Z" });
    const m = await monthlyEvidence(db, { now: new Date("2026-11-20T00:00:00Z"), months: 3 });
    expect(m).toEqual([
      { month: "2026-09", planning: 0, layout: 0, interactivity: 0, member_value: 1, total: 1 },
      { month: "2026-10", planning: 0, layout: 0, interactivity: 0, member_value: 0, total: 0 },
      { month: "2026-11", planning: 1, layout: 0, interactivity: 1, member_value: 0, total: 2 },
    ]);
    expect(await typeTotals(db)).toEqual(expect.arrayContaining([{ type: "rsvp_created", n: 1 }]));
  });
});

describe("analytics snapshots", () => {
  it("creates and then updates one snapshot per month", async () => {
    await upsertSnapshot(db, { month: "2026-11", organicClicks: "120", impressions: "4000", visitors: "", note: "" }, { userId: "admin" });
    await upsertSnapshot(db, { month: "2026-11", organicClicks: "150", impressions: "4500", visitors: "900", note: "After switch" }, { userId: "admin" });
    expect(await listSnapshots(db)).toEqual([expect.objectContaining({ month: "2026-11", organicClicks: 150, impressions: 4500, visitors: 900, note: "After switch" })]);
  });

  it("refuses a bad month or negative numbers", async () => {
    expect((await upsertSnapshot(db, { month: "Nov 2026" }, { userId: "admin" })).ok).toBe(false);
    expect((await upsertSnapshot(db, { month: "2026-11", organicClicks: "-1" }, { userId: "admin" })).ok).toBe(false);
  });
});

describe("CSV", () => {
  it("joins the monthly counts with the analytics numbers", () => {
    const csv = evidenceCsv(
      [{ month: "2026-11", planning: 1, layout: 0, interactivity: 2, member_value: 0, total: 3 }],
      [{ month: "2026-11", organicClicks: 150, impressions: 4500, visitors: null, note: "=cmd" }],
    );
    expect(csv.split("\r\n")).toEqual([
      '"Month","Planning & execution","Layout & presentation","Interactivity & services","Value to members","Total","Organic clicks","Impressions","Visitors","Note"',
      '"2026-11","1","0","2","0","3","150","4500","","\'=cmd"',
    ]);
  });

  it("exports every log row", async () => {
    await logEvent(db, { type: "rsvp_created", refTable: "rsvps", refId: 1, now: "2026-11-01T00:00:00.000Z" });
    expect((await logCsv(db)).split("\r\n")[1]).toBe('"2026-11-01T00:00:00.000Z","rsvp_created","interactivity","public","rsvps","1"');
  });
});
