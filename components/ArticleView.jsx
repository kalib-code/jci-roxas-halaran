import Link from "next/link";
import Image from "next/image";
import ArticleCard from "@/components/ArticleCard.jsx";
import { SafeHtml } from "@/components/SafeHtml.jsx";
import { formatDate } from "@/lib/format.js";
import { CATEGORY_LABELS } from "@/lib/content/validation.js";

export default function ArticleView({ article, related, project }) {
  return (
    <article className="article">
      <header className="page-hero article__head">
        <p className="label">
          <Link href={`/articles?category=${article.category}`}>{CATEGORY_LABELS[article.category]}</Link>
          {article.publishedAt && <> · <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time></>}
        </p>
        <h1>{article.title}</h1>
        <p className="article__byline">By {article.authorName ?? "JCI Roxas Halaran"}</p>
      </header>
      {article.coverUrl && (
        <figure className="article__cover">
          <Image src={article.coverUrl} alt={article.coverAlt ?? ""} fill sizes="100vw" style={{ objectFit: "cover" }} priority />
        </figure>
      )}
      <div className="section">
        <SafeHtml className="article-body" html={article.bodyHtml} />
        {project && (
          <p className="article__project">Part of our project <Link href={`/projects/${project.slug}`}>{project.title}</Link>.</p>
        )}
        <p className="section__more"><Link className="btn" href="/join">Join JCI Roxas Halaran</Link></p>
      </div>
      {related.length > 0 && (
        <section className="section section--line-top">
          <div className="section__bar"><h2>Related articles</h2><span className="label">Read next</span></div>
          <div className="projects">{related.map((a) => <ArticleCard key={a.id} article={a} />)}</div>
        </section>
      )}
    </article>
  );
}
