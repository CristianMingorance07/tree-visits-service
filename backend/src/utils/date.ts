export function toISO(sqliteDate: string): string {
  // SQLite datetime('now') returns "YYYY-MM-DD HH:MM:SS" in UTC
  return sqliteDate.replace(' ', 'T') + '.000Z';
}
