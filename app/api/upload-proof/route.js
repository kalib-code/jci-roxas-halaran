import { handleUpload } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { verifyTurnstile } from "@/lib/turnstile.js";

const PROOF_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PROOF_BYTES = 5 * 1024 * 1024;

// Public upload for payment screenshots: images only, 5 MB, Turnstile-checked.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        let token = "";
        try {
          token = JSON.parse(clientPayload ?? "{}").turnstileToken ?? "";
        } catch {
          token = "";
        }
        if (!(await verifyTurnstile(token))) throw new Error("Not allowed");
        return { allowedContentTypes: PROOF_TYPES, maximumSizeInBytes: MAX_PROOF_BYTES, addRandomSuffix: true };
      },
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(json);
  } catch (error) {
    const status = error.message === "Not allowed" ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
