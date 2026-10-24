"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db.js";
import { requireArea } from "@/lib/auth.js";
import { SUPPORT_PATHS, revalidateAll } from "@/lib/revalidate.js";
import { confirmPayment, rejectPayment, saveCampaign, recordExpense } from "@/lib/engagement/money.js";
import { audit } from "@/lib/audit.js";
import { formatPesos } from "@/lib/format.js";

function refreshMoney() {
  revalidateAll(SUPPORT_PATHS);
  revalidatePath("/projects/[slug]", "page");
  revalidatePath("/admin/payments");
  revalidatePath("/transparency");
  revalidatePath("/impact");
}

export async function confirmPaymentAction(id) {
  const { userId } = await requireArea("content");
  const r = await confirmPayment(getDb(), id, { userId });
  if (r.ok) {
    refreshMoney();
    await audit(getDb(), { actor: userId, action: "payment.confirm", table: "payments", id: r.payment.id, summary: `Confirmed ${formatPesos(r.payment.amountCentavos)} from ${r.payment.payerName} (${r.payment.method}, ref ${r.payment.referenceNo})` });
  }
  return r.ok ? { ok: true, type: r.payment.type, linkedMember: r.linkedMember } : r;
}

export async function rejectPaymentAction(id, note) {
  const { userId } = await requireArea("content");
  const r = await rejectPayment(getDb(), id, { userId, note });
  revalidatePath("/admin/payments");
  if (r.ok) await audit(getDb(), { actor: userId, action: "payment.reject", table: "payments", id: r.payment.id, summary: `Rejected ${formatPesos(r.payment.amountCentavos)} from ${r.payment.payerName}`, details: note ? { note } : null });
  return r;
}

export async function saveCampaignAction(input) {
  const { userId } = await requireArea("content");
  const r = await saveCampaign(getDb(), input);
  if (r.ok) {
    refreshMoney();
    await audit(getDb(), { actor: userId, action: input?.id ? "campaign.update" : "campaign.create", table: "campaigns", id: r.campaign.id, summary: `${input?.id ? "Edited" : "Created"} campaign "${r.campaign.title}"` });
    revalidatePath("/admin/campaigns");
  }
  return r;
}

export async function recordExpenseAction(input) {
  const { userId } = await requireArea("content");
  const r = await recordExpense(getDb(), input, { userId });
  if (r.ok) {
    await audit(getDb(), { actor: userId, action: "expense.record", table: "expenses", id: r.expense.id, summary: `Recorded expense ${formatPesos(r.expense.amountCentavos)}: ${r.expense.description}` });
    revalidatePath("/admin/expenses");
    revalidatePath("/transparency");
  }
  return r;
}
