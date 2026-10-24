"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db.js";
import { requireArea } from "@/lib/auth.js";
import { adminUpdateMember } from "@/lib/members/profile.js";
import { verifyEntry, declineEntry, addVerifiedEntry } from "@/lib/members/passport.js";
import { inviteUnlinkedMembers } from "@/lib/members/invite.js";
import { inviteMember, raiseRole } from "@/lib/clerk-invite.js";
import { audit, changedFields } from "@/lib/audit.js";
import { eq } from "drizzle-orm";
import { members } from "@/db/schema.js";

export async function updateMemberAction(id, input) {
  const { userId } = await requireArea("content");
  const db = getDb();
  const [before] = await db.select().from(members).where(eq(members.id, Number(id)));
  const r = await adminUpdateMember(db, id, input);
  if (r.ok) {
    const changes = changedFields(before, r.member, ["email", "status", "inDirectory", "clerkUserId"]);
    if (Object.keys(changes).length) {
      const what = Object.keys(changes).map((f) => (f === "clerkUserId" ? "account link" : f === "inDirectory" ? "directory listing" : f)).join(", ");
      await audit(db, { actor: userId, action: "member.update", table: "members", id: r.member.id, summary: `Changed ${r.member.name}'s ${what}`, details: changes });
    }
    revalidatePath("/admin/members");
    revalidatePath("/members/directory");
  }
  return r.ok ? { ok: true } : r;
}

export async function inviteAllMembersAction() {
  const { userId } = await requireArea("content");
  const r = await inviteUnlinkedMembers(getDb(), { invite: inviteMember, raise: raiseRole });
  await audit(getDb(), {
    actor: userId,
    action: "member.invite_all",
    summary: `Sent ${r.invited.length} invitation${r.invited.length === 1 ? "" : "s"}, linked ${r.linked.length}, gave admin to ${r.admins.length}${r.failed.length ? `, ${r.failed.length} failed` : ""}`,
    details: { invited: r.invited, linked: r.linked, admins: r.admins, failed: r.failed },
  });
  revalidatePath("/admin/members");
  return { ok: true, ...r };
}

export async function verifyEntryAction(id, points) {
  const { userId } = await requireArea("content");
  const r = await verifyEntry(getDb(), id, { userId, points: points === "" || points == null ? undefined : Number(points) });
  revalidatePath("/admin/passport");
  if (r.ok) await audit(getDb(), { actor: userId, action: "passport.verify", table: "passport_entries", id: r.entry.id, summary: `Verified passport entry "${r.entry.title}" (${r.entry.points} pts)` });
  return r.ok ? { ok: true } : r;
}

export async function declineEntryAction(id) {
  const { userId } = await requireArea("content");
  const r = await declineEntry(getDb(), id, { userId });
  revalidatePath("/admin/passport");
  if (r.ok) await audit(getDb(), { actor: userId, action: "passport.decline", table: "passport_entries", id: r.entry.id, summary: `Declined passport entry "${r.entry.title}"` });
  return r.ok ? { ok: true } : r;
}

export async function addEntryAction(memberId, input) {
  const { userId } = await requireArea("content");
  const points = input?.points === "" || input?.points == null ? undefined : Number(input.points);
  const r = await addVerifiedEntry(getDb(), memberId, input, { userId, points });
  revalidatePath("/admin/passport");
  if (r.ok) await audit(getDb(), { actor: userId, action: "passport.add", table: "passport_entries", id: r.entry.id, summary: `Added passport entry "${r.entry.title}" for member #${memberId}` });
  return r.ok ? { ok: true } : r;
}
