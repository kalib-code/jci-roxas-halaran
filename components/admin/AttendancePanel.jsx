"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCheckinAction, addAttendeeAction, updateAttendeeAction, removeAttendeeAction, sendCertificatesAction } from "@/app/admin/events/actions.js";
import { timeIn } from "@/lib/engagement/attendance-sheet.js";
import { formatDistance } from "@/lib/proof/location.js";
import VenueCheck from "./VenueCheck.jsx";

const HOME = "JCI Roxas Halaran";
const FILTERS = [["all", "All"], ["home", HOME], ["other_lo", "Other chapters"], ["guest", "Guests"]];
const SOURCE = { qr: ["QR", "badge--ok"], admin: ["Organizer", "badge--neutral"], rsvp: ["RSVP", "badge--wait"] };
const EMPTY = { name: "", position: "", affiliation: "home", localOrganization: "", email: "" };
const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });
const at = (iso) => TIME.format(new Date(iso)).replace(/ /g, " ");

function AttendeeFields({ value, onChange, idPrefix, membersOnly }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="attend-fields">
      <div className="field"><label htmlFor={`${idPrefix}-name`}>Name</label><input id={`${idPrefix}-name`} value={value.name} onChange={set("name")} required /></div>
      <div className="field"><label htmlFor={`${idPrefix}-pos`}>Position</label><input id={`${idPrefix}-pos`} value={value.position} onChange={set("position")} required placeholder="Member" /></div>
      {!membersOnly && <div className="field">
        <label htmlFor={`${idPrefix}-aff`}>From</label>
        <select id={`${idPrefix}-aff`} value={value.affiliation} onChange={set("affiliation")}>
          <option value="home">{HOME}</option>
          <option value="other_lo">Another JCI chapter</option>
          <option value="guest">Not a JCI member</option>
        </select>
      </div>}
      {!membersOnly && value.affiliation !== "home" && (
        <div className="field">
          <label htmlFor={`${idPrefix}-lo`}>{value.affiliation === "other_lo" ? "Chapter" : "Organization (optional)"}</label>
          <input id={`${idPrefix}-lo`} value={value.localOrganization} onChange={set("localOrganization")} placeholder={value.affiliation === "other_lo" ? "JCI Capiz" : ""} />
        </div>
      )}
      <div className="field"><label htmlFor={`${idPrefix}-email`}>Email (optional)</label><input id={`${idPrefix}-email`} type="email" value={value.email ?? ""} onChange={set("email")} /></div>
    </div>
  );
}

