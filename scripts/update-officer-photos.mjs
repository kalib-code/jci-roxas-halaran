import { createDb } from "../lib/db.js";
import { updateMemberPhotos } from "../db/member-photos.js";
import { OFFICER_PHOTOS_2026 } from "../db/seed-data.js";

const n = await updateMemberPhotos(createDb(), OFFICER_PHOTOS_2026);
console.log(`Updated photos for ${n} members.`);
