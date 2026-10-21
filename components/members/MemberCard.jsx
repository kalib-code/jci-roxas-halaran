import Image from "next/image";
import Link from "next/link";
import { initials } from "@/lib/format.js";

export default function MemberCard({ member }) {
  const skills = (member.skills ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 4);
  return (
    <article className="mtile">
      <div className="mtile__photo">
        {member.photoUrl ? (
          <Image src={member.photoUrl} alt={member.name} fill sizes="72px" style={{ objectFit: "cover", objectPosition: "top" }} />
        ) : (
          <span aria-hidden="true">{initials(member.name)}</span>
        )}
      </div>
      <div className="mtile__body">
        <h3 className="mtile__name">{member.name}</h3>
        {(member.profession || member.business) && <p className="mtile__work">{[member.profession, member.business].filter(Boolean).join(" · ")}</p>}
        {skills.length > 0 && <ul className="mtile__skills">{skills.map((s) => <li key={s}>{s}</li>)}</ul>}
        {member.cardPublished && <Link className="mtile__card" href={`/card/${member.slug}`} aria-label={`View ${member.name}'s card`}>View card</Link>}
      </div>
    </article>
  );
}
