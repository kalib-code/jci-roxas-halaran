import QRCode from "qrcode";

const COLORS = { dark: "#121314", light: "#ede8df" };

export async function qrSvg(text) {
  try {
    return await QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: COLORS });
  } catch (e) {
    console.error("QR code failed", e);
    return null;
  }
}

export async function qrDataUrl(text) {
  try {
    return await QRCode.toDataURL(text, { margin: 1, width: 360, errorCorrectionLevel: "M", color: COLORS });
  } catch (e) {
    console.error("QR code failed", e);
    return null;
  }
}

export const cardUrl = (origin, slug) => `${origin.replace(/\/$/, "")}/card/${encodeURIComponent(slug)}`;

// The address the visitor used, so a QR code works on whichever domain served the page.
export function originFrom(headers) {
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost";
  const proto = headers.get("x-forwarded-proto") ?? (/^(localhost|127\.)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}
