/* eslint-disable @next/next/no-img-element -- print pages: a plain <img> prints where CSS backgrounds don't */
import { SITE } from "@/lib/site.js";
import { ROWS_PER_PAGE, sheetPages, needsOrganizationColumn, eventWhen, timeIn } from "@/lib/engagement/attendance-sheet.js";

// One A4 page on the JCI Philippines letterhead, with the template's centred event details.
export function LetterheadPage({ layout = "portrait", event, label, children, footer = null }) {
  return (
    <section className={`sheet-page sheet-page--${layout}`} aria-label={label}>
      <img className="sheet-page__bg" src={`/assets/img/jcip/letterhead-2026-${layout}.png`} alt="" />
      <div className="sheet-page__body">
        <header className="sheet-head">
          <p><strong>{SITE.name}</strong></p>
          <p><strong>{event.title}</strong></p>
          <p>{eventWhen(event)}</p>
          <p>{event.venue || "Venue to be announced"}</p>
        </header>
        {children}
        {footer}
      </div>
    </section>
  );
}

const SIGNERS = [["president", "LO President"], ["secretary", "LO Secretary"], ["chairperson", "Project Chairperson"]];

// The digital sheet: timestamps stand in for signatures, and the LO President,
// Secretary and Project Chairperson certify it (JCI PH reporting guidelines).
// `blank` prints the paper version instead: empty rows and a signature column.
export default function AttendanceSheet({ event, rows, certifiers, layout = "portrait", blank = false }) {
  const withOrg = blank || needsOrganizationColumn(rows);
  const pages = sheetPages(rows, { layout, certify: !blank, blankRows: blank ? ROWS_PER_PAGE[layout] : 0 });
  const day = event.startAt.slice(0, 10);
  // QR rows are the participant's own timestamp; anything else an organizer recorded.
  const added = rows.some((r) => r.source !== "qr");
  let n = 0;
  return (
    <div className="sheet-print">
      <style>{`@page { size: A4 ${layout}; margin: 0; }`}</style>
      {pages.map((page, i) => (
        <LetterheadPage
          key={i}
          layout={layout}
          event={event}
          label={`Attendance sheet page ${i + 1} of ${pages.length}`}
          footer={<p className="sheet-page__num">Page {i + 1} of {pages.length}</p>}
        >
          <h1 className="sheet-title">ATTENDANCE SHEET</h1>
          {(page.length > 0 || i === 0) && (
            <table className={`sheet-table${withOrg ? " sheet-table--org" : ""}`}>
              <thead>
                <tr><th>NAME</th>{withOrg && <th>LOCAL ORGANIZATION</th>}<th>POSITION</th><th>{blank ? "SIGNATURE" : "TIME IN"}</th></tr>
              </thead>
              <tbody>
                {page.map((r) => {
                  n += 1;
                  return r ? (
                    <tr key={r.id}>
                      <td>{r.name}</td>
                      {withOrg && <td>{r.localOrganization}</td>}
                      <td>{r.position}</td>
                      <td>{timeIn(r.checkedInAt, day)}{r.source !== "qr" ? " †" : ""}</td>
                    </tr>
                  ) : (
                    <tr key={n}><td />{withOrg && <td />}<td /><td /></tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {!blank && i === pages.length - 1 && (
            <div className="sheet-cert">
              <p className="sheet-cert__note">
                Total participants: {rows.length}. Digital attendance: times are Philippine time, recorded when each participant checked in by QR code at {SITE.url.replace(/^https?:\/\//, "")}
                {added ? "; † marks a participant an organizer added or marked present" : ""}.
              </p>
              <p className="sheet-cert__lead">Certified true and correct:</p>
              <div className="sheet-cert__signs">
                {SIGNERS.map(([key, title]) => (
                  <div className="sheet-cert__sign" key={key}>
                    <span className="sheet-cert__name">{certifiers[key] ?? " "}</span>
                    <span className="sheet-cert__title">{title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </LetterheadPage>
      ))}
    </div>
  );
}
