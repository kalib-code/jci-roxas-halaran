import { describe, it, expect, beforeEach, vi } from "vitest";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { saveEvent } from "@/lib/engagement/events.js";
import { setCheckin, setCheckinNearby, checkIn, listAttendance, checksNearby } from "@/lib/engagement/attendance.js";
import { parseCoordinates, distanceMeters, nearbyCheck, nearbyMessage, formatDistance } from "@/lib/proof/location.js";
import { coordinatesFrom, searchPlaces, findPlaces } from "@/lib/maps-link.js";

const PARK = { lat: 11.6047, lng: 122.7339 }; // People's Park, Baybay
const CITY_HALL = { lat: 11.5853, lng: 122.7511 }; // about 2.9 km away
const AT_PARK = { lat: 11.605, lng: 122.7345, accuracy: 25 }; // about 70 m from the pin

describe("venue distance", () => {
  it("measures straight-line metres", () => {
    expect(distanceMeters(PARK, PARK)).toBe(0);
    expect(Math.round(distanceMeters(PARK, CITY_HALL) / 100) / 10).toBe(2.9);
  });

  it("lets phones within 1 km through, and not rough or distant readings", () => {
    expect(nearbyCheck(PARK, AT_PARK)).toMatchObject({ ok: true });
    expect(nearbyCheck(PARK, { ...CITY_HALL, accuracy: 20 })).toMatchObject({ ok: false, reason: "far" });
    expect(nearbyCheck(PARK, { ...AT_PARK, accuracy: 3000 })).toMatchObject({ ok: false, reason: "rough" });
    expect(nearbyCheck(PARK, { ...AT_PARK, accuracy: undefined })).toMatchObject({ ok: false, reason: "rough" });
  });

  it("says how far in plain words", () => {
    expect(formatDistance(3)).toBe("10 m");
    expect(formatDistance(734)).toBe("730 m");
    expect(formatDistance(1000)).toBe("1 km");
    expect(formatDistance(2849)).toBe("2.8 km");
    expect(nearbyMessage(nearbyCheck(PARK, { ...CITY_HALL, accuracy: 20 }), "People's Park")).toMatch(/^You're about 2\.9 km from People's Park\. Check-in works within 1 km/);
  });
});

describe("reading a venue pin", () => {
  it("prefers a place link's own pin and reads encoded links", () => {
    expect(parseCoordinates("https://www.google.com/maps/place/People's+Park/@11.6,122.73,17z/data=!4m6!3m5!1s0x0:0x0!8m2!3d11.6047!4d122.7339")).toEqual(PARK);
    expect(parseCoordinates("https://www.google.com/maps/search/?api=1&query=11.6047%2C122.7339")).toEqual(PARK);
    expect(parseCoordinates("bad %E0%A4%A link")).toBeNull();
  });

  it("follows a short Maps link through Google's redirects only", async () => {
    const hops = {
      "https://maps.app.goo.gl/abc123": "https://www.google.com/maps/place/People's+Park/@11.6,122.73,17z/data=!3d11.6047!4d122.7339",
    };
    const fetchImpl = vi.fn(async (url) => ({ headers: new Headers(hops[url] ? { location: hops[url] } : {}) }));
    expect(await coordinatesFrom("People's Park\nhttps://maps.app.goo.gl/abc123", { fetchImpl })).toEqual(PARK);
    expect(await coordinatesFrom("https://evil.example/maps", { fetchImpl })).toBeNull();
    const offsite = vi.fn(async () => ({ headers: new Headers({ location: "https://evil.example/x" }) }));
    expect(await coordinatesFrom("https://maps.app.goo.gl/abc123", { fetchImpl: offsite })).toBeNull();
    expect(offsite).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("finding the venue by name on OpenStreetMap", () => {
  const hit = (name, lat, lon, address) => ({ name, lat: String(lat), lon: String(lon), display_name: `${name}, somewhere`, address });
  const answer = (rows) => ({ ok: true, json: async () => rows });

  it("searches around Capiz first and says which town each place is in", async () => {
    const fetchImpl = vi.fn(async () => answer([hit("Kalan-an sa People's Park", 11.6069, 122.7376, { city: "Roxas City", state: "Capiz" })]));
    expect(await searchPlaces("People's Park", { fetchImpl })).toEqual([{ name: "Kalan-an sa People's Park", area: "Roxas City, Capiz", lat: 11.6069, lng: 122.7376 }]);
    const [url, init] = fetchImpl.mock.calls[0];
    const params = new URL(url).searchParams;
    expect([params.get("q"), params.get("countrycodes"), params.get("bounded")]).toEqual(["People's Park", "ph", "1"]);
    expect(init.headers["User-Agent"]).toMatch(/^JCI Roxas Halaran website/);
  });

  it("looks across the Philippines, a second later, when nothing near Capiz matches", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(answer([]))
      .mockResolvedValueOnce(answer([hit("Rizal Park", 14.5831, 120.9794, { city: "Manila", state: "Metro Manila" }), hit("Far away", 35.68, 139.76, {})]));
    const wait = vi.fn(async () => {});
    const places = await searchPlaces("Rizal Park", { fetchImpl, wait });
    expect(places.map((p) => `${p.name} (${p.area})`)).toEqual(["Rizal Park (Manila, Metro Manila)"]);
    expect(wait).toHaveBeenCalledWith(1000);
    expect(new URL(fetchImpl.mock.calls[1][0]).searchParams.has("bounded")).toBe(false);
  });

  it("goes straight to pasted coordinates, and reports a search that fails", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 429 }));
    expect(await findPlaces("11.6069, 122.7376", { fetchImpl })).toEqual([{ name: "11.6069, 122.7376", area: "", lat: 11.6069, lng: 122.7376 }]);
    expect(fetchImpl).not.toHaveBeenCalled();
    await expect(findPlaces("Villareal Stadium", { fetchImpl })).rejects.toThrow(/429/);
  });
});

