import Link from "next/link";
import { headers } from "next/headers";
import { currentMember } from "@/lib/members/current.js";
import { getDb } from "@/lib/db.js";
import { listPositions } from "@/lib/members/ecard.js";
import { cardIsPublic, cardView } from "@/lib/members/card-view.js";
import { qrSvg, cardUrl, originFrom } from "@/lib/members/qr.js";
import ECard from "@/components/members/ECard.jsx";
import CardShare from "@/components/members/CardShare.jsx";

export const metadata = { title: "My e-calling card" };
export const dynamic = "force-dynamic";

export default async function MyCard() {
  const { member } = await currentMember();
  if (!member) return <><h1>My e-calling card</h1><p>Your account isn't linked to a member profile yet — ask an admin.</p></>;
  const card = cardView(member, await listPositions(getDb(), member.id));
  const url = cardUrl(originFrom(await headers()), member.slug);
  const live = cardIsPublic(member);
  return (
    <>
      <h1>My e-calling card</h1>
      {!live && (
        <p className="form-errors">
          {member.status !== "active" ? "E-calling cards are for active members — ask an admin about your membership status." : "Your card isn't published yet."}{" "}
          <Link href="/members/profile#card">Set it up →</Link>
        </p>
      )}
      <div className="mycard">
        <ECard card={card} qrSvg={live ? await qrSvg(url) : null} live={live} />
        <div className="mycard__side">
          {live && <p>Your card is live at <a href={url}>{url}</a></p>}
          {live && <CardShare url={url} slug={member.slug} />}
          <p><Link href="/members/profile#card">Edit card details →</Link></p>
        </div>
      </div>
    </>
  );
}
