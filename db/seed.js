import { members, officerTerms, projects, faqs, awards, sponsors } from "./schema.js";
import { MEMBERS, TERMS, PROJECTS, FAQS, AWARDS, SPONSORS } from "./seed-data.js";

// Inserts migrated content only where it is missing. Safe to re-run: it never
// duplicates rows and never overwrites edits made later in the admin area.
// No transaction on purpose: libsql opens a new connection per transaction,
// which breaks in-memory test databases; every insert is idempotent instead.
export async function seed(db) {
  await db.insert(members).values(MEMBERS).onConflictDoNothing({ target: members.slug });

  const ids = new Map(
    (await db.select({ id: members.id, slug: members.slug }).from(members)).map((m) => [m.slug, m.id]),
  );
  const terms = TERMS.map(({ member, role, year, sort }) => {
    const memberId = ids.get(member);
    if (!memberId) throw new Error(`Seed term references unknown member "${member}"`);
    return { memberId, role, year, sort };
  });
  await db.insert(officerTerms).values(terms).onConflictDoNothing();

  await db.insert(projects).values(PROJECTS).onConflictDoNothing({ target: projects.slug });
  await db.insert(faqs).values(FAQS).onConflictDoNothing({ target: faqs.question });
  await db.insert(awards).values(AWARDS).onConflictDoNothing();
  await db.insert(sponsors).values(SPONSORS).onConflictDoNothing({ target: sponsors.name });
}
