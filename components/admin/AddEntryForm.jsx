"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addEntryAction } from "@/app/admin/members/actions.js";

const EMPTY = { memberId: "", kind: "training", title: "", date: "", note: "", points: "" };

export default function AddEntryForm({ members }) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState([]);
  const [pending, start] = useTransition();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = () => start(async () => {
    try {
      if (!form.memberId) { setErrors(["Choose a member"]); return; }
      const r = await addEntryAction(form.memberId, form);
      if (!r.ok) { setErrors(r.errors); return; }
      setErrors([]);
      setForm(EMPTY);
      router.refresh();
    } catch (e) {
      setErrors([`Couldn't save (${e.message})`]);
    }
  });
  return (
    <section className="editor__side">
      <h2 className="syne">Add a verified entry</h2>
      {errors.length > 0 && <div className="form-errors" role="alert"><ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul></div>}
      <div className="field">
        <label htmlFor="ae-member">Member</label>
        <select id="ae-member" value={form.memberId} onChange={set("memberId")}>
          <option value="">Choose…</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="ae-kind">Kind</label>
        <select id="ae-kind" value={form.kind} onChange={set("kind")}>
          <option value="training">Training</option><option value="project_led">Project led</option><option value="project_joined">Project joined</option><option value="award">Award</option><option value="position">Position</option>
        </select>
      </div>
      <div className="field"><label htmlFor="ae-title">Title</label><input id="ae-title" value={form.title} onChange={set("title")} /></div>
      <div className="field"><label htmlFor="ae-date">Date</label><input id="ae-date" type="date" value={form.date} onChange={set("date")} /></div>
      <div className="field"><label htmlFor="ae-points">Points (empty = default)</label><input id="ae-points" type="number" min="0" value={form.points} onChange={set("points")} /></div>
      <div className="field"><label htmlFor="ae-note">Note</label><input id="ae-note" value={form.note} onChange={set("note")} /></div>
      <button type="button" className="btn" disabled={pending} onClick={save}>Add entry</button>
    </section>
  );
}
