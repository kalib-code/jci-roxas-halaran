"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveDriveAction } from "@/app/admin/volunteers/actions.js";

const blankRole = () => ({ key: crypto.randomUUID(), id: null, label: "", description: "", slots: "" });
const toRow = (r) => ({ key: `r${r.id}`, id: r.id, label: r.label, description: r.description ?? "", slots: r.slots ?? "", taken: r.taken + r.waitlist });

// `drive` when editing; otherwise `draft` (filled in from an event or project) for a new one.
export default function DriveEditor({ drive, draft = {}, events, projects }) {
  const router = useRouter();
  const src = drive ?? draft;
  const [form, setForm] = useState({
    title: src.title ?? "",
    slug: "",
    description: src.description ?? "",
    eventId: src.eventId ?? "",
    projectId: src.projectId ?? "",
    startsAt: src.startsAt ?? "",
    venue: src.venue ?? "",
    closesOn: src.closesOn ?? "",
    open: src.open ?? true,
  });
  const [roles, setRoles] = useState(drive ? drive.roles.map(toRow) : [blankRole()]);
  const [meta, setMeta] = useState(drive ? { id: drive.id, updatedAt: drive.updatedAt } : null);
  const [errors, setErrors] = useState([]);
  const [notice, setNotice] = useState(null);
  const [pending, start] = useTransition();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const setRole = (key, k) => (e) => setRoles((rs) => rs.map((r) => (r.key === key ? { ...r, [k]: e.target.value } : r)));

  const save = () => start(async () => {
    try {
      // A role row left completely empty is just unused, not an error.
      const filled = roles.filter((r) => r.id || r.label.trim() || String(r.slots).trim() || r.description.trim());
      const r = await saveDriveAction({
        ...form,
        roles: filled.map(({ id, label, description, slots }) => ({ id, label, description, slots })),
        id: meta?.id,
        expectedUpdatedAt: meta?.updatedAt,
      });
      if (!r.ok) { setErrors(r.errors); setNotice(null); return; }
      setErrors([]);
      setNotice("Saved — the sign-up page is up to date.");
      setMeta({ id: r.drive.id, updatedAt: r.drive.updatedAt });
      setRoles(r.drive.roles.map(toRow));
      if (!drive) router.replace(`/admin/volunteers/${r.drive.id}`);
      else router.refresh();
    } catch (e) {
      setErrors([`Couldn't save (${e.message}). Your changes are still here — try again.`]);
    }
  });

  return (
    <div className="editor">
      <div className="drive-editor__main">
        <input className="title-input" aria-label="Title" placeholder="Volunteers for…" value={form.title} onChange={set("title")} />
        {errors.length > 0 && <div className="form-errors" role="alert"><ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul></div>}
        {notice && <p className="form-ok" role="status">{notice}</p>}
        <div className="field">
          <label htmlFor="vd-desc">What volunteers will do</label>
          <textarea id="vd-desc" rows={5} value={form.description} onChange={set("description")} placeholder="Call time, what to wear or bring, who to look for on the day…" />
        </div>

        <fieldset className="drive-roles">
          <legend>Roles</legend>
          <p className="count">Volunteers pick one. Leave spots empty for no limit. With no roles, anyone can sign up.</p>
          {roles.map((r, i) => (
            <div className="drive-role" key={r.key}>
              <div className="field drive-role__label"><label htmlFor={`vr-${r.key}-label`}>Role {i + 1}</label><input id={`vr-${r.key}-label`} value={r.label} onChange={setRole(r.key, "label")} placeholder="Registration desk" /></div>
              <div className="field drive-role__slots"><label htmlFor={`vr-${r.key}-slots`}>Spots</label><input id={`vr-${r.key}-slots`} type="number" min="1" value={r.slots} onChange={setRole(r.key, "slots")} placeholder="Any" /></div>
              <div className="field drive-role__desc"><label htmlFor={`vr-${r.key}-desc`}>Details (optional)</label><input id={`vr-${r.key}-desc`} value={r.description} onChange={setRole(r.key, "description")} placeholder="7 am call time" /></div>
              <button
                type="button"
                className="tool drive-role__remove"
                disabled={r.taken > 0}
                title={r.taken > 0 ? "Remove its volunteers first" : undefined}
                onClick={() => setRoles((rs) => rs.filter((x) => x.key !== r.key))}
              >
                Remove
              </button>
            </div>
          ))}
          <button type="button" className="tool" onClick={() => setRoles((rs) => [...rs, blankRole()])}>Add a role</button>
        </fieldset>
      </div>

      <aside className="editor__side">
        <div className="actions">
          <button type="button" className="btn" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save"}</button>
        </div>
        <label className="consent"><input type="checkbox" checked={form.open} onChange={set("open")} /> Taking sign-ups</label>
        {!drive && <div className="field"><label htmlFor="vd-slug">Address (optional)</label><input id="vd-slug" value={form.slug} onChange={set("slug")} placeholder="made from the title" /></div>}
        <div className="field"><label htmlFor="vd-close">Last day to sign up (optional)</label><input id="vd-close" type="date" value={form.closesOn} onChange={set("closesOn")} /></div>
        <div className="field"><label htmlFor="vd-start">When volunteers are needed (Philippine time)</label><input id="vd-start" type="datetime-local" value={form.startsAt} onChange={set("startsAt")} /></div>
        <div className="field"><label htmlFor="vd-venue">Where</label><input id="vd-venue" value={form.venue} onChange={set("venue")} /></div>
        <div className="field">
          <label htmlFor="vd-event">Event</label>
          <select id="vd-event" value={form.eventId} onChange={set("eventId")}>
            <option value="">None</option>
            {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="vd-proj">Project</label>
          <select id="vd-proj" value={form.projectId} onChange={set("projectId")}>
            <option value="">None</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
        <p className="count">Linking an event or project shows a sign-up button on its page while this is taking sign-ups.</p>
      </aside>
    </div>
  );
}
