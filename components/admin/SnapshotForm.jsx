"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSnapshotAction } from "@/app/admin/evidence/actions.js";

const blank = { organicClicks: "", impressions: "", visitors: "", note: "" };
const valuesFor = (month, snapshots) => {
  const s = snapshots.find((x) => x.month === month);
  return { month, ...blank, ...(s && { organicClicks: s.organicClicks ?? "", impressions: s.impressions ?? "", visitors: s.visitors ?? "", note: s.note ?? "" }) };
};

// Picking a month loads that month's saved numbers, so one month's figures never land in another.
export default function SnapshotForm({ months, month, snapshots }) {
  const router = useRouter();
  const [form, setForm] = useState(() => valuesFor(month, snapshots));
  const [message, setMessage] = useState(null);
  const [pending, start] = useTransition();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = () => start(async () => {
    try {
      const r = await saveSnapshotAction(form);
      setMessage(r.ok ? "Saved." : r.errors.join(" "));
      if (r.ok) router.refresh();
    } catch (e) {
      setMessage(`Couldn't save (${e.message})`);
    }
  });
  return (
    <section className="editor__side">
      <h2 className="syne">Monthly analytics</h2>
      <div className="field"><label htmlFor="sn-month">Month</label><select id="sn-month" value={form.month} onChange={(e) => { setMessage(null); setForm(valuesFor(e.target.value, snapshots)); }}>
        {months.slice().reverse().map((m) => <option key={m} value={m}>{m}</option>)}
      </select></div>
      <div className="field"><label htmlFor="sn-clicks">Organic clicks (Search Console)</label><input id="sn-clicks" type="number" min="0" value={form.organicClicks} onChange={set("organicClicks")} /></div>
      <div className="field"><label htmlFor="sn-impr">Impressions (Search Console)</label><input id="sn-impr" type="number" min="0" value={form.impressions} onChange={set("impressions")} /></div>
      <div className="field"><label htmlFor="sn-vis">Visitors (GA4)</label><input id="sn-vis" type="number" min="0" value={form.visitors} onChange={set("visitors")} /></div>
      <div className="field"><label htmlFor="sn-note">Note</label><input id="sn-note" value={form.note} onChange={set("note")} /></div>
      <button type="button" className="btn" disabled={pending} onClick={save}>Save analytics</button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
