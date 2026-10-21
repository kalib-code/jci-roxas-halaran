// Accepts "11.5853, 122.7511" or a Google Maps link containing "@11.58,122.75".
const PAIR = /(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/;

export const LOCATION_MESSAGE = "Use coordinates inside the Philippines, e.g. 11.5853, 122.7511";

export function parseCoordinates(text) {
  const m = String(text ?? "").match(PAIR);
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
}

export const inPhilippines = (lat, lng) => lat >= 4 && lat <= 22 && lng >= 116 && lng <= 127;