export default function AttendancePanel({ event, rows: initial, checkin }) {
  const router = useRouter();
  const membersOnly = event.weChair === false;
  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(null);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(null);
  const [certNote, setCertNote] = useState(null);
  const [pending, start] = useTransition();

  // Fresh rows from the server (a refresh, or an RSVP ticked as attended).
  useEffect(() => setRows(initial), [initial]);
  // While check-in is open, new arrivals show up without reloading.
  useEffect(() => {
    if (!checkin.open) return undefined;
    const t = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 20000);
    return () => clearInterval(t);
  }, [checkin.open, router]);

  const run = (fn) => start(async () => {
    setError(null);
    try {
      const r = await fn();
      if (r && !r.ok) setError(r.errors.join(" "));
      return r;
    } catch (e) {
      setError(`Couldn't save (${e.message}).`);
      return null;
    }
  });

  const counts = useMemo(() => Object.fromEntries(FILTERS.map(([k]) => [k, k === "all" ? rows.length : rows.filter((r) => r.affiliation === k).length])), [rows]);
  const term = q.trim().toLowerCase();
  const shown = rows.filter((r) => (filter === "all" || r.affiliation === filter) && (!term || `${r.name} ${r.position} ${r.localOrganization}`.toLowerCase().includes(term)));

  const toggle = (open, newCode = false) => run(async () => {
    const r = await setCheckinAction(event.id, { open, newCode });
    if (r.ok) router.refresh();
    return r;
  });
  const add = (e) => { e.preventDefault(); run(async () => {
    const r = await addAttendeeAction(event.id, adding);
    if (r.ok) { setRows((rs) => [...rs, r.attendee]); setAdding(null); }
    return r;
  }); };
  const save = (e) => { e.preventDefault(); run(async () => {
    const r = await updateAttendeeAction(editing.id, editing);
    if (r.ok) { setRows((rs) => rs.map((x) => (x.id === r.attendee.id ? r.attendee : x))); setEditing(null); }
    return r;
  }); };
  // Removing takes a second click, like the other admin actions.
  const remove = (row) => run(async () => {
    const r = await removeAttendeeAction(row.id);
    if (r.ok) { setRows((rs) => rs.filter((x) => x.id !== row.id)); setConfirming(null); }
    return r;
  });
  const unsent = rows.filter((r) => r.email && !r.certificateSentAt).length;
  const sendCerts = () => run(async () => {
    const r = await sendCertificatesAction(event.id);
    if (r.ok) {
      setCertNote(`Sent ${r.sent} certificate${r.sent === 1 ? "" : "s"}.${r.failed.length ? ` Not sent: ${r.failed.map((f) => f.name).join(", ")} (they'll be retried automatically).` : ""}`);
      router.refresh();
    }
    return r;
  });
  const copy = async () => {
    try { await navigator.clipboard.writeText(checkin.url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); }
  };
  const editRow = (r) => setEditing({ ...r, email: r.email ?? "", localOrganization: r.affiliation === "home" ? "" : r.localOrganization === "Non-JCI guest" ? "" : r.localOrganization });

  return (
    <section className="attend" id="attendance" aria-labelledby="attend-h">
      <div className="attend__head">
        <h2 className="syne" id="attend-h">Attendance</h2>
        <div className="actions">
          <a className="btn btn--ghost" href={`/admin/events/${event.id}/attendance`}>Attendance sheet</a>
          <a className="btn btn--ghost" href={`/admin/events/${event.id}/attendance.csv`}>Download CSV</a>
        </div>
      </div>

      <div className="attend__glance">
        <div className="attend__stat"><strong>{rows.length}</strong><span>checked in</span></div>
        <div className="attend__checkin">
          <div className="attend__checkin-text">
            <p><span className={`badge ${checkin.open ? "badge--ok" : "badge--neutral"}`}>{checkin.open ? "Check-in open" : "Check-in closed"}</span></p>
            {checkin.open ? (
              <>
                <p>Participants scan the QR to sign in. It stops taking entries a day after the event.</p>
                <div className="actions">
                  <a className="tool" href={`/admin/events/${event.id}/check-in-qr`}>Show QR poster</a>
                  <button type="button" className="tool" onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
                  <button type="button" className="tool" disabled={pending} onClick={() => toggle(true, true)} title="Use if the QR was shared somewhere it shouldn't be">New QR code</button>
                  <button type="button" className="tool" disabled={pending} onClick={() => toggle(false)}>Close check-in</button>
                </div>
              </>
            ) : (
              <>
                <p>Open check-in at the start of the event to get a QR code for the registration table.</p>
                <button type="button" className="btn" disabled={pending} onClick={() => toggle(true)}>Open check-in</button>
              </>
            )}
          </div>
          {checkin.open && checkin.qrSvg && <div className="attend__qr" role="img" aria-label="Check-in QR code" dangerouslySetInnerHTML={{ __html: checkin.qrSvg }} />}
        </div>
      </div>

      <VenueCheck event={event} />
      {membersOnly && <p className="count">Another organization chairs this event, so check-in and the attendance sheet cover only {HOME} members.</p>}
      <div className="attend__certs">
        <p>Certificates of attendance are emailed automatically an hour after the event ends, to everyone who gave an email.{unsent > 0 && ` ${unsent} still to send.`}</p>
        {unsent > 0 && <button type="button" className="tool" disabled={pending} onClick={sendCerts}>Send certificates now</button>}
        {certNote && <p className="form-ok" role="status">{certNote}</p>}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="attend__bar">
        <div className="attend__filters" role="group" aria-label="Show">
          {FILTERS.map(([k, label]) => (
            <button key={k} type="button" className={`attend__filter${filter === k ? " is-on" : ""}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>{label} <span>{counts[k]}</span></button>
          ))}
        </div>
        <input className="attend__search" type="search" aria-label="Search participants" placeholder="Search names, positions, chapters" value={q} onChange={(e) => setQ(e.target.value)} />
        {!adding && <button type="button" className="btn" onClick={() => setAdding(EMPTY)}>+ Add participant</button>}
      </div>

      {adding && (
        <form className="attend__form" onSubmit={add} aria-label="Add participant">
          <AttendeeFields value={adding} onChange={setAdding} idPrefix="add" membersOnly={membersOnly} />
          <div className="actions"><button className="btn" type="submit" disabled={pending}>Add to sheet</button><button className="tool" type="button" onClick={() => setAdding(null)}>Cancel</button></div>
        </form>
      )}

      {rows.length === 0 ? (
        <p className="attend__empty">No one has checked in yet.</p>
      ) : (
        <table className="admin-table attend__table">
          <thead><tr><th>Name</th><th>Position</th><th>Local Organization</th><th>Time in</th><th>How</th><th>Certificate</th><th aria-label="Actions" /></tr></thead>
          <tbody>
            {shown.map((r) => editing?.id === r.id ? (
              <tr key={r.id}><td colSpan={7}>
                <form className="attend__form" onSubmit={save} aria-label={`Edit ${r.name}`}>
                  <AttendeeFields value={editing} onChange={setEditing} idPrefix={`edit-${r.id}`} membersOnly={membersOnly} />
                  <div className="actions"><button className="btn" type="submit" disabled={pending}>Save</button><button className="tool" type="button" onClick={() => setEditing(null)}>Cancel</button></div>
                </form>
              </td></tr>
            ) : (
              <tr key={r.id}>
                <td>{r.name}{r.email && <><br /><small>{r.email}</small></>}</td>
                <td>{r.position}</td>
                <td>{r.localOrganization}</td>
                <td>{timeIn(r.checkedInAt, event.startAt.slice(0, 10))}</td>
                <td><span className={`badge ${SOURCE[r.source][1]}`}>{SOURCE[r.source][0]}</span>{r.distanceM != null && <><br /><small>{formatDistance(r.distanceM)} from venue</small></>}</td>
                <td>{r.certificateSentAt ? <a href={`/certificate/${r.certificateCode}`} target="_blank" rel="noopener noreferrer">Sent</a> : r.email ? "Pending" : <small>No email</small>}</td>
                <td className="attend__row-actions">
                  {confirming === r.id ? (
                    <>
                      <button type="button" className="tool" disabled={pending} onClick={() => remove(r)}>Yes, remove</button>
                      <button type="button" className="tool" onClick={() => setConfirming(null)}>Keep</button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="tool" aria-label={`Edit ${r.name}`} onClick={() => editRow(r)}>Edit</button>
                      <button type="button" className="tool" aria-label={`Remove ${r.name}`} onClick={() => setConfirming(r.id)}>Remove</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={7}>No one matches.</td></tr>}
          </tbody>
        </table>
      )}
    </section>
  );
}
