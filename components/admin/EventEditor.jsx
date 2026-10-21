"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import RichTextEditor from "./RichTextEditor.jsx";
import FileUpload from "./FileUpload.jsx";
import { saveEventAction } from "@/app/admin/events/actions.js";

export default function EventEditor({ event, projects }) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: event?.title ?? "",
    slug: "",
    startAt: event?.startAt ?? "",
    endAt: event?.endAt ?? "",
    venue: event?.venue ?? "",
    capacity: event?.capacity ?? "",
    rsvpOpen: event?.rsvpOpen ?? true,
    projectId: event?.projectId ?? "",
    coverUrl: event?.coverUrl ?? "",
    coverAlt: event?.coverAlt ?? "",
    descriptionJson: event?.descriptionJson ?? "",
    descriptionHtml: event?.description ?? "",
  });
  const [meta, setMeta] = useState(event ? { id: event.id, updatedAt: event.updatedAt, slug: event.slug } : null);
  const [errors, setErrors] = useState([]);
  const [notice, setNotice] = useState(null);
  const [pending, start] = useTransition();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const save = () => start(async () => {
    try {
      const r = await saveEventAction({ ...form, id: meta?.id, expectedUpdatedAt: meta?.updatedAt });
      if (!r.ok) { setErrors(r.errors); return; }
      setErrors([]);
      setNotice("Saved — live now.");
      setMeta({ id: r.event.id, updatedAt: r.event.updatedAt, slug: r.event.slug });
      if (!event) router.replace(`/admin/events/${r.event.id}`);
    } catch (e) {
      setErrors([`Couldn't save (${e.message}). Your changes are still here — try again.`]);
    }
  });

  return (
    <div className="editor">
      <div>
        <input className="title-input" aria-label="Title" placeholder="Event title" value={form.title} onChange={set("title")} />
        {errors.length > 0 && <div className="form-errors" role="alert"><ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul></div>}
        {notice && <p className="form-ok" role="status">{notice}</p>}
        <RichTextEditor initialJson={event?.descriptionJson ?? null} onChange={({ json, html }) => setForm((f) => ({ ...f, descriptionJson: json, descriptionHtml: html }))} />
      </div>
      <aside className="editor__side">
        <div className="actions">
          <button type="button" className="btn" disabled={pending} onClick={save}>Save</button>
          {meta && <a href={`/events/${meta.slug}`} target="_blank" rel="noreferrer">View</a>}
        </div>
        {!event && <div className="field"><label htmlFor="ev-slug">Address (optional)</label><input id="ev-slug" value={form.slug} onChange={set("slug")} placeholder="made from the title" /></div>}
        <div className="field"><label htmlFor="ev-start">Starts (Philippine time)</label><input id="ev-start" type="datetime-local" value={form.startAt} onChange={set("startAt")} /></div>
        <div className="field"><label htmlFor="ev-end">Ends (optional)</label><input id="ev-end" type="datetime-local" value={form.endAt} onChange={set("endAt")} /></div>
        <div className="field"><label htmlFor="ev-venue">Venue</label><input id="ev-venue" value={form.venue} onChange={set("venue")} /></div>
        <div className="field"><label htmlFor="ev-cap">Capacity (empty = unlimited)</label><input id="ev-cap" type="number" min="1" value={form.capacity} onChange={set("capacity")} /></div>
        <label className="consent"><input type="checkbox" checked={form.rsvpOpen} onChange={set("rsvpOpen")} /> RSVPs open</label>
        <div className="field">
          <label htmlFor="ev-proj">Related project</label>
          <select id="ev-proj" value={form.projectId} onChange={set("projectId")}>
            <option value="">None</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
        {form.coverUrl ? (
          <div className="field">
            <span className="count">Cover image</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={form.coverUrl} alt={form.coverAlt} />
            <input aria-label="Cover alt text" value={form.coverAlt} onChange={set("coverAlt")} />
            <button type="button" className="tool" onClick={() => setForm((f) => ({ ...f, coverUrl: "", coverAlt: "" }))}>Remove cover</button>
          </div>
        ) : (
          <FileUpload accept="image/jpeg,image/png,image/webp" requireAlt label="Cover image" onUploaded={({ url, alt }) => setForm((f) => ({ ...f, coverUrl: url, coverAlt: alt }))} />
        )}
      </aside>
    </div>
  );
}
