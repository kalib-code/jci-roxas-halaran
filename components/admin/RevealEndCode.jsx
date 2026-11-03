"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { showEndCodeAction } from "@/app/admin/events/actions.js";

// On the shared screen, so the host can switch to the end code without leaving it.
export default function RevealEndCode({ eventId, shown, open }) {
  const router = useRouter();
  const [error, setError] = useState(null);
  const [pending, start] = useTransition();
  const reveal = () => start(async () => {
    try {
      const r = await showEndCodeAction(eventId);
      if (!r.ok) { setError(r.errors.join(" ")); return; }
      setError(null);
      router.refresh();
    } catch (e) {
      setError(`Couldn't show it (${e.message}).`);
    }
  });
  return (
    <span className="codes-screen__reveal">
      {error && <span className="form-error" role="alert">{error}</span>}
      <button type="button" className={shown && open ? "tool" : "btn"} disabled={pending} onClick={reveal}>
        {!shown ? "Show end code" : open ? "Restart the end code's hour" : "Take the end code for another hour"}
      </button>
    </span>
  );
}
