import Link from "next/link";
import Image from "next/image";
import Contours from "@/components/Contours.jsx";
import { formatDate } from "@/lib/format.js";
import { CATEGORY_LABELS } from "@/lib/content/validation.js";

export default function ArticleCard({ article, featured = false }) {
  return (
    <article className={"project article-card" + (featured ? " article-card--featured" : "")}>
      <Link href={`/articles/${article.slug}`} className="article-card__link">
        <figure>
          {article.coverUrl ? (
            <Image src={article.coverUrl} alt={article.coverAlt ?? ""} fill sizes={featured ? "100vw" : "(max-width: 900px) 100vw, 33vw"} style={{ objectFit: "cover" }} />
          ) : (
            <div className="project__placeholder" aria-hidden="true"><Contours variant="quote" /><span>{CATEGORY_LABELS[article.category]}</span></div>
          )}
        </figure>
        <div className="project__meta">
          <h3>{article.title}</h3>
          <time className="label label--sm" dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
        </div>
        {article.metaDescription && <p className="article-card__excerpt">{article.metaDescription}</p>}
      </Link>
    </article>
  );
}
