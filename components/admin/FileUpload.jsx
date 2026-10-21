"use client";

import { useId, useState } from "react";
import { upload } from "@vercel/blob/client";
import { checkUpload } from "@/lib/uploads.js";

export default function FileUpload({ accept, requireAlt = false, label, onUploaded, handleUploadUrl = "/api/upload" }) {
  const id = useId();
  const [file, setFile] = useState(null);
  const [alt, setAlt] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  function choose(e) {
    const f = e.target.files?.[0] ?? null;
    const problem = f ? checkUpload({ type: f.type, size: f.size }) : null;
    setError(problem);
    setFile(problem ? null : f);
  }

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const blob = await upload(file.name, file, { access: "public", handleUploadUrl });
      onUploaded({ url: blob.url, alt: alt.trim(), name: file.name });
      setFile(null);
      setAlt("");
    } catch (e) {
      setError(`Upload failed (${e.message}). Check your connection and try again.`);
    } finally {
      setBusy(false);
    }
  }

  const ready = file && (!requireAlt || alt.trim()) && !busy;
  return (
    <div className="upload">
      <label htmlFor={`${id}-file`}>{label}</label>
      <input id={`${id}-file`} type="file" accept={accept} onChange={choose} />
      {requireAlt && (
        <>
          <label htmlFor={`${id}-alt`}>Alt text (describe the image)</label>
          <input id={`${id}-alt`} value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={200} />
        </>
      )}
      <button type="button" className="btn" disabled={!ready} onClick={send}>
        {busy ? "Uploading…" : "Upload"}
      </button>
      {error && <p role="alert" className="form-error">{error}</p>}
    </div>
  );
}
