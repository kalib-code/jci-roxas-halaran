import { describe, it, expect } from "vitest";
import { testDb } from "./helpers/db.js";
import { eventsLog } from "@/db/schema.js";
import { logEvent } from "@/lib/evidence.js";

describe("logEvent", () => {
  it("records the type with its award criterion", async () => {
    const db = await testDb();
    await logEvent(db, { type: "rsvp_created", refTable: "rsvps", refId: 4, meta: { status: "going" }, now: "2026-11-01T00:00:00.000Z" });
    const [row] = await db.select().from(eventsLog);
    expect(row).toMatchObject({ type: "rsvp_created", criterion: "interactivity", actor: "public", refTable: "rsvps", refId: 4, meta: '{"status":"going"}' });
  });

  it("maps every type to the right criterion", async () => {
    const db = await testDb();
    for (const type of ["member_approved", "payment_confirmed", "article_published"]) await logEvent(db, { type, actor: "user_1" });
    expect((await db.select().from(eventsLog)).map((r) => r.criterion)).toEqual(["member_value", "planning", "planning"]);
  });

  it("rejects unknown types", async () => {
    const db = await testDb();
    await expect(logEvent(db, { type: "made_up" })).rejects.toThrow("Unknown log type made_up");
  });
});
