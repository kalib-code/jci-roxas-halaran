import Link from "next/link";
import { formatDate, formatDateTime } from "@/lib/format.js";

// Open volunteer registrations for an event or project page, each linking to its sign-up page.
export default function VolunteerCalls({ drives }) {
  return (
    <ul className="volunteer-calls">
      {drives.map((d) => (
        <li key={d.id} className="volunteer-call">
          <div>
            <h3>{d.title}</h3>
            <p>{[d.startsAt && formatDateTime(d.startsAt), d.venue, d.closesOn && `Sign up by ${formatDate(d.closesOn)}`].filter(Boolean).join(" · ")}</p>
          </div>
          <Link className="btn" href={`/volunteer/${d.slug}`}>Sign up</Link>
        </li>
      ))}
    </ul>
  );
}
