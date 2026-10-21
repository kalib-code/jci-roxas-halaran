import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../db/schema.js";

export function createDb(
  url = process.env.TURSO_DATABASE_URL,
  authToken = process.env.TURSO_AUTH_TOKEN,
) {
  if (!url) throw new Error("TURSO_DATABASE_URL is not set");
  return drizzle(createClient({ url, authToken }), { schema });
}

let db;
export function getDb() {
  db ??= createDb();
  return db;
}
