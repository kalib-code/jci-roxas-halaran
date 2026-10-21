import Image from "next/image";
import { initials } from "@/lib/format.js";

export default function OfficerCard({ officer }) {
  return (
    <div className="officer">
      <figure>
        {officer.photoUrl ? (
          <Image src={officer.photoUrl} alt={officer.name} fill sizes="(max-width: 560px) 100vw, (max-width: 900px) 50vw, 25vw" style={{ objectFit: "cover", objectPosition: "top" }} />
        ) : (
          <div className="initials" aria-hidden="true">{initials(officer.name)}</div>
        )}
      </figure>
      <div className="officer__meta">
        <span className="name">{officer.name}</span>
        <span className="role">{officer.role}</span>
      </div>
    </div>
  );
}
