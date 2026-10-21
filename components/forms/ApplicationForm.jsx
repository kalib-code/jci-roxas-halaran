"use client";

import { useState } from "react";
import Turnstile from "./Turnstile.jsx";
import FormStatus from "./FormStatus.jsx";
import { useSubmit } from "./useSubmit.js";
import { applyAction } from "@/app/actions/engagement.js";

const EMPTY = { name: "", email: "", phone: "", birthdate: "", barangay: "", whyJoin: "", referredBy: "", consent: false };

export default function ApplicationForm() {
  const [form, setForm] = useState(EMPTY);
  const [token, setToken] = useState("");
  const { submit, pending, result } = useSubmit(applyAction);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  if (result?.ok) return <p className="form-ok" role="status">{result.message}</p>;
  return (
    <form className="public-form" onSubmit={(e) => { e.preventDefault(); submit({ ...form, turnstileToken: token }); }}>
      <div className="field"><label htmlFor="ap-name">Full name</label><input id="ap-name" value={form.name} onChange={set("name")} required autoComplete="name" /></div>
      <div className="field"><label htmlFor="ap-email">Email</label><input id="ap-email" type="email" value={form.email} onChange={set("email")} required autoComplete="email" /></div>
      <div className="field"><label htmlFor="ap-phone">Mobile</label><input id="ap-phone" value={form.phone} onChange={set("phone")} autoComplete="tel" /></div>
      <div className="field"><label htmlFor="ap-birth">Birthdate</label><input id="ap-birth" type="date" value={form.birthdate} onChange={set("birthdate")} required /></div>
      <div className="field"><label htmlFor="ap-brgy">Barangay</label><input id="ap-brgy" value={form.barangay} onChange={set("barangay")} /></div>
      <div className="field"><label htmlFor="ap-why">Why do you want to join?</label><textarea id="ap-why" rows={4} value={form.whyJoin} onChange={set("whyJoin")} /></div>
      <div className="field"><label htmlFor="ap-ref">Referred by (optional)</label><input id="ap-ref" value={form.referredBy} onChange={set("referredBy")} /></div>
      <label className="consent"><input type="checkbox" checked={form.consent} onChange={set("consent")} required /> I agree that JCI Roxas Halaran may use these details to process my application, under the Data Privacy Act of 2012.</label>
      <Turnstile onToken={setToken} />
      <FormStatus result={result} />
      <button className="btn" type="submit" disabled={pending}>{pending ? "Sending…" : "Apply"}</button>
    </form>
  );
}
