import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { canAccess } from "./lib/roles.js";

const isAdmin = createRouteMatcher(["/admin(.*)"]);
const isMembers = createRouteMatcher(["/members(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (!isAdmin(req) && !isMembers(req)) return;

  const { userId, sessionClaims, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: req.url });

  const area = isAdmin(req) ? "admin" : "members";
  if (!canAccess(sessionClaims?.metadata?.role, area)) {
    // Signed in but not allowed: answer 404 so the area isn't advertised.
    return new NextResponse("Not found", { status: 404 });
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
