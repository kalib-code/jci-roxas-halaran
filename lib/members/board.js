import { and, asc, eq, gte, lte, max, min } from "drizzle-orm";
import { members, officerTerms } from "../../db/schema.js";
import { phToday } from "../format.js";

// The board in office: the latest year on record up to this year (Philippine
// time), so a board elected ahead (2027, entered in late 2026) waits for its
// year. With no current board on record, the earliest one stands in.
export async function boardYear(db, { now = new Date() } = {}) {
  const thisYear = Number(phToday(now.toISOString()).slice(0, 4));
  const [{ year }] = await db.select({ year: max(officerTerms.year) }).from(officerTerms).where(lte(officerTerms.year, thisYear));
  if (year != null) return year;
  const [{ first }] = await db.select({ first: min(officerTerms.year) }).from(officerTerms);
  return first ?? null;
}

const boardFields = { id: members.id, name: members.name, email: members.email, position: officerTerms.role, year: officerTerms.year };

// The board in office, the same list the public Officers page shows. It gets
// the info@ mail.
export async function currentBoardMembers(db, { now } = {}) {
  const year = await boardYear(db, { now });
  if (year == null) return [];
  return db
    .select(boardFields)
    .from(officerTerms)
    .innerJoin(members, eq(officerTerms.memberId, members.id))
    .where(eq(officerTerms.year, year))
    .orderBy(asc(officerTerms.sort), asc(officerTerms.id));
}

// Admins: the board in office plus any board already elected for a later
// year, each member once.
export async function adminBoardMembers(db, { now } = {}) {
  const year = await boardYear(db, { now });
  if (year == null) return [];
  const rows = await db
    .select(boardFields)
    .from(officerTerms)
    .innerJoin(members, eq(officerTerms.memberId, members.id))
    .where(gte(officerTerms.year, year))
    .orderBy(asc(officerTerms.year), asc(officerTerms.sort), asc(officerTerms.id));
  return rows.filter((r, i) => rows.findIndex((x) => x.id === r.id) === i);
}

export async function isAdminBoardMember(db, memberId, { now } = {}) {
  const year = await boardYear(db, { now });
  if (year == null) return false;
  const [term] = await db
    .select({ id: officerTerms.id })
    .from(officerTerms)
    .where(and(eq(officerTerms.memberId, Number(memberId)), gte(officerTerms.year, year)))
    .limit(1);
  return Boolean(term);
}

export async function currentBoardEmails(db, { now } = {}) {
  const emails = (await currentBoardMembers(db, { now })).map((m) => m.email?.trim().toLowerCase()).filter(Boolean);
  return [...new Set(emails)];
}

export const roleForMember = (memberId, boardIds) => (boardIds.has(memberId) ? "admin" : "member");
