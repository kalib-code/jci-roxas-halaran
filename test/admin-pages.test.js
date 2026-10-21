import { describe, it, expect } from "vitest";
import { pickTab, statusTabs } from "@/lib/admin/tabs.js";
import { todoCards } from "@/lib/admin/dashboard.js";

const rows = [
  { id: 1, status: "pending", amountCentavos: 50000 },
  { id: 2, status: "pending", amountCentavos: 25000 },
  { id: 3, status: "confirmed", amountCentavos: 100000 },
];
const DEFS = [["pending", "To confirm"], ["confirmed", "Confirmed"], ["rejected", "Rejected"]];

describe("statusTabs", () => {
  it("splits rows by status with counts and peso totals", () => {
    const tabs = statusTabs(rows, DEFS, { amount: true });
    expect(tabs.map(({ key, count, total }) => ({ key, count, total }))).toEqual([
      { key: "pending", count: 2, total: 75000 },
      { key: "confirmed", count: 1, total: 100000 },
      { key: "rejected", count: 0, total: 0 },
    ]);
    expect(tabs[0].rows.map((r) => r.id)).toEqual([1, 2]);
  });

  it("leaves totals out when amounts don't apply", () => {
    expect(statusTabs(rows, DEFS)[0].total).toBeNull();
  });
});

describe("pickTab", () => {
  it("falls back to the first tab for unknown or missing values", () => {
    expect(pickTab("confirmed", ["pending", "confirmed"])).toBe("confirmed");
    expect(pickTab("garbage", ["pending", "confirmed"])).toBe("pending");
    expect(pickTab(undefined, ["pending", "confirmed"])).toBe("pending");
  });
});

describe("todoCards", () => {
  it("says what is waiting and 'All caught up' when nothing is", () => {
    const cards = todoCards({ applications: 2, payments: 0, passport: 1 }, 3);
    expect(cards.map((c) => [c.href, c.text, c.badge])).toEqual([
      ["/admin/applications", "2 waiting for review", 2],
      ["/admin/payments", "All caught up", null],
      ["/admin/passport", "1 to verify", 1],
      ["/admin/articles", "3 drafts in progress", null],
    ]);
  });

  it("copes with missing counts", () => {
    expect(todoCards({}, 0).every((c) => c.text === "All caught up" || c.text === "No drafts")).toBe(true);
  });
});
