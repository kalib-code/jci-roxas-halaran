import Link from "next/link";

export default function AdminNav({ isAdmin }) {
  return (
    <nav className="admin-nav" aria-label="Admin">
      <Link href="/admin">Dashboard</Link>
      {isAdmin && (
        <>
          <Link href="/admin/articles">Articles</Link>
          <Link href="/admin/projects">Projects</Link>
          <Link href="/admin/events">Events</Link>
          <Link href="/admin/applications">Applications</Link>
          <Link href="/admin/payments">Payments</Link>
          <Link href="/admin/campaigns">Campaigns</Link>
          <Link href="/admin/expenses">Expenses</Link>
          <Link href="/admin/members">Members</Link>
          <Link href="/admin/passport">Passport</Link>
          <Link href="/admin/resources">Resources</Link>
          <Link href="/admin/seo-plan">SEO plan</Link>
        </>
      )}
    </nav>
  );
}
