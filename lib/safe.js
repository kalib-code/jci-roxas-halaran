// One quoted CSV cell. Values that a spreadsheet would run as a formula
// (=, +, -, @, tab, carriage return) get a leading apostrophe.
export function csvCell(value) {
  let s = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

// Links built from stored URLs: https only, anything else is dropped.
export function safeHttpsUrl(url) {
  return typeof url === "string" && /^https:\/\//i.test(url.trim()) ? url.trim() : null;
}
