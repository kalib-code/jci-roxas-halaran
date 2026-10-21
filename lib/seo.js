import { SITE } from "./site.js";

export function absoluteUrl(path) {
  return new URL(path, `${SITE.url}/`).toString();
}

export function pageMetadata({ title, description, path, languages, locale = "en_PH" }) {
  const ogTitle = typeof title === "string" ? `${title} | ${SITE.name}` : title.absolute;
  const image = absoluteUrl(SITE.ogImage);
  return {
    title,
    description,
    alternates: languages ? { canonical: path, languages } : { canonical: path },
    openGraph: {
      title: ogTitle,
      description,
      url: absoluteUrl(path),
      siteName: SITE.name,
      locale,
      type: "website",
      images: [{ url: image }],
    },
    twitter: { card: "summary_large_image", title: ogTitle, description, images: [image] },
  };
}

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": ["NGO", "Organization"],
    name: SITE.name,
    url: absoluteUrl("/"),
    logo: absoluteUrl(SITE.logo),
    email: SITE.email,
    foundingDate: String(SITE.foundedYear),
    description: SITE.description,
    address: {
      "@type": "PostalAddress",
      addressLocality: SITE.address.locality,
      addressRegion: SITE.address.region,
      postalCode: SITE.address.postalCode,
      addressCountry: SITE.address.country,
    },
    sameAs: [SITE.facebookUrl],
    parentOrganization: {
      "@type": "Organization",
      name: "JCI Philippines",
      url: "https://jciphilippines.com",
    },
  };
}

export function breadcrumbLd(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function buildSitemap({ routes, articles = [], projects = [], events = [] }) {
  const entry = (path, updatedAt, priority) => ({
    url: absoluteUrl(path),
    ...(updatedAt ? { lastModified: new Date(updatedAt) } : {}),
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority,
  });
  return [
    ...routes.map((p) => entry(p, null, p === "/" ? 1 : 0.7)),
    ...articles.map((a) => entry(`/articles/${a.slug}`, a.updatedAt, 0.8)),
    ...projects.map((p) => entry(`/projects/${p.slug}`, p.updatedAt, 0.6)),
    ...events.map((e) => entry(`/events/${e.slug}`, e.updatedAt, 0.7)),
  ];
}

export function articleLd(article) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.metaDescription,
    image: article.coverUrl ?? absoluteUrl(SITE.ogImage),
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: article.authorName
      ? { "@type": "Person", name: article.authorName }
      : { "@type": "Organization", name: SITE.name },
    publisher: { "@type": "Organization", name: SITE.name, logo: { "@type": "ImageObject", url: absoluteUrl(SITE.logo) } },
    mainEntityOfPage: absoluteUrl(`/articles/${article.slug}`),
  };
}

export function eventLd(event) {
  const ph = (local) => (local ? `${local.slice(0, 16)}:00+08:00` : undefined);
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: (event.description ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || undefined,
    startDate: ph(event.startAt),
    endDate: ph(event.endAt),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: event.venue ?? "Roxas City, Capiz",
      address: { "@type": "PostalAddress", addressLocality: SITE.address.locality, addressRegion: SITE.address.region, addressCountry: SITE.address.country },
    },
    image: event.coverUrl ?? absoluteUrl(SITE.ogImage),
    organizer: { "@type": "Organization", name: SITE.name, url: absoluteUrl("/") },
    url: absoluteUrl(`/events/${event.slug}`),
  };
}
