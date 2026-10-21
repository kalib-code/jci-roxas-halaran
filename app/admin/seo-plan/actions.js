"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db.js";
import { requireArea } from "@/lib/auth.js";
import { addPlanKeyword, setPlanStatus } from "@/lib/content/seoPlan.js";

const num = (v) => (v === null || v === "" ? null : Number(v));

export async function addPlanKeywordAction(formData) {
  await requireArea("content");
  await addPlanKeyword(getDb(), {
    month: String(formData.get("month") ?? ""),
    keyword: String(formData.get("keyword") ?? ""),
    volume: num(formData.get("volume")),
    kd: num(formData.get("kd")),
    workingTitle: String(formData.get("workingTitle") ?? "") || null,
  });
  revalidatePath("/admin/seo-plan");
}

export async function setPlanStatusAction(formData) {
  await requireArea("content");
  await setPlanStatus(getDb(), Number(formData.get("id")), String(formData.get("status")));
  revalidatePath("/admin/seo-plan");
}
