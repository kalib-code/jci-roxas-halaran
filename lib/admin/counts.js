import { count, eq } from "drizzle-orm";
import { applications, payments, passportEntries } from "../../db/schema.js";

export async function adminCounts(db) {
  const n = async (table, column, value) => (await db.select({ n: count() }).from(table).where(eq(column, value)))[0].n;
  const [apps, pays, passport] = await Promise.all([
    n(applications, applications.status, "pending"),
    n(payments, payments.status, "pending"),
    n(passportEntries, passportEntries.status, "requested"),
  ]);
  return { applications: apps, payments: pays, passport };
}

// Badges are a convenience: a failed count hides them rather than breaking every admin page.
export async function safeAdminCounts(db) {
  try {
    return await adminCounts(db);
  } catch (e) {
    console.error("Admin counts failed", e);
    return {};
  }
}
