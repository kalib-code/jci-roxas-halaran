"use client";

import { useState, useTransition } from "react";
import FileUpload from "@/components/admin/FileUpload.jsx";
import { updateProfileAction } from "@/app/members/actions.js";

export default function ProfileForm({ member }) {
  const [form, setForm] = useState({
    photoUrl: undefined,
    profession: member.profession ?? "",
    business: member.business ?? "",
    skills: member.skills ?? "",
    bio: member.bio ?? "",
    inDirectory: member.inDirectory,
  });
  const [preview, setPreview] = useState(member.photoUrl);
  const [result, setResult] = useState(null);
  const [pending, start] = useTransition();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const save = () => start(async () => {
    try {
      setResult(await updateProfileAction(form));
    } catch (e) {
      setResult({ ok: false, errors: [`Couldn't save (${e.message}). Try again.`] });
    }
  });

  return (
    <form className="public-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <div className="field">
        <span className="count">Photo</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview && <img src={preview} alt={member.name} style={{ maxWidth: 160 }} />}
        <FileUpload accept="image/jpeg,image/png,image/webp" label="Upload a new photo" handleUploadUrl="/api/upload-avatar" onUploaded={({ url }) => { setForm((f) => ({ ...f, photoUrl: url })); setPreview(url); }} />
      </div>
      <div className="field"><label htmlFor="pr-prof">Profession</label><input id="pr-prof" value={form.profession} onChange={set("profession")} /></div>
      <div className="field"><label htmlFor="pr-biz">Business</label><input id="pr-biz" value={form.business} onChange={set("business")} /></div>
      <div className="field"><label htmlFor="pr-skills">Skills (separate with commas)</label><input id="pr-skills" value={form.skills} onChange={set("skills")} placeholder="Photography, event planning, accounting" /></div>
      <div className="field"><label htmlFor="pr-bio">About you</label><textarea id="pr-bio" rows={5} value={form.bio} onChange={set("bio")} /></div>
      <label className="consent"><input type="checkbox" checked={form.inDirectory} onChange={set("inDirectory")} /> Show me in the member directory (name, photo, profession, business and skills — never your email or phone)</label>
      {result && !result.ok && <div className="form-errors" role="alert"><ul>{result.errors.map((e) => <li key={e}>{e}</li>)}</ul></div>}
      {result?.ok && <p className="form-ok" role="status">Profile saved.</p>}
      <button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
    </form>
  );
}
