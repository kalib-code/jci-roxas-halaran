"use client";

import { useEffect, useState } from "react";
import Turnstile, { turnstileEnabled } from "./Turnstile.jsx";
import FormStatus from "./FormStatus.jsx";
import { useSubmit } from "./useSubmit.js";
import { driveSignupAction } from "@/app/actions/engagement.js";

// What a role card says under its name: spots left, waitlist or full.
function roleNote(r) {
  const left = r.slots ? Math.max(r.slots - r.taken, 0) : null;
  const status = !r.seat ? "Full" : r.seat === "waitlist" ? "Full — join the waitlist" : left === null ? null : `${left} of ${r.slots} spot${r.slots === 1 ? "" : "s"} left`;
  return [r.description, status].filter(Boolean).join(" · ");
}

// `roles` come with `seat` ("confirmed", "waitlist" or null) worked out on the server.
export default function DriveSignupForm({ driveId, roles }) {
  const firstOpen = roles.find((r) => r.seat);
  const [form, setForm] = useState({ name: "", email: "", phone: "", skills: "", consent: false, roleId: roles.length === 1 && firstOpen ? String(firstOpen.id) : "" });
  const [token, setToken] = useState("");
  const { submit, pending, result } = useSubmit(driveSignupAction);
  const [resetKey, setResetKey] = useState(0);
  // The server used up the token; get a fresh one so a retry can pass.
  useEffect(() => { if (result && !result.ok) setResetKey((k) => k + 1); }, [result]);
  const waitingForCheck = turnstileEnabled() && !token;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  if (result?.ok) return <div className="checkin__saved" role="status"><p className="checkin__welcome">{result.message}</p><p>We sent a copy to {form.email}.</p></div>;
  if (roles.length > 0 && !firstOpen) return <p className="form-errors">Every role is filled. Thank you for wanting to help! Watch our events page for the next one.</p>;
  return (
    <form className="public-form" onSubmit={(e) => { e.preventDefault(); submit({ ...form, driveId, turnstileToken: token }); }}>
      {roles.length > 0 && (
        <fieldset className="checkin__choice">
          <legend>How would you like to help?</legend>
          {roles.map((r) => (
            <label key={r.id} className={`checkin__option${r.seat ? "" : " checkin__option--off"}`}>
              <input type="radio" name="vd-role" value={r.id} checked={form.roleId === String(r.id)} onChange={set("roleId")} disabled={!r.seat} required />
              <span><strong>{r.label}</strong>{roleNote(r) && <small>{roleNote(r)}</small>}</span>
            </label>
          ))}
        </fieldset>
      )}
      <div className="field"><label htmlFor="vd-name">Name</label><input id="vd-name" value={form.name} onChange={set("name")} required autoComplete="name" /></div>
      <div className="field"><label htmlFor="vd-email">Email</label><input id="vd-email" type="email" value={form.email} onChange={set("email")} required autoComplete="email" /></div>
      <div className="field"><label htmlFor="vd-phone">Mobile (optional)</label><input id="vd-phone" value={form.phone} onChange={set("phone")} autoComplete="tel" inputMode="tel" /></div>
      <div className="field"><label htmlFor="vd-note">Anything we should know? (optional)</label><input id="vd-note" value={form.skills} onChange={set("skills")} placeholder="Skills, T-shirt size, time you can arrive…" /></div>
      <label className="consent"><input type="checkbox" checked={form.consent} onChange={set("consent")} required /> I agree that JCI Roxas Halaran may contact me about volunteering, under the Data Privacy Act of 2012.</label>
      <Turnstile onToken={setToken} resetKey={resetKey} />
      <FormStatus result={result} />
      <button className="btn btn--lg" type="submit" disabled={pending || waitingForCheck}>{pending ? "Sending…" : "Sign up to volunteer"}</button>
    </form>
  );
}
