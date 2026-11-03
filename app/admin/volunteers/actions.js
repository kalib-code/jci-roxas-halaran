"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db.js";
import { requireArea } from "@/lib/auth.js";
import { audit } from "@/lib/audit.js";
import { pathsForEvent, pathsForProject, revalidateAll } from "@/lib/revalidate.js";
import { saveDrive, getDrive, removeDriveSignup, confirmDriveSignup } from "@/lib/engagement/volunteers.js";

// Event and project pages show their open registrations, so refresh the ones
// a registration is (or was) linked to.
function refreshLinked(...drives) {
  for (const d of drives) {
    if (d?.eventSlug) revalidateAll(pathsForEvent(d.eventSlug));
    if (d?.projectSlug) revalidateAll(pathsForProject(d.projectSlug));
  }
}

export async function saveDriveAction(input) {
  const { userId } = await requireArea("content");
  const db = getDb();
  const before = input?.id ? await getDrive(db, input.id) : null;
  const r = await saveDrive(db, input);
  if (r.ok) {
    refreshLinked(before, r.drive);
    revalidatePath(`/volunteer/${r.drive.slug}`);
    await audit(db, {
      actor: userId,
      action: before ? "volunteer_drive.update" : "volunteer_drive.create",
      table: "volunteer_drives",
      id: r.drive.id,
      summary: `${before ? "Edited" : "Created"} volunteer registration "${r.drive.title}"`,
    });
  }
  return r;
}

export async function removeDriveSignupAction(id) {
  const { userId } = await requireArea("content");
  const db = getDb();
  const r = await removeDriveSignup(db, id);
  if (r.ok) {
    await audit(db, { actor: userId, action: "volunteer.remove", table: "volunteer_signups", id: r.signup.id, summary: `Removed volunteer ${r.signup.name} (${r.signup.email})` });
    revalidatePath(`/admin/volunteers/${r.signup.driveId}`);
  }
  return r;
}

export async function confirmDriveSignupAction(id) {
  const { userId } = await requireArea("content");
  const db = getDb();
  const r = await confirmDriveSignup(db, id);
  if (r.ok) {
    await audit(db, { actor: userId, action: "volunteer.confirm", table: "volunteer_signups", id: r.signup.id, summary: `Moved volunteer ${r.signup.name} off the waitlist` });
    revalidatePath(`/admin/volunteers/${r.signup.driveId}`);
  }
  return r;
}
