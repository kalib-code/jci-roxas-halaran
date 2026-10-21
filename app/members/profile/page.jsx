import { currentMember } from "@/lib/members/current.js";
import { getDb } from "@/lib/db.js";
import { listPositions } from "@/lib/members/ecard.js";
import ProfileForm from "@/components/members/ProfileForm.jsx";

export const metadata = { title: "Your profile" };
export const dynamic = "force-dynamic";

export default async function Profile() {
  const { member } = await currentMember();
  if (!member) return <><h1>Your profile</h1><p>Your account isn't linked to a member profile yet — ask an admin.</p></>;
  const positions = await listPositions(getDb(), member.id);
  return (
    <>
      <h1>Your profile</h1>
      <ProfileForm member={member} positions={positions} />
    </>
  );
}
