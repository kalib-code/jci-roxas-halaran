const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function todoCards(counts, drafts) {
  const card = (href, title, n, text) => ({ href, title, text: n > 0 ? text(n) : "All caught up", badge: n > 0 ? n : null });
  return [
    card("/admin/applications", "Applications", counts.applications ?? 0, (n) => `${n} waiting for review`),
    card("/admin/payments", "Payments", counts.payments ?? 0, (n) => `${n} to confirm`),
    card("/admin/passport", "Passport requests", counts.passport ?? 0, (n) => `${n} to verify`),
    { href: "/admin/articles", title: "Drafts", text: drafts > 0 ? `${plural(drafts, "draft")} in progress` : "No drafts", badge: null },
  ];
}
