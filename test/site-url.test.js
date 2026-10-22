import { describe, it, expect, vi, afterEach } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("SITE.url", () => {
  it("falls back to the www domain, which is where the site is served", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined);
    const { SITE } = await import("@/lib/site.js");
    expect(SITE.url).toBe("https://www.jciroxashalaran.com");
  });
  it("uses NEXT_PUBLIC_SITE_URL without a trailing slash", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.jciroxashalaran.com/");
    const { SITE } = await import("@/lib/site.js");
    expect(SITE.url).toBe("https://www.jciroxashalaran.com");
  });
});
