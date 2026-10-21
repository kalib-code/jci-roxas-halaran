import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { members } from "../../db/schema.js";

// The member record for a signed-in Clerk user: by stored Clerk id, else by
// email on a record nobody has linked yet (then the link is stored).
export async function memberForUser(db, { clerkUserId, email }) {
  if (!clerkUserId) return null;
  const [byId] = await db.select().from(members).where(eq(members.clerkUserId, clerkUserId));
  if (byId) return byId;
  if (!email) return null;
  const [byEmail] = await db
    .select()
    .from(members)
    .where(and(sql`lower(${members.email}) = ${email.trim().toLowerCase()}`, isNull(members.clerkUserId)))
    .orderBy(asc(members.id));
  if (!byEmail) return null;
  const [linked] = await db.update(members).set({ clerkUserId }).where(eq(members.id, byEmail.id)).returning();
  return linked;
}
