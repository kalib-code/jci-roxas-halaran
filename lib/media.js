// Turns a pasted media link into an embed for one of the players we trust.
// Only the URL is stored; the iframe src is always rebuilt from it here, so
// no pasted embed code ever reaches a page.

const ID = /^[A-Za-z0-9_-]+$/;

function parse(url) {
  try {
    const u = new URL(String(url ?? "").trim());
    return u.protocol === "https:" ? u : null;
  } catch {
    return null;
  }
}

function youtube(u) {
  const host = u.hostname.replace(/^(www|m)\./, "");
  let id = null;
  if (host === "youtu.be") id = u.pathname.slice(1);
  else if (host === "youtube.com" && u.pathname === "/watch") id = u.searchParams.get("v");
  else if (host === "youtube.com") id = u.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1];
  return id && ID.test(id) ? { provider: "youtube", kind: "video", src: `https://www.youtube-nocookie.com/embed/${id}` } : null;
}

function facebook(u) {
  if (!/^(www\.|m\.|web\.)?facebook\.com$/.test(u.hostname)) return null;
  const reel = u.pathname.match(/^\/reel\/(\d+)\/?$/)?.[1];
  const video = u.pathname.match(/^\/[^/]+\/videos\/(?:[^/]+\/)?(\d+)\/?$/)?.[1] ?? (u.pathname.startsWith("/watch") ? u.searchParams.get("v") : null);
  const id = reel ?? video;
  if (!id || !/^\d+$/.test(id)) return null;
  const href = reel ? `https://www.facebook.com/reel/${id}/` : `https://www.facebook.com/watch/?v=${id}`;
  return { provider: "facebook", kind: "video", src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(href)}&show_text=false`, vertical: Boolean(reel) };
}

function soundcloud(u) {
  if (!/^(www\.|m\.)?soundcloud\.com$/.test(u.hostname)) return null;
  const parts = u.pathname.split("/").filter(Boolean);
  if (parts.length === 0 || parts.length > 3 || !parts.every((p) => ID.test(p))) return null;
  const page = `https://soundcloud.com/${parts.join("/")}`;
  // A profile or a set is a playlist, which needs the taller player.
  const set = parts.length === 1 || parts[1] === "sets";
  return { provider: "soundcloud", kind: "audio", set, src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(page)}&color=%23e5a823&visual=false` };
}

function spotify(u) {
  if (u.hostname !== "open.spotify.com") return null;
  const m = u.pathname.match(/^\/(?:intl-[a-z]+\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)\/?$/);
  return m ? { provider: "spotify", kind: "audio", src: `https://open.spotify.com/embed/${m[1]}/${m[2]}` } : null;
}

export const MEDIA_PROVIDERS = "YouTube, Facebook video or reel, SoundCloud or Spotify";

export function embedFor(url) {
  const u = parse(url);
  if (!u) return null;
  return youtube(u) ?? facebook(u) ?? soundcloud(u) ?? spotify(u);
}
