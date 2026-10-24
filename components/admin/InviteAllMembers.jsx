"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteAllMembersAction } from "@/app/admin/members/actions.js";

const names = (list) => list.join(", ");

// Sends an email to everyone listed, so the first click only asks to confirm.
export default function InviteAllMembers({ count }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState(null);
  const [pending, start] = useTransition();

  const send = () => start(async () => {
    setConfirming(false);
    try {
      const r = await inviteAllMembersAction();
      setMessage([
        r.invited.length && `Invitation sent to ${r.invited.length}: ${names(r.invited)}.`,
        r.admins.length && `Board members given admin: ${names(r.admins)}.`,
        r.linked.length && `Already signed up, now linked with member access: ${names(r.linked)}.`,
        r.failed.length && `Failed: ${r.failed.map((f) => `${f.name} (${f.error})`).join(", ")}.`,
        r.withoutEmail.length && `No email on file, so not invited: ${names(r.withoutEmail)}.`,
      ].filter(Boolean).join(" ") || "Nobody left to invite.");
      router.refresh();
    } catch (e) {
      setMessage(`Couldn't send invitations (${e.message}).`);
    }
  });

  if (!count) return null;
  return (
    <div className="actions">
      {confirming ? (
        <>
          <span>Email a sign-up invitation to {count} member{count === 1 ? "" : "s"}? Current board members get admin access.</span>
          <button type="button" className="btn" disabled={pending} onClick={send}>Yes, send</button>
          <button type="button" className="btn btn--ghost" disabled={pending} onClick={() => setConfirming(false)}>Cancel</button>
        </>
      ) : (
        <button type="button" className="btn" disabled={pending} onClick={() => setConfirming(true)}>
          {pending ? "Sending…" : `Invite ${count} member${count === 1 ? "" : "s"} without an account`}
        </button>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
