"use client";

import { useState, useTransition } from "react";
import { addProjectMediaAction, deleteProjectMediaAction } from "@/app/admin/projects/actions.js";
import { MEDIA_PROVIDERS } from "@/lib/media.js";

export default function ProjectMediaEditor({ projectId, slug, initial = [] }) {
  const [items, setItems] = useState(initial);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [errors, setErrors] = useState([]);
  const [pending, start] = useTransition();

  const add = () => start(async () => {
    const r = await addProjectMediaAction({ projectId, url, title });
    if (!r.ok) return setErrors(r.errors);
    setItems((xs) => [...xs, r.item]);
    setUrl("");
    setTitle("");
    setErrors([]);
  });

  return (
    <section>
      <h2 className="syne">Video and audio</h2>
      <p className="hint">Paste a link from {MEDIA_PROVIDERS}. It plays on the project page.</p>
      {errors.length > 0 && <div className="form-errors" role="alert"><ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul></div>}
      <ul>
        {items.map((m) => (
          <li key={m.id}>
            <a href={m.url} target="_blank" rel="noreferrer">{m.title}</a>{" "}
            <button type="button" className="tool" disabled={pending} onClick={() => start(async () => {
              const r = await deleteProjectMediaAction(m.id, slug);
              if (r.ok) setItems((xs) => xs.filter((x) => x.id !== m.id));
            })}>Remove</button>
          </li>
        ))}
      </ul>
      <div className="field"><label htmlFor="media-url">Link</label><input id="media-url" type="url" placeholder="https://www.facebook.com/reel/…" value={url} onChange={(e) => setUrl(e.target.value)} /></div>
      <div className="field"><label htmlFor="media-title">Title</label><input id="media-title" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <button type="button" className="btn btn--ghost" disabled={pending || !url} onClick={add}>Add video or audio</button>
    </section>
  );
}
