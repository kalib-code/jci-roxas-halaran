"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db.js";
import { requireArea } from "@/lib/auth.js";
import { SUPPORT_PATHS, revalidateAll } from "@/lib/revalidate.js";
import { confirmPayment, rejectPayment, saveCampaign, recordExpense } from "@/lib/engagement/money.js";

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
  if (r.ok) refreshMoney();
  return r.ok ? { ok: true, type: r.payment.type, linkedMember: r.linkedMember } : r;
}

export async function rejectPaymentAction(id, note) {
  const { userId } = await requireArea("content");
  const r = await rejectPayment(getDb(), id, { userId, note });
  revalidatePath("/admin/payments");
  return r;
}

export async function saveCampaignAction(input) {
  await requireArea("content");
  const r = await saveCampaign(getDb(), input);
  if (r.ok) {
    refreshMoney();
    revalidatePath("/admin/campaigns");
  }
  return r;
}

export async function recordExpenseAction(input) {
  const { userId } = await requireArea("content");
  const r = await recordExpense(getDb(), input, { userId });
  if (r.ok) {
    revalidatePath("/admin/expenses");
    revalidatePath("/transparency");
  }
  return r;
}
