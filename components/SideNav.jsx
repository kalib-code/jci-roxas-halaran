"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isCurrent } from "@/lib/admin/nav.js";

// Grouped sidebar shared by the admin and members areas; children render in its footer.
export default function SideNav({ groups, ariaLabel, children }) {
  const pathname = usePathname() ?? "";
  return (
    <nav className="admin-side" aria-label={ariaLabel}>
      {groups.map((g) => (
        <div className="admin-side__group" key={g.label ?? "main"}>
          {g.label && <span className="admin-side__label">{g.label}</span>}
          {g.links.map((l) => {
            const current = isCurrent(l.href, pathname);
            return (
              <Link key={l.href} href={l.href} className={current ? "is-current" : undefined} aria-current={current ? "page" : undefined}>
                {l.label}
                {l.badge ? <span className="admin-side__badge" aria-label={`${l.badge} waiting`}>{l.badge}</span> : null}
              </Link>
            );
          })}
        </div>
      ))}
      {children && <div className="admin-side__foot">{children}</div>}
    </nav>
  );
}
