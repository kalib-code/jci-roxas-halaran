import Link from "next/link";
import SiteFooter from "@/components/SiteFooter.jsx";

export const metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <>
      <header className="page-hero">
        <h1>Page not found</h1>
        <p>This page may have moved. Try <Link href="/projects">our projects</Link>, <Link href="/officers">our officers</Link> or <Link href="/join">how to join</Link>.</p>
      </header>
      <SiteFooter />
    </>
  );
}
