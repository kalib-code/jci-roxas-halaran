import { describe, it, expect, beforeEach } from "vitest";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { parseCoordinates, inPhilippines } from "@/lib/proof/location.js";
import { setProjectMetrics, listProjectMetrics } from "@/lib/proof/metrics.js";
import { saveProject, getProjectBySlug } from "@/lib/content/projects.js";

let db;
beforeEach(async () => {
  db = await testDb();
  await seed(db);
});

describe("coordinates", () => {
  it("reads a plain pair and a Google Maps link", () => {
    expect(parseCoordinates("11.5853, 122.7511")).toEqual({ lat: 11.5853, lng: 122.7511 });
    expect(parseCoordinates("https://www.google.com/maps/place/Baybay/@11.6047,122.7339,15z/data")).toEqual({ lat: 11.6047, lng: 122.7339 });
    expect(parseCoordinates("Roxas City")).toBeNull();
  });

  it("checks the Philippines bounds", () => {
    expect(inPhilippines(11.58, 122.75)).toBe(true);
    expect(inPhilippines(51.5, -0.12)).toBe(false);
  });

  it("saves a project location and refuses one outside the Philippines", async () => {
    const p = await getProjectBySlug(db, "coastline-cuts");
    const ok = await saveProject(db, { id: p.id, expectedUpdatedAt: p.updatedAt, title: p.title, lat: "11.6047", lng: "122.7339", barangay: "Baybay" }, {});
    expect(ok.project).toMatchObject({ lat: 11.6047, lng: 122.7339, barangay: "Baybay" });
    const bad = await saveProject(db, { id: p.id, expectedUpdatedAt: ok.project.updatedAt, title: p.title, lat: "51.5", lng: "-0.12" }, {});
    expect(bad).toEqual({ ok: false, errors: ["Use coordinates inside the Philippines, e.g. 11.5853, 122.7511"] });
  });

  it("requires both coordinates or neither", async () => {
    const p = await getProjectBySlug(db, "coastline-cuts");
    expect((await saveProject(db, { id: p.id, expectedUpdatedAt: p.updatedAt, title: p.title, lat: "11.6" }, {})).ok).toBe(false);
  });
});

describe("impact metrics", () => {
  it("replaces a project's metrics and keeps the last value for a repeated metric", async () => {
    const p = await getProjectBySlug(db, "coastline-cuts");
    await setProjectMetrics(db, p.id, [{ metric: "trees_planted", value: "100" }]);
    const r = await setProjectMetrics(db, p.id, [
      { metric: "people_reached", value: 50 },
      { metric: "trees_planted", value: 120 },
      { metric: "trees_planted", value: 150 },
    ]);
    expect(r.ok).toBe(true);
    const rows = await listProjectMetrics(db, p.id);
    expect(Object.fromEntries(rows.map((m) => [m.metric, m.value]))).toEqual({ people_reached: 50, trees_planted: 150 });
  });

  it("refuses unknown metrics and fractional values", async () => {
    const p = await getProjectBySlug(db, "coastline-cuts");
    expect((await setProjectMetrics(db, p.id, [{ metric: "bananas", value: 1 }])).ok).toBe(false);
    expect((await setProjectMetrics(db, p.id, [{ metric: "volunteers", value: 2.5 }])).ok).toBe(false);
  });
});
