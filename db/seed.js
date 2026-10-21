import { count } from "drizzle-orm";
import { members, officerTerms, projects, faqs, awards, sponsors } from "./schema.js";
import { MEMBERS, TERMS, PROJECTS, FAQS, AWARDS, SPONSORS } from "./seed-data.js";

// One-time content migration. Each table is filled only while it is empty, so
// re-running never duplicates rows, never undoes edits (including edits to
// names, slugs or questions) and never brings back rows deleted in the admin.
// No transaction on purpose: libsql opens a new connection per transaction,
// which breaks in-memory test databases.
export async function seed(db) {
  const isEmpty = async (table) => (await db.select({ n: count() }).from(table))[0].n === 0;

  if (await isEmpty(members)) await db.insert(members).values(MEMBERS);

  if (await isEmpty(officerTerms)) {
    const ids = new Map(
      (await db.select({ id: members.id, slug: members.slug }).from(members)).map((m) => [m.slug, m.id]),
    );
    const terms = TERMS.map(({ member, role, year, sort }) => {
      const memberId = ids.get(member);
      if (!memberId) throw new Error(`Seed term references unknown member "${member}"`);
      return { memberId, role, year, sort };
    });
    await db.insert(officerTerms).values(terms);
  }

  if (await isEmpty(projects)) await db.insert(projects).values(PROJECTS);
  if (await isEmpty(faqs)) await db.insert(faqs).values(FAQS);
  if (await isEmpty(awards)) await db.insert(awards).values(AWARDS);
  if (await isEmpty(sponsors)) await db.insert(sponsors).values(SPONSORS);
}
