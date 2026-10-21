// Card logic with no database imports, so client components (the live preview) can use it.

export const cardIsPublic = (member) => Boolean(member && member.status === "active" && member.cardPublished);

export function roleLine(member, positions = []) {
  const [latest] = [...positions].sort((a, b) => b.year - a.year);
  if (latest) return `${latest.role} ${latest.year}`;
  if (member.joinedAt) return `Member since ${member.joinedAt.slice(0, 4)}`;
  return "Member";
}

const LINKS = [["Facebook", "facebookUrl"], ["LinkedIn", "linkedinUrl"], ["Instagram", "instagramUrl"], ["Website", "websiteUrl"]];

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
    links: LINKS.filter(([, key]) => member[key]).map(([label, key]) => ({ label, url: member[key] })),
  };
}

const esc = (value) => String(value).replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

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
    ...card.links.map((l) => `X-SOCIALPROFILE;TYPE=${l.label.toLowerCase()}:${l.url}`),
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
