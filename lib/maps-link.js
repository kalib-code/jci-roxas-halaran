import { parseCoordinates, inPhilippines } from "./proof/location.js";

// Only Google's own map addresses are followed, so a pasted link can't make the
// server fetch anything else.
const GOOGLE = /^(maps\.app\.goo\.gl|goo\.gl|(www\.|maps\.)?google\.com(\.ph)?)$/i;
const HOPS = 4;

// Coordinates from what an organizer pasted: "11.5853, 122.7511", a full Google
// Maps link, or the short maps.app.goo.gl link the Maps app shares (followed
// through its redirects to the full link). Null when none can be read.
export async function coordinatesFrom(text, { fetchImpl = fetch } = {}) {
  const direct = parseCoordinates(text);
  if (direct) return direct;
  let url = String(text ?? "").match(/https:\/\/\S+/)?.[0];
  for (let hop = 0; url && hop < HOPS; hop += 1) {
    let host;
    try {
      host = new URL(url).hostname;
    } catch {
      return null;
    }
    if (!GOOGLE.test(host)) return null;
    let res;
    try {
      res = await fetchImpl(url, { redirect: "manual", signal: AbortSignal.timeout(5000) });
    } catch {
      return null;
    }
    const next = res.headers.get("location");
    if (!next) return null;
    url = new URL(next, url).toString();
    const found = parseCoordinates(url);
    if (found) return found;
  }
  return null;
}

// OpenStreetMap's free place search (Nominatim). Its rules: at most one request a
// second, a User-Agent naming the site, and no searching as someone types.
const SEARCH = "https://nominatim.openstreetmap.org/search";
const AGENT = "JCI Roxas Halaran website (+https://www.jciroxashalaran.com)";
// Capiz and its neighbours (west, north, east, south), searched first: most of our events are here.
const NEAR_HOME = "122.25,11.85,123.05,11.1";

async function nominatim(query, { nearHome, fetchImpl }) {
  const params = new URLSearchParams({ q: query, format: "jsonv2", addressdetails: "1", countrycodes: "ph", limit: "5", ...(nearHome && { viewbox: NEAR_HOME, bounded: "1" }) });
  const res = await fetchImpl(`${SEARCH}?${params}`, { headers: { "User-Agent": AGENT, "Accept-Language": "en" }, signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`place search answered ${res.status}`);
  return res.json();
}

// "Kalan-an sa People's Park" in "Roxas City, Capiz": enough to tell same-named places apart.
function place(r) {
  const a = r.address ?? {};
  return {
    name: r.name || r.display_name.split(",")[0],
    area: [a.city ?? a.town ?? a.municipality ?? a.village, a.state].filter(Boolean).join(", "),
    lat: Number(r.lat),
    lng: Number(r.lon),
  };
}

// Places matching a name, best match first. The Capiz area is searched first and
// the rest of the Philippines only when nothing there matches.
export async function searchPlaces(query, { fetchImpl = fetch, wait = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  let found = await nominatim(query, { nearHome: true, fetchImpl });
  if (!found.length) {
    await wait(1000);
    found = await nominatim(query, { nearHome: false, fetchImpl });
  }
  return found.map(place).filter((p) => inPhilippines(p.lat, p.lng));
}

// Where to put the venue pin for what an organizer typed: coordinates or a map
// link go straight there, anything else is looked up as a place name.
export async function findPlaces(text, options) {
  const at = await coordinatesFrom(text, options);
  if (at) return [{ name: `${at.lat}, ${at.lng}`, area: "", ...at }];
  return searchPlaces(text, options);
}
