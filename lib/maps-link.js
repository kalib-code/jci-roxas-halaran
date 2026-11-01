import { parseCoordinates } from "./proof/location.js";

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
