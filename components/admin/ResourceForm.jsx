"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import FileUpload from "./FileUpload.jsx";
import { createResourceAction, deleteResourceAction } from "@/app/admin/resources/actions.js";

export function DeleteResourceButton({ id }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" className="tool" disabled={pending} onClick={() => start(async () => { await deleteResourceAction(id); router.refresh(); })}>
      Delete
    </button>
  );
}

export default function ResourceForm() {
  const router = useRouter();
  const [form, setForm] = useState({ title: "", description: "", kind: "template", visibility: "public", fileUrl: "" });
  const [errors, setErrors] = useState([]);
  const [pending, start] = useTransition();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = () => start(async () => {
    const r = await createResourceAction(form);
    if (!r.ok) { setErrors(r.errors); return; }
    setErrors([]);
    setForm({ title: "", description: "", kind: "template", visibility: "public", fileUrl: "" });
    router.refresh();
  });

  return (
    <section className="editor__side">
      <h2 className="syne">Add a resource</h2>
      {errors.length > 0 && <div className="form-errors" role="alert"><ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul></div>}
      <div className="field"><label htmlFor="rt">Title</label><input id="rt" value={form.title} onChange={set("title")} /></div>
      <div className="field"><label htmlFor="rd">Description</label><textarea id="rd" rows={2} value={form.description} onChange={set("description")} /></div>
      <div className="field">
        <label htmlFor="rk">Kind</label>
        <select id="rk" value={form.kind} onChange={set("kind")}>
          <option value="template">Template</option><option value="training">Training</option><option value="bylaws">Bylaws</option><option value="other">Other</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="rv">Who can see it</label>
        <select id="rv" value={form.visibility} onChange={set("visibility")}>
          <option value="public">Everyone</option><option value="members">Members only (Phase 4)</option>
        </select>
      </div>
      {form.fileUrl ? <p>File ready: {form.fileUrl.split("/").pop()}</p> : (
        <FileUpload accept="application/pdf,image/jpeg,image/png,image/webp" label="File" onUploaded={({ url }) => setForm((f) => ({ ...f, fileUrl: url }))} />
      )}
      <button type="button" className="btn" disabled={pending} onClick={submit}>Add resource</button>
    </section>
  );
}
