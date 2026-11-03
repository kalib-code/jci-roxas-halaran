import { and, asc, count, desc, eq } from "drizzle-orm";
import { events, projects, volunteerDrives, volunteerRoles, volunteerSignups } from "../../db/schema.js";
import { driveInput, driveSignupInput } from "./validation.js";
import { phToday, slugify } from "../format.js";
import { logEvent } from "../evidence.js";
import { isUniqueViolation } from "../db-errors.js";

const issues = (r) => r.error.issues.map((i) => i.message);

// Where a new volunteer for `role` goes, given how many are already confirmed
// in it: "confirmed", "waitlist", or null when the role can't take anyone.
// The public form uses the same answer to grey out roles, so they always agree.
export function seatFor(role, taken) {
  // TODO(Karl): decide what happens when a role is full.
  if (!role.slots) return "confirmed";
  return taken < role.slots ? "confirmed" : null;
}

// Open, and the last day to sign up (if any) hasn't passed in the Philippines.
export function driveIsOpen(drive, { now = new Date() } = {}) {
  if (!drive?.open) return false;
  return !drive.closesOn || phToday(now.toISOString()) <= drive.closesOn;
}

async function rolesWithCounts(db, driveId) {
  const [roles, counts] = await Promise.all([
    db.select().from(volunteerRoles).where(eq(volunteerRoles.driveId, driveId)).orderBy(asc(volunteerRoles.sort), asc(volunteerRoles.id)),
    db
      .select({ roleId: volunteerSignups.roleId, status: volunteerSignups.status, n: count() })
      .from(volunteerSignups)
      .where(eq(volunteerSignups.driveId, driveId))
      .groupBy(volunteerSignups.roleId, volunteerSignups.status),
  ]);
  const of = (roleId, status) => counts.filter((c) => c.roleId === roleId && c.status === status).reduce((s, c) => s + c.n, 0);
  const total = (status) => counts.filter((c) => c.status === status).reduce((s, c) => s + c.n, 0);
  return {
    roles: roles.map((r) => ({ ...r, taken: of(r.id, "confirmed"), waitlist: of(r.id, "waitlist") })),
    confirmed: total("confirmed"),
    waitlist: total("waitlist"),
  };
}

const driveColumns = {
  drive: volunteerDrives,
  eventTitle: events.title,
  eventSlug: events.slug,
  projectTitle: projects.title,
  projectSlug: projects.slug,
};

const withLinks = (row) => ({ ...row.drive, eventTitle: row.eventTitle, eventSlug: row.eventSlug, projectTitle: row.projectTitle, projectSlug: row.projectSlug });

function selectDrives(db) {
  return db
    .select(driveColumns)
    .from(volunteerDrives)
    .leftJoin(events, eq(volunteerDrives.eventId, events.id))
    .leftJoin(projects, eq(volunteerDrives.projectId, projects.id));
}

async function withRoles(db, drive) {
  return drive ? { ...drive, ...(await rolesWithCounts(db, drive.id)) } : null;
}

export async function getDrive(db, id) {
  const [row] = await selectDrives(db).where(eq(volunteerDrives.id, Number(id)));
  return withRoles(db, row ? withLinks(row) : null);
}

export async function getDriveBySlug(db, slug) {
  const [row] = await selectDrives(db).where(eq(volunteerDrives.slug, slug));
  return withRoles(db, row ? withLinks(row) : null);
}

// Every registration, newest first, with sign-up counts and total spots
// (null when any role, or the registration itself, has no limit).
export async function listDrives(db) {
  const rows = await selectDrives(db).orderBy(desc(volunteerDrives.createdAt), desc(volunteerDrives.id));
  return Promise.all(
    rows.map(async (row) => {
      const d = await withRoles(db, withLinks(row));
      const limited = d.roles.length > 0 && d.roles.every((r) => r.slots);
      return { ...d, spots: limited ? d.roles.reduce((s, r) => s + r.slots, 0) : null };
    }),
  );
}

// Every registration linked to an event or a project, oldest first.
export function listDrivesFor(db, { eventId = null, projectId = null }) {
  const where = eventId ? eq(volunteerDrives.eventId, Number(eventId)) : eq(volunteerDrives.projectId, Number(projectId));
  return db.select().from(volunteerDrives).where(where).orderBy(asc(volunteerDrives.id));
}

// Registrations still taking sign-ups, for an event or project page.
export async function listOpenDrivesFor(db, link, { now = new Date() } = {}) {
  return (await listDrivesFor(db, link)).filter((d) => driveIsOpen(d, { now }));
}

// A new registration filled in from an event or project, for the organizer to adjust.
export function draftFromEvent(event) {
  return {
    title: `Volunteers for ${event.title}`,
    eventId: event.id,
    projectId: event.projectId ?? null,
    startsAt: event.startAt ?? "",
    venue: event.venue ?? "",
    closesOn: event.startAt ? event.startAt.slice(0, 10) : "",
  };
}

export function draftFromProject(project) {
  return {
    title: `Volunteers for ${project.title}`,
    eventId: null,
    projectId: project.id,
    startsAt: "",
    venue: project.barangay ?? "",
    closesOn: "",
  };
}

