import { eq } from "drizzle-orm";
import { payments, expenses, campaigns, projects } from "../../db/schema.js";
import { phToday } from "../format.js";

const paymentYear = (p) => phToday(p.confirmedAt ?? p.createdAt).slice(0, 4);
const sum = (rows) => rows.reduce((s, r) => s + r.amountCentavos, 0);

async function confirmed(db) {
  return db.select().from(payments).where(eq(payments.status, "confirmed"));
}

export async function transparencyYears(db) {
  const [pays, exps] = await Promise.all([confirmed(db), db.select({ spentOn: expenses.spentOn }).from(expenses)]);
  const years = new Set([...pays.map(paymentYear), ...exps.map((e) => e.spentOn.slice(0, 4))]);
  return [...years].sort().reverse();
}

export async function transparencyForYear(db, year) {
  const [allPays, allExps, camps, projs] = await Promise.all([
    confirmed(db),
    db.select().from(expenses),
    db.select().from(campaigns),
    db.select({ id: projects.id, title: projects.title, slug: projects.slug }).from(projects),
  ]);
  const pays = allPays.filter((p) => paymentYear(p) === year);
  const exps = allExps.filter((e) => e.spentOn.startsWith(year));
  const byType = (type) => sum(pays.filter((p) => p.type === type));
  const income = { donation: byType("donation"), sponsorship: byType("sponsorship"), membership_fee: byType("membership_fee") };
  income.total = income.donation + income.sponsorship + income.membership_fee;
  const expensesTotal = sum(exps);
  const titleOf = (list, id) => list.find((x) => x.id === id)?.title ?? null;

  return {
    year,
    income,
    expensesTotal,
    balance: income.total - expensesTotal,
    campaigns: camps
      .map((c) => ({
        id: c.id,
        title: c.title,
        goalCentavos: c.goalCentavos,
        raised: sum(pays.filter((p) => p.campaignId === c.id)),
        spent: sum(exps.filter((e) => e.campaignId === c.id)),
      }))
      .filter((c) => c.raised || c.spent),
    projects: projs
      .map((p) => ({ id: p.id, title: p.title, slug: p.slug, spent: sum(exps.filter((e) => e.projectId === p.id)) }))
      .filter((p) => p.spent),
    items: exps
      .sort((a, b) => b.spentOn.localeCompare(a.spentOn) || b.id - a.id)
      .map((e) => ({
        id: e.id,
        spentOn: e.spentOn,
        description: e.description,
        amountCentavos: e.amountCentavos,
        projectTitle: titleOf(projs, e.projectId),
        campaignTitle: titleOf(camps, e.campaignId),
      })),
  };
}
