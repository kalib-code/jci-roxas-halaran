import { describe, it, expect, vi, beforeEach } from "vitest";
import { testDb } from "./helpers/db.js";
import { saveEvent } from "@/lib/engagement/events.js";
import { setCheckin } from "@/lib/engagement/attendance.js";

let db;
vi.mock("@/lib/db.js", async (importOriginal) => ({ ...(await importOriginal()), getDb: () => db }));
vi.mock("@/lib/turnstile.js", () => ({ verifyTurnstile: async () => true }));
const { checkInAction } = await import("@/app/actions/attendance.js");

describe("checkInAction", () => {
  let code;
  beforeEach(async () => {
    db = await testDb();
    const soon = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 16);
    const { event } = await saveEvent(db, { title: "GA", startAt: soon });
    code = (await setCheckin(db, event.id, { open: true })).event.checkinCode;
  });
  const visit = (name, email) => checkInAction({ code, name, email, position: "Member", affiliation: "home", consent: true });

  it("never reveals whose row an email belongs to", async () => {
    expect((await visit("Judy Daliva", "judy@x.ph")).name).toBe("Judy Daliva");
    const again = await visit("Someone Else", "judy@x.ph");
    expect(again).toEqual({ ok: true, already: true, online: false, name: "Someone Else", at: null });
    expect(JSON.stringify(again)).not.toContain("Judy");
  });
});