export async function saveDrive(db, { id, expectedUpdatedAt, ...raw }, { now = new Date().toISOString() } = {}) {
  const parsed = driveInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: issues(parsed) };
  const d = parsed.data;
  const existing = id ? await getDrive(db, id) : null;
  if (id && !existing) return { ok: false, errors: ["Volunteer registration not found"] };
  if (existing && expectedUpdatedAt !== existing.updatedAt) {
    return { ok: false, errors: ["This was changed since you opened it — reload"] };
  }
  const slug = existing ? existing.slug : slugify(d.slug || d.title);
  if (!slug) return { ok: false, errors: ["Add a title with letters or numbers"] };
  if (!existing) {
    const taken = await db.select({ id: volunteerDrives.id }).from(volunteerDrives).where(eq(volunteerDrives.slug, slug));
    if (taken.length) return { ok: false, errors: [`The address /volunteer/${slug} is taken — try ${slug}-2`] };
  }

  // Check the roles before writing anything, so a refused save changes nothing.
  const before = existing?.roles ?? [];
  const keptIds = new Set(d.roles.filter((r) => r.id).map((r) => r.id));
  const stranger = d.roles.find((r) => r.id && !before.some((b) => b.id === r.id));
  if (stranger) return { ok: false, errors: ["A role doesn't belong to this registration — reload"] };
  const dropped = before.filter((b) => !keptIds.has(b.id));
  const busy = dropped.find((b) => b.taken + b.waitlist > 0);
  if (busy) {
    const n = busy.taken + busy.waitlist;
    return { ok: false, errors: [`"${busy.label}" has ${n} volunteer${n === 1 ? "" : "s"}. Remove them from the list below before deleting the role.`] };
  }

  const values = {
    title: d.title,
    slug,
    description: d.description || null,
    eventId: d.eventId,
    projectId: d.projectId,
    startsAt: d.startsAt || null,
    venue: d.venue || null,
    closesOn: d.closesOn || null,
    open: d.open,
    updatedAt: now,
  };
  const [drive] = existing
    ? await db.update(volunteerDrives).set(values).where(eq(volunteerDrives.id, existing.id)).returning()
    : await db.insert(volunteerDrives).values({ ...values, createdAt: now }).returning();

  for (const b of dropped) await db.delete(volunteerRoles).where(eq(volunteerRoles.id, b.id));
  for (const [sort, r] of d.roles.entries()) {
    const role = { label: r.label, description: r.description || null, slots: r.slots, sort };
    if (r.id) await db.update(volunteerRoles).set(role).where(eq(volunteerRoles.id, r.id));
    else await db.insert(volunteerRoles).values({ ...role, driveId: drive.id });
  }
  return { ok: true, drive: await getDrive(db, drive.id) };
}

export async function submitDriveSignup(db, raw, { now = new Date().toISOString() } = {}) {
  const parsed = driveSignupInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: issues(parsed) };
  const d = parsed.data;
  const drive = await getDrive(db, d.driveId);
  if (!drive) return { ok: false, errors: ["Volunteer registration not found"] };
  if (!driveIsOpen(drive, { now: new Date(now) })) return { ok: false, errors: ["Sign-ups for this are closed"] };

  let role = null;
  let status = "confirmed";
  if (drive.roles.length) {
    role = drive.roles.find((r) => r.id === d.roleId) ?? null;
    if (!role) return { ok: false, errors: ["Choose how you'd like to help"] };
    status = seatFor(role, role.taken);
    if (!status) return { ok: false, errors: [`${role.label} is full — please choose another role`] };
  }

  try {
    const [signup] = await db
      .insert(volunteerSignups)
      .values({
        driveId: drive.id,
        roleId: role?.id ?? null,
        eventId: drive.eventId,
        projectId: drive.projectId,
        status,
        name: d.name,
        email: d.email,
        phone: d.phone || null,
        skills: d.skills || null,
        consent: true,
        createdAt: now,
      })
      .returning();
    await logEvent(db, { type: "volunteer_signed_up", refTable: "volunteer_signups", refId: signup.id, meta: { driveId: drive.id, status }, now });
    return { ok: true, signup, drive, role, status };
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, errors: ["You've already signed up for this — we'll be in touch"] };
    throw e;
  }
}

// A registration's volunteers in role order, earliest sign-up first.
export function listDriveSignups(db, driveId) {
  return db
    .select({
      id: volunteerSignups.id,
      name: volunteerSignups.name,
      email: volunteerSignups.email,
      phone: volunteerSignups.phone,
      skills: volunteerSignups.skills,
      status: volunteerSignups.status,
      createdAt: volunteerSignups.createdAt,
      roleId: volunteerSignups.roleId,
      roleLabel: volunteerRoles.label,
    })
    .from(volunteerSignups)
    .leftJoin(volunteerRoles, eq(volunteerSignups.roleId, volunteerRoles.id))
    .where(eq(volunteerSignups.driveId, Number(driveId)))
    .orderBy(asc(volunteerRoles.sort), asc(volunteerSignups.createdAt), asc(volunteerSignups.id));
}

export async function removeDriveSignup(db, id) {
  const [signup] = await db.delete(volunteerSignups).where(eq(volunteerSignups.id, Number(id))).returning();
  return signup ? { ok: true, signup } : { ok: false, errors: ["Volunteer not found"] };
}

// Moves a waitlisted volunteer into the role (an organizer's call, so it may go over the spots).
export async function confirmDriveSignup(db, id) {
  const [signup] = await db
    .update(volunteerSignups)
    .set({ status: "confirmed" })
    .where(and(eq(volunteerSignups.id, Number(id)), eq(volunteerSignups.status, "waitlist")))
    .returning();
  return signup ? { ok: true, signup } : { ok: false, errors: ["Already confirmed"] };
}
