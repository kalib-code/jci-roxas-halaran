import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listDirectory } from "@/lib/members/profile.js";
import MemberCard from "@/components/members/MemberCard.jsx";

export const metadata = { title: "Member directory" };
export const dynamic = "force-dynamic";

export default async function Directory({ searchParams }) {
  await requireArea("members");
  const { q = "" } = await searchParams;
  const list = await listDirectory(getDb(), { q: String(q).slice(0, 80) });
  return (
    <>
      <h1>Member directory</h1>
      <form className="actions" role="search">
        <label htmlFor="dir-q" className="count">Search by name, skill or business</label>
        <input id="dir-q" name="q" defaultValue={q} placeholder="e.g. photography" />
        <button className="btn" type="submit">Search</button>
      </form>
      <p>{list.length} member{list.length === 1 ? "" : "s"}{q ? ` matching “${q}”` : ""}. Only members who opted in are listed.</p>
      <div className="mdir">{list.map((m) => <MemberCard key={m.id} member={m} />)}</div>
    </>
  );
}
