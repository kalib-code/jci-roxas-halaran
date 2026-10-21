import { desc, eq } from "drizzle-orm";
import { members, officerTerms } from "../../db/schema.js";
import { cardIsPublic, cardView } from "./card-view.js";

export function listPositions(db, memberId) {
  return db
    .select({ role: officerTerms.role, year: officerTerms.year })
    .from(officerTerms)
    .where(eq(officerTerms.memberId, Number(memberId)))
    .orderBy(desc(officerTerms.year));
}

// The public card, or null unless the member is active and has published it.
export async function getPublicCard(db, slug) {
  const [member] = await db.select().from(members).where(eq(members.slug, String(slug)));
  if (!cardIsPublic(member)) return null;
  return cardView(member, await listPositions(db, member.id));
}
