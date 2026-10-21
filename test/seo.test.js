import { describe, it, expect } from "vitest";
import { SITE } from "@/lib/site.js";
import {
  absoluteUrl,
  pageMetadata,
  organizationLd,
  breadcrumbLd,
  buildSitemap,
  articleLd,
  eventLd,
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
  it("lists static routes without dates and content with its real update time", () => {
    const entries = buildSitemap({
      routes: ["/", "/about"],
      articles: [{ slug: "rizal-day", updatedAt: "2026-11-01T00:00:00.000Z" }],
      projects: [{ slug: "coastline-cuts", updatedAt: null }],
    });
    expect(entries).toEqual([
      { url: `${SITE.url}/`, changeFrequency: "weekly", priority: 1 },
      { url: `${SITE.url}/about`, changeFrequency: "monthly", priority: 0.7 },
      { url: `${SITE.url}/articles/rizal-day`, lastModified: new Date("2026-11-01T00:00:00.000Z"), changeFrequency: "monthly", priority: 0.8 },
      { url: `${SITE.url}/projects/coastline-cuts`, changeFrequency: "monthly", priority: 0.6 },
    ]);
  });
});

describe("articleLd", () => {
  const article = {
    slug: "rizal-day",
    title: "Rizal Day",
    metaDescription: "What Filipinos commemorate.",
    coverUrl: null,
    publishedAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-02T00:00:00.000Z",
    authorName: null,
  };

  it("describes an article by the chapter when there is no author", () => {
    const ld = articleLd(article);
    expect(ld).toMatchObject({
      "@type": "Article",
      headline: "Rizal Day",
      datePublished: "2026-11-01T00:00:00.000Z",
      dateModified: "2026-11-02T00:00:00.000Z",
      author: { "@type": "Organization", name: "JCI Roxas Halaran" },
      mainEntityOfPage: `${SITE.url}/articles/rizal-day`,
    });
    expect(ld.image).toBe(absoluteUrl(SITE.ogImage));
  });

  it("credits a named member as a Person", () => {
    expect(articleLd({ ...article, authorName: "Judy Daliva" }).author).toEqual({ "@type": "Person", name: "Judy Daliva" });
  });
});

describe("eventLd", () => {
  it("describes an in-person event in Roxas City with PH times", () => {
    const ld = eventLd({ slug: "ga", title: "General Assembly", description: "<p>Hi</p>", startAt: "2027-01-15T18:00", endAt: null, venue: "Capiz Gym", coverUrl: null });
    expect(ld).toMatchObject({
      "@type": "Event",
      name: "General Assembly",
      startDate: "2027-01-15T18:00:00+08:00",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      location: { "@type": "Place", name: "Capiz Gym", address: { addressLocality: "Roxas City" } },
      url: `${SITE.url}/events/ga`,
      description: "Hi",
    });
  });
});

describe("buildSitemap with events", () => {
  it("adds event pages", () => {
    const entries = buildSitemap({ routes: [], events: [{ slug: "ga", updatedAt: "2026-11-01T00:00:00.000Z" }] });
    expect(entries[0].url).toBe(`${SITE.url}/events/ga`);
  });
});

describe("pageMetadata languages", () => {
  it("adds hreflang alternates and a locale when given", () => {
    const m = pageMetadata({ title: "Mangin miyembro", description: "d", path: "/hil/join", languages: { en: "/join", hil: "/hil/join" }, locale: "hil_PH" });
    expect(m.alternates).toEqual({ canonical: "/hil/join", languages: { en: "/join", hil: "/hil/join" } });
    expect(m.openGraph.locale).toBe("hil_PH");
  });
});
