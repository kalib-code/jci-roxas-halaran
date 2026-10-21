// libsql errors arrive wrapped by Drizzle; look through the cause chain.
export function isUniqueViolation(error) {
  const text = [error?.message, error?.cause?.message, error?.cause?.cause?.message].join(" ");
  return /UNIQUE constraint failed/i.test(text);
}
