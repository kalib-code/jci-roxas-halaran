import Link from "next/link";
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import { getDb } from "@/lib/db.js";
import { transparencyYears, transparencyForYear } from "@/lib/proof/transparency.js";
import { formatDate, formatPesos, phNow } from "@/lib/format.js";
import { pageMetadata, breadcrumbLd } from "@/lib/seo.js";

export const metadata = pageMetadata({
  title: "Transparency",
  description: "How JCI Roxas Halaran raises and spends money: confirmed donations, sponsorships and fees, and every expense, by year.",
  path: "/transparency",
});

export default async function Transparency({ searchParams }) {
  const db = getDb();
  const years = await transparencyYears(db);
  const { year: asked } = await searchParams;
  const current = phNow().slice(0, 4);
  const year = years.includes(asked) ? asked : years[0] ?? current;
  const y = await transparencyForYear(db, year);
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Transparency", path: "/transparency" }])} />
      <header className="page-hero">
        <h1>Transparency</h1>
        <p>Every peso in and out. Only payments our treasurer confirmed are counted; donor names are never shown.</p>
        {years.length > 1 && (
          <p className="actions category-filter">
            {years.map((yr) => <Link key={yr} href={`/transparency?year=${yr}`} aria-current={yr === year ? "page" : undefined}>{yr}</Link>)}
          </p>
        )}
      </header>
      <section className="section">
        <div className="section__bar"><h2>{year} at a glance</h2><span className="label">Summary</span></div>
        <div className="stats">
          <div className="stat"><span className="v">{formatPesos(y.income.total)}</span><span className="l">Money in</span></div>
          <div className="stat"><span className="v">{formatPesos(y.expensesTotal)}</span><span className="l">Money out</span></div>
          <div className="stat"><span className="v">{formatPesos(y.balance)}</span><span className="l">Balance</span></div>
        </div>
        <table className="admin-table money-table">
          <tbody>
            <tr><td>Donations</td><td>{formatPesos(y.income.donation)}</td></tr>
            <tr><td>Sponsorships</td><td>{formatPesos(y.income.sponsorship)}</td></tr>
            <tr><td>Membership fees</td><td>{formatPesos(y.income.membership_fee)}</td></tr>
          </tbody>
        </table>
      </section>
      {y.campaigns.length > 0 && (
        <section className="section">
          <div className="section__bar"><h2>Campaigns</h2><span className="label">Raised vs spent</span></div>
          <table className="admin-table money-table">
            <thead><tr><th>Campaign</th><th>Goal</th><th>Raised</th><th>Spent</th></tr></thead>
            <tbody>{y.campaigns.map((c) => <tr key={c.id}><td>{c.title}</td><td>{formatPesos(c.goalCentavos)}</td><td>{formatPesos(c.raised)}</td><td>{formatPesos(c.spent)}</td></tr>)}</tbody>
          </table>
        </section>
      )}
      {y.projects.length > 0 && (
        <section className="section">
          <div className="section__bar"><h2>Spending by project</h2><span className="label">Projects</span></div>
          <table className="admin-table money-table">
            <tbody>{y.projects.map((p) => <tr key={p.id}><td><Link href={`/projects/${p.slug}`}>{p.title}</Link></td><td>{formatPesos(p.spent)}</td></tr>)}</tbody>
          </table>
        </section>
      )}
      <section className="section">
        <div className="section__bar"><h2>Expenses</h2><span className="label">{y.items.length} items</span></div>
        {y.items.length === 0 ? <p>No expenses recorded for {year} yet.</p> : (
          <table className="admin-table money-table">
            <thead><tr><th>Date</th><th>What</th><th>For</th><th>Amount</th></tr></thead>
            <tbody>{y.items.map((e) => <tr key={e.id}><td>{formatDate(e.spentOn)}</td><td>{e.description}</td><td>{e.projectTitle ?? e.campaignTitle ?? "General"}</td><td>{formatPesos(e.amountCentavos)}</td></tr>)}</tbody>
          </table>
        )}
      </section>
      <SiteFooter />
    </>
  );
}
