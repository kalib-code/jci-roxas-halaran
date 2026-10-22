import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { members } from "@/db/schema.js";
import { importRoster, nameKey } from "@/db/import-roster.js";

const bySlug = async (db, slug) => (await db.select().from(members).where(eq(members.slug, slug)))[0];

describe("nameKey", () => {
  it("ignores middle initials and suffixes", () => {
    expect(nameKey("Jaime Cortes M. Altavas")).toBe(nameKey("Jaime Cortes Altavas"));
    expect(nameKey("Elmer F. Jimenez, Jr.")).toBe(nameKey("Elmer D. Jimenez Jr."));
    expect(nameKey("Mark Vincent D. Bernas")).not.toBe(nameKey("Christopher Bryan C. Bernas"));
  });
});

describe("importRoster", () => {
  it("fills contacts on existing members and takes the roster's spelling of the name", async () => {
    const db = await testDb();
    await seed(db);
    await db.update(members).set({ name: "Jasper L. Sayo" }).where(eq(members.slug, "jasper-sayo"));
    const r = await importRoster(db, [{ name: "Jasper T. Sayo", email: "Jasper@X.ph", phone: "0917 000 0001" }]);
    expect(r.filled).toEqual(["Jasper L. Sayo (name, email, phone)"]);
    const jasper = await bySlug(db, "jasper-sayo");
    expect(jasper).toMatchObject({ name: "Jasper T. Sayo", email: "jasper@x.ph", phone: "+639170000001" });
  });

  it("adds new people as private, active members in the house slug style", async () => {
    const db = await testDb();
    await seed(db);
    const r = await importRoster(db, [{ name: "Richard Mert D. Borlado", email: "r@x.ph" }, { name: "Karl Alibuas" }]);
    expect(r.added).toEqual(["Richard Mert D. Borlado", "Karl Alibuas"]);
    expect(await bySlug(db, "richard-mert-borlado")).toMatchObject({ status: "active", inDirectory: false, email: "r@x.ph" });
    expect(await bySlug(db, "karl-alibuas")).toMatchObject({ email: null, phone: null });
  });

  it("never overwrites stored contacts, so a re-run changes nothing", async () => {
    const db = await testDb();
    await seed(db);
    await db.update(members).set({ email: "judy@admin.ph" }).where(eq(members.slug, "judy-daliva"));
    const rows = [{ name: "Judy J. Daliva", email: "judy@list.ph" }, { name: "Kim Carlo Dicon" }];
    await importRoster(db, rows);
    const again = await importRoster(db, rows);
    expect(again).toMatchObject({ added: [], filled: [] });
    expect((await bySlug(db, "judy-daliva")).email).toBe("judy@admin.ph");
  });

  it("won't put an email on a member it can't tell apart from another", async () => {
    const db = await testDb();
    await seed(db);
    await db.insert(members).values({ slug: "jaime-altavas-2", name: "Jaime R. Altavas" });
    const r = await importRoster(db, [
      { name: "Jaime Cortes M. Altavas", email: "a@x.ph" },
      { name: "Jaime Miguel Dadivas Sr.", email: "b@x.ph" },
      { name: "Manuel Jose Luna", email: "c@x.ph" },
    ]);
    expect(r.needsReview).toEqual([
      "Jaime Cortes M. Altavas ~ Jaime Cortes M. Altavas / Jaime R. Altavas",
      "Manuel Jose Luna ~ Manuel Luis Luna",
    ]);
    expect(r.filled).toEqual(["Jaime Miguel Dadivas (name, email)"]);
    expect((await bySlug(db, "manuel-luis-luna")).email).toBeNull();
  });

  it("skips a phone that isn't a Philippine number and says so", async () => {
    const db = await testDb();
    await seed(db);
    const r = await importRoster(db, [{ name: "Ergin Tamano", phone: "12345" }]);
    expect(r.badPhones).toEqual(["Ergin Tamano: 12345"]);
    expect((await bySlug(db, "ergin-tamano")).phone).toBeNull();
  });
});
