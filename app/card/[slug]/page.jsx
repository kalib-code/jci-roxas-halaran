import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import ECard from "@/components/members/ECard.jsx";
import { getDb } from "@/lib/db.js";
import { getPublicCard } from "@/lib/members/ecard.js";
import { qrSvg, cardUrl, originFrom } from "@/lib/members/qr.js";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const card = await getPublicCard(getDb(), slug);
  if (!card) return { title: "Card not found", robots: { index: false, follow: false } };
  return {
    title: `${card.name} — JCI Roxas Halaran`,
    description: [card.roleLine, card.profession, card.business].filter(Boolean).join(" · "),
    robots: { index: false, follow: false },
  };
}

export default async function CardPage({ params }) {
  const { slug } = await params;
  const card = await getPublicCard(getDb(), slug);
  if (!card) notFound();
  const svg = await qrSvg(cardUrl(originFrom(await headers()), card.slug));
  return (
    <main className="ecard-page">
      <ECard card={card} qrSvg={svg} nameAs="h1" />
      <p className="ecard-page__foot">
        <Link href="/">Member of JCI Roxas Halaran</Link> · <a href={`/card/${card.slug}/image.png`} download>Download card image</a>
      </p>
    </main>
  );
}
