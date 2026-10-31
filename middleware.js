import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { canAccess } from "./lib/roles.js";
import { resolveRole } from "./lib/role-lookup.js";
import { loadClerkUser } from "./lib/clerk-user.js";

const isAdmin = createRouteMatcher(["/admin(.*)"]);
const isMembers = createRouteMatcher(["/members(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (!isAdmin(req) && !isMembers(req)) return;

  const { userId, sessionClaims, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: req.url });

  const area = isAdmin(req) ? "admin" : "members";
  const role = await resolveRole({ userId, sessionClaims }, loadClerkUser);
  if (!canAccess(role, area)) {
    // A first sign-in with no role yet goes to /welcome, which sets up members
    // by their verified email. Otherwise answer 404 so the area isn't advertised.
    if (!role) return NextResponse.redirect(new URL("/welcome", req.url));
    return new NextResponse("Not found", { status: 404 });
  }
});

// Run Clerk only where sign-in matters. On every other route Clerk's
// development "handshake" would redirect public visitors through Clerk.
export const config = {
  matcher: ["/admin/:path*", "/members/:path*", "/sign-in/:path*", "/welcome", "/api/:path*"],
};
