import { migrate } from "drizzle-orm/libsql/migrator";
import { createDb } from "../../lib/db.js";

// A fresh, fully migrated in-memory database for each test.
export async function testDb() {
  const db = createDb("file::memory:");
  await migrate(db, { migrationsFolder: "db/migrations" });
  return db;
}
