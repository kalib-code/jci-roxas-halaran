import { eq } from "drizzle-orm";
import { members } from "./schema.js";

// Sets photo_url for the given { slug: url } map. Returns how many members were
// matched. Safe to re-run; used to bring existing databases up to date when
// the chapter supplies new portraits.
export async function updateMemberPhotos(db, photos) {
  let matched = 0;
  for (const [slug, photoUrl] of Object.entries(photos)) {
    const rows = await db.update(members).set({ photoUrl }).where(eq(members.slug, slug)).returning({ id: members.id });
    matched += rows.length;
  }
  return matched;
}
