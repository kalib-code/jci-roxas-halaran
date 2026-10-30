// Card logic with no database imports, so client components (the live preview) can use it.

export const cardIsPublic = (member) => Boolean(member && member.status === "active" && member.cardPublished);

export function roleLine(member, positions = []) {
  const [latest] = [...positions].sort((a, b) => b.year - a.year);
  if (latest) return `${latest.role} ${latest.year}`;
  if (member.joinedAt) return `Member since ${member.joinedAt.slice(0, 4)}`;
  return "Member";
}

// Parse with the same URL parser browsers use and store its normalised form, so the link
// that was validated is exactly the link every later reader (browser, vCard app) sees.
export function safeLink(input) {
  const value = String(input ?? "").trim();
  if (!value) return "";
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || !url.hostname.includes(".")) return null;
  return url.href.length <= 300 ? url.href : null;
}

// Known sites get a name from their address; anything else is a "Website".
const PLATFORMS = [
  ["facebook", "Facebook", ["facebook.com", "fb.com", "fb.me"]],
  ["messenger", "Messenger", ["m.me", "messenger.com"]],
  ["instagram", "Instagram", ["instagram.com", "instagr.am"]],
  ["linkedin", "LinkedIn", ["linkedin.com", "lnkd.in"]],
  ["discord", "Discord", ["discord.gg", "discord.com", "discordapp.com"]],
  ["tiktok", "TikTok", ["tiktok.com"]],
  ["x", "X", ["x.com", "twitter.com"]],
  ["youtube", "YouTube", ["youtube.com", "youtu.be"]],
  ["threads", "Threads", ["threads.net", "threads.com"]],
  ["telegram", "Telegram", ["t.me", "telegram.me"]],
  ["whatsapp", "WhatsApp", ["wa.me", "whatsapp.com"]],
  ["github", "GitHub", ["github.com"]],
  ["shopee", "Shopee", ["shopee.ph"]],
  ["lazada", "Lazada", ["lazada.com.ph"]],
  ["linktree", "Linktree", ["linktr.ee"]],
];
const WEBSITE = { key: "website", label: "Website" };

export function platformFor(url) {
  let host;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return WEBSITE;
  }
  const hit = PLATFORMS.find(([, , domains]) => domains.some((d) => host === d || host.endsWith(`.${d}`)));
  return hit ? { key: hit[0], label: hit[1] } : WEBSITE;
}

export const MAX_LINKS = 10;
export const cleanLabel = (label) => String(label ?? "").replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);

// Safe links only, each with a label (the member's own, or the site's name).
// Takes stored links or the editor's rows as typed, so the preview matches the card.
export const cardLinks = (rows) =>
  (Array.isArray(rows) ? rows : [])
    .map((r) => ({ url: safeLink(r?.url), label: cleanLabel(r?.label) }))
    .filter((r) => r.url)
    .map((r) => ({ label: r.label || platformFor(r.url).label, url: r.url }));

// The one shape every card surface renders. The member's switches always apply, so the
// preview a member sees is exactly what the public sees.
export function cardView(member, positions = []) {
  return {
    slug: member.slug,
    name: member.name,
    roleLine: roleLine(member, positions),
    profession: member.profession || null,
    business: member.business || null,
    photoUrl: member.photoUrl || null,
    bio: member.bio || null,
    phone: member.cardShowPhone && member.phone ? member.phone : null,
    email: member.cardShowEmail && member.email ? member.email : null,
    links: cardLinks(member.links),
  };
}

const esc = (value) => String(value).replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

export function vcard(card, url) {
  const parts = card.name.trim().split(/\s+/);
  const first = parts.shift() ?? "";
  const last = parts.pop() ?? "";
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${esc(last)};${esc(first)};${esc(parts.join(" "))};;`,
    `FN:${esc(card.name)}`,
    `ORG:${esc(card.business ?? "JCI Roxas Halaran")}`,
    card.profession && `TITLE:${esc(card.profession)}`,
    card.phone && `TEL;TYPE=CELL:${card.phone}`,
    card.email && `EMAIL;TYPE=INTERNET:${esc(card.email)}`,
    `URL:${url}`,
    // TYPE comes from the address, never the member's label, so it can't carry vCard syntax.
    ...card.links.map((l) => `X-SOCIALPROFILE;TYPE=${platformFor(l.url).key}:${l.url}`),
    "NOTE:Member of JCI Roxas Halaran",
    "END:VCARD",
  ].filter(Boolean);
  return `${lines.join("\r\n")}\r\n`;
}

const FIELDS = [["photo", "photoUrl"], ["profession", "profession"], ["skills", "skills"], ["bio", "bio"], ["phone", "phone"]];

export function profileCompleteness(member) {
  const missing = FIELDS.filter(([, key]) => !member[key]).map(([label]) => label);
  return { pct: Math.round((100 * (FIELDS.length - missing.length)) / FIELDS.length), missing };
}
