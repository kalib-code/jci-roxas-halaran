import { describe, it, expect } from "vitest";
import { REDIRECTS } from "@/lib/redirects.js";
import { STATIC_ROUTES } from "@/lib/routes.js";

describe("REDIRECTS", () => {
  it("covers every old Webflow page", () => {
    const sources = REDIRECTS.map((r) => r.source);
    expect(sources).toEqual(expect.arrayContaining(["/about-us", "/our-officers", "/contact"]));
  });

  it("only points at pages that exist, with no chains", () => {
    for (const r of REDIRECTS) {
      expect(STATIC_ROUTES).toContain(r.destination);
      expect(REDIRECTS.map((x) => x.source)).not.toContain(r.destination);
      expect(r.permanent).toBe(true);
    }
  });

  it("never redirects a live page away", () => {
    for (const r of REDIRECTS) expect(STATIC_ROUTES).not.toContain(r.source);
  });
});
