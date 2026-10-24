import { asc, eq, max } from "drizzle-orm";
import { members, officerTerms } from "../../db/schema.js";

// The current board is the latest year in officer_terms, the same list the
// public Officers page shows. Being on it is what makes someone an admin.
export async function currentBoardMembers(db) {
  const [{ year }] = await db.select({ year: max(officerTerms.year) }).from(officerTerms);
  if (year == null) return [];
  const rows = await db
    .select({ id: members.id, name: members.name, email: members.email, position: officerTerms.role })
    .from(officerTerms)
    .innerJoin(members, eq(officerTerms.memberId, members.id))
    .where(eq(officerTerms.year, year))
    .orderBy(asc(officerTerms.sort), asc(officerTerms.id));
  return rows;
}

export async function currentBoardEmails(db) {
  const emails = (await currentBoardMembers(db)).map((m) => m.email?.trim().toLowerCase()).filter(Boolean);
  return [...new Set(emails)];
}

export const roleForMember = (memberId, boardIds) => (boardIds.has(memberId) ? "admin" : "member");
