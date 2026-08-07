// ============================================================
// ISO-UKE-ID
// ============================================================
// Gir en streng som "2026-W32" basert på standard ISO 8601-uke
// (mandag er første dag i uken). Brukes som nøkkel for å skille
// ukentlige highscorelister fra hverandre.
// ============================================================

export function getCurrentWeekId() {
  const now = new Date();
  const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

  // ISO: mandag = 1 ... søndag = 7
  const dayNum = date.getUTCDay() === 0 ? 7 : date.getUTCDay();

  // Flytt datoen til torsdag i samme uke (ISO-uke-standard-triks)
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);

  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);

  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
