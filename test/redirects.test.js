import { describe, it, expect } from "vitest";
import { REDIRECTS, HOST_REDIRECTS } from "@/lib/redirects.js";
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

describe("HOST_REDIRECTS", () => {
  it("sends only the production vercel.app alias to the www domain, keeping the path", () => {
    expect(HOST_REDIRECTS).toEqual([
      expect.objectContaining({
        source: "/:path*",
        has: [{ type: "host", value: "jci-roxas-halaran.vercel.app" }],
        destination: "https://www.jciroxashalaran.com/:path*",
        permanent: true,
      }),
    ]);
  });
});
