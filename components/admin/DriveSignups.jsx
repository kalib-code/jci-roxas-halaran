"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeDriveSignupAction, confirmDriveSignupAction } from "@/app/admin/volunteers/actions.js";
import { formatDate } from "@/lib/format.js";

// The volunteers, grouped under their role.
export default function DriveSignups({ driveId, roles, signups }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(null);
  const [error, setError] = useState(null);
  const [pending, start] = useTransition();
  const run = (fn) => start(async () => {
    setError(null);
    try {
      const r = await fn();
      if (!r.ok) setError(r.errors.join(" "));
      else router.refresh();
    } catch (e) {
      setError(`Couldn't save (${e.message}).`);
    }
    setConfirming(null);
  });

  const groups = roles.length
    ? [...roles.map((r) => ({ key: r.id, title: r.label, slots: r.slots, rows: signups.filter((s) => s.roleId === r.id) })),
       { key: "none", title: "No role", rows: signups.filter((s) => !roles.some((r) => r.id === s.roleId)) }].filter((g) => g.key !== "none" || g.rows.length)
    : [{ key: "all", title: "Volunteers", rows: signups }];

  return (
    <section className="drive-signups" aria-labelledby="drive-signups-h">
      <h2 className="syne" id="drive-signups-h">Volunteers ({signups.length})</h2>
      {signups.length > 0 && <p><a href={`/admin/volunteers/${driveId}/signups.csv`}>Download CSV</a></p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {signups.length === 0 && <p className="admin-empty">No one has signed up yet. Share the link or QR above.</p>}
      {signups.length > 0 && groups.map((g) => {
        const confirmed = g.rows.filter((s) => s.status === "confirmed").length;
        return (
          <div key={g.key} className="drive-signups__group">
            <h3>{g.title} <span className="count">{confirmed}{g.slots ? ` of ${g.slots}` : ""} confirmed{g.rows.length > confirmed ? `, ${g.rows.length - confirmed} waitlist` : ""}</span></h3>
            {g.rows.length === 0 ? <p className="count">No one yet.</p> : (
              <table className="admin-table">
                <thead><tr><th>Volunteer</th><th>Note</th><th>Signed up</th><th aria-label="Actions" /></tr></thead>
                <tbody>
                  {g.rows.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.name}</strong>{s.status === "waitlist" && <> <span className="badge badge--wait">Waitlist</span></>}
                        <br /><a href={`mailto:${s.email}`}>{s.email}</a>{s.phone ? <><br /><a href={`tel:${s.phone}`}>{s.phone}</a></> : null}
                      </td>
                      <td>{s.skills ?? "—"}</td>
                      <td>{formatDate(s.createdAt)}</td>
                      <td>
                        <div className="actions">
                          {s.status === "waitlist" && <button type="button" className="tool" disabled={pending} onClick={() => run(() => confirmDriveSignupAction(s.id))}>Confirm</button>}
                          {confirming === s.id ? (
                            <>
                              <button type="button" className="tool" disabled={pending} onClick={() => run(() => removeDriveSignupAction(s.id))}>Yes, remove</button>
                              <button type="button" className="tool" disabled={pending} onClick={() => setConfirming(null)}>Keep</button>
                            </>
                          ) : (
                            <button type="button" className="tool" disabled={pending} onClick={() => setConfirming(s.id)}>Remove</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </section>
  );
}
