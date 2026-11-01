"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCheckinNearbyAction, findVenueAction } from "@/app/admin/events/actions.js";
import { currentPosition } from "@/lib/geolocate.js";
import { formatDistance, NEARBY_M } from "@/lib/proof/location.js";
import VenueMap from "./VenueMap.jsx";

// A phone reading rougher than this can't stand in for the venue's pin.
const PIN_ACCURACY_M = 200;
const RADIUS = formatDistance(NEARBY_M);
const coords = (at) => `${at.lat.toFixed(5)}, ${at.lng.toFixed(5)}`;
const osmUrl = (at) => `https://www.openstreetmap.org/?mlat=${at.lat}&mlon=${at.lng}#map=17/${at.lat}/${at.lng}`;

// Organizer controls for "only accept QR check-ins near the venue": pin the
// venue on the map, then turn the check on or off.
export default function VenueCheck({ event }) {
  const router = useRouter();
  const [pinning, setPinning] = useState(null); // null, "on" (pin, then turn on) or "move"
  const [query, setQuery] = useState(event.venue ?? "");
  const [places, setPlaces] = useState([]);
  const [goTo, setGoTo] = useState(null); // where the map was last sent
  const [spot, setSpot] = useState(null); // where the pin is now
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [pending, start] = useTransition();
  const pinned = event.lat != null && event.lng != null;
  const on = Boolean(event.checkinNearby && pinned);

  const persist = async (input) => {
    try {
      const r = await setCheckinNearbyAction(event.id, input);
      if (!r.ok) return setError(r.errors.join(" "));
      setPinning(null);
      router.refresh();
    } catch (e) {
      setError(`Couldn't save (${e.message}).`);
    }
  };
  const save = (input) => start(async () => { setError(null); await persist(input); });

  const search = async (text) => {
    setError(null);
    setSearching(true);
    try {
      const r = await findVenueAction(text);
      if (!r.ok) return setError(r.errors.join(" "));
      setPlaces(r.places);
      if (r.places.length) setGoTo(r.places[0]);
      else setError(`Nothing on the map matches "${text}". Try another name, or drag the map to the venue.`);
    } catch (e) {
      setError(`Couldn't search (${e.message}).`);
    } finally {
      setSearching(false);
    }
  };

  const openPin = (mode) => {
    setPinning(mode);
    setError(null);
    setPlaces([]);
    setSpot(null);
    if (pinned) setGoTo({ lat: event.lat, lng: event.lng });
    else {
      setGoTo(null);
      if (query.trim().length >= 3) search(query);
    }
  };

  const pinHere = async () => {
    setError(null);
    let at;
    try {
      at = await currentPosition();
    } catch (e) {
      return setError(e.message === "denied" ? "Location is blocked for this site in your browser. Search for the venue instead." : "Couldn't get your location. Search for the venue instead.");
    }
    if (at.accuracy > PIN_ACCURACY_M) return setError(`Your phone's location is too rough to pin the venue (within ${formatDistance(at.accuracy)}). Search for the venue instead.`);
    setPlaces([]);
    setGoTo({ lat: at.lat, lng: at.lng });
  };

  // Moving the pin keeps the check as it was; pinning to turn it on turns it on.
  const nearbyAfterPin = pinning === "on" ? true : on;

  return (
    <div className="attend__nearby">
      <p>
        <span className={`badge ${on ? "badge--ok" : "badge--neutral"}`}>{on ? "Venue check on" : "Venue check off"}</span>{" "}
        {on ? `QR check-in works only on phones within ${RADIUS} of the venue.` : `Turn on to accept QR check-ins only from phones within ${RADIUS} of the venue.`}
      </p>
      {pinned && !pinning && (
        <p className="count">
          Venue pin: <a href={osmUrl(event)} target="_blank" rel="noopener noreferrer">{coords(event)}</a>
        </p>
      )}
      {!pinning && (
        <div className="actions">
          {on ? (
            <button type="button" className="tool" disabled={pending} onClick={() => save({ nearby: false })}>Turn off</button>
          ) : (
            <button type="button" className="tool" disabled={pending} onClick={() => (pinned ? save({ nearby: true }) : openPin("on"))}>Turn on venue check</button>
          )}
          {pinned && <button type="button" className="tool" disabled={pending} onClick={() => openPin("move")}>Move pin</button>}
        </div>
      )}
      {pinning && (
        <div className="attend__form" role="group" aria-label="Pin the venue">
          <form role="search" className="field" onSubmit={(e) => { e.preventDefault(); search(query); }}>
            <label htmlFor="venue-search">Find the venue</label>
            <div className="venue-pin__search">
              <input id="venue-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Villareal Stadium" />
              <button className="tool" type="submit" disabled={searching}>{searching ? "Searching…" : "Search"}</button>
            </div>
          </form>
          {places.length > 0 && (
            <div className="venue-pin__places" role="group" aria-label="Places found">
              {places.map((p) => (
                <button key={`${p.lat},${p.lng}`} type="button" className={`attend__filter${goTo === p ? " is-on" : ""}`} aria-pressed={goTo === p} onClick={() => setGoTo(p)}>
                  {p.name}{p.area && <span>{p.area}</span>}
                </button>
              ))}
            </div>
          )}
          <VenueMap goTo={goTo} onMove={setSpot} />
          <p className="count">
            {spot ? `Pin at ${coords(spot)}. ` : ""}The shaded circle is the {RADIUS} check-in area.
          </p>
          <div className="actions">
            <button className="btn" type="button" disabled={pending || !spot} onClick={() => save({ nearby: nearbyAfterPin, place: spot })}>{pinning === "on" ? "Pin and turn on" : "Save pin"}</button>
            <button className="tool" type="button" disabled={pending} onClick={pinHere}>Use where I am now</button>
            <button className="tool" type="button" onClick={() => { setPinning(null); setError(null); }}>Cancel</button>
          </div>
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
