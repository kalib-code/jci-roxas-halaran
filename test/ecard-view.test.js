import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { members } from "@/db/schema.js";
import { cardIsPublic, roleLine, cardView, vcard, profileCompleteness } from "@/lib/members/card-view.js";
import { getPublicCard } from "@/lib/members/ecard.js";
import { qrSvg, cardUrl, originFrom } from "@/lib/members/qr.js";

const base = {
  slug: "ana-cruz", name: "Ana Cruz", email: "ana@x.ph", phone: "+639171234567", status: "active",
  profession: "Architect", business: "Cruz, Ana; Design Studio", photoUrl: null, bio: "Hi", joinedAt: "2024-03-01",
  websiteUrl: "https://ana.ph", facebookUrl: null, linkedinUrl: "https://linkedin.com/in/ana", instagramUrl: null,
  cardPublished: true, cardShowPhone: false, cardShowEmail: true,
};

describe("cardIsPublic", () => {
  it("needs an active member who published", () => {
    expect(cardIsPublic(base)).toBe(true);
    expect(cardIsPublic({ ...base, status: "inactive" })).toBe(false);
    expect(cardIsPublic({ ...base, cardPublished: false })).toBe(false);
    expect(cardIsPublic(undefined)).toBe(false);
  });
});

describe("roleLine", () => {
  it("prefers the latest officer term, then the join year", () => {
    expect(roleLine(base, [{ role: "Director", year: 2025 }, { role: "Vice President", year: 2026 }])).toBe("Vice President 2026");
    expect(roleLine(base, [])).toBe("Member since 2024");
    expect(roleLine({ ...base, joinedAt: null }, [])).toBe("Member");
  });
});

describe("cardView", () => {
  it("applies the show/hide switches and keeps only set links", () => {
    const card = cardView(base, []);
    expect(card.phone).toBeNull();
    expect(card.email).toBe("ana@x.ph");
    expect(card.links).toEqual([{ label: "LinkedIn", url: "https://linkedin.com/in/ana" }, { label: "Website", url: "https://ana.ph" }]);
    expect(cardView({ ...base, cardShowPhone: true, cardShowEmail: false }, []).phone).toBe("+639171234567");
    expect(cardView({ ...base, cardShowEmail: false }, []).email).toBeNull();
  });
});

describe("vcard", () => {
  it("escapes special characters and leaves hidden fields out", () => {
    const text = vcard(cardView(base, []), "https://site.ph/card/ana-cruz");
    const lines = text.trim().split("\r\n");
    expect(lines[0]).toBe("BEGIN:VCARD");
    expect(lines).toContain("N:Cruz;Ana;;;");
    expect(lines).toContain("FN:Ana Cruz");
    expect(lines).toContain("ORG:Cruz\\, Ana\\; Design Studio");
    expect(lines).toContain("EMAIL;TYPE=INTERNET:ana@x.ph");
    expect(lines).toContain("URL:https://site.ph/card/ana-cruz");
    expect(lines.some((l) => l.startsWith("TEL"))).toBe(false);
    expect(lines.at(-1)).toBe("END:VCARD");
  });
});

describe("profileCompleteness", () => {
  it("lists what is missing", () => {
    expect(profileCompleteness({ photoUrl: null, profession: "x", skills: "", bio: "y", phone: null })).toEqual({ pct: 40, missing: ["photo", "skills", "phone"] });
  });
});

describe("getPublicCard", () => {
  let db;
  beforeEach(async () => {
    db = await testDb();
    await seed(db);
  });
  const set = (values) => db.update(members).set(values).where(eq(members.slug, "lemuel-capa"));

  it("returns the card only for an active member who published", async () => {
    expect(await getPublicCard(db, "lemuel-capa")).toBeNull();
    await set({ cardPublished: true });
    const card = await getPublicCard(db, "lemuel-capa");
    expect(card).toMatchObject({ slug: "lemuel-capa", name: "Lemuel J. Capa" });
    expect(card.roleLine).toMatch(/\d{4}$/);
    await set({ status: "inactive" });
    expect(await getPublicCard(db, "lemuel-capa")).toBeNull();
    expect(await getPublicCard(db, "nobody")).toBeNull();
  });
});

describe("qr helpers", () => {
  it("draws an SVG QR code and builds card URLs", async () => {
    expect(await qrSvg("https://site.ph/card/ana")).toMatch(/^<svg/);
    expect(cardUrl("https://site.ph/", "ana-cruz")).toBe("https://site.ph/card/ana-cruz");
    expect(originFrom(new Map([["host", "localhost:3100"]]))).toBe("http://localhost:3100");
    expect(originFrom(new Map([["x-forwarded-host", "jci.ph"], ["x-forwarded-proto", "https"], ["host", "internal"]]))).toBe("https://jci.ph");
  });
});
