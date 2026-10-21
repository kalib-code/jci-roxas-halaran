import { and, asc, eq, sql, count } from "drizzle-orm";
import { seoPlan } from "../../db/schema.js";

export function listPlan(db) {
  return db.select().from(seoPlan).orderBy(asc(seoPlan.month), asc(seoPlan.id));
}

export async function addPlanKeyword(db, { month, keyword, volume = null, kd = null, workingTitle = null }) {
  const k = keyword.trim().toLowerCase();
  if (!/^\d{4}-\d{2}$/.test(month) || !k) return { ok: false, errors: ["Use a month like 2026-12 and a keyword"] };
  try {
    const [row] = await db.insert(seoPlan).values({ month, keyword: k, volume, kd, workingTitle }).returning();
    return { ok: true, row };
  } catch {
    return { ok: false, errors: [`"${k}" is already planned for ${month}`] };
  }
}

export async function setPlanStatus(db, id, status) {
  if (!["idea", "drafting", "published"].includes(status)) return { ok: false, errors: ["Unknown status"] };
  await db.update(seoPlan).set({ status }).where(eq(seoPlan.id, id));
  return { ok: true };
}

export async function monthProgress(db, month) {
  const [total] = await db.select({ n: count() }).from(seoPlan).where(eq(seoPlan.month, month));
  const [done] = await db
    .select({ n: count() })
    .from(seoPlan)
    .where(and(eq(seoPlan.month, month), eq(seoPlan.status, "published")));
  return { published: done.n, total: total.n };
}

export async function linkPublishedArticle(db, article) {
  if (!article.targetKeyword) return;
  await db
    .update(seoPlan)
    .set({ status: "published", articleId: article.id })
    .where(sql`lower(${seoPlan.keyword}) = lower(${article.targetKeyword.trim()})`);
}

export async function unlinkArticle(db, articleId) {
  await db.update(seoPlan).set({ status: "drafting" }).where(eq(seoPlan.articleId, articleId));
}
