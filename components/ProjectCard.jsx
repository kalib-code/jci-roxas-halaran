import Link from "next/link";
import Image from "next/image";
import Contours from "@/components/Contours.jsx";
import { formatDate } from "@/lib/format.js";

export const PILLARS = { leadership: "Leadership", community: "Community", global: "Global" };

export default function ProjectCard({ project }) {
  const date = formatDate(project.startDate);
  const pillar = PILLARS[project.pillar] ? project.pillar : "community";
  return (
    <article className="acard">
      <Link href={`/projects/${project.slug}`} className="acard__link">
        <figure className="acard__media">
          {project.coverUrl ? (
            <Image src={project.coverUrl} alt={project.coverAlt ?? project.title} fill sizes="(max-width: 560px) 96px, (max-width: 900px) 50vw, 33vw" style={{ objectFit: "cover" }} />
          ) : (
            <div className={`project__placeholder project__placeholder--${pillar}`} aria-hidden="true">
              <Contours variant="quote" />
              <span className="project__pillar">{PILLARS[pillar]}</span>
              <strong className="project__tile-title">{project.title}</strong>
              {project.barangay && <span className="project__place">{project.barangay}</span>}
            </div>
          )}
        </figure>
        <div className="acard__body">
          <p className="acard__cat">{PILLARS[pillar]}</p>
          <h3 className="acard__title">{project.title}</h3>
          <p className="acard__meta">
            {date && <time dateTime={project.startDate}>{date}</time>}
            {project.barangay && <span>{project.barangay}</span>}
          </p>
        </div>
      </Link>
    </article>
  );
}
