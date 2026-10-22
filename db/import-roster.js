import { eq } from "drizzle-orm";
import { members } from "./schema.js";
import { slugify } from "../lib/format.js";
import { normalizePhone } from "../lib/members/card.js";

const SUFFIX = /^(jr|sr|ii|iii|iv)$/;

// Name words without initials ("M.") or suffixes ("Jr."), lowercased.
function nameWords(name) {
  return slugify(name).split("-").filter((w) => w.length > 1 && !SUFFIX.test(w));
}

// The key two spellings of one person share: "Jaime Cortes M. Altavas" and the
// stored "Jaime Cortes Altavas" both give "jaime-altavas". First given name plus
// last surname word, so middle initials and Jr. never stop a match.
export function nameKey(name) {
  const words = nameWords(name);
  return words.length < 2 ? words.join("-") : `${words[0]}-${words.at(-1)}`;
}

// Slug in the house style: the full name minus initials and suffix punctuation,
// with "jr" kept so "Elmer F. Jimenez, Jr." gives "elmer-jimenez-jr".
function rosterSlug(name) {
  return slugify(name).split("-").filter((w) => w.length > 1).join("-");
}

// Adds roster people who aren't members yet, and for those who are, takes the
// roster's spelling of the name (it comes from the chapter) and fills a missing
// email or phone. A stored email or phone is never overwritten, so contacts
// fixed in the admin survive a re-run. Rows are { name, email?, phone? }.
export async function importRoster(db, rows) {
  const existing = await db.select().from(members);
  const byEmail = new Map(existing.filter((m) => m.email).map((m) => [m.email.toLowerCase(), m]));
  const byKey = new Map(existing.map((m) => [nameKey(m.name), m]));
  const slugs = new Set(existing.map((m) => m.slug));
  const result = { added: [], filled: [], unchanged: [], badPhones: [] };

  for (const row of rows) {
    const name = row.name.trim();
    const email = row.email?.trim().toLowerCase() || null;
    const phone = row.phone ? normalizePhone(row.phone) : null;
    if (row.phone && !phone) result.badPhones.push(`${name}: ${row.phone}`);

    const match = (email && byEmail.get(email)) ?? byKey.get(nameKey(name));
    if (match) {
      const fill = {};
      if (name !== match.name) fill.name = name;
      if (email && !match.email) fill.email = email;
      if (phone && !match.phone) fill.phone = phone;
      if (Object.keys(fill).length) {
        await db.update(members).set(fill).where(eq(members.id, match.id));
        result.filled.push(`${match.name} (${Object.keys(fill).join(", ")})`);
      } else result.unchanged.push(match.name);
      continue;
    }

    let slug = rosterSlug(name);
    for (let n = 2; slugs.has(slug); n++) slug = `${rosterSlug(name)}-${n}`;
    const [added] = await db.insert(members).values({ slug, name, email, phone: phone || null }).returning();
    slugs.add(slug);
    byKey.set(nameKey(name), added);
    if (email) byEmail.set(email, added);
    result.added.push(name);
  }
  return result;
}
