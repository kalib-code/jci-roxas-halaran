import { asc, desc, eq, lt, max, and, sql } from "drizzle-orm";
import { members, officerTerms, projects, faqs, awards, sponsors } from "../db/schema.js";

const officerFields = {
  name: members.name,
  slug: members.slug,
  role: officerTerms.role,
  year: officerTerms.year,
  photoUrl: members.photoUrl,
  bio: members.bio,
  quote: members.quote,
};

export async function getCurrentBoard(db) {
  const [{ year }] = await db.select({ year: max(officerTerms.year) }).from(officerTerms);
  if (year == null) return { year: null, president: null, officers: [] };

  const rows = await db
    .select(officerFields)
    .from(officerTerms)
    .innerJoin(members, eq(officerTerms.memberId, members.id))
    .where(eq(officerTerms.year, year))
    .orderBy(asc(officerTerms.sort), asc(officerTerms.id));

  const president = rows.find((r) => r.role === "President") ?? null;
  return { year, president, officers: rows.filter((r) => r !== president) };
}

export function getPastPresidents(db, beforeYear) {
  return db
    .select(officerFields)
    .from(officerTerms)
    .innerJoin(members, eq(officerTerms.memberId, members.id))
    .where(and(eq(officerTerms.role, "President"), lt(officerTerms.year, beforeYear)))
    .orderBy(desc(officerTerms.year));
}

export function listProjects(db, { limit } = {}) {
  const query = db
    .select()
    .from(projects)
    .orderBy(sql`${projects.startDate} is null`, desc(projects.startDate), asc(projects.id));
  return limit ? query.limit(limit) : query;
}

export function listFaqs(db) {
  return db.select().from(faqs).orderBy(asc(faqs.sort), asc(faqs.id));
}

export function listAwards(db) {
  return db.select().from(awards).orderBy(desc(awards.year), asc(awards.id));
}

export function listSponsors(db) {
  return db.select().from(sponsors).orderBy(asc(sponsors.name));
}
