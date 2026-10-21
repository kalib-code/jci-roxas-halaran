"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import FileUpload from "./FileUpload.jsx";
import { recordExpenseAction } from "@/app/admin/payments/actions.js";

const EMPTY = { amountPesos: "", description: "", spentOn: "", projectId: "", campaignId: "", receiptUrl: "" };

export default function ExpenseForm({ projects, campaigns }) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState([]);
  const [pending, start] = useTransition();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = () => start(async () => {
    try {
      const r = await recordExpenseAction(form);
      if (!r.ok) { setErrors(r.errors); return; }
      setErrors([]);
      setForm(EMPTY);
      router.refresh();
    } catch (e) {
      setErrors([`Couldn't save (${e.message}).`]);
    }
  });
  return (
    <section className="editor__side">
      <h2 className="syne">Record an expense</h2>
      {errors.length > 0 && <div className="form-errors" role="alert"><ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul></div>}
      <div className="field"><label htmlFor="ex-amt">Amount (₱)</label><input id="ex-amt" type="number" min="0.01" step="0.01" value={form.amountPesos} onChange={set("amountPesos")} /></div>
      <div className="field"><label htmlFor="ex-desc">What was it for?</label><input id="ex-desc" value={form.description} onChange={set("description")} /></div>
      <div className="field"><label htmlFor="ex-date">Date</label><input id="ex-date" type="date" value={form.spentOn} onChange={set("spentOn")} /></div>
      <div className="field">
        <label htmlFor="ex-proj">Project</label>
        <select id="ex-proj" value={form.projectId} onChange={set("projectId")}>
          <option value="">None</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="ex-camp">Campaign</label>
        <select id="ex-camp" value={form.campaignId} onChange={set("campaignId")}>
          <option value="">None</option>
          {campaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </div>
      {form.receiptUrl ? <p>Receipt attached.</p> : (
        <FileUpload accept="image/jpeg,image/png,image/webp,application/pdf" label="Receipt (optional)" onUploaded={({ url }) => setForm((f) => ({ ...f, receiptUrl: url }))} />
      )}
      <button type="button" className="btn" disabled={pending} onClick={save}>Record expense</button>
    </section>
  );
}
