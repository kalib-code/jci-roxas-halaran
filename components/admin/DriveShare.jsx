"use client";

import { useState } from "react";

// The sign-up link and its QR, to post in group chats or print for the venue.
export default function DriveShare({ driveId, url, qrSvg, open }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <section className="drive-share" aria-labelledby="drive-share-h">
      <div className="drive-share__body">
        <h2 className="syne" id="drive-share-h">Share the sign-up page</h2>
        <p><span className={`badge ${open ? "badge--ok" : "badge--neutral"}`}>{open ? "Taking sign-ups" : "Closed"}</span></p>
        <p className="drive-share__url"><a href={url} target="_blank" rel="noreferrer">{url.replace(/^https?:\/\//, "")}</a></p>
        <div className="actions">
          <button type="button" className="tool" onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
          <a className="tool" href={`/admin/volunteers/${driveId}/qr.png`}>Download QR (PNG)</a>
          <a className="tool" href={`/admin/volunteers/${driveId}/qr.svg`}>QR for print (SVG)</a>
        </div>
        {!open && <p className="count">People who open the link see that sign-ups are closed.</p>}
      </div>
      {qrSvg && <div className="attend__qr" role="img" aria-label="Sign-up QR code" dangerouslySetInnerHTML={{ __html: qrSvg }} />}
    </section>
  );
}
