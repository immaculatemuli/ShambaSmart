import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.DB_PATH = ':memory:';
const { getForecast, setWeatherFetch } = await import('../src/services/weather.js');
const { addDays, nairobiToday } = await import('../src/util.js');

const today = nairobiToday();
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

/** A MET Norway forecast: hourly steps for today, then 6-hourly steps, all at 21:00 UTC = midnight in Kenya onwards. */
function metNorway() {
  const start = Date.parse(`${addDays(today, -1)}T21:00:00Z`); // 00:00 today in Kenya
  const series = [];
  for (let h = 0; h < 24; h++) {
    series.push({
      time: new Date(start + h * 3600_000).toISOString(),
      data: {
        instant: { details: { air_temperature: 14 + (h > 12 ? 10 : h / 2), wind_speed: h === 15 ? 12 : 3 } },
        next_1_hours: { summary: { symbol_code: h === 15 ? 'heavyrainandthunder' : 'partlycloudy_day' }, details: { precipitation_amount: h === 15 ? 20 : 0.5 } },
        next_6_hours: { summary: { symbol_code: 'rain' }, details: { precipitation_amount: 99 } },
      },
    });
  }
  for (let s = 0; s < 4 * 8; s++) {
    series.push({
      time: new Date(start + 24 * 3600_000 + s * 6 * 3600_000).toISOString(),
      data: {
        instant: { details: { air_temperature: 18, wind_speed: 2 } },
        next_6_hours: { summary: { symbol_code: 'fair_day' }, details: { precipitation_amount: 1 } },
      },
    });
  }
  return { properties: { timeseries: series } };
}

test('when Open-Meteo says "too many requests", MET Norway gives the forecast in the same shape', async () => {
  const asked = [];
  setWeatherFetch(async (url, init) => {
    asked.push({ url, init });
    return url.includes('open-meteo') ? json({ reason: 'limit' }, 429) : json(metNorway());
  });
  const forecast = await getForecast(-1.17, 36.83);
  assert.equal(forecast.source, 'met-norway');
  assert.equal(forecast.days.length, 7);
  assert.equal(forecast.days[0].date, today);

  const first = forecast.days[0];
  // 23 hourly steps of 0.5 mm plus one of 20 mm; the six-hour totals on hourly steps are not counted again.
  assert.equal(first.rain_mm, 31.5);
  assert.equal(first.code, 95); // the day's most severe weather: a thunderstorm
  assert.equal(first.temp_max, 24);
  assert.equal(first.temp_min, 14);
  assert.equal(first.wind_kmh, 43); // 12 m/s
  assert.equal(forecast.days[1].rain_mm, 4); // four 6-hour steps of 1 mm
  assert.equal(forecast.days[1].code, 1);

  const met = asked.find((a) => a.url.includes('api.met.no'));
  assert.match(met.init.headers['User-Agent'], /ShambaSmart/);
  assert.match(met.url, /lat=-1\.2&lon=36\.8/);
});

test('after a "too many requests", Open-Meteo is left alone for a while', async () => {
  const asked = [];
  setWeatherFetch(async (url) => {
    asked.push(url);
    return url.includes('open-meteo') ? json({}, 429) : json(metNorway());
  });
  await getForecast(0.5, 35.3);
  await getForecast(-0.1, 34.8); // another place: not in the hour-long cache
  assert.equal(asked.filter((u) => u.includes('open-meteo')).length, 1);
  assert.equal(asked.filter((u) => u.includes('api.met.no')).length, 2);
});

test('with both services down, the forecast is reported as unavailable', async () => {
  setWeatherFetch(async () => json({}, 503));
  await assert.rejects(getForecast(-4.0, 39.7), { status: 503, code: 'WEATHER_UNAVAILABLE' });
});
