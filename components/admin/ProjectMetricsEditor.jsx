"use client";

import { useState, useTransition } from "react";
import { METRICS } from "@/lib/proof/metric-labels.js";
import { setProjectMetricsAction } from "@/app/admin/projects/actions.js";

export default function ProjectMetricsEditor({ projectId, initial }) {
  const [rows, setRows] = useState(initial.length ? initial.map((m) => ({ metric: m.metric, value: String(m.value) })) : []);
  const [message, setMessage] = useState(null);
  const [pending, start] = useTransition();
  const update = (i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const save = () => start(async () => {
    try {
      const r = await setProjectMetricsAction(projectId, rows.filter((r) => r.value !== ""));
      setMessage(r.ok ? "Impact numbers saved." : r.errors.join(" "));
    } catch (e) {
      setMessage(`Couldn't save (${e.message})`);
    }
  });
  return (
    <section>
      <h2 className="syne">Impact numbers</h2>
      {rows.map((r, i) => (
        <div className="actions" key={i}>
          <select aria-label="Metric" value={r.metric} onChange={(e) => update(i, { metric: e.target.value })}>
            {Object.entries(METRICS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <input aria-label="Value" type="number" min="0" step="1" value={r.value} onChange={(e) => update(i, { value: e.target.value })} />
          <button type="button" className="tool" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>Remove</button>
        </div>
      ))}
      <p className="actions">
        <button type="button" className="tool" onClick={() => setRows((rs) => [...rs, { metric: "people_reached", value: "" }])}>Add a number</button>
        <button type="button" className="btn" disabled={pending} onClick={save}>Save impact numbers</button>
      </p>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
