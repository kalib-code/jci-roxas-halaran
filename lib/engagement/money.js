import { and, desc, eq, sql } from "drizzle-orm";
import { campaigns, payments, expenses, members } from "../../db/schema.js";
import { campaignInput, pledgeInput, expenseInput, toCentavos } from "./validation.js";
import { phToday, slugify } from "../format.js";
import { logEvent } from "../evidence.js";
import { isUniqueViolation } from "../db-errors.js";

const issues = (r) => r.error.issues.map((i) => i.message);

async function raised(db, campaignId) {
  const [r] = await db
    .select({ total: sql`coalesce(sum(${payments.amountCentavos}), 0)` })
    .from(payments)
    .where(and(eq(payments.campaignId, campaignId), eq(payments.status, "confirmed")));
  return Number(r.total);
}

async function getCampaign(db, id) {
  const [row] = await db.select().from(campaigns).where(eq(campaigns.id, Number(id)));
  return row ?? null;
}

export async function saveCampaign(db, { id, ...raw }, { now = new Date().toISOString() } = {}) {
  const parsed = campaignInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: issues(parsed) };
  const d = parsed.data;
  if (d.qrImageUrl && !d.qrImageAlt) return { ok: false, errors: ["Add alt text for the QR image"] };
  const existing = id ? await getCampaign(db, id) : null;
  if (id && !existing) return { ok: false, errors: ["Campaign not found"] };
  const slug = existing ? existing.slug : slugify(d.slug || d.title);
  const values = {
    title: d.title,
    slug,
    description: d.description || null,
    projectId: d.projectId,
    goalCentavos: toCentavos(d.goalPesos),
    qrImageUrl: d.qrImageUrl || null,
    qrImageAlt: d.qrImageAlt || null,
    paymentInstructions: d.paymentInstructions || null,
    open: d.open,
    updatedAt: now,
  };
  try {
    const [campaign] = existing
      ? await db.update(campaigns).set(values).where(eq(campaigns.id, existing.id)).returning()
      : await db.insert(campaigns).values({ ...values, createdAt: now }).returning();
    return { ok: true, campaign };
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, errors: [`A campaign called ${slug} already exists`] };
    throw e;
  }
}

export async function listCampaigns(db, { openOnly = false } = {}) {
  const q = db.select().from(campaigns).orderBy(desc(campaigns.createdAt), desc(campaigns.id));
  const rows = await (openOnly ? q.where(eq(campaigns.open, true)) : q);
  return Promise.all(rows.map(async (c) => ({ ...c, raisedCentavos: await raised(db, c.id) })));
}

export async function getCampaignForProject(db, projectId) {
  const [c] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.projectId, Number(projectId)), eq(campaigns.open, true)))
    .orderBy(desc(campaigns.createdAt));
  return c ? { ...c, raisedCentavos: await raised(db, c.id) } : null;
}

export async function submitPledge(db, raw, { now = new Date().toISOString() } = {}) {
  const parsed = pledgeInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: issues(parsed) };
  const d = parsed.data;
  if (d.campaignId) {
    const c = await getCampaign(db, d.campaignId);
    if (!c) return { ok: false, errors: ["Campaign not found"] };
    if (!c.open) return { ok: false, errors: ["This campaign is closed"] };
  }
  try {
    const [payment] = await db
      .insert(payments)
      .values({
        campaignId: d.campaignId,
        type: d.type,
        payerName: d.payerName,
        payerEmail: d.payerEmail,
        amountCentavos: toCentavos(d.amountPesos),
        method: d.method,
        referenceNo: d.referenceNo,
        proofUrl: d.proofUrl || null,
        consent: true,
        createdAt: now,
      })
      .returning();
    await logEvent(db, { type: "pledge_submitted", refTable: "payments", refId: payment.id, meta: { amountCentavos: payment.amountCentavos }, now });
    return { ok: true, payment };
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, errors: ["That reference number was already submitted"] };
    throw e;
  }
}

export function listPayments(db, { status } = {}) {
  const q = db.select().from(payments).orderBy(desc(payments.createdAt), desc(payments.id));
  return status ? q.where(eq(payments.status, status)) : q;
}

async function pendingPayment(db, id) {
  const [p] = await db.select().from(payments).where(eq(payments.id, Number(id)));
  if (!p) return { error: "Payment not found" };
  if (p.status !== "pending") return { error: "This payment was already reviewed" };
  return { p };
}

export async function confirmPayment(db, id, { userId, now = new Date().toISOString() }) {
  const { p, error } = await pendingPayment(db, id);
  if (error) return { ok: false, errors: [error] };
  let memberId = p.memberId;
  let linkedMember = null;
  if (p.type === "membership_fee") {
    const [m] = await db.select().from(members).where(sql`lower(${members.email}) = ${p.payerEmail}`).orderBy(members.id);
    if (m) {
      memberId = m.id;
      linkedMember = m.name;
      await db.update(members).set({ feePaidYear: Number(phToday(now).slice(0, 4)) }).where(eq(members.id, m.id));
    }
  }
  const [payment] = await db
    .update(payments)
    .set({ status: "confirmed", confirmedBy: userId, confirmedAt: now, memberId })
    .where(eq(payments.id, p.id))
    .returning();
  await logEvent(db, { type: "payment_confirmed", actor: userId, refTable: "payments", refId: p.id, meta: { amountCentavos: p.amountCentavos }, now });
  return { ok: true, payment, linkedMember };
}

export async function rejectPayment(db, id, { userId, now = new Date().toISOString(), note = "" }) {
  const { p, error } = await pendingPayment(db, id);
  if (error) return { ok: false, errors: [error] };
  const [payment] = await db
    .update(payments)
    .set({ status: "rejected", confirmedBy: userId, confirmedAt: now, note: note || null })
    .where(eq(payments.id, p.id))
    .returning();
  return { ok: true, payment };
}

export async function recordExpense(db, raw, { userId, now = new Date().toISOString() }) {
  const parsed = expenseInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: issues(parsed) };
  const d = parsed.data;
  const [expense] = await db
    .insert(expenses)
    .values({
      amountCentavos: toCentavos(d.amountPesos),
      description: d.description,
      spentOn: d.spentOn,
      projectId: d.projectId,
      campaignId: d.campaignId,
      receiptUrl: d.receiptUrl || null,
      recordedBy: userId,
      createdAt: now,
    })
    .returning();
  await logEvent(db, { type: "expense_recorded", actor: userId, refTable: "expenses", refId: expense.id, meta: { amountCentavos: expense.amountCentavos }, now });
  return { ok: true, expense };
}

export function listExpenses(db) {
  return db.select().from(expenses).orderBy(desc(expenses.spentOn), desc(expenses.id));
}
