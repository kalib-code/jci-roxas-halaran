"use client";

import { useState } from "react";

export default function CardShare({ url, slug }) {
  const [message, setMessage] = useState(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Link copied");
    } catch {
      setMessage(url);
    }
  };
  const share = async () => {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "My e-calling card", url });
      } catch {
        // the member closed the share sheet
      }
    } else {
      await copy();
    }
  };
  return (
    <div className="card-share">
      <button type="button" className="btn" onClick={share}>Share</button>
      <button type="button" className="tool" onClick={copy}>Copy link</button>
      <a className="tool" href={`/card/${slug}/image.png`} download>Download image</a>
      <a className="tool" href={`/card/${slug}/vcard`}>Save contact</a>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
