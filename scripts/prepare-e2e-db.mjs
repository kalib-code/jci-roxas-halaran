import { rmSync } from "node:fs";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDb } from "../lib/db.js";
import { seed } from "../db/seed.js";

rmSync("e2e.db", { force: true });
const db = createDb("file:e2e.db");
await migrate(db, { migrationsFolder: "db/migrations" });
await seed(db);
console.log("e2e.db ready.");
