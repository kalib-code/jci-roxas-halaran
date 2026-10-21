"use client";

import { useEffect, useState } from "react";
import { upload } from "@vercel/blob/client";
import Turnstile, { turnstileEnabled } from "./Turnstile.jsx";
import FormStatus from "./FormStatus.jsx";
import { useSubmit } from "./useSubmit.js";
import { pledgeAction } from "@/app/actions/engagement.js";
import { checkUpload } from "@/lib/uploads.js";

const MAX_PROOF = 5 * 1024 * 1024;

export default function PledgeForm({ campaigns, defaultCampaignId = "" }) {
  const [form, setForm] = useState({ campaignId: defaultCampaignId, type: "donation", payerName: "", payerEmail: "", amountPesos: "", method: "gcash", referenceNo: "", proofUrl: "", consent: false });
  const [token, setToken] = useState("");
  const [proofError, setProofError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const { submit, pending, result } = useSubmit(pledgeAction);
  const [resetKey, setResetKey] = useState(0);
  // The server used up the token; get a fresh one so a retry can pass.
  useEffect(() => { if (result && !result.ok) setResetKey((k) => k + 1); }, [result]);
  const waitingForCheck = turnstileEnabled() && !token;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  async function attach(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const problem = checkUpload({ type: file.type, size: file.size }) ?? (file.type === "application/pdf" ? "Upload a screenshot image (JPG, PNG or WebP)." : null) ?? (file.size > MAX_PROOF ? "Screenshots must be 5 MB or smaller." : null);
    if (problem) { setProofError(problem); return; }
    setProofError(null);
    setUploading(true);
    try {
      const blob = await upload(file.name, file, { access: "public", handleUploadUrl: "/api/upload-proof", clientPayload: JSON.stringify({ turnstileToken: token }) });
      setForm((f) => ({ ...f, proofUrl: blob.url }));
    } catch (err) {
      setProofError(`Upload failed (${err.message}). You can still submit without a screenshot.`);
    } finally {
      setUploading(false);
      setResetKey((k) => k + 1); // the upload check used the token
    }
  }

  if (result?.ok) return <p className="form-ok" role="status">{result.message}</p>;
  return (
    <form className="public-form" onSubmit={(e) => { e.preventDefault(); submit({ ...form, turnstileToken: token }); }}>
      <div className="field">
        <label htmlFor="pl-for">What is this payment for?</label>
        <select id="pl-for" value={form.type === "donation" ? form.campaignId : form.type} onChange={(e) => {
          const v = e.target.value;
          setForm((f) => (v === "membership_fee" || v === "sponsorship" ? { ...f, type: v, campaignId: "" } : { ...f, type: "donation", campaignId: v }));
        }}>
          {campaigns.map((c) => <option key={c.id} value={c.id}>Donation: {c.title}</option>)}
          <option value="">General donation</option>
          <option value="sponsorship">Sponsorship</option>
          <option value="membership_fee">Membership fee</option>
        </select>
      </div>
      <div className="field"><label htmlFor="pl-name">Name</label><input id="pl-name" value={form.payerName} onChange={set("payerName")} required autoComplete="name" /></div>
      <div className="field"><label htmlFor="pl-email">Email</label><input id="pl-email" type="email" value={form.payerEmail} onChange={set("payerEmail")} required autoComplete="email" /></div>
      <div className="field"><label htmlFor="pl-amount">Amount (₱)</label><input id="pl-amount" type="number" min="1" step="0.01" value={form.amountPesos} onChange={set("amountPesos")} required inputMode="decimal" /></div>
      <div className="field">
        <label htmlFor="pl-method">Paid with</label>
        <select id="pl-method" value={form.method} onChange={set("method")}>
          <option value="gcash">GCash</option><option value="maya">Maya</option><option value="bank">Bank transfer</option>
        </select>
      </div>
      <div className="field"><label htmlFor="pl-ref">Reference number</label><input id="pl-ref" value={form.referenceNo} onChange={set("referenceNo")} required /></div>
      <div className="field">
        <label htmlFor="pl-proof">Receipt screenshot (optional)</label>
        <input id="pl-proof" type="file" accept="image/jpeg,image/png,image/webp" onChange={attach} disabled={uploading || waitingForCheck} />
        {uploading && <span className="count">Uploading…</span>}
        {form.proofUrl && <span className="count">Screenshot attached.</span>}
        {proofError && <p className="form-error" role="alert">{proofError}</p>}
      </div>
      <label className="consent"><input type="checkbox" checked={form.consent} onChange={set("consent")} required /> I agree that JCI Roxas Halaran may use these details to confirm my payment, under the Data Privacy Act of 2012.</label>
      <Turnstile onToken={setToken} resetKey={resetKey} />
      <FormStatus result={result} />
      <button className="btn" type="submit" disabled={pending || uploading || waitingForCheck}>{pending ? "Sending…" : "Submit payment details"}</button>
    </form>
  );
}
