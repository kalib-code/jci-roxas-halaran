"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db.js";
import { currentMember } from "@/lib/members/current.js";
import { updateProfile } from "@/lib/members/profile.js";
import { requestEntry } from "@/lib/members/passport.js";

const NO_PROFILE = { ok: false, errors: ["Your account isn't linked to a member profile yet — ask an admin."] };

export async function updateProfileAction(input) {
  const { member } = await currentMember();
  if (!member) return NO_PROFILE;
  const r = await updateProfile(getDb(), member.id, input);
  if (!r.ok) return r;
  revalidatePath("/members", "layout");
  revalidatePath("/officers");
  return { ok: true };
}

export async function requestEntryAction(input) {
  const { userId, member } = await currentMember();
  if (!member) return NO_PROFILE;
  const r = await requestEntry(getDb(), member.id, input, { userId });
  if (!r.ok) return r;
  revalidatePath("/members/passport");
  return { ok: true };
}
