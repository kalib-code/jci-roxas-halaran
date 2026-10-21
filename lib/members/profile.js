import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { members } from "../../db/schema.js";
import { phoneField, linkField, CONSENT_MESSAGE } from "./card.js";

const PHOTO = /^(https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/|\/assets\/)/i;
const text = (max) => z.string().trim().max(max).default("");
const issues = (r) => r.error.issues.map((i) => i.message);

export function normalizeSkills(input) {
  const seen = new Set();
  const out = [];
  for (const raw of (input ?? "").split(",")) {
    const s = raw.trim().slice(0, 40);
    if (s && !seen.has(s.toLowerCase())) {
      seen.add(s.toLowerCase());
      out.push(s);
    }
  }
  return out.slice(0, 15).join(", ");
}

export const profileInput = z
  .object({
    photoUrl: z.string().trim().regex(PHOTO, "Upload a photo").or(z.literal("")).optional(),
    profession: text(120),
    business: text(120),
    skills: text(400),
    bio: text(1000),
    inDirectory: z.boolean().default(false),
    phone: phoneField,
    websiteUrl: linkField,
    facebookUrl: linkField,
    linkedinUrl: linkField,
    instagramUrl: linkField,
    cardPublished: z.boolean().default(false),
    cardShowPhone: z.boolean().default(false),
    cardShowEmail: z.boolean().default(true),
    cardConsent: z.boolean().default(false),
  })
  .refine((d) => !d.cardPublished || d.cardConsent, { message: CONSENT_MESSAGE });

export async function updateProfile(db, memberId, raw) {
  const parsed = profileInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: issues(parsed) };
  const d = parsed.data;
  const values = {
    profession: d.profession || null,
    business: d.business || null,
    skills: normalizeSkills(d.skills) || null,
    bio: d.bio || null,
    inDirectory: d.inDirectory,
    phone: d.phone || null,
    websiteUrl: d.websiteUrl || null,
    facebookUrl: d.facebookUrl || null,
    linkedinUrl: d.linkedinUrl || null,
    instagramUrl: d.instagramUrl || null,
    cardPublished: d.cardPublished,
    cardShowPhone: d.cardShowPhone,
    cardShowEmail: d.cardShowEmail,
  };
  if (d.photoUrl !== undefined) values.photoUrl = d.photoUrl || null;
  const [member] = await db.update(members).set(values).where(eq(members.id, Number(memberId))).returning();
  return member ? { ok: true, member } : { ok: false, errors: ["Member not found"] };
}

export const adminMemberInput = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address").or(z.literal("")).default(""),
  status: z.enum(["active", "inactive", "senator", "alumni"]),
  inDirectory: z.boolean(),
  unlink: z.boolean().default(false),
});

export async function adminUpdateMember(db, id, raw) {
  const parsed = adminMemberInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: issues(parsed) };
  const d = parsed.data;
  const [current] = await db.select().from(members).where(eq(members.id, Number(id)));
  if (!current) return { ok: false, errors: ["Member not found"] };
  const values = { email: d.email || null, status: d.status, inDirectory: d.inDirectory };
  // A wrong email may have linked the wrong sign-in account: changing the email
  // (or asking to unlink) frees the record to link again on the next sign-in.
  const emailChanged = (current.email ?? "").toLowerCase() !== (d.email ?? "");
  if (current.clerkUserId && (d.unlink || emailChanged)) values.clerkUserId = null;
  const [member] = await db.update(members).set(values).where(eq(members.id, current.id)).returning();
  return { ok: true, member };
}

export function listMembersAdmin(db) {
  return db.select().from(members).orderBy(asc(members.name));
}

const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export function listDirectory(db, { q = "" } = {}) {
  const term = q.trim().toLowerCase();
  const conds = [eq(members.inDirectory, true), eq(members.status, "active")];
  if (term) {
    const like = `%${escapeLike(term)}%`;
    conds.push(sql`(
      lower(${members.name}) like ${like} escape '\\'
      or lower(coalesce(${members.profession}, '')) like ${like} escape '\\'
      or lower(coalesce(${members.business}, '')) like ${like} escape '\\'
      or lower(coalesce(${members.skills}, '')) like ${like} escape '\\'
    )`);
  }
  return db
    .select({
      id: members.id,
      slug: members.slug,
      name: members.name,
      photoUrl: members.photoUrl,
      profession: members.profession,
      business: members.business,
      skills: members.skills,
      cardPublished: members.cardPublished,
    })
    .from(members)
    .where(and(...conds))
    .orderBy(asc(members.name));
}