describe("check-in at the venue", () => {
  const NOW = new Date("2027-01-15T10:30:00Z");
  const ana = { name: "Ana Reyes", position: "Member", affiliation: "home", email: "", consent: true };
  let db;
  let event;
  beforeEach(async () => {
    db = await testDb();
    await seed(db);
    event = (await saveEvent(db, { title: "Fun Run", startAt: "2027-01-15T17:00", venue: "People's Park" })).event;
    ({ event } = await setCheckin(db, event.id, { open: true }));
  });

  it("needs a pin before the check can go on, and only inside the Philippines", async () => {
    expect(await setCheckinNearby(db, event.id, { nearby: true })).toMatchObject({ ok: false });
    expect(await setCheckinNearby(db, event.id, { nearby: true, lat: 51.5, lng: -0.12 })).toMatchObject({ ok: false });
    const r = await setCheckinNearby(db, event.id, { nearby: true, ...PARK });
    expect(checksNearby(r.event)).toBe(true);
    const off = await setCheckinNearby(db, event.id, { nearby: false });
    expect(checksNearby(off.event)).toBe(false);
    expect(off.event).toMatchObject(PARK);
  });

  it("turns away phones that are missing, rough or far, and keeps only the distance", async () => {
    await setCheckinNearby(db, event.id, { nearby: true, ...PARK });
    const go = (location) => checkIn(db, { ...ana, code: event.checkinCode, location }, { now: NOW });
    expect((await go(undefined)).errors[0]).toMatch(/^Share your location/);
    expect((await go({ ...AT_PARK, accuracy: 2500 })).errors[0]).toMatch(/rough location/);
    expect((await go({ ...CITY_HALL, accuracy: 15 })).errors[0]).toMatch(/2\.9 km from People's Park/);
    expect((await go({ lat: "x", lng: 1, accuracy: 1 })).ok).toBe(false);
    expect(await listAttendance(db, event.id)).toHaveLength(0);
    const r = await go(AT_PARK);
    expect(r.ok).toBe(true);
    const [row] = await listAttendance(db, event.id);
    expect(row.distanceM).toBeGreaterThan(50);
    expect(row.distanceM).toBeLessThan(100);
    expect(JSON.stringify(row)).not.toContain("11.605");
  });

  it("doesn't ask for a location when the check is off", async () => {
    const r = await checkIn(db, { ...ana, code: event.checkinCode }, { now: NOW });
    expect(r.ok).toBe(true);
    expect((await listAttendance(db, event.id))[0].distanceM).toBeNull();
  });
});
