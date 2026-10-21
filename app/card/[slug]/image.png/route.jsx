import { ImageResponse } from "next/og";
import { getDb } from "@/lib/db.js";
import { getPublicCard } from "@/lib/members/ecard.js";
import { qrDataUrl, cardUrl } from "@/lib/members/qr.js";

export async function GET(request, { params }) {
  const { slug } = await params;
  const card = await getPublicCard(getDb(), slug);
  if (!card) return new Response("Not found", { status: 404 });
  const qr = await qrDataUrl(cardUrl(new URL(request.url).origin, card.slug));
  const work = [card.profession, card.business].filter(Boolean).join(" · ");
  const contact = [card.phone, card.email].filter(Boolean);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#121314", color: "#ede8df", padding: 64, gap: 48 }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", fontSize: 24, letterSpacing: 4, color: "#e5a823" }}>JCI ROXAS HALARAN</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", fontSize: 64, fontWeight: 800, lineHeight: 1.05 }}>{card.name}</div>
            <div style={{ display: "flex", fontSize: 28, color: "#e5a823" }}>{card.roleLine}</div>
            {work ? <div style={{ display: "flex", fontSize: 28 }}>{work}</div> : null}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 26, color: "#c9c4bb" }}>
            {contact.map((c) => <div key={c} style={{ display: "flex" }}>{c}</div>)}
          </div>
        </div>
        {qr ? <img src={qr} width={300} height={300} alt="" style={{ alignSelf: "center", borderRadius: 16 }} /> : null}
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=300" } },
  );
}
