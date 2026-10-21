import { createDb } from "../lib/db.js";
import { seed } from "../db/seed.js";

await seed(createDb());
console.log("Seed complete.");
