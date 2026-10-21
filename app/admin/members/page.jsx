import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listMembersAdmin } from "@/lib/members/profile.js";
import MemberRow from "@/components/admin/MemberRow.jsx";

export const metadata = { title: "Members — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminMembers() {
  await requireArea("content");
  const list = await listMembersAdmin(getDb());
  return (
    <div className="admin">
      <h1>Members</h1>
      <p>A member's email links their sign-in account to this record on their first sign-in.</p>
      <table className="admin-table">
        <thead><tr><th>Member</th><th>Email</th><th>Status</th><th>Directory</th><th>Card</th><th></th></tr></thead>
        <tbody>{list.map((m) => <MemberRow key={m.id} member={m} />)}</tbody>
      </table>
    </div>
  );
}
