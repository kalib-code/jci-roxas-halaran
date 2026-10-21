import { handleUpload } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { canAccess } from "@/lib/roles.js";
import { resolveRole } from "@/lib/role-lookup.js";
import { loadClerkUser } from "@/lib/clerk-user.js";

const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

async function isMember() {
  const { userId, sessionClaims } = await auth();
  return Boolean(userId) && canAccess(await resolveRole({ userId, sessionClaims }, loadClerkUser), "members");
}

// Profile photos: signed-in members only, images up to 5 MB.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (body?.type === "blob.generate-client-token" && !(await isMember())) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        if (!(await isMember())) throw new Error("Not allowed");
        return { allowedContentTypes: AVATAR_TYPES, maximumSizeInBytes: MAX_AVATAR_BYTES, addRandomSuffix: true };
      },
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(json);
  } catch (error) {
    const status = error.message === "Not allowed" ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
