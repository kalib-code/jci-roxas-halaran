import Link from "next/link";
import { formatPesos } from "@/lib/format.js";

export default function AdminTabs({ base, tabs, current }) {
  return (
    <nav className="admin-tabs" aria-label="Filter by status">
      {tabs.map((t) => (
        <Link key={t.key} href={`${base}?tab=${t.key}`} className={t.key === current ? "is-current" : undefined} aria-current={t.key === current ? "page" : undefined}>
          {t.label} <span className="admin-tabs__count">{t.count}</span>
          {t.total !== null && <span className="admin-tabs__total">{formatPesos(t.total)}</span>}
        </Link>
      ))}
    </nav>
  );
}
