import { migrate } from "drizzle-orm/libsql/migrator";
import { createDb } from "../lib/db.js";

await migrate(createDb(), { migrationsFolder: "db/migrations" });
console.log("Migrations applied.");
