"use client";

// Keeps admin errors inside the admin layout instead of a blank "Application error".
export default function AdminError({ error, reset }) {
  return (
    <div className="admin" role="alert">
      <h1>Something went wrong</h1>
      <p>{error.message || "The page could not load."} Your last saved version is safe.</p>
      <p><button type="button" className="btn" onClick={reset}>Try again</button></p>
    </div>
  );
}
