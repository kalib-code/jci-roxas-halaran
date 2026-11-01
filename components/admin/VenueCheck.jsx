"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCheckinNearbyAction } from "@/app/admin/events/actions.js";
import { currentPosition } from "@/lib/geolocate.js";
import { formatDistance, NEARBY_M } from "@/lib/proof/location.js";

// A phone reading rougher than this can't stand in for the venue's pin.
const PIN_ACCURACY_M = 200;
const RADIUS = formatDistance(NEARBY_M);

// Organizer controls for "only accept QR check-ins near the venue": pin the
// venue, then turn the check on or off.
export default function VenueCheck({ event }) {
  const router = useRouter();
  const [pinning, setPinning] = useState(null); // null, "on" (pin, then turn on) or "move"
  const [place, setPlace] = useState("");
  const [error, setError] = useState(null);
  const [pending, start] = useTransition();
  const pinned = event.lat != null && event.lng != null;
  const on = Boolean(event.checkinNearby && pinned);

  const persist = async (input) => {
    try {
      const r = await setCheckinNearbyAction(event.id, input);
      if (!r.ok) return setError(r.errors.join(" "));
      setPinning(null);
      setPlace("");
      router.refresh();
    } catch (e) {
      setError(`Couldn't save (${e.message}).`);
    }
  };
  const save = (input) => start(async () => { setError(null); await persist(input); });
  // Moving the pin keeps the check as it was; pinning to turn it on turns it on.
  const nearbyAfterPin = pinning === "on" ? true : on;
  const pinHere = () => start(async () => {
    setError(null);
    let at;
    try {
      at = await currentPosition();
    } catch (e) {
      return setError(e.message === "denied" ? "Location is blocked for this site in your browser. Paste the venue's Google Maps link instead." : "Couldn't get your location. Paste the venue's Google Maps link instead.");
    }
    if (at.accuracy > PIN_ACCURACY_M) return setError(`Your phone's location is too rough to pin the venue (within ${formatDistance(at.accuracy)}). Paste the venue's Google Maps link instead.`);
    await persist({ nearby: nearbyAfterPin, place: { lat: at.lat, lng: at.lng } });
  });

  return (
    <div className="attend__nearby">
      <p>
        <span className={`badge ${on ? "badge--ok" : "badge--neutral"}`}>{on ? "Venue check on" : "Venue check off"}</span>{" "}
        {on ? `QR check-in works only on phones within ${RADIUS} of the venue.` : `Turn on to accept QR check-ins only from phones within ${RADIUS} of the venue.`}
      </p>
      {pinned && (
        <p className="count">
          Venue pin: <a href={`https://www.google.com/maps?q=${event.lat},${event.lng}`} target="_blank" rel="noopener noreferrer">{event.lat.toFixed(5)}, {event.lng.toFixed(5)}</a>
        </p>
      )}
      {!pinning && (
        <div className="actions">
          {on ? (
            <button type="button" className="tool" disabled={pending} onClick={() => save({ nearby: false })}>Turn off</button>
          ) : (
            <button type="button" className="tool" disabled={pending} onClick={() => (pinned ? save({ nearby: true }) : setPinning("on"))}>Turn on venue check</button>
          )}
          {pinned && <button type="button" className="tool" disabled={pending} onClick={() => setPinning("move")}>Move pin</button>}
        </div>
      )}
      {pinning && (
        <form className="attend__form" aria-label="Pin the venue" onSubmit={(e) => { e.preventDefault(); save({ nearby: nearbyAfterPin, place }); }}>
          <div className="field">
            <label htmlFor="venue-pin">Venue location</label>
            <input id="venue-pin" value={place} onChange={(e) => setPlace(e.target.value)} required placeholder="Paste a Google Maps link, or 11.5853, 122.7511" />
            <span className="count">In Google Maps, find the venue and tap Share, then Copy link. Or press and hold the spot and copy the numbers shown.</span>
          </div>
          <div className="actions">
            <button className="btn" type="submit" disabled={pending}>{pinning === "on" ? "Pin and turn on" : "Save pin"}</button>
            <button className="tool" type="button" disabled={pending} onClick={pinHere}>Use where I am now</button>
            <button className="tool" type="button" onClick={() => { setPinning(null); setError(null); }}>Cancel</button>
          </div>
        </form>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
