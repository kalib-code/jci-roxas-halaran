import Link from "next/link";
import ArticleCard from "@/components/ArticleCard.jsx";
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import { getDb } from "@/lib/db.js";
import { listPublishedArticles } from "@/lib/content/articles.js";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/content/validation.js";
import { pageMetadata, breadcrumbLd } from "@/lib/seo.js";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: "Articles",
  description: "Stories, guides and Capiz history from JCI Roxas Halaran: leadership, community, business and Philippine holidays.",
  path: "/articles",
});

export default async function Articles({ searchParams }) {
  const { category } = await searchParams;
  const active = CATEGORIES.includes(category) ? category : undefined;
  const list = await listPublishedArticles(getDb(), { category: active });
  const [first, ...rest] = list;
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Articles", path: "/articles" }])} />
      <header className="page-hero">
        <h1>Articles</h1>
        <p>Guides, stories and Capiz history from the chapter.</p>
      </header>
      <section className="section">
        <nav className="chips" aria-label="Filter by category">
          <Link href="/articles" aria-current={active ? undefined : "page"}>All</Link>
          {CATEGORIES.map((c) => (
            <Link key={c} href={`/articles?category=${c}`} aria-current={active === c ? "page" : undefined}>{CATEGORY_LABELS[c]}</Link>
          ))}
        </nav>
        {list.length === 0 && <p>No articles here yet.</p>}
        {first && <ArticleCard article={first} featured />}
        {rest.length > 0 && <div className="article-grid">{rest.map((a) => <ArticleCard key={a.id} article={a} />)}</div>}
      </section>
      <SiteFooter />
    </>
  );
}
