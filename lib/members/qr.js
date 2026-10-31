import QRCode from "qrcode";

const COLORS = { dark: "#121314", light: "#ede8df" };

// Black on white for paper; the site's own colours everywhere else.
export const PRINT_COLORS = { dark: "#000000", light: "#ffffff" };

export async function qrSvg(text, { colors = COLORS } = {}) {
  try {
    return await QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: colors });
  } catch (e) {
    console.error("QR code failed", e);
    return null;
  }
}

export async function qrDataUrl(text, { colors = COLORS } = {}) {
  try {
    return await QRCode.toDataURL(text, { margin: 1, width: 360, errorCorrectionLevel: "M", color: colors });
  } catch (e) {
    console.error("QR code failed", e);
    return null;
  }
}

// A QR code members download and put on their own designs: black on white with
// the full four-module quiet zone, so it scans on any background, large enough to print.
export async function qrPng(text, { width = 1200 } = {}) {
  try {
    return await QRCode.toBuffer(text, { type: "png", margin: 4, width, errorCorrectionLevel: "M", color: PRINT_COLORS });
  } catch (e) {
    console.error("QR code failed", e);
    return null;
  }
}

export const cardUrl =(origin, slug) => `${origin.replace(/\/$/, "")}/card/${encodeURIComponent(slug)}`;

// The address the visitor used, so a QR code works on whichever domain served the page.
export function originFrom(headers) {
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost";
  const proto = headers.get("x-forwarded-proto") ?? (/^(localhost|127\.)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

export const checkinUrl = (origin, code) => `${origin.replace(/\/$/, "")}/check-in/${encodeURIComponent(code)}`;
