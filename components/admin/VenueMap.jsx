"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { NEARBY_M } from "@/lib/proof/location.js";

const ROXAS_CITY = { lat: 11.5853, lng: 122.7511 };
const round = (n) => Math.round(n * 1e5) / 1e5;

// Pin the venue on OpenStreetMap (Leaflet, loaded only here). The pin stays in the
// middle and the organizer moves the map under it, which is easier on a phone than
// dragging a small marker; the shaded circle is the check-in area. `goTo` moves the
// map to a place, and `onMove` gets the pin's { lat, lng } each time the map stops.
export default function VenueMap({ goTo, onMove }) {
  const box = useRef(null);
  const map = useRef(null);
  const leaflet = useRef(null);
  const report = useRef(onMove);
  const target = useRef(goTo);

  useEffect(() => {
    report.current = onMove;
  });

  // Fits the whole check-in area around a place; zoom in to place the pin closer.
  const show = (at) => map.current?.fitBounds(leaflet.current.latLng(at.lat, at.lng).toBounds(NEARBY_M * 2.4));

  useEffect(() => {
    let m;
    let cancelled = false;
    import("leaflet").then(({ default: L }) => {
      if (cancelled || !box.current) return;
      m = L.map(box.current, { scrollWheelZoom: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(m);
      const area = L.circle([ROXAS_CITY.lat, ROXAS_CITY.lng], { radius: NEARBY_M, color: "#E5A823", weight: 2, fillOpacity: 0.12, interactive: false }).addTo(m);
      m.on("move", () => area.setLatLng(m.getCenter()));
      m.on("moveend", () => {
        const c = m.getCenter();
        report.current({ lat: round(c.lat), lng: round(c.lng) });
      });
      m.on("click", (e) => m.panTo(e.latlng));
      leaflet.current = L;
      map.current = m;
      show(target.current ?? ROXAS_CITY);
    });
    return () => {
      cancelled = true;
      m?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    target.current = goTo;
    if (goTo) show(goTo);
  }, [goTo]);

  return (
    <div className="venue-map">
      <div ref={box} className="venue-map__map" role="region" aria-label="Map: drag it until the pin is on the venue" />
      <svg className="venue-map__pin" viewBox="0 0 24 24" width="40" height="40" aria-hidden="true">
        <path fill="currentColor" stroke="#121314" strokeWidth="1.2" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" />
      </svg>
      <span className="venue-map__hint" aria-hidden="true">Drag the map to put the pin on the venue</span>
    </div>
  );
}
