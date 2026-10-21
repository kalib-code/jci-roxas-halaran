import Toc from "@/components/Toc.jsx";
import Link from "next/link";
import Image from "next/image";
import ArticleCard, { ArticleMeta } from "@/components/ArticleCard.jsx";
import { outlineBody } from "@/lib/articleBody.js";
import { CATEGORY_LABELS } from "@/lib/content/validation.js";

export default function ArticleView({ article, related, project }) {
  // outlineBody cleans the stored HTML before adding heading ids.
  const body = outlineBody(article.bodyHtml);
  return (
    <article className="article">
      <div className="read-progress" aria-hidden="true" />
      <header className="article__head">
        <p className="acard__cat">
          <Link href="/articles">Articles</Link> / <Link href={`/articles?category=${article.category}`}>{CATEGORY_LABELS[article.category]}</Link>
        </p>
        <h1>{article.title}</h1>
        {article.metaDescription && <p className="article__dek">{article.metaDescription}</p>}
        <div className="article__byline">
          <span>By {article.authorName ?? "JCI Roxas Halaran"}</span>
          <ArticleMeta article={article} />
        </div>
      </header>
      {article.coverUrl && (
        <figure className="article__cover article__cover--contained">
          <Image src={article.coverUrl} alt={article.coverAlt ?? ""} fill sizes="(max-width: 1200px) 100vw, 1100px" style={{ objectFit: "cover" }} priority />
        </figure>
      )}
      <div className="article__layout">
        <div className="article__main">
          <div className="article-body" dangerouslySetInnerHTML={{ __html: body.html }} />
          {project && (
            <p className="article__project">Part of our project <Link href={`/projects/${project.slug}`}>{project.title}</Link>.</p>
          )}
          <p className="section__more"><Link className="btn" href="/join">Join JCI Roxas Halaran</Link></p>
        </div>
        {body.headings.length > 2 && (
          <Toc headings={body.headings} />
        )}
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
