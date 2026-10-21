import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";

export default function MembersNav() {
  return (
    <nav className="admin-nav" aria-label="Members">
      <Link href="/members">Home</Link>
      <Link href="/members/profile">Profile</Link>
      <Link href="/members/directory">Directory</Link>
      <Link href="/members/passport">Passport</Link>
      <Link href="/members/library">Library</Link>
      <Link href="/members/events">My events</Link>
      <SignOutButton redirectUrl="/"><button type="button" className="tool">Sign out</button></SignOutButton>
    </nav>
  );
}
