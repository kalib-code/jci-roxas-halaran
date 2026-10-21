"use client";

import { useState, useTransition } from "react";
import { updateMemberAction } from "@/app/admin/members/actions.js";
import { cardIsPublic } from "@/lib/members/card-view.js";

export default function MemberRow({ member }) {
  const [form, setForm] = useState({ email: member.email ?? "", status: member.status, inDirectory: member.inDirectory });
  const [message, setMessage] = useState(null);
  const [pending, start] = useTransition();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const save = (extra = {}) => start(async () => {
    try {
      const r = await updateMemberAction(member.id, { ...form, ...extra });
      setMessage(r.ok ? "Saved" : r.errors.join(" "));
    } catch (e) {
      setMessage(`Couldn't save (${e.message})`);
    }
  });
  return (
    <tr>
      <td>{member.name}<br /><span className="count">{member.clerkUserId ? <>Account linked <button type="button" className="tool" disabled={pending} onClick={() => save({ unlink: true })}>Unlink</button></> : "No account yet"}{member.feePaidYear ? ` · Fee paid ${member.feePaidYear}` : ""}</span></td>
      <td><input aria-label={`Email for ${member.name}`} type="email" value={form.email} onChange={set("email")} /></td>
      <td>
        <select aria-label={`Status for ${member.name}`} value={form.status} onChange={set("status")}>
          <option value="active">Active</option><option value="inactive">Inactive</option><option value="senator">Senator</option><option value="alumni">Alumni</option>
        </select>
      </td>
      <td><input aria-label={`${member.name} in directory`} type="checkbox" checked={form.inDirectory} onChange={set("inDirectory")} /></td>
      <td>{cardIsPublic(member) ? <a href={`/card/${member.slug}`} target="_blank" rel="noreferrer">View</a> : "—"}</td>
      <td><button type="button" className="tool" disabled={pending} onClick={() => save()}>Save</button> {message && <span role="status">{message}</span>}</td>
    </tr>
  );
}
