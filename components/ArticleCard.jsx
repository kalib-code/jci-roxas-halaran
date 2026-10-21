import Link from "next/link";
import Image from "next/image";
import Contours from "@/components/Contours.jsx";
import { formatDate, readingTime } from "@/lib/format.js";
import { CATEGORY_LABELS } from "@/lib/content/validation.js";

export function ArticleMeta({ article }) {
  const minutes = readingTime(article.bodyHtml);
  return (
    <p className="acard__meta">
      {article.publishedAt && <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>}
      {minutes && <span>{minutes}</span>}
    </p>
  );
}

export default function ArticleCard({ article, featured = false }) {
  const Heading = featured ? "h2" : "h3";
  return (
    <article className={"acard" + (featured ? " acard--featured" : "")}>
      <Link href={`/articles/${article.slug}`} className="acard__link">
        <figure className="acard__media">
          {article.coverUrl ? (
            <Image
              src={article.coverUrl}
              alt={article.coverAlt ?? ""}
              fill
              sizes={featured ? "(max-width: 900px) 100vw, 58vw" : "(max-width: 560px) 96px, (max-width: 900px) 50vw, 33vw"}
              style={{ objectFit: "cover" }}
              priority={featured}
            />
          ) : (
            <div className="project__placeholder" aria-hidden="true"><Contours variant="quote" /></div>
          )}
        </figure>
        <div className="acard__body">
          <p className="acard__cat">{CATEGORY_LABELS[article.category]}</p>
          <Heading className="acard__title">{article.title}</Heading>
          {article.metaDescription && <p className="acard__excerpt">{article.metaDescription}</p>}
          <ArticleMeta article={article} />
        </div>
      </Link>
    </article>
  );
}
