/**
 * The Monday (UTC midnight) of the ISO week containing `date` — the key
 * ConquestPlan groups by. Pure, so the date-math edge cases (Sunday
 * wrapping backward, month/year boundaries) are unit-tested without a
 * database.
 */
export function weekStartOf(date: Date): Date {
  const truncated = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = truncated.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  truncated.setUTCDate(truncated.getUTCDate() - daysSinceMonday);
  return truncated;
}
