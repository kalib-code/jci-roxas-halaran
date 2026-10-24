import { asc, eq, isNull } from "drizzle-orm";
import { members } from "../../db/schema.js";

// Invite every roster member who has an email but no linked account yet.
// invite(email) is lib/clerk-invite.js in production: it returns { invited: true }
// for a new invitation, or { clerkUserId } when the person already signed up,
// in which case the link is stored right away.
export async function inviteUnlinkedMembers(db, { invite }) {
  const unlinked = await db.select().from(members).where(isNull(members.clerkUserId)).orderBy(asc(members.name));
  const list = unlinked.filter((m) => m.email?.trim());
  const result = { invited: [], linked: [], failed: [] };
  for (const m of list) {
    try {
      const res = await invite(m.email.trim().toLowerCase());
      if (res?.clerkUserId) {
        await db.update(members).set({ clerkUserId: res.clerkUserId }).where(eq(members.id, m.id));
        result.linked.push(m.name);
      } else {
        result.invited.push(m.name);
      }
    } catch (e) {
      result.failed.push({ name: m.name, error: e?.errors?.[0]?.longMessage ?? e.message });
    }
  }
  return { ...result, withoutEmail: unlinked.filter((m) => !m.email?.trim()).map((m) => m.name) };
}
