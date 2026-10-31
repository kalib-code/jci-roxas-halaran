"use client";

export default function PrintButton({ children = "Print or save as PDF" }) {
  return <button type="button" className="btn" onClick={() => window.print()}>{children}</button>;
}
