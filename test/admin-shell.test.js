import { describe, it, expect, beforeEach } from "vitest";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { adminNav, isCurrent } from "@/lib/admin/nav.js";
import { adminCounts, safeAdminCounts } from "@/lib/admin/counts.js";
import { badgeTone } from "@/lib/admin/status.js";
import { submitPledge } from "@/lib/engagement/money.js";

describe("adminNav", () => {
  it("groups admin links and shows only non-zero badges", () => {
    const groups = adminNav("admin", { applications: 0, payments: 3, passport: 1 });
    expect(groups.map((g) => g.label)).toEqual([null, "Content", "People", "Money", "Proof"]);
    const links = groups.flatMap((g) => g.links);
    expect(links.find((l) => l.href === "/admin/payments").badge).toBe(3);
    expect(links.find((l) => l.href === "/admin/passport").badge).toBe(1);
    expect(links.find((l) => l.href === "/admin/applications").badge).toBeNull();
    expect(links.find((l) => l.href === "/admin/articles").badge).toBeNull();
  });

  it("gives officers and treasurers only the dashboard", () => {
    for (const role of ["officer", "treasurer"]) {
      expect(adminNav(role, { payments: 3 }).flatMap((g) => g.links).map((l) => l.href)).toEqual(["/admin"]);
    }
  });
});

describe("isCurrent", () => {
  it("matches nested pages to their section and the dashboard only exactly", () => {
    expect(isCurrent("/admin/payments", "/admin/payments/12")).toBe(true);
    expect(isCurrent("/admin/projects", "/admin/projects/new")).toBe(true);
    expect(isCurrent("/admin", "/admin/payments")).toBe(false);
    expect(isCurrent("/admin", "/admin")).toBe(true);
    expect(isCurrent("/admin/events", "/admin/evidence")).toBe(false);
  });
});

describe("adminCounts", () => {
  let db;
  beforeEach(async () => {
    db = await testDb();
    await seed(db);
  });

  it("counts pending applications, payments and passport requests", async () => {
    await submitPledge(db, { payerName: "Ana Cruz", payerEmail: "a@x.ph", amountPesos: 500, method: "gcash", referenceNo: "REF00009", consent: true });
    expect(await adminCounts(db)).toEqual({ applications: 0, payments: 1, passport: 0 });
  });

  it("returns no counts instead of failing when the database errors", async () => {
    const broken = { select: () => { throw new Error("offline"); } };
    expect(await safeAdminCounts(broken)).toEqual({});
  });
});

describe("badgeTone", () => {
  it("maps statuses to tones", () => {
    expect(["pending", "requested", "draft"].map(badgeTone)).toEqual(["wait", "wait", "wait"]);
    expect(["confirmed", "approved", "published", "verified", "attended"].map(badgeTone)).toEqual(["ok", "ok", "ok", "ok", "ok"]);
    expect(["rejected", "declined", "cancelled"].map(badgeTone)).toEqual(["bad", "bad", "bad"]);
    expect(badgeTone("archived")).toBe("neutral");
  });
});
