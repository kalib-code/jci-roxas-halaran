import { clerkClient } from "@clerk/nextjs/server";
import { sendEmail } from "./email.js";
import { SITE } from "./site.js";

// Everyone with the admin role in Clerk, by their verified primary address.
// Read fresh each time, so promoting or demoting someone in Clerk is enough.
export async function loadAdminEmails() {
  const clerk = await clerkClient();
  const emails = [];
  for (let offset = 0; ; offset += 100) {
    const { data } = await clerk.users.getUserList({ limit: 100, offset });
    for (const u of data ?? []) {
      if (u.publicMetadata?.role !== "admin") continue;
      const primary = u.emailAddresses?.find((e) => e.id === u.primaryEmailAddressId);
      if (primary?.verification?.status === "verified") emails.push(primary.emailAddress);
    }
    if (!data || data.length < 100) return emails;
  }
}

// Best-effort alert to the chapter inbox and every admin. If Clerk can't be
// reached, the chapter inbox still gets it, so nothing goes unseen.
export async function notifyAdmins({ subject, text }, { loadAdmins = loadAdminEmails, send = sendEmail } = {}) {
  let admins = [];
  try {
    admins = await loadAdmins();
  } catch {
    admins = [];
  }
  const to = [...new Set([SITE.email, ...admins].map((e) => e.trim().toLowerCase()))];
  return send({ to, subject, text });
}
