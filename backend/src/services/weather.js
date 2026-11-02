import { HttpError } from '../errors.js';

// The 7-day forecast from Open-Meteo (free, no key). Kept for an hour per place (rounded to about 10 km), so many
// farmers in one area cost one request.
const CACHE_MS = 60 * 60_000;
const cache = new Map();

const DAILY = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
  'precipitation_probability_max',
  'wind_speed_10m_max',
];

/** Fills in for tests (and for a server with no internet in development). */
let fetchImpl = (url) => fetch(url, { signal: AbortSignal.timeout(10_000) });
export const setWeatherFetch = (fn) => {
  fetchImpl = fn;
  cache.clear();
};

export async function getForecast(latitude, longitude) {
  const lat = Math.round(latitude * 10) / 10;
  const lon = Math.round(longitude * 10) / 10;
  const key = `${lat},${lon}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.forecast;

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=${DAILY.join(',')}&current=temperature_2m,weather_code&timezone=Africa%2FNairobi&forecast_days=7`;
  let body;
  try {
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`Open-Meteo answered ${res.status}`);
    body = await res.json();
  } catch (error) {
    // An older forecast is better than none.
    if (hit) return hit.forecast;
    throw new HttpError(503, 'WEATHER_UNAVAILABLE', 'The weather forecast is not available right now. Please try again later', error.message);
  }

  const d = body.daily;
  const forecast = {
    latitude: lat,
    longitude: lon,
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
  cache.set(key, { at: Date.now(), forecast });
  return forecast;
}
