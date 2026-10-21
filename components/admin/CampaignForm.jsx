"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import FileUpload from "./FileUpload.jsx";
import { saveCampaignAction } from "@/app/admin/payments/actions.js";

export default function CampaignForm({ campaign, projects }) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: campaign?.title ?? "",
    description: campaign?.description ?? "",
    projectId: campaign?.projectId ?? "",
    goalPesos: campaign ? campaign.goalCentavos / 100 : "",
    qrImageUrl: campaign?.qrImageUrl ?? "",
    qrImageAlt: campaign?.qrImageAlt ?? "",
    paymentInstructions: campaign?.paymentInstructions ?? "",
    open: campaign?.open ?? true,
  });
  const [errors, setErrors] = useState([]);
  const [pending, start] = useTransition();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const save = () => start(async () => {
    try {
      const r = await saveCampaignAction({ ...form, id: campaign?.id });
      if (!r.ok) { setErrors(r.errors); return; }
      setErrors([]);
      router.replace("/admin/campaigns");
      router.refresh();
    } catch (e) {
      setErrors([`Couldn't save (${e.message}).`]);
    }
  });

  return (
    <section className="editor__side">
      <h2 className="syne">{campaign ? `Edit: ${campaign.title}` : "New campaign"}</h2>
      {errors.length > 0 && <div className="form-errors" role="alert"><ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul></div>}
      <div className="field"><label htmlFor="ca-title">Title</label><input id="ca-title" value={form.title} onChange={set("title")} /></div>
      <div className="field"><label htmlFor="ca-desc">Description</label><textarea id="ca-desc" rows={3} value={form.description} onChange={set("description")} /></div>
      <div className="field"><label htmlFor="ca-goal">Goal (₱)</label><input id="ca-goal" type="number" min="1" value={form.goalPesos} onChange={set("goalPesos")} /></div>
      <div className="field">
        <label htmlFor="ca-proj">Project</label>
        <select id="ca-proj" value={form.projectId} onChange={set("projectId")}>
          <option value="">None</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </div>
      <div className="field"><label htmlFor="ca-how">Payment instructions</label><textarea id="ca-how" rows={3} value={form.paymentInstructions} onChange={set("paymentInstructions")} placeholder="GCash 0917 000 0000 — Juan Dela Cruz" /></div>
      {form.qrImageUrl ? (
        <div className="field">
          <span className="count">QR image</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={form.qrImageUrl} alt={form.qrImageAlt} style={{ maxWidth: 200 }} />
          <input aria-label="QR alt text" value={form.qrImageAlt} onChange={set("qrImageAlt")} />
          <button type="button" className="tool" onClick={() => setForm((f) => ({ ...f, qrImageUrl: "", qrImageAlt: "" }))}>Remove QR</button>
        </div>
      ) : (
        <FileUpload accept="image/jpeg,image/png,image/webp" requireAlt label="QR image" onUploaded={({ url, alt }) => setForm((f) => ({ ...f, qrImageUrl: url, qrImageAlt: alt }))} />
      )}
      <label className="consent"><input type="checkbox" checked={form.open} onChange={set("open")} /> Open for donations</label>
      <button type="button" className="btn" disabled={pending} onClick={save}>Save campaign</button>
    </section>
  );
}
