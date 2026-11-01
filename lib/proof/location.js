// Accepts "11.5853, 122.7511" or a Google Maps link containing "@11.58,122.75".
const PAIR = /(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/;
// A place link's own pin ("!3d11.58!4d122.75"); the "@" pair is only where the map was centred.
const PIN = /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/;

export const LOCATION_MESSAGE = "Use coordinates inside the Philippines, e.g. 11.5853, 122.7511";

function decoded(text) {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

export function parseCoordinates(text) {
  const s = decoded(String(text ?? ""));
  const m = s.match(PIN) ?? s.match(PAIR);
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
}

export const inPhilippines = (lat, lng) => lat >= 4 && lat <= 22 && lng >= 116 && lng <= 127;

// Straight-line distance in metres between two { lat, lng } points (haversine).
export function distanceMeters(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

// Check-in at the venue: how close a phone has to be to the event's pin.
export const NEARBY_M = 1000;

// Whether a phone's reading puts someone at the venue. `at.accuracy` is the
// phone's own error radius in metres. Shared by the check-in form (instant
// feedback) and the server (the check that counts).
export function nearbyCheck(venue, at) {
  const distance = Math.round(distanceMeters(venue, at));
  if (!(at.accuracy <= NEARBY_M)) return { ok: false, reason: "rough", distance };
  if (distance > NEARBY_M) return { ok: false, reason: "far", distance };
  return { ok: true, distance };
}

export const formatDistance = (m) => (m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1).replace(/\.0$/, "")} km`);

// What to tell someone the check found, in the same words on the phone and from the server.
export function nearbyMessage(check, venueName) {
  const where = venueName || "the venue";
  if (check.reason === "rough") return "Your phone gave only a rough location, so we can't tell if you're at the venue. Turn on precise location (or GPS), then try again.";
  if (check.reason === "far") return `You're about ${formatDistance(check.distance)} from ${where}. Check-in works within ${formatDistance(NEARBY_M)} of the venue. If you're at the event, ask an organizer at the registration table to add you.`;
  return `You're at ${where} (about ${formatDistance(check.distance)} away).`;
}
