import { asc, eq, isNotNull, isNull } from "drizzle-orm";
import { members } from "../../db/schema.js";
import { currentBoardMembers, roleForMember } from "./board.js";

// Invite every roster member who has an email but no linked account yet;
// the current board is invited as admin, everyone else as member.
// invite(email) is lib/clerk-invite.js in production: it returns { invited: true }
// for a new invitation, or { clerkUserId } when the person already signed up,
// in which case the link is stored right away.
export async function inviteUnlinkedMembers(db, { invite, raise }) {
  const unlinked = await db.select().from(members).where(isNull(members.clerkUserId)).orderBy(asc(members.name));
  const list = unlinked.filter((m) => m.email?.trim());
  const boardIds = new Set((await currentBoardMembers(db)).map((b) => b.id));
  const result = { invited: [], linked: [], failed: [], admins: [] };
  for (const m of list) {
    try {
      const role = roleForMember(m.id, boardIds);
      const res = await invite(m.email.trim().toLowerCase(), { role });
      if (role === "admin") result.admins.push(m.name);
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
  // Board members who already have an account get admin too.
  if (raise) {
    for (const b of await db.select().from(members).where(isNotNull(members.clerkUserId))) {
      if (!boardIds.has(b.id)) continue;
      try {
        if (await raise(b.clerkUserId, "admin")) result.admins.push(b.name);
      } catch (e) {
        result.failed.push({ name: b.name, error: e?.errors?.[0]?.longMessage ?? e.message });
      }
    }
  }
  return { ...result, withoutEmail: unlinked.filter((m) => !m.email?.trim()).map((m) => m.name) };
}
