"use client";

import { useEffect, useState } from "react";
import Turnstile, { turnstileEnabled } from "./Turnstile.jsx";
import FormStatus from "./FormStatus.jsx";
import { useSubmit } from "./useSubmit.js";
import { checkInAction } from "@/app/actions/attendance.js";

const HOME = "JCI Roxas Halaran";
const AFFILIATIONS = [
  ["home", HOME, "Member of this chapter"],
  ["other_lo", "Another JCI chapter", "Visiting from another LO"],
  ["guest", "Not a JCI member", "Guest, partner or speaker"],
];
const POSITIONS = {
  home: ["Member", "Local President", "Executive Vice President", "Vice President", "Secretary", "Treasurer", "Auditor", "Director", "Immediate Past President", "Senator"],
  other_lo: ["Member", "Local President", "Executive Vice President", "Vice President", "Secretary", "Treasurer", "Director", "Senator", "Area Officer", "National Officer"],
  guest: ["Guest", "Speaker", "Volunteer", "Partner", "Sponsor"],
};
// Kept only on this phone, only when the participant asks, to skip typing next time.
const SAVED = "jci-checkin-details";
const EMPTY = { name: "", position: "", affiliation: "", localOrganization: "", email: "" };

function readSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED) ?? "null");
    return saved?.name ? { ...EMPTY, ...saved } : null;
  } catch {
    return null;
  }
}

// "Check in someone else" starts a fresh form (a shared phone at the door),
// without showing the last person's saved details.
export default function CheckinForm(props) {
  const [round, setRound] = useState(0);
  return <CheckinFlow key={round} {...props} fresh={round > 0} onAgain={() => setRound((r) => r + 1)} />;
}

function CheckinFlow({ code, event, fresh, onAgain }) {
  const [form, setForm] = useState(EMPTY);
  const [saved, setSaved] = useState(null);
  const [remember, setRemember] = useState(false);
  const [consent, setConsent] = useState(false);
  const [token, setToken] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const { submit, pending, result } = useSubmit(checkInAction);

  useEffect(() => {
    const s = fresh ? null : readSaved();
    if (s) { setSaved(s); setForm(s); setRemember(true); }
  }, [fresh]);
  // The server used up the token; get a fresh one so a retry can pass.
  useEffect(() => { if (result && !result.ok) setResetKey((k) => k + 1); }, [result]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const waitingForCheck = turnstileEnabled() && !token;
  const send = (e) => {
    e.preventDefault();
    try {
      if (remember) localStorage.setItem(SAVED, JSON.stringify(form));
      else localStorage.removeItem(SAVED);
    } catch { /* private browsing: nothing to remember */ }
    submit({ ...form, consent, code, turnstileToken: token });
  };

  const eventCard = (
    <div className="checkin__event">
      <span className="label label--sm">Event check-in</span>
      <h1 className="checkin__title">{event.title}</h1>
      <p>{event.when}</p>
      {event.venue && <p>{event.venue}</p>}
    </div>
  );

  if (result?.ok) {
    return (
      <div className="checkin">
        <div className="checkin__done" role="status">
          <span className="checkin__tick" aria-hidden="true">✓</span>
          <h2 className="checkin__title">{result.already ? "Already checked in" : "You're checked in"}</h2>
          <p className="checkin__who">{result.name}</p>
          {result.at && <p className="checkin__stamp">Recorded {result.at}</p>}
          {result.already && <p className="checkin__note">If that isn&apos;t you, ask an organizer at the registration table to add you.</p>}
        </div>
        {eventCard}
        <button type="button" className="btn btn--ghost checkin__again" onClick={onAgain}>Check in someone else</button>
      </div>
    );
  }

  const editing = !saved;
  return (
    <form className="checkin" onSubmit={send}>
      {eventCard}
      {saved ? (
        <div className="checkin__saved">
          <p className="checkin__welcome">Welcome back, {saved.name.split(" ")[0]}</p>
          <p>Check that your details are still right.</p>
          <dl>
            <dt>Name</dt><dd>{saved.name}</dd>
            <dt>Position</dt><dd>{saved.position}</dd>
            <dt>Local Organization</dt><dd>{saved.affiliation === "home" ? HOME : saved.localOrganization || "Not a JCI member"}</dd>
          </dl>
          <div className="checkin__saved-actions">
            <button type="button" className="tool" onClick={() => setSaved(null)}>Edit details</button>
            <button type="button" className="tool" onClick={() => { try { localStorage.removeItem(SAVED); } catch { /* nothing saved */ } setSaved(null); setForm(EMPTY); setRemember(false); }}>Not me</button>
          </div>
        </div>
      ) : null}
      {editing && (
        <>
          <div className="field"><label htmlFor="ci-name">Full name</label><input id="ci-name" value={form.name} onChange={set("name")} required autoComplete="name" /></div>
          <fieldset className="checkin__choice">
            <legend>Local Organization</legend>
            {AFFILIATIONS.map(([value, title, hint]) => (
              <label key={value} className="checkin__option">
                <input type="radio" name="affiliation" value={value} checked={form.affiliation === value} onChange={set("affiliation")} required />
                <span><strong>{title}</strong><small>{hint}</small></span>
              </label>
            ))}
          </fieldset>
          {form.affiliation === "other_lo" && (
            <div className="field"><label htmlFor="ci-lo">Which chapter?</label><input id="ci-lo" value={form.localOrganization} onChange={set("localOrganization")} required placeholder="e.g. JCI Capiz" /></div>
          )}
          {form.affiliation === "guest" && (
            <div className="field"><label htmlFor="ci-org">Organization, school or barangay (optional)</label><input id="ci-org" value={form.localOrganization} onChange={set("localOrganization")} /></div>
          )}
          <div className="field">
            <label htmlFor="ci-pos">Position or designation</label>
            <input id="ci-pos" list="ci-positions" value={form.position} onChange={set("position")} required placeholder={form.affiliation === "guest" ? "Guest" : "Member"} />
            <datalist id="ci-positions">{(POSITIONS[form.affiliation] ?? POSITIONS.home).map((p) => <option key={p} value={p} />)}</datalist>
          </div>
          <div className="field">
            <label htmlFor="ci-email">Email (optional)</label>
            <input id="ci-email" type="email" value={form.email} onChange={set("email")} autoComplete="email" />
            <span className="count">Members: use the email you gave the chapter to get this activity in your JCI passport.</span>
          </div>
          <label className="consent"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember my details on this phone for next time</label>
        </>
      )}
      <label className="consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required /> I agree that JCI Roxas Halaran may record my attendance for this event and include it in reports to JCI Philippines, under the Data Privacy Act of 2012.</label>
      <Turnstile onToken={setToken} resetKey={resetKey} />
      <FormStatus result={result} />
      <button className="btn btn--lg checkin__submit" type="submit" disabled={pending || waitingForCheck}>{pending ? "Checking in…" : "Check in"}</button>
    </form>
  );
}
