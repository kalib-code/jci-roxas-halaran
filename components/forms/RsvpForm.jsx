"use client";

import { useEffect, useState } from "react";
import Turnstile, { turnstileEnabled } from "./Turnstile.jsx";
import FormStatus from "./FormStatus.jsx";
import { useSubmit } from "./useSubmit.js";
import { rsvpAction } from "@/app/actions/engagement.js";

export default function RsvpForm({ eventId, full }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", consent: false });
  const [token, setToken] = useState("");
  const { submit, pending, result } = useSubmit(rsvpAction);
  const [resetKey, setResetKey] = useState(0);
  // The server used up the token; get a fresh one so a retry can pass.
  useEffect(() => { if (result && !result.ok) setResetKey((k) => k + 1); }, [result]);
  const waitingForCheck = turnstileEnabled() && !token;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  if (result?.ok) return <p className="form-ok" role="status">{result.message}</p>;
  return (
    <form className="public-form" onSubmit={(e) => { e.preventDefault(); submit({ ...form, eventId, turnstileToken: token }); }}>
      <div className="field"><label htmlFor="rsvp-name">Name</label><input id="rsvp-name" value={form.name} onChange={set("name")} required autoComplete="name" /></div>
      <div className="field"><label htmlFor="rsvp-email">Email</label><input id="rsvp-email" type="email" value={form.email} onChange={set("email")} required autoComplete="email" /></div>
      <div className="field"><label htmlFor="rsvp-phone">Mobile (optional)</label><input id="rsvp-phone" value={form.phone} onChange={set("phone")} autoComplete="tel" /></div>
      <label className="consent"><input type="checkbox" checked={form.consent} onChange={set("consent")} required /> I agree that JCI Roxas Halaran may use these details for this event, under the Data Privacy Act of 2012.</label>
      <Turnstile onToken={setToken} resetKey={resetKey} />
      <FormStatus result={result} />
      <button className="btn" type="submit" disabled={pending || waitingForCheck}>{pending ? "Sending…" : full ? "RSVP — join the waitlist" : "RSVP"}</button>
    </form>
  );
}
