import Image from "next/image";
import { SITE } from "@/lib/site.js";
import { initials } from "@/lib/format.js";

// One card design for the public page, the member's own card page and the live editor preview.
export default function ECard({ card, qrSvg = null, nameAs = "p" }) {
  const Name = nameAs;
  return (
    <article className="ecard" aria-label={`${card.name}, e-calling card`}>
      <div className="ecard__brand"><Image src={SITE.logo} alt="JCI Roxas Halaran" width={83} height={40} /></div>
      <div className="ecard__who">
        <div className="ecard__photo">
          {card.photoUrl ? (
            <Image src={card.photoUrl} alt={card.name} fill sizes="120px" style={{ objectFit: "cover", objectPosition: "top" }} />
          ) : (
            <span aria-hidden="true">{initials(card.name)}</span>
          )}
        </div>
        <Name className="ecard__name">{card.name}</Name>
        <p className="ecard__role">{card.roleLine}</p>
        {(card.profession || card.business) && <p className="ecard__work">{[card.profession, card.business].filter(Boolean).join(" · ")}</p>}
      </div>
      <nav className="ecard__actions" aria-label="Contact">
        {card.phone && <a href={`tel:${card.phone}`}>Call</a>}
        {card.phone && <a href={`sms:${card.phone}`}>Text</a>}
        {card.email && <a href={`mailto:${card.email}`}>Email</a>}
        <a className="ecard__save" href={`/card/${card.slug}/vcard`}>Save contact</a>
      </nav>
      {card.links.length > 0 && (
        <ul className="ecard__links">
          {card.links.map((l) => <li key={l.label}><a href={l.url} target="_blank" rel="noopener noreferrer">{l.label}</a></li>)}
        </ul>
      )}
      {qrSvg && (
        <figure className="ecard__qr">
          <div role="img" aria-label="QR code for this card" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <figcaption>Scan to save my card</figcaption>
        </figure>
      )}
      {card.bio && <p className="ecard__bio">{card.bio}</p>}
    </article>
  );
}
