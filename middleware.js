import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { canAccess, roleFromSessionClaims } from "./lib/roles.js";

const isAdmin = createRouteMatcher(["/admin(.*)"]);
const isMembers = createRouteMatcher(["/members(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (!isAdmin(req) && !isMembers(req)) return;

  const { userId, sessionClaims, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: req.url });

  const area = isAdmin(req) ? "admin" : "members";
  if (!canAccess(roleFromSessionClaims(sessionClaims), area)) {
    // Signed in but not allowed: answer 404 so the area isn't advertised.
    return new NextResponse("Not found", { status: 404 });
  }
});

// Run Clerk only where sign-in matters. On every other route Clerk's
// development "handshake" would redirect public visitors through Clerk.
export const config = {
  matcher: ["/admin/:path*", "/members/:path*", "/sign-in/:path*", "/api/:path*"],
};
