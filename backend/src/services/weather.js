import { HttpError } from '../errors.js';
import { addDays, nairobiToday } from '../util.js';

// The 7-day forecast, from two free services:
//   1. Open-Meteo (no key). Its free limit counts per internet address, and free hosts such as Render share one
//      address between many apps, so it can answer "429 too many requests".
//   2. MET Norway (api.met.no, the Norwegian weather service behind yr.no; no key, limits per app). Used whenever
//      Open-Meteo fails, and alone for a while after Open-Meteo says "too many".
// Both give the same shape (see `days` below). A forecast is kept for an hour per place (rounded to about 10 km), so
// many farmers in one area cost one request.
const CACHE_MS = 60 * 60_000;
const OPEN_METEO_PAUSE_MS = 30 * 60_000;
const DAYS = 7;
const cache = new Map();
let openMeteoPausedUntil = 0;

// MET Norway asks every app to say who it is.
const USER_AGENT = 'ShambaSmart/1.0 (farmer companion; https://github.com/immaculatemuli/ShambaSmart)';

/** Fills in for tests (and for a server with no internet in development). */
let fetchImpl = (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
export const setWeatherFetch = (fn) => {
  fetchImpl = fn;
  cache.clear();
  openMeteoPausedUntil = 0;
};

async function getJson(url, headers = {}) {
  const res = await fetchImpl(url, { headers });
  if (!res.ok) {
    const error = new Error(`answered ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

async function fromOpenMeteo(lat, lon) {
  const daily = ['weather_code', 'temperature_2m_max', 'temperature_2m_min', 'precipitation_sum', 'precipitation_probability_max', 'wind_speed_10m_max'];
  const body = await getJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&daily=${daily.join(',')}&current=temperature_2m,weather_code&timezone=Africa%2FNairobi&forecast_days=${DAYS}`,
  );
  const d = body.daily;
  return {
    source: 'open-meteo',
    current: body.current ? { temperature: body.current.temperature_2m, code: body.current.weather_code } : null,
    days: d.time.map((date, i) => ({
      date,
      code: d.weather_code[i],
      temp_max: d.temperature_2m_max[i],
      temp_min: d.temperature_2m_min[i],
      rain_mm: d.precipitation_sum[i] ?? 0,
      rain_chance: d.precipitation_probability_max[i] ?? null,
      wind_kmh: d.wind_speed_10m_max[i],
    })),
  };
}

// MET Norway names its pictures (e.g. "lightrainshowers_day"); the app uses the WMO weather codes Open-Meteo gives.
// Ordered from most to least severe: a day shows its most severe weather.
const MET_CODES = [
  [/thunder/, 95],
  [/heavyrain|heavysleet/, 65],
  [/snow|sleet/, 71],
  [/rain/, 61],
  [/fog/, 45],
  [/^cloudy/, 3],
  [/partlycloudy/, 2],
  [/fair/, 1],
  [/clearsky/, 0],
];
const severity = (code) => [95, 65, 71, 61, 45, 3, 2, 1, 0].indexOf(code);
function metCode(symbol) {
  const name = String(symbol ?? '').replace(/_(day|night|polartwilight)$/, '');
  return MET_CODES.find(([pattern]) => pattern.test(name))?.[1] ?? 3;
}
/** Kenya's date (UTC+3) of a UTC timestamp. */
const kenyaDate = (iso) => new Date(Date.parse(iso) + 3 * 3600_000).toISOString().slice(0, 10);

async function fromMetNorway(lat, lon) {
  const body = await getJson(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`, { 'User-Agent': USER_AGENT });
  const series = body.properties.timeseries;
  const today = nairobiToday();
  const byDay = new Map(Array.from({ length: DAYS }, (_, i) => [addDays(today, i), { temps: [], rain: 0, wind: 0, code: null }]));

  series.forEach((entry, i) => {
    const day = byDay.get(kenyaDate(entry.time));
    if (!day) return;
    const now = entry.data.instant.details;
    day.temps.push(now.air_temperature);
    day.wind = Math.max(day.wind, (now.wind_speed ?? 0) * 3.6);
    // Hourly steps carry the next hour's rain; later, 6-hourly steps carry the next six hours'. Count each hour once.
    const next = series[i + 1];
    const hourly = entry.data.next_1_hours && next && Date.parse(next.time) - Date.parse(entry.time) === 3600_000;
    const period = hourly ? entry.data.next_1_hours : (entry.data.next_6_hours ?? entry.data.next_1_hours);
    if (!period) return;
    day.rain += period.details?.precipitation_amount ?? 0;
    const code = metCode(period.summary?.symbol_code);
    if (day.code === null || severity(code) < severity(day.code)) day.code = code;
  });

  const days = [...byDay]
    .filter(([, d]) => d.temps.length)
    .map(([date, d]) => ({
      date,
      code: d.code ?? 3,
      temp_max: Math.max(...d.temps),
      temp_min: Math.min(...d.temps),
      rain_mm: Math.round(d.rain * 10) / 10,
      rain_chance: null,
      wind_kmh: Math.round(d.wind),
    }));
  const first = series[0]?.data;
  return {
    source: 'met-norway',
    current: first ? { temperature: first.instant.details.air_temperature, code: metCode(first.next_1_hours?.summary?.symbol_code) } : null,
    days,
  };
}

export async function getForecast(latitude, longitude) {
  const lat = Math.round(latitude * 10) / 10;
  const lon = Math.round(longitude * 10) / 10;
  const key = `${lat},${lon}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.forecast;

  const problems = [];
  let result = null;
  if (Date.now() >= openMeteoPausedUntil) {
    try {
      result = await fromOpenMeteo(lat, lon);
    } catch (error) {
      if (error.status === 429) openMeteoPausedUntil = Date.now() + OPEN_METEO_PAUSE_MS;
      problems.push(`Open-Meteo ${error.message}`);
    }
  }
  if (!result) {
    try {
      result = await fromMetNorway(lat, lon);
    } catch (error) {
      problems.push(`MET Norway ${error.message}`);
    }
  }
  if (!result) {
    // An older forecast is better than none.
    if (hit) return hit.forecast;
    throw new HttpError(503, 'WEATHER_UNAVAILABLE', 'The weather forecast is not available right now. Please try again later', problems.join('; '));
  }

  const forecast = { latitude: lat, longitude: lon, ...result };
  cache.set(key, { at: Date.now(), forecast });
  return forecast;
}
