import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { members } from "@/db/schema.js";
import { updateMemberPhotos } from "@/db/member-photos.js";
import { OFFICER_PHOTOS_2026 } from "@/db/seed-data.js";

const photo = async (db, slug) => (await db.select().from(members).where(eq(members.slug, slug)))[0].photoUrl;

describe("2026 officer photos", () => {
  it("cover all 13 members of the 2026 board", () => {
    expect(Object.keys(OFFICER_PHOTOS_2026)).toHaveLength(13);
  });

  it("are used by a fresh seed, so no 2026 officer lacks a photo", async () => {
    const db = await testDb();
    await seed(db);
    expect(await photo(db, "judy-daliva")).toBe("/assets/img/officer-2026-judy-daliva.jpg");
  });

  it("can be applied to an existing database, and running it twice changes nothing more", async () => {
    const db = await testDb();
    await seed(db);
    await db.update(members).set({ photoUrl: null }).where(eq(members.slug, "manuel-luis-luna"));
    expect(await updateMemberPhotos(db, OFFICER_PHOTOS_2026)).toBe(13);
    expect(await photo(db, "manuel-luis-luna")).toBe("/assets/img/officer-2026-manuel-luis-luna.jpg");
    expect(await updateMemberPhotos(db, OFFICER_PHOTOS_2026)).toBe(13);
  });

  it("leaves members outside the 2026 board alone", async () => {
    const db = await testDb();
    await seed(db);
    await updateMemberPhotos(db, OFFICER_PHOTOS_2026);
    expect(await photo(db, "lemuel-capa")).toBe("/assets/img/president-lemuel-capa.jpg");
  });
});
