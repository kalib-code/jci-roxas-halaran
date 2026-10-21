"use client";

import { useEffect, useState } from "react";
import Turnstile, { turnstileEnabled } from "./Turnstile.jsx";
import FormStatus from "./FormStatus.jsx";
import { useSubmit } from "./useSubmit.js";
import { applyAction } from "@/app/actions/engagement.js";
import { t } from "@/lib/i18n.js";

const EMPTY = { name: "", email: "", phone: "", birthdate: "", barangay: "", whyJoin: "", referredBy: "", consent: false };

export default function ApplicationForm({ lang = "en" }) {
  const [form, setForm] = useState(EMPTY);
  const [token, setToken] = useState("");
  const { submit, pending, result } = useSubmit(applyAction);
  const [resetKey, setResetKey] = useState(0);
  // The server used up the token; get a fresh one so a retry can pass.
  useEffect(() => { if (result && !result.ok) setResetKey((k) => k + 1); }, [result]);
  const waitingForCheck = turnstileEnabled() && !token;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const L = (key) => t(lang, key);

  if (result?.ok) return <p className="form-ok" role="status">{result.message}</p>;
  return (
    <form className="public-form" onSubmit={(e) => { e.preventDefault(); submit({ ...form, turnstileToken: token }); }}>
      <div className="field"><label htmlFor="ap-name">{L("form.fullName")}</label><input id="ap-name" value={form.name} onChange={set("name")} required autoComplete="name" /></div>
      <div className="field"><label htmlFor="ap-email">{L("form.email")}</label><input id="ap-email" type="email" value={form.email} onChange={set("email")} required autoComplete="email" /></div>
      <div className="field"><label htmlFor="ap-phone">{L("form.mobile")}</label><input id="ap-phone" value={form.phone} onChange={set("phone")} autoComplete="tel" /></div>
      <div className="field"><label htmlFor="ap-birth">{L("form.birthdate")}</label><input id="ap-birth" type="date" value={form.birthdate} onChange={set("birthdate")} required /></div>
      <div className="field"><label htmlFor="ap-brgy">{L("form.barangay")}</label><input id="ap-brgy" value={form.barangay} onChange={set("barangay")} /></div>
      <div className="field"><label htmlFor="ap-why">{L("form.whyJoin")}</label><textarea id="ap-why" rows={4} value={form.whyJoin} onChange={set("whyJoin")} /></div>
      <div className="field"><label htmlFor="ap-ref">{L("form.referredBy")}</label><input id="ap-ref" value={form.referredBy} onChange={set("referredBy")} /></div>
      <label className="consent"><input type="checkbox" checked={form.consent} onChange={set("consent")} required /> {L("form.consentApply")}</label>
      <Turnstile onToken={setToken} resetKey={resetKey} />
      <FormStatus result={result} />
      <button className="btn" type="submit" disabled={pending || waitingForCheck}>{pending ? L("form.sending") : L("form.apply")}</button>
    </form>
  );
}
