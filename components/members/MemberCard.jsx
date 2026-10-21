import Image from "next/image";
import { initials } from "@/lib/format.js";

export default function MemberCard({ member }) {
  return (
    <div className="officer member-card">
      <figure>
        {member.photoUrl ? (
          <Image src={member.photoUrl} alt={member.name} fill sizes="(max-width: 560px) 100vw, 25vw" style={{ objectFit: "cover", objectPosition: "top" }} />
        ) : (
          <div className="initials" aria-hidden="true">{initials(member.name)}</div>
        )}
      </figure>
      <div className="officer__meta">
        <span className="name">{member.name}</span>
        {(member.profession || member.business) && <span className="role">{[member.profession, member.business].filter(Boolean).join(" · ")}</span>}
        {member.skills && <span className="member-card__skills">{member.skills}</span>}
      </div>
    </div>
  );
}
