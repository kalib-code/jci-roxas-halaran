"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmPaymentAction, rejectPaymentAction } from "@/app/admin/payments/actions.js";

export default function PaymentActions({ id }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [message, setMessage] = useState(null);
  const [pending, start] = useTransition();
  const run = (fn) => start(async () => {
    try {
      const r = await fn();
      if (!r.ok) { setMessage(r.errors.join(" ")); return; }
      if (r.type === "membership_fee" && !r.linkedMember) {
        setMessage("Confirmed — but no member has this email, so the fee wasn't recorded on a member. Update the member's email, then record it again.");
        return;
      }
      router.refresh();
    } catch (e) {
      setMessage(`Couldn't save (${e.message}).`);
    }
  });
  return (
    <div className="actions">
      <button type="button" className="btn" disabled={pending} onClick={() => run(() => confirmPaymentAction(id))}>Confirm</button>
      <input aria-label="Reason for rejecting" placeholder="Reason" value={note} onChange={(e) => setNote(e.target.value)} />
      <button type="button" className="btn btn--ghost" disabled={pending} onClick={() => run(() => rejectPaymentAction(id, note))}>Reject</button>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
