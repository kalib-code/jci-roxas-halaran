"use client";

import { useEffect, useState } from "react";
import Turnstile, { turnstileEnabled } from "./Turnstile.jsx";
import FormStatus from "./FormStatus.jsx";
import { useSubmit } from "./useSubmit.js";
import { volunteerAction } from "@/app/actions/engagement.js";

export default function VolunteerForm({ projectId = null, eventId = null }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", skills: "", consent: false });
  const [token, setToken] = useState("");
  const { submit, pending, result } = useSubmit(volunteerAction);
  const [resetKey, setResetKey] = useState(0);
  // The server used up the token; get a fresh one so a retry can pass.
  useEffect(() => { if (result && !result.ok) setResetKey((k) => k + 1); }, [result]);
  const waitingForCheck = turnstileEnabled() && !token;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  if (result?.ok) return <p className="form-ok" role="status">{result.message}</p>;
  return (
    <form className="public-form" onSubmit={(e) => { e.preventDefault(); submit({ ...form, projectId, eventId, turnstileToken: token }); }}>
      <div className="field"><label htmlFor="vo-name">Name</label><input id="vo-name" value={form.name} onChange={set("name")} required autoComplete="name" /></div>
      <div className="field"><label htmlFor="vo-email">Email</label><input id="vo-email" type="email" value={form.email} onChange={set("email")} required autoComplete="email" /></div>
      <div className="field"><label htmlFor="vo-phone">Mobile (optional)</label><input id="vo-phone" value={form.phone} onChange={set("phone")} autoComplete="tel" /></div>
      <div className="field"><label htmlFor="vo-skills">How can you help? (optional)</label><input id="vo-skills" value={form.skills} onChange={set("skills")} placeholder="Photography, logistics, first aid…" /></div>
      <label className="consent"><input type="checkbox" checked={form.consent} onChange={set("consent")} required /> I agree that JCI Roxas Halaran may contact me about volunteering, under the Data Privacy Act of 2012.</label>
      <Turnstile onToken={setToken} resetKey={resetKey} />
      <FormStatus result={result} />
      <button className="btn" type="submit" disabled={pending || waitingForCheck}>{pending ? "Sending…" : "Volunteer"}</button>
    </form>
  );
}
