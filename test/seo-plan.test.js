import { describe, it, expect, beforeEach } from "vitest";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { addPlanKeyword, monthProgress, setPlanStatus, listPlan } from "@/lib/content/seoPlan.js";

let db;
beforeEach(async () => {
  db = await testDb();
  await seed(db);
});

describe("SEO plan", () => {
  it("starts with 10 ideas for November", async () => {
    expect(await monthProgress(db, "2026-11")).toEqual({ published: 0, total: 10 });
  });

  it("adds a keyword once per month, lowercased", async () => {
    expect((await addPlanKeyword(db, { month: "2027-02", keyword: "  Valentine's Day PH " })).row.keyword).toBe("valentine's day ph");
    expect(await addPlanKeyword(db, { month: "2027-02", keyword: "valentine's day ph" })).toEqual({
      ok: false,
      errors: ['"valentine\'s day ph" is already planned for 2027-02'],
    });
  });

  it("changes a status and rejects unknown ones", async () => {
    const [first] = await listPlan(db);
    expect(await setPlanStatus(db, first.id, "drafting")).toEqual({ ok: true });
    expect(await setPlanStatus(db, first.id, "done")).toEqual({ ok: false, errors: ["Unknown status"] });
  });
});
