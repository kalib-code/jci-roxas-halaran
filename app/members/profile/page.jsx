import { currentMember } from "@/lib/members/current.js";
import ProfileForm from "@/components/members/ProfileForm.jsx";

export const metadata = { title: "Your profile" };
export const dynamic = "force-dynamic";

export default async function Profile() {
  const { member } = await currentMember();
  if (!member) return <><h1>Your profile</h1><p>Your account isn't linked to a member profile yet — ask an admin.</p></>;
  return (
    <>
      <h1>Your profile</h1>
      <ProfileForm member={member} />
    </>
  );
}
