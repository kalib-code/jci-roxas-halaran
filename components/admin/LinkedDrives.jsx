import Link from "next/link";
import { driveIsOpen } from "@/lib/engagement/volunteers.js";

// On an event or project's admin page: its volunteer registrations, and a
// one-click way to make one filled in from it.
export default function LinkedDrives({ drives, newHref }) {
  return (
    <section className="linked-drives" aria-labelledby="linked-drives-h">
      <h2 className="syne" id="linked-drives-h">Volunteers</h2>
      {drives.length > 0 ? (
        <ul>
          {drives.map((d) => (
            <li key={d.id}>
              <Link href={`/admin/volunteers/${d.id}`}>{d.title}</Link>{" "}
              <span className={`badge ${driveIsOpen(d) ? "badge--ok" : "badge--neutral"}`}>{driveIsOpen(d) ? "Open" : "Closed"}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="count">No volunteer registration yet. Make one to get a sign-up link and QR code with roles and spots.</p>
      )}
      <p><Link className="tool" href={newHref}>Make a volunteer registration</Link></p>
    </section>
  );
}
