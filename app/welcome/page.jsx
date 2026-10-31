import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { ClerkProvider, SignOutButton } from "@clerk/nextjs";
import { getDb } from "@/lib/db.js";
import { claimMembership } from "@/lib/members/claim.js";
import { SITE } from "@/lib/site.js";

export const metadata = { title: "Welcome", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Where middleware sends a signed-in account that has no role yet. A member's
// verified email sets them up and moves them on; anyone else learns what to do.
export default async function Welcome() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  let r;
  try {
    r = await claimMembership(getDb(), userId);
  } catch (e) {
    console.error("Couldn't set up member access", e?.message);
    r = { ok: false, reason: "error" };
  }
  if (r.ok) redirect("/members");
  return (
    <ClerkProvider>
      <main className="welcome">
        <h1 className="syne">Almost there</h1>
        {r.reason === "no-member" && (
          <p>We couldn&apos;t find a {SITE.name} member record for <strong>{r.email}</strong>. If you&apos;re a member, ask an officer to add this email to your record in Admin → Members, then sign in again.</p>
        )}
        {r.reason === "unverified" && <p>Please verify your email address first: check your inbox for the code from our sign-in, then sign in again.</p>}
        {r.reason === "error" && <p>We couldn&apos;t set up your access just now. Please refresh this page in a minute.</p>}
        <p>Questions? Email <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.</p>
        <SignOutButton redirectUrl="/"><button type="button" className="btn btn--ghost">Sign out</button></SignOutButton>
      </main>
    </ClerkProvider>
  );
}
