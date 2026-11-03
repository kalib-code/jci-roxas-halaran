"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteEventAction } from "@/app/admin/events/actions.js";

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// At the bottom of an event's admin page. Two steps, and the second spells out
// what goes with the event, so a real event isn't lost by a stray tap.
export default function DeleteEvent({ event, counts }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [errors, setErrors] = useState([]);
  const [pending, start] = useTransition();

  const lost = [
    counts.rsvps && plural(counts.rsvps, "RSVP"),
    counts.attendance && `${plural(counts.attendance, "attendance sheet entry", "attendance sheet entries")} and the passport points they gave`,
    counts.certificates && `${plural(counts.certificates, "certificate")} already emailed, whose verification links will stop working`,
  ].filter(Boolean);

  const remove = () => start(async () => {
    try {
      const r = await deleteEventAction(event.id);
      if (!r.ok) { setErrors(r.errors); return; }
      router.replace("/admin/events");
    } catch (e) {
      setErrors([`Couldn't delete (${e.message}). Try again.`]);
    }
  });

  return (
    <section className="delete-zone" aria-labelledby="delete-event-h">
      <h2 className="syne" id="delete-event-h">Delete this event</h2>
      {errors.length > 0 && <div className="form-errors" role="alert"><ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul></div>}
      {!asking ? (
        <>
          <p className="count">Takes it off the website for good. Use this for test or duplicate events. For a cancelled event, edit its title or description instead, so people who RSVP&apos;d can see it was cancelled.</p>
          <p><button type="button" className="tool" onClick={() => setAsking(true)}>Delete event…</button></p>
        </>
      ) : (
        <div className="delete-zone__confirm" role="group" aria-label="Confirm delete">
          <p>Delete <strong>{event.title}</strong>? This can&apos;t be undone.</p>
          {lost.length > 0 ? (
            <>
              <p>It also deletes:</p>
              <ul>{lost.map((l) => <li key={l}>{l}</li>)}</ul>
            </>
          ) : (
            <p className="count">It has no RSVPs or attendance.</p>
          )}
          {counts.drives > 0 && <p className="count">Its {plural(counts.drives, "volunteer registration")} and the volunteers in them stay, just no longer linked to an event.</p>}
          <div className="actions">
            <button type="button" className="btn btn--danger" disabled={pending} onClick={remove}>{pending ? "Deleting…" : "Yes, delete it"}</button>
            <button type="button" className="tool" disabled={pending} onClick={() => setAsking(false)}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}
