import { describe, it, expect, vi } from "vitest";

const h = vi.hoisted(() => ({ pages: [] }));
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({ users: { getUserList: async ({ offset }) => ({ data: h.pages[offset / 100] ?? [] }) } }),
}));
const { notifyAdmins, loadAdminEmails } = await import("@/lib/notify-admins.js");

const user = (role, email, status = "verified") => ({
  publicMetadata: role ? { role } : {},
  primaryEmailAddressId: "e1",
  emailAddresses: [{ id: "e1", emailAddress: email, verification: { status } }],
});

describe("admin notifications", () => {
  it("collect verified admin addresses across pages, skipping other roles", async () => {
    h.pages = [
      [...Array(99)].map((_, i) => user("member", `m${i}@x.ph`)).concat(user("admin", "a1@x.ph")),
      [user("admin", "a2@x.ph"), user("admin", "fake@x.ph", "unverified"), user("officer", "o@x.ph")],
    ];
    expect(await loadAdminEmails()).toEqual(["a1@x.ph", "a2@x.ph"]);
  });

  it("send one email to the chapter inbox and every admin, without duplicates", async () => {
    const send = vi.fn(async () => ({ sent: true }));
    await notifyAdmins({ subject: "s", text: "t" }, { loadAdmins: async () => ["A1@x.ph", "a1@x.ph", "roxashalaran.jci@gmail.com"], send });
    expect(send).toHaveBeenCalledWith({ to: ["roxashalaran.jci@gmail.com", "a1@x.ph"], subject: "s", text: "t" });
  });

  it("still reach the chapter inbox when Clerk is down", async () => {
    const send = vi.fn(async () => ({ sent: true }));
    await notifyAdmins({ subject: "s", text: "t" }, { loadAdmins: async () => { throw new Error("down"); }, send });
    expect(send.mock.calls[0][0].to).toEqual(["roxashalaran.jci@gmail.com"]);
  });
});
