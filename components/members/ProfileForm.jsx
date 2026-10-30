"use client";

import { useState, useTransition } from "react";
import FileUpload from "@/components/admin/FileUpload.jsx";
import ECard from "@/components/members/ECard.jsx";
import { cardView, cardIsPublic, platformFor, MAX_LINKS } from "@/lib/members/card-view.js";
import { normalizePhone } from "@/lib/members/card.js";
import { updateProfileAction } from "@/app/members/actions.js";

// Each row keeps a key of its own so removing one doesn't shift what's typed in the others.
let nextKey = 0;
const linkRow = (l = {}) => ({ key: nextKey++, url: l.url ?? "", label: l.label ?? "" });

export default function ProfileForm({ member, positions = [] }) {
  const [form, setForm] = useState({
    photoUrl: undefined,
    profession: member.profession ?? "",
    business: member.business ?? "",
    skills: member.skills ?? "",
    bio: member.bio ?? "",
    inDirectory: member.inDirectory,
    phone: member.phone ?? "",
    links: member.links?.length ? member.links.map(linkRow) : [linkRow()],
    cardPublished: member.cardPublished,
    cardShowPhone: member.cardShowPhone,
    cardShowEmail: member.cardShowEmail,
    cardConsent: member.cardPublished,
  });
  const [photo, setPhoto] = useState(member.photoUrl);
  const [result, setResult] = useState(null);
  const [pending, start] = useTransition();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const setLinks = (fn) => setForm((f) => ({ ...f, links: fn(f.links) }));
  const setLink = (key, field) => (e) => setLinks((ls) => ls.map((l) => (l.key === key ? { ...l, [field]: e.target.value } : l)));

  const save = () => start(async () => {
    try {
      setResult(await updateProfileAction(form));
    } catch (e) {
      setResult({ ok: false, errors: [`Couldn't save (${e.message}). Try again.`] });
    }
  });

  const card = cardView({ ...member, ...form, photoUrl: photo, phone: normalizePhone(form.phone) || null }, positions);

  return (
    <div className="profile-editor">
      <form className="public-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <h2 className="syne">About you</h2>
        <div className="field">
          <span className="count">Photo</span>
          <FileUpload accept="image/jpeg,image/png,image/webp" label="Upload a new photo" handleUploadUrl="/api/upload-avatar" onUploaded={({ url }) => { setForm((f) => ({ ...f, photoUrl: url })); setPhoto(url); }} />
        </div>
        <div className="field"><label htmlFor="pr-prof">Profession</label><input id="pr-prof" value={form.profession} onChange={set("profession")} /></div>
        <div className="field"><label htmlFor="pr-biz">Business</label><input id="pr-biz" value={form.business} onChange={set("business")} /></div>
        <div className="field"><label htmlFor="pr-skills">Skills (separate with commas)</label><input id="pr-skills" value={form.skills} onChange={set("skills")} placeholder="Photography, event planning, accounting" /></div>
        <div className="field"><label htmlFor="pr-bio">About you</label><textarea id="pr-bio" rows={5} value={form.bio} onChange={set("bio")} /></div>
        <label className="consent"><input type="checkbox" checked={form.inDirectory} onChange={set("inDirectory")} /> Show me in the member directory (name, photo, profession, business and skills — never your email or phone)</label>

        <h2 className="syne" id="card">Contact &amp; e-calling card</h2>
        <div className="field"><label htmlFor="pr-phone">Mobile or phone</label><input id="pr-phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} placeholder="0917 123 4567" /></div>
        <label className="consent"><input type="checkbox" checked={form.cardShowPhone} onChange={set("cardShowPhone")} /> Show my phone on my card</label>
        <label className="consent"><input type="checkbox" checked={form.cardShowEmail} onChange={set("cardShowEmail")} /> Show my email on my card</label>
        {member.email && <span className="count">Your email: {member.email}</span>}
        <fieldset className="links-editor">
          <legend>Links — Facebook, Discord, TikTok, your shop or website</legend>
          {form.links.map((l, i) => (
            <div className="links-editor__row" key={l.key}>
              <input aria-label={`Link ${i + 1} address`} type="url" value={l.url} onChange={setLink(l.key, "url")} placeholder="https://" />
              <input aria-label={`Link ${i + 1} label`} value={l.label} onChange={setLink(l.key, "label")} maxLength={40} placeholder={l.url ? platformFor(l.url).label : "Label (optional)"} />
              <button className="tool" type="button" aria-label={`Remove link ${i + 1}`} onClick={() => setLinks((ls) => ls.filter((x) => x.key !== l.key))}>Remove</button>
            </div>
          ))}
          {form.links.length < MAX_LINKS && <button className="tool" type="button" onClick={() => setLinks((ls) => [...ls, linkRow()])}>+ Add a link</button>}
          <span className="count">Leave the label blank and we&apos;ll name it from the address (e.g. Discord, Instagram).</span>
        </fieldset>
        <label className="consent"><input type="checkbox" checked={form.cardPublished} onChange={set("cardPublished")} /> Publish my e-calling card</label>
        {form.cardPublished && (
          <label className="consent"><input type="checkbox" checked={form.cardConsent} onChange={set("cardConsent")} /> I agree to show the details I switched on to anyone with my card link.</label>
        )}

        {result && !result.ok && <div className="form-errors" role="alert"><ul>{result.errors.map((e) => <li key={e}>{e}</li>)}</ul></div>}
        {result?.ok && <p className="form-ok" role="status">Profile saved.</p>}
        <button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
      </form>
      <aside className="profile-editor__preview" aria-label="Card preview">
        <span className="label">Live preview</span>
        <ECard card={card} live={cardIsPublic(member)} />
      </aside>
    </div>
  );
}
