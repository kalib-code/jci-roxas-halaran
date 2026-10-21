import { notFound } from "next/navigation";
import ArticleView from "@/components/ArticleView.jsx";
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import { getDb } from "@/lib/db.js";
import { getPublishedArticle, listPublishedArticles, relatedArticles } from "@/lib/content/articles.js";
import { getProject } from "@/lib/content/projects.js";
import { pageMetadata, breadcrumbLd, articleLd } from "@/lib/seo.js";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  return (await listPublishedArticles(getDb())).map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const article = await getPublishedArticle(getDb(), slug);
  if (!article) return { title: "Page not found", robots: { index: false } };
  const meta = pageMetadata({ title: article.title, description: article.metaDescription, path: `/articles/${slug}` });
  if (article.coverUrl) {
    meta.openGraph.images = [{ url: article.coverUrl }];
    meta.twitter.images = [article.coverUrl];
  }
  meta.openGraph.type = "article";
  return meta;
}

export default async function ArticlePage({ params }) {
  const { slug } = await params;
  const db = getDb();
  const article = await getPublishedArticle(db, slug);
  if (!article) notFound();
  const [related, project] = await Promise.all([
    relatedArticles(db, article),
    article.projectId ? getProject(db, article.projectId) : null,
  ]);
  return (
    <>
      <JsonLd data={articleLd(article)} />
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Articles", path: "/articles" }, { name: article.title, path: `/articles/${slug}` }])} />
      <ArticleView article={article} related={related} project={project} />
      <SiteFooter />
    </>
  );
}
