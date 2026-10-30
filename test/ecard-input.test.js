import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { members } from "@/db/schema.js";
import { normalizePhone } from "@/lib/members/card.js";
import { updateProfile } from "@/lib/members/profile.js";

describe("normalizePhone", () => {
  it("accepts Philippine mobiles and landlines in any common format", () => {
    expect(normalizePhone("0917-123-4567")).toBe("+639171234567");
    expect(normalizePhone("+63 917 123 4567")).toBe("+639171234567");
    expect(normalizePhone("639171234567")).toBe("+639171234567");
    expect(normalizePhone("(033) 621 1234")).toBe("+63336211234");
    expect(normalizePhone("(02) 8123 4567")).toBe("+63281234567");
    expect(normalizePhone("")).toBe("");
  });

  it("refuses numbers that aren't Philippine", () => {
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("+1 415 555 0100")).toBeNull();
    expect(normalizePhone("0917 123 45678")).toBeNull();
  });
});

describe("updateProfile card fields", () => {
  let db;
  let id;
  beforeEach(async () => {
    db = await testDb();
    await seed(db);
    id = (await db.select().from(members).where(eq(members.slug, "judy-daliva")))[0].id;
  });
  const row = async () => (await db.select().from(members).where(eq(members.id, id)))[0];

  it("stores contact details and switches", async () => {
    const r = await updateProfile(db, id, {
      phone: "0917 123 4567", links: [{ url: "https://judy.ph", label: "My studio" }, { url: "https://facebook.com/judy" }],
      cardPublished: true, cardConsent: true, cardShowPhone: true, cardShowEmail: false,
    });
    expect(r.ok).toBe(true);
    expect(await row()).toMatchObject({
      phone: "+639171234567",
      links: [{ label: "My studio", url: "https://judy.ph/" }, { label: "Facebook", url: "https://facebook.com/judy" }],
      cardPublished: true, cardShowPhone: true, cardShowEmail: false,
    });
  });

  it("refuses a foreign phone, an http link, and publishing without consent", async () => {
    expect(await updateProfile(db, id, { phone: "+1 415 555 0100" })).toEqual({ ok: false, errors: ["Enter a Philippine number, e.g. 0917 123 4567"] });
    expect(await updateProfile(db, id, { links: [{ url: "https://judy.ph" }, { url: "http://judy.ph" }] })).toEqual({ ok: false, errors: ["Link 2: Use a full https:// link"] });
    expect(await updateProfile(db, id, { cardPublished: true })).toEqual({ ok: false, errors: ["Tick the consent box to publish your card"] });
  });
});

describe("updateProfile links list", () => {
  let db;
  let id;
  beforeEach(async () => {
    db = await testDb();
    await seed(db);
    id = (await db.select().from(members).where(eq(members.slug, "judy-daliva")))[0].id;
  });
  const links = async () => (await db.select().from(members).where(eq(members.id, id)))[0].links;

  it("drops blank rows and repeats, and names Discord, TikTok and others itself", async () => {
    await updateProfile(db, id, { links: [
      { url: "https://discord.gg/judy", label: "" },
      { url: "", label: "half-typed" },
      { url: "https://www.tiktok.com/@judy", label: "   " },
      { url: "https://discord.gg/judy", label: "again" },
    ] });
    expect(await links()).toEqual([{ label: "Discord", url: "https://discord.gg/judy" }, { label: "TikTok", url: "https://www.tiktok.com/@judy" }]);
  });

  it("caps the list, clears it when emptied, and leaves it alone when not sent", async () => {
    const eleven = Array.from({ length: 11 }, (_, i) => ({ url: `https://judy.ph/${i}` }));
    expect(await updateProfile(db, id, { links: eleven })).toEqual({ ok: false, errors: ["Add up to 10 links"] });
    await updateProfile(db, id, { links: [{ url: "https://judy.ph" }] });
    await updateProfile(db, id, { profession: "Engineer" });
    expect(await links()).toEqual([{ label: "Website", url: "https://judy.ph/" }]);
    await updateProfile(db, id, { links: [{ url: "", label: "" }] });
    expect(await links()).toBeNull();
  });
});

describe("card links are parsed, not pattern-matched", () => {
  let db;
  let id;
  beforeEach(async () => {
    db = await testDb();
    await seed(db);
    id = (await db.select().from(members).where(eq(members.slug, "judy-daliva")))[0].id;
  });
  const saved = async () => (await db.select().from(members).where(eq(members.id, id)))[0];
  const LINK = { ok: false, errors: ["Link 1: Use a full https:// link"] };
  const one = (url) => ({ links: [{ url }] });

  it("refuses links with credentials or without a real host", async () => {
    expect(await updateProfile(db, id, one("https://user:pass@evil.com"))).toEqual(LINK);
    expect(await updateProfile(db, id, one("https://evil"))).toEqual(LINK);
    expect(await updateProfile(db, id, one("https://"))).toEqual(LINK);
    expect(await updateProfile(db, id, one("javascript:alert(1)"))).toEqual(LINK);
  });

  it("stores the browser's reading of the link so nothing parses it differently later", async () => {
    expect((await updateProfile(db, id, one("https://good.ph\\@evil.com"))).ok).toBe(true);
    expect((await saved()).links).toEqual([{ label: "Website", url: "https://good.ph/@evil.com" }]);
  });
});
