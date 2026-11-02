import { currentLanguage, t } from './i18n';

const MONTHS = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  sw: ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ago', 'Sep', 'Okt', 'Nov', 'Des'],
};
const DAYS = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  sw: ['Jpl', 'Jtt', 'Jnn', 'Jtn', 'Alh', 'Iju', 'Jmm'],
};

/** Shillings, whole: 12500 -> "KES 12,500". */
export const kes = (amount: number) => `KES ${Math.round(amount).toLocaleString('en-KE')}`;

/** Today in Kenya (UTC+3), as YYYY-MM-DD. */
export function todayIso() {
  return new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** A date (YYYY-MM-DD) as is, or a moment (a full timestamp from the server) as its day in Kenya. */
const kenyaDay = (iso: string) => (iso.length <= 10 ? iso : new Date(Date.parse(iso) + 3 * 3600_000).toISOString().slice(0, 10));

export const daysFromToday = (iso: string) => Math.round((Date.parse(`${kenyaDay(iso)}T00:00:00Z`) - Date.parse(`${todayIso()}T00:00:00Z`)) / 86_400_000);

/** "2026-03-14" -> "Sat 14 Mar" (Kiswahili month and day names when chosen). */
export function shortDate(iso: string, withDay = true) {
  const d = new Date(`${kenyaDay(iso)}T00:00:00Z`);
  const lang = currentLanguage();
  const date = `${d.getUTCDate()} ${MONTHS[lang][d.getUTCMonth()]}`;
  return withDay ? `${DAYS[lang][d.getUTCDay()]} ${date}` : date;
}

export function longDate(iso: string) {
  const d = new Date(`${kenyaDay(iso)}T00:00:00Z`);
  return `${shortDate(iso)} ${d.getUTCFullYear()}`;
}

/** "Today", "Tomorrow", "In 3 days", "2 days ago", else the date. */
export function relativeDay(iso: string) {
  const n = daysFromToday(iso);
  if (n === 0) return t('Today');
  if (n === 1) return t('Tomorrow');
  if (n === -1) return t('Yesterday');
  if (n > 1 && n <= 6) return t('In {n} days', { n });
  if (n < -1 && n >= -6) return t('{n} days ago', { n: -n });
  return shortDate(iso);
}

export function dayName(iso: string) {
  const n = daysFromToday(iso);
  if (n === 0) return t('Today');
  return DAYS[currentLanguage()][new Date(`${iso}T00:00:00Z`).getUTCDay()];
}

export const monthName = (month: number) => MONTHS[currentLanguage()][month - 1];

/** Open-Meteo weather codes (WMO) to a picture and a short description. */
export function weatherLook(code: number): { icon: string; label: string } {
  if (code === 0) return { icon: 'sunny', label: t('Sunny') };
  if (code <= 2) return { icon: 'partly-sunny', label: t('Partly cloudy') };
  if (code === 3) return { icon: 'cloudy', label: t('Cloudy') };
  if (code === 45 || code === 48) return { icon: 'cloudy', label: t('Fog') };
  if (code >= 51 && code <= 57) return { icon: 'rainy', label: t('Drizzle') };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { icon: 'rainy', label: t('Rain') };
  if (code >= 95) return { icon: 'thunderstorm', label: t('Thunderstorm') };
  return { icon: 'cloudy', label: t('Cloudy') };
}

export const EXPENSE_LABELS: Record<string, string> = {
  seed: 'Seed',
  fertilizer: 'Fertilizer',
  chemicals: 'Sprays & chemicals',
  labour: 'Labour',
  land: 'Land & rent',
  equipment: 'Tools & equipment',
  transport: 'Transport',
  water: 'Water & irrigation',
  other: 'Other',
};

export const TASK_LABELS: Record<string, string> = {
  prepare: 'Land preparation',
  nursery: 'Nursery',
  plant: 'Planting',
  weed: 'Weeding',
  fertilize: 'Fertilizer',
  scout: 'Checking for pests',
  spray: 'Spraying',
  water: 'Watering',
  harvest: 'Harvest',
  other: 'Other',
};

export const TASK_ICONS: Record<string, string> = {
  prepare: 'construct',
  nursery: 'flower',
  plant: 'leaf',
  weed: 'cut',
  fertilize: 'flask',
  scout: 'search',
  spray: 'water',
  water: 'water-outline',
  harvest: 'basket',
  other: 'ellipse-outline',
};
