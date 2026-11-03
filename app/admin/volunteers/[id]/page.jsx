import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listProjects } from "@/lib/queries.js";
import { listEvents } from "@/lib/engagement/events.js";
import { getDrive, listDriveSignups, driveIsOpen } from "@/lib/engagement/volunteers.js";
import { qrSvg, volunteerUrl, originFrom } from "@/lib/members/qr.js";
import DriveEditor from "@/components/admin/DriveEditor.jsx";
import DriveShare from "@/components/admin/DriveShare.jsx";
import DriveSignups from "@/components/admin/DriveSignups.jsx";

export const metadata = { title: "Volunteer registration — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function EditDrive({ params }) {
  await requireArea("content");
  const { id } = await params;
  const db = getDb();
  const drive = await getDrive(db, id);
  if (!drive) notFound();
  const [{ upcoming, past }, projects, signups] = await Promise.all([listEvents(db), listProjects(db), listDriveSignups(db, drive.id)]);
  const url = volunteerUrl(originFrom(await headers()), drive.slug);
  return (
    <div className="admin">
      <p><Link href="/admin/volunteers">← Volunteers</Link></p>
      <h1>{drive.title}</h1>
      <DriveShare driveId={drive.id} url={url} qrSvg={await qrSvg(url)} open={driveIsOpen(drive)} />
      <DriveEditor key={drive.updatedAt} drive={drive} events={[...upcoming, ...past]} projects={projects} />
      <DriveSignups driveId={drive.id} roles={drive.roles} signups={signups} />
    </div>
  );
}
