"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db.js";
import { requireArea } from "@/lib/auth.js";
import { addPlanKeyword, setPlanStatus } from "@/lib/content/seoPlan.js";
import { audit } from "@/lib/audit.js";

const num = (v) => (v === null || v === "" ? null : Number(v));

export async function addPlanKeywordAction(formData) {
  const { userId } = await requireArea("content");
  await addPlanKeyword(getDb(), {
    month: String(formData.get("month") ?? ""),
    keyword: String(formData.get("keyword") ?? ""),
    volume: num(formData.get("volume")),
    kd: num(formData.get("kd")),
    workingTitle: String(formData.get("workingTitle") ?? "") || null,
  });
  await audit(getDb(), { actor: userId, action: "seo.add_keyword", table: "seo_plan", summary: `Added SEO keyword "${String(formData.get("keyword") ?? "")}"` });
  revalidatePath("/admin/seo-plan");
}

export async function setPlanStatusAction(formData) {
  const { userId } = await requireArea("content");
  await setPlanStatus(getDb(), Number(formData.get("id")), String(formData.get("status")));
  await audit(getDb(), { actor: userId, action: "seo.set_status", table: "seo_plan", id: Number(formData.get("id")), summary: `Set SEO plan item #${formData.get("id")} to ${formData.get("status")}` });
  revalidatePath("/admin/seo-plan");
}
