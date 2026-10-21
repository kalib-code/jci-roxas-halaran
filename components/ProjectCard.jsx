import Image from "next/image";
import Contours from "@/components/Contours.jsx";
import { formatDate } from "@/lib/format.js";

export default function ProjectCard({ project }) {
  const date = formatDate(project.startDate);
  return (
    <article className="project">
      <figure>
        {project.coverUrl ? (
          <Image src={project.coverUrl} alt={project.coverAlt ?? project.title} fill sizes="(max-width: 560px) 100vw, (max-width: 900px) 50vw, 33vw" style={{ objectFit: "cover" }} />
        ) : (
          <div className="project__placeholder" aria-hidden="true">
            <Contours variant="quote" />
            <span>JCI Roxas Halaran</span>
          </div>
        )}
      </figure>
      <div className="project__meta">
        <h3>{project.title}</h3>
        {date && (
          <time className="label label--sm" dateTime={project.startDate}>{date}</time>
        )}
      </div>
    </article>
  );
}
