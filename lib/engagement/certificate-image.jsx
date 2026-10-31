/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text -- satori draws <img> into the PNG */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE } from "../site.js";
import { qrDataUrl, PRINT_COLORS } from "../members/qr.js";
import { issuedOn } from "./certificates.js";

// A4 landscape at 150 dpi, on the JCI Philippines 2026 letterhead.
export const CERT_SIZE = { width: 1754, height: 1240 };
const NAVY = "#1d3f78";

let letterhead;
async function letterheadDataUrl() {
  letterhead ??= readFile(join(process.cwd(), "public/assets/img/jcip/letterhead-2026-landscape.png")).then(
    (b) => `data:image/png;base64,${b.toString("base64")}`,
  );
  return letterhead;
}

// Inter (regular and bold); the built-in font if Google Fonts can't be reached.
let inter;
async function interFonts() {
  inter ??= (async () => {
    const css = await (await fetch("https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap")).text();
    const faces = [...css.matchAll(/font-weight: (\d+);[^}]*?src: url\((.+?)\) format\('(?:opentype|truetype)'\)/g)];
    if (faces.length < 2) throw new Error("no font URLs");
    return Promise.all(faces.map(async ([, weight, url]) => ({ name: "Inter", weight: Number(weight), style: "normal", data: await (await fetch(url)).arrayBuffer() })));
  })().catch(() => null);
  return inter;
}

// The certificate as a PNG ImageResponse; `.arrayBuffer()` gives the bytes for email.
export async function renderCertificate(view) {
  const [bg, qr, fonts] = await Promise.all([letterheadDataUrl(), qrDataUrl(view.url, { colors: PRINT_COLORS }), interFonts()]);
  const host = SITE.url.replace(/^https?:\/\//, "");
  const B = fonts ? { fontWeight: 700 } : {};
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#fff", color: "#111", ...(fonts ? { fontFamily: "Inter", fontWeight: 400 } : {}) }}>
        <img src={bg} width={CERT_SIZE.width} height={CERT_SIZE.height} style={{ position: "absolute", top: 0, left: 0 }} />
        <div style={{ position: "absolute", top: 250, left: 170, right: 170, bottom: 290, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <div style={{ display: "flex", fontSize: 50, letterSpacing: 8, color: NAVY, ...B }}>CERTIFICATE OF ATTENDANCE</div>
          <div style={{ display: "flex", marginTop: 34, fontSize: 26, color: "#444" }}>This certifies that</div>
          <div style={{ display: "flex", marginTop: 10, fontSize: 70, lineHeight: 1.1, ...B }}>{view.name}</div>
          <div style={{ display: "flex", marginTop: 12, fontSize: 26, color: "#444" }}>{[view.position, view.localOrganization].filter(Boolean).join(" · ")}</div>
          <div style={{ display: "flex", marginTop: 30, fontSize: 26, color: "#444" }}>attended</div>
          <div style={{ display: "flex", marginTop: 8, fontSize: 42, color: NAVY, ...B }}>{view.eventTitle}</div>
          <div style={{ display: "flex", marginTop: 10, fontSize: 26, color: "#333" }}>{[view.when, view.venue].filter(Boolean).join(" · ")}</div>
          <div style={{ display: "flex", marginTop: "auto", width: "100%", justifyContent: "center", gap: 70 }}>
            {view.signers.map(([name, title]) => (
              <div key={title} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 360 }}>
                <div style={{ display: "flex", width: "100%", justifyContent: "center", paddingBottom: 8, borderBottom: "2px solid #111", fontSize: 24, textTransform: "uppercase", ...B }}>{name}</div>
                <div style={{ display: "flex", marginTop: 8, fontSize: 21, color: "#444" }}>{title}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Verification sits centred under the signatures, clear of the footer art. */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 150, display: "flex", justifyContent: "center", alignItems: "center", gap: 16 }}>
          {qr && <img src={qr} width={92} height={92} />}
          <div style={{ display: "flex", flexDirection: "column", fontSize: 17, color: "#555" }}>
            <div style={{ display: "flex" }}>Certificate ID {view.code} · Issued {issuedOn(view.issuedAt) ?? "by " + SITE.name}</div>
            <div style={{ display: "flex" }}>Verify at {host}/certificate/{view.code}</div>
          </div>
        </div>
      </div>
    ),
    { ...CERT_SIZE, ...(fonts ? { fonts } : {}) },
  );
}
