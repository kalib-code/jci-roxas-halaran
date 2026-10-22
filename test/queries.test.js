import { describe, it, expect, beforeAll } from "vitest";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import {
  getCurrentBoard,
  getPastPresidents,
  listProjects,
  listFaqs,
  listAwards,
} from "@/lib/queries.js";

let db;
beforeAll(async () => {
  db = await testDb();
  await seed(db);
});

describe("getCurrentBoard", () => {
  it("returns the latest year's president separately from the board", async () => {
    const board = await getCurrentBoard(db);
    expect(board.year).toBe(2026);
    expect(board.president.name).toBe("Jaime Cortes M. Altavas");
    expect(board.officers).toHaveLength(12);
    expect(board.officers[0]).toMatchObject({
      name: "Lemuel J. Capa",
      role: "Immediate Past President",
    });
  });

  it("returns an empty board when there are no terms", async () => {
    const empty = await testDb();
    expect(await getCurrentBoard(empty)).toEqual({ year: null, president: null, officers: [] });
  });
});

describe("getPastPresidents", () => {
  it("lists earlier presidents, newest first", async () => {
    const past = await getPastPresidents(db, 2026);
    expect(past.map((p) => [p.name, p.year])).toEqual([
      ["Lemuel J. Capa", 2025],
      ["John Paul Sorongon", 2024],
    ]);
  });
});

describe("listProjects", () => {
  it("puts the newest projects first", async () => {
    const latest = await listProjects(db, { limit: 3 });
    expect(latest.map((p) => p.slug)).toEqual([
      "mural-marker-inauguration",
      "sampukanay-2026",
      "symposium-on-mens-mental-health",
    ]);
  });

  it("puts undated projects last", async () => {
    const all = await listProjects(db);
    expect(all).toHaveLength(11);
    expect(all.slice(-2).map((p) => p.slug)).toEqual(["sa-dagat", "hapag-ng-daigdig"]);
  });
});

describe("listFaqs and listAwards", () => {
  it("keeps FAQ order and sorts awards newest first", async () => {
    expect((await listFaqs(db))[0].question).toBe("What is JCI?");
    expect((await listAwards(db))[0].year).toBe(2026);
  });
});
