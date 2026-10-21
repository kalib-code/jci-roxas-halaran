"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { popupHtml } from "@/lib/proof/popup.js";

// Interactive map of project locations (Leaflet + OpenStreetMap, loaded only here).
export default function ImpactMap({ points }) {
  const ref = useRef(null);

  useEffect(() => {
    let map;
    let cancelled = false;
    import("leaflet").then(({ default: L }) => {
      if (cancelled || !ref.current) return;
      map = L.map(ref.current, { scrollWheelZoom: false }).setView([11.4, 122.6], 9);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      const markers = points.map((p) =>
        L.circleMarker([p.lat, p.lng], { radius: 9, color: "#121314", weight: 2, fillColor: "#E5A823", fillOpacity: 0.9 })
          .bindPopup(popupHtml(p))
          .addTo(map),
      );
      if (markers.length > 1) map.fitBounds(L.featureGroup(markers).getBounds().pad(0.3));
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [points]);

  return <div ref={ref} className="impact-map" role="region" aria-label="Map of project locations in Capiz" />;
}
