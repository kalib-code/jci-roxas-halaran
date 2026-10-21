import Link from "next/link";

export default function AdminNav({ isAdmin }) {
  return (
    <nav className="admin-nav" aria-label="Admin">
      <Link href="/admin">Dashboard</Link>
      {isAdmin && (
        <>
          <Link href="/admin/articles">Articles</Link>
          <Link href="/admin/projects">Projects</Link>
          <Link href="/admin/resources">Resources</Link>
          <Link href="/admin/seo-plan">SEO plan</Link>
        </>
      )}
    </nav>
  );
}
