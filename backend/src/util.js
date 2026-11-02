// Kenya is UTC+3 all year (no DST).
const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Normalises Kenyan mobile numbers to 2547XXXXXXXX / 2541XXXXXXXX, or returns null. */
export function normalizePhone(input) {
  const digits = String(input ?? '').replace(/[\s\-()+]/g, '');
  if (/^0[17]\d{8}$/.test(digits)) return '254' + digits.slice(1);
  if (/^[17]\d{8}$/.test(digits)) return '254' + digits;
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  return null;
}

export const nairobiToday = () => new Date(Date.now() + NAIROBI_OFFSET_MS).toISOString().slice(0, 10);

/** '2026-03-01' + 14 -> '2026-03-15' (calendar days, no time zone surprises). */
export function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso, toIso) {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
}

export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}
