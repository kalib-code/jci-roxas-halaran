import Link from "next/link";
import Image from "next/image";
import Contours from "@/components/Contours.jsx";
import { formatDate } from "@/lib/format.js";

const PILLARS = { leadership: "Leadership", community: "Community", global: "Global" };

export default function ProjectCard({ project }) {
  const date = formatDate(project.startDate);
  return (
    <article className="project">
      <Link href={`/projects/${project.slug}`} className="article-card__link">
        <figure>
          {project.coverUrl ? (
            <Image src={project.coverUrl} alt={project.coverAlt ?? project.title} fill sizes="(max-width: 560px) 100vw, (max-width: 900px) 50vw, 33vw" style={{ objectFit: "cover" }} />
          ) : (
            <div className={`project__placeholder project__placeholder--${PILLARS[project.pillar] ? project.pillar : "community"}`} aria-hidden="true">
              <Contours variant="quote" />
              <span className="project__pillar">{PILLARS[project.pillar] ?? PILLARS.community}</span>
              <strong className="project__tile-title">{project.title}</strong>
              {project.barangay && <span className="project__place">{project.barangay}</span>}
            </div>
          )}
        </figure>
        <div className="project__meta">
          <h3>{project.title}</h3>
          {date && (
            <time className="label label--sm" dateTime={project.startDate}>{date}</time>
          )}
        </div>
      </Link>
    </article>
  );
}
