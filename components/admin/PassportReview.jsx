"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { verifyEntryAction, declineEntryAction } from "@/app/admin/members/actions.js";

export default function PassportReview({ entry }) {
  const router = useRouter();
  const [points, setPoints] = useState(String(entry.points));
  const [message, setMessage] = useState(null);
  const [pending, start] = useTransition();
  const run = (fn) => start(async () => {
    try {
      const r = await fn();
      if (!r.ok) { setMessage(r.errors.join(" ")); return; }
      router.refresh();
    } catch (e) {
      setMessage(`Couldn't save (${e.message})`);
    }
  });
  return (
    <div className="actions">
      <input aria-label={`Points for ${entry.title}`} type="number" min="0" value={points} onChange={(e) => setPoints(e.target.value)} style={{ width: 80 }} />
      <button type="button" className="btn" disabled={pending} onClick={() => run(() => verifyEntryAction(entry.id, points))}>Verify</button>
      <button type="button" className="btn btn--ghost" disabled={pending} onClick={() => run(() => declineEntryAction(entry.id))}>Decline</button>
      {message && <span role="status">{message}</span>}
    </div>
  );
}
