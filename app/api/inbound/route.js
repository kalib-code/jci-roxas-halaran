import { NextResponse } from "next/server";
import { Resend } from "resend";
import { handleInbound, parseRecipients } from "@/lib/inbound.js";
import { getDb } from "@/lib/db.js";
import { currentBoardEmails } from "@/lib/members/board.js";

// Resend Receiving webhook (event: email.received) for info@jciroxashalaran.com.
// Forwards to the current board (Officers page) plus any INFO_FORWARD_TO extras.
export async function POST(request) {
  const { RESEND_API_KEY, RESEND_WEBHOOK_SECRET, INFO_FORWARD_TO } = process.env;
  if (!RESEND_API_KEY || !RESEND_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Inbound forwarding isn't configured" }, { status: 503 });
  }
  const rawBody = await request.text();
  const headers = {
    id: request.headers.get("svix-id") ?? "",
    timestamp: request.headers.get("svix-timestamp") ?? "",
    signature: request.headers.get("svix-signature") ?? "",
  };
  const { status, body } = await handleInbound(rawBody, headers, {
    resend: new Resend(RESEND_API_KEY),
    webhookSecret: RESEND_WEBHOOK_SECRET,
    infoAddress: process.env.INFO_ADDRESS ?? "info@jciroxashalaran.com",
    from: process.env.INFO_FORWARD_FROM ?? "JCI Roxas Halaran <forwarder@jciroxashalaran.com>",
    recipients: async () => [...new Set([...(await currentBoardEmails(getDb())), ...parseRecipients(INFO_FORWARD_TO).map((e) => e.toLowerCase())])],
  });
  return NextResponse.json(body, { status });
}
