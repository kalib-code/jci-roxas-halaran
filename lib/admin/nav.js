export const ADMIN_GROUPS = [
  { label: null, links: [{ href: "/admin", label: "Dashboard" }] },
  { label: "Content", links: [{ href: "/admin/articles", label: "Articles" }, { href: "/admin/projects", label: "Projects" }, { href: "/admin/resources", label: "Resources" }, { href: "/admin/seo-plan", label: "SEO plan" }] },
  { label: "People", links: [{ href: "/admin/applications", label: "Applications", count: "applications" }, { href: "/admin/members", label: "Members" }, { href: "/admin/passport", label: "Passport", count: "passport" }] },
  { label: "Money", links: [{ href: "/admin/payments", label: "Payments", count: "payments" }, { href: "/admin/campaigns", label: "Campaigns" }, { href: "/admin/expenses", label: "Expenses" }] },
  { label: "Proof", links: [{ href: "/admin/events", label: "Events" }, { href: "/admin/evidence", label: "Evidence" }] },
];

// Officers and treasurers can open the admin area but only admins edit, so they get the dashboard alone.
export function adminNav(role, counts = {}) {
  const groups = role === "admin" ? ADMIN_GROUPS : ADMIN_GROUPS.slice(0, 1);
  return groups.map((g) => ({
    label: g.label,
    links: g.links.map(({ count, ...link }) => ({ ...link, badge: count && counts[count] > 0 ? counts[count] : null })),
  }));
}

const ROOTS = new Set(["/admin", "/members"]);

export const isCurrent = (href, pathname) =>
  ROOTS.has(href) ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
