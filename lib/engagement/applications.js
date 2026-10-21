import { desc, eq, sql } from "drizzle-orm";
import { applications, members } from "../../db/schema.js";
import { applicationInput } from "./validation.js";
import { ageOn, slugify } from "../format.js";
import { logEvent } from "../evidence.js";
import { isUniqueViolation } from "../db-errors.js";

const issues = (r) => r.error.issues.map((i) => i.message);

export async function submitApplication(db, raw, { now = new Date().toISOString() } = {}) {
  const parsed = applicationInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: issues(parsed) };
  const d = parsed.data;
  const age = ageOn(d.birthdate, now);
  if (age < 18 || age > 40) return { ok: false, errors: ["JCI membership is for ages 18 to 40"] };
  try {
    const [application] = await db
      .insert(applications)
      .values({
        name: d.name,
        email: d.email,
        phone: d.phone || null,
        birthdate: d.birthdate,
        barangay: d.barangay || null,
        whyJoin: d.whyJoin || null,
        referredBy: d.referredBy || null,
        consent: true,
        createdAt: now,
      })
      .returning();
    await logEvent(db, { type: "application_submitted", refTable: "applications", refId: application.id, now });
    return { ok: true, application };
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, errors: ["You already have a pending application — we'll be in touch soon"] };
    throw e;
  }
}

export function listApplications(db) {
  return db
    .select()
    .from(applications)
    .orderBy(sql`${applications.status} = 'pending' desc`, desc(applications.createdAt), desc(applications.id));
}

async function pending(db, id) {
  const [app] = await db.select().from(applications).where(eq(applications.id, Number(id)));
  if (!app) return { error: "Application not found" };
  if (app.status !== "pending") return { error: "This application was already reviewed" };
  return { app };
}

async function uniqueSlug(db, name) {
  const base = slugify(name) || "member";
  for (let n = 1; ; n += 1) {
    const slug = n === 1 ? base : `${base}-${n}`;
    if (!(await db.select({ id: members.id }).from(members).where(eq(members.slug, slug))).length) return slug;
  }
}

export async function approveApplication(db, id, { userId, now = new Date().toISOString(), invite } = {}) {
  const { app, error } = await pending(db, id);
  if (error) return { ok: false, errors: [error] };

  let [member] = await db.select().from(members).where(sql`lower(${members.email}) = ${app.email}`);
  if (!member) {
    [member] = await db
      .insert(members)
      .values({ slug: await uniqueSlug(db, app.name), name: app.name, email: app.email, joinedAt: now.slice(0, 10), status: "active" })
      .returning();
  }
  await db
    .update(applications)
    .set({ status: "approved", reviewedBy: userId, reviewedAt: now, memberId: member.id })
    .where(eq(applications.id, app.id));
  await logEvent(db, { type: "member_approved", actor: userId, refTable: "members", refId: member.id, now });

  let invited = false;
  let inviteError = null;
  if (invite && !member.clerkUserId) {
    try {
      await invite(app.email);
      invited = true;
    } catch (e) {
      inviteError = e.message;
    }
  }
  return { ok: true, member, invited, inviteError };
}

export async function declineApplication(db, id, { userId, now = new Date().toISOString(), note = "" } = {}) {
  const { app, error } = await pending(db, id);
  if (error) return { ok: false, errors: [error] };
  await db
    .update(applications)
    .set({ status: "declined", reviewedBy: userId, reviewedAt: now, note: note || null })
    .where(eq(applications.id, app.id));
  return { ok: true };
}
