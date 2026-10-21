import Link from "next/link";
import { ClerkProvider, SignOutButton } from "@clerk/nextjs";
import { currentMember } from "@/lib/members/current.js";
import { memberNav } from "@/lib/members/nav.js";
import { cardIsPublic } from "@/lib/members/card-view.js";
import SideNav from "@/components/SideNav.jsx";

export const metadata = { robots: { index: false } };

// currentMember() runs requireArea("members") first, so the area never renders for visitors without a role.
export default async function MembersLayout({ children }) {
  const { member } = await currentMember();
  return (
    <ClerkProvider>
      <div className="admin-shell members-area">
        <SideNav groups={memberNav()} ariaLabel="Members">
          <Link href="/">View site</Link>
          {cardIsPublic(member) && <Link href={`/card/${member.slug}`}>View my card</Link>}
          <SignOutButton redirectUrl="/"><button type="button" className="tool">Sign out</button></SignOutButton>
        </SideNav>
        <div className="admin-main"><div className="admin">{children}</div></div>
      </div>
    </ClerkProvider>
  );
}
