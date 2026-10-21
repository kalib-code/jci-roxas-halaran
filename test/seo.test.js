import { describe, it, expect } from "vitest";
import { SITE } from "@/lib/site.js";
import {
  absoluteUrl,
  pageMetadata,
  organizationLd,
  breadcrumbLd,
  buildSitemap,
} from "@/lib/seo.js";

describe("pageMetadata", () => {
  it("sets canonical, Open Graph and Twitter fields", () => {
    const m = pageMetadata({ title: "Our officers", description: "The board.", path: "/officers" });
    expect(m.title).toBe("Our officers");
    expect(m.alternates.canonical).toBe("/officers");
    expect(m.openGraph.url).toBe(`${SITE.url}/officers`);
    expect(m.openGraph.title).toBe("Our officers | JCI Roxas Halaran");
    expect(m.twitter.card).toBe("summary_large_image");
  });

  it("supports an absolute title for the home page", () => {
    const m = pageMetadata({ title: { absolute: "Home title" }, description: "d", path: "/" });
    expect(m.openGraph.title).toBe("Home title");
  });
});

describe("structured data", () => {
  it("describes the chapter as an NGO in Roxas City", () => {
    const ld = organizationLd();
    expect(ld["@type"]).toEqual(["NGO", "Organization"]);
    expect(ld.address.addressLocality).toBe("Roxas City");
    expect(ld.logo).toBe(absoluteUrl(SITE.logo));
  });

  it("builds breadcrumbs with positions and absolute URLs", () => {
    const ld = breadcrumbLd([{ name: "Home", path: "/" }, { name: "Officers", path: "/officers" }]);
    expect(ld.itemListElement[1]).toEqual({
      "@type": "ListItem",
      position: 2,
      name: "Officers",
      item: `${SITE.url}/officers`,
    });
  });
});

describe("buildSitemap", () => {
  it("lists every route with the home page first and highest", () => {
    const now = new Date("2026-10-21T00:00:00Z");
    const entries = buildSitemap(["/", "/about"], now);
    expect(entries).toEqual([
      { url: `${SITE.url}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
      { url: `${SITE.url}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    ]);
  });
});
