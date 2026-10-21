"use client";

import { useState, useTransition } from "react";
import { setAttendanceAction, moveToGoingAction } from "@/app/admin/events/actions.js";

export default function RsvpTable({ eventId, rsvps: initial }) {
  const [rsvps, setRsvps] = useState(initial);
  const [error, setError] = useState(null);
  const [pending, start] = useTransition();
  const update = (id, patch) => setRsvps((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const attend = (r, attended) => start(async () => {
    try {
      const res = await setAttendanceAction(r.id, attended);
      if (res.ok) update(r.id, { attended }); else setError(res.errors.join(" "));
    } catch (e) { setError(`Couldn't save (${e.message}).`); }
  });
  const promote = (r) => start(async () => {
    try {
      const res = await moveToGoingAction(r.id, eventId);
      if (res.ok) update(r.id, { status: "going" }); else setError(res.errors.join(" "));
    } catch (e) { setError(`Couldn't save (${e.message}).`); }
  });

  const count = (s) => rsvps.filter((r) => r.status === s).length;
  return (
    <section>
      <h2 className="syne">RSVPs — {count("going")} going, {count("waitlist")} waitlist</h2>
      <p><a href={`/admin/events/${eventId}/rsvps.csv`}>Download CSV</a></p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <table className="admin-table">
        <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Attended</th></tr></thead>
        <tbody>
          {rsvps.map((r) => (
            <tr key={r.id}>
              <td>{r.name}{r.phone ? <><br />{r.phone}</> : null}</td>
              <td>{r.email}</td>
              <td>{r.status}{r.status === "waitlist" && <> <button type="button" className="tool" disabled={pending} onClick={() => promote(r)}>Move to going</button></>}</td>
              <td><input type="checkbox" aria-label={`${r.name} attended`} checked={r.attended} disabled={pending} onChange={(e) => attend(r, e.target.checked)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
