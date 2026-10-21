import { handleUpload } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { canAccess, roleFromSessionClaims } from "@/lib/roles.js";
import { UPLOAD_TYPES, MAX_UPLOAD_BYTES } from "@/lib/uploads.js";

async function isContentAdmin() {
  const { userId, sessionClaims } = await auth();
  return Boolean(userId) && canAccess(roleFromSessionClaims(sessionClaims), "content");
}

export async function POST(request) {
  const body = await request.json();
  // Check the role before Blob does anything (including looking for its token),
  // so a signed-out or non-admin caller always gets 403.
  if (body?.type === "blob.generate-client-token" && !(await isContentAdmin())) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        if (!(await isContentAdmin())) throw new Error("Not allowed");
        return { allowedContentTypes: UPLOAD_TYPES, maximumSizeInBytes: MAX_UPLOAD_BYTES, addRandomSuffix: true };
      },
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(json);
  } catch (error) {
    const status = error.message === "Not allowed" ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
