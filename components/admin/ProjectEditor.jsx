"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import RichTextEditor from "./RichTextEditor.jsx";
import FileUpload from "./FileUpload.jsx";
import ProjectMetricsEditor from "./ProjectMetricsEditor.jsx";
import { parseCoordinates } from "@/lib/proof/location.js";
import ProjectMediaEditor from "./ProjectMediaEditor.jsx";
import { saveProjectAction, addProjectPhotoAction, deleteProjectPhotoAction } from "@/app/admin/projects/actions.js";

const fields = ["title", "summary", "startDate", "endDate", "barangay", "pillar", "status", "coverUrl", "coverAlt", "bodyJson", "bodyHtml", "lat", "lng"];

export default function ProjectEditor({ project, metrics = [] }) {
  const router = useRouter();
  const [form, setForm] = useState(() =>
    Object.fromEntries(fields.map((k) => [k, project?.[k === "bodyHtml" ? "body" : k] ?? (k === "pillar" ? "community" : k === "status" ? "done" : "")])),
  );
  const [meta, setMeta] = useState(project ? { id: project.id, updatedAt: project.updatedAt, slug: project.slug } : null);
  const [photos, setPhotos] = useState(project?.photos ?? []);
  const [errors, setErrors] = useState([]);
  const [notice, setNotice] = useState(null);
  const [pending, start] = useTransition();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = () => start(async () => {
    try {
      const r = await saveProjectAction({ ...form, id: meta?.id, expectedUpdatedAt: meta?.updatedAt ?? null });
      if (!r.ok) { setErrors(r.errors); return; }
      setErrors([]);
      setNotice("Saved — live now.");
      setMeta({ id: r.project.id, updatedAt: r.project.updatedAt, slug: r.project.slug });
      if (!project) router.replace(`/admin/projects/${r.project.id}`);
    } catch (e) {
      setErrors([`Couldn't save (${e.message}). Your text is still here — check your connection and try again.`]);
    }
  });

  return (
    <div className="editor">
      <div>
        <input className="title-input" aria-label="Title" placeholder="Project title" value={form.title} onChange={set("title")} />
        {errors.length > 0 && <div className="form-errors" role="alert"><ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul></div>}
        {notice && <p className="form-ok" role="status">{notice}</p>}
        <RichTextEditor initialJson={project?.bodyJson ?? null} initialHtml={project?.body ?? null} onChange={({ json, html }) => setForm((f) => ({ ...f, bodyJson: json, bodyHtml: html }))} />
        {meta && (<>
          <ProjectMetricsEditor projectId={meta.id} initial={metrics} />
          <section>
            <h2 className="syne">Gallery</h2>
            <ul>
              {photos.map((p) => (
                <li key={p.id}>
                  {p.alt}{" "}
                  <button type="button" className="tool" onClick={() => start(async () => {
                    const r = await deleteProjectPhotoAction(p.id, meta.slug);
                    if (r.ok) setPhotos((ps) => ps.filter((x) => x.id !== p.id));
                  })}>Remove</button>
                </li>
              ))}
            </ul>
            <FileUpload accept="image/jpeg,image/png,image/webp" requireAlt label="Add a photo" onUploaded={({ url, alt }) => start(async () => {
              const r = await addProjectPhotoAction({ projectId: meta.id, url, alt });
              if (r.ok) setPhotos((ps) => [...ps, r.photo]); else setErrors(r.errors);
            })} />
          </section>
          <ProjectMediaEditor projectId={meta.id} slug={meta.slug} initial={project?.media ?? []} />
        </>)}
      </div>
      <aside className="editor__side">
        <div className="actions">
          <button type="button" className="btn" disabled={pending} onClick={save}>Save</button>
          {meta && <a href={`/projects/${meta.slug}`} target="_blank" rel="noreferrer">View</a>}
        </div>
        <div className="field"><label htmlFor="summary">Summary</label><textarea id="summary" rows={3} value={form.summary} onChange={set("summary")} /></div>
        <div className="field"><label htmlFor="start">Start date</label><input id="start" type="date" value={form.startDate} onChange={set("startDate")} /></div>
        <div className="field"><label htmlFor="end">End date</label><input id="end" type="date" value={form.endDate} onChange={set("endDate")} /></div>
        <div className="field"><label htmlFor="brgy">Barangay</label><input id="brgy" value={form.barangay} onChange={set("barangay")} /></div>
        <div className="field">
          <label htmlFor="loc-paste">Location (paste "lat, lng" or a Google Maps link)</label>
          <input id="loc-paste" placeholder="11.5853, 122.7511" onChange={(e) => {
            const c = parseCoordinates(e.target.value);
            if (c) setForm((f) => ({ ...f, lat: String(c.lat), lng: String(c.lng) }));
          }} />
        </div>
        <div className="field"><label htmlFor="lat">Latitude</label><input id="lat" inputMode="decimal" value={form.lat} onChange={set("lat")} /></div>
        <div className="field"><label htmlFor="lng">Longitude</label><input id="lng" inputMode="decimal" value={form.lng} onChange={set("lng")} /></div>
        <div className="field">
          <label htmlFor="pillar">Pillar</label>
          <select id="pillar" value={form.pillar} onChange={set("pillar")}>
            <option value="leadership">Leadership</option><option value="community">Community</option><option value="global">Global</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="status">Status</label>
          <select id="status" value={form.status} onChange={set("status")}>
            <option value="planned">Planned</option><option value="ongoing">Ongoing</option><option value="done">Done</option>
          </select>
        </div>
        {form.coverUrl ? (
          <div className="field">
            <label>Cover image</label>
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
