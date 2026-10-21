import { SITE } from "./site.js";

export function absoluteUrl(path) {
  return new URL(path, `${SITE.url}/`).toString();
}

export function pageMetadata({ title, description, path }) {
  const ogTitle = typeof title === "string" ? `${title} | ${SITE.name}` : title.absolute;
  const image = absoluteUrl(SITE.ogImage);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: ogTitle,
      description,
      url: absoluteUrl(path),
      siteName: SITE.name,
      locale: "en_PH",
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

export function buildSitemap({ routes, articles = [], projects = [] }) {
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
