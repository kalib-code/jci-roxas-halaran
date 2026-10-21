import { embedFor } from "@/lib/media.js";

// Embedded players for a project's videos and audio. Links that no longer
// match a trusted player are skipped rather than rendered.
export default function ProjectMedia({ items }) {
  const embeds = items.map((m) => ({ ...m, embed: embedFor(m.url) })).filter((m) => m.embed);
  if (embeds.length === 0) return null;
  return (
    <section className="section">
      <div className="section__bar"><h2>Watch and listen</h2><span className="label">Media</span></div>
      <div className="media-grid">
        {embeds.map(({ id, title, embed }) => (
          <figure key={id} className={`media media--${embed.kind}${embed.vertical ? " media--vertical" : ""}${embed.set ? " media--set" : ""}`}>
            <iframe
              src={embed.src}
              title={title}
              loading="lazy"
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
            <figcaption>{title}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
