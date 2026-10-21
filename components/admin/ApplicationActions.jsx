"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveApplicationAction, declineApplicationAction } from "@/app/admin/applications/actions.js";

export default function ApplicationActions({ id }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [message, setMessage] = useState(null);
  const [pending, start] = useTransition();

  const run = (fn) => start(async () => {
    try {
      const r = await fn();
      if (!r.ok) { setMessage(r.errors.join(" ")); return; }
      setMessage(
        r.inviteError
          ? `Approved — the invitation email failed (${r.inviteError}); resend it from Clerk.`
          : r.linkedAccount
            ? "Approved — they already had an account, so it now has member access."
            : r.invited
              ? "Approved — invitation sent."
              : "Done.",
      );
      router.refresh();
    } catch (e) {
      setMessage(`Couldn't save (${e.message}).`);
    }
  });

  return (
    <div className="actions">
      <button type="button" className="btn" disabled={pending} onClick={() => run(() => approveApplicationAction(id))}>Approve</button>
      <input aria-label="Reason for declining (optional)" placeholder="Reason (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <button type="button" className="btn btn--ghost" disabled={pending} onClick={() => run(() => declineApplicationAction(id, note))}>Decline</button>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
