"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestEntryAction } from "@/app/members/actions.js";

const EMPTY = { kind: "training", title: "", date: "", note: "" };

export default function PassportRequestForm() {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [result, setResult] = useState(null);
  const [pending, start] = useTransition();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = () => start(async () => {
    try {
      const r = await requestEntryAction(form);
      setResult(r);
      if (r.ok) { setForm(EMPTY); router.refresh(); }
    } catch (e) {
      setResult({ ok: false, errors: [`Couldn't send (${e.message}). Try again.`] });
    }
  });
  return (
    <form className="public-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div className="field">
        <label htmlFor="pp-kind">What kind?</label>
        <select id="pp-kind" value={form.kind} onChange={set("kind")}>
          <option value="training">Training</option>
          <option value="project_led">Project I led</option>
          <option value="project_joined">Project I joined</option>
          <option value="award">Award</option>
          <option value="position">Position</option>
        </select>
      </div>
      <div className="field"><label htmlFor="pp-title">Title</label><input id="pp-title" value={form.title} onChange={set("title")} placeholder="e.g. Effective Communication training" /></div>
      <div className="field"><label htmlFor="pp-date">Date</label><input id="pp-date" type="date" value={form.date} onChange={set("date")} /></div>
      <div className="field"><label htmlFor="pp-note">Note for the admin (optional)</label><textarea id="pp-note" rows={3} value={form.note} onChange={set("note")} /></div>
      {result && !result.ok && <div className="form-errors" role="alert"><ul>{result.errors.map((e) => <li key={e}>{e}</li>)}</ul></div>}
      {result?.ok && <p className="form-ok" role="status">Sent — an admin will verify it.</p>}
      <button className="btn" type="submit" disabled={pending}>{pending ? "Sending…" : "Request entry"}</button>
    </form>
  );
}
