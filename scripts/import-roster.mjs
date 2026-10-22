import { readFile } from "node:fs/promises";
import { createDb } from "../lib/db.js";
import { importRoster } from "../db/import-roster.js";

// The roster holds members' emails and phones, so it lives in the git-ignored
// private/ folder, never in the repo: private/members.json = [{ name, email?, phone? }].
const file = process.argv[2] ?? "private/members.json";
const rows = JSON.parse(await readFile(file, "utf8"));

const { added, filled, unchanged, needsReview, badPhones } = await importRoster(createDb(), rows);
console.log(`Added ${added.length} members, filled contacts on ${filled.length}, ${unchanged.length} unchanged, ${needsReview.length} need review.`);
for (const name of added) console.log(`  added ${name}`);
for (const line of filled) console.log(`  filled ${line}`);
for (const line of needsReview) console.log(`  skipped, could be more than one member: ${line}`);
for (const line of badPhones) console.log(`  skipped phone, not a PH number: ${line}`);
