import { cropByKey } from '../catalog/crops.js';
import { all, one, run } from '../db.js';
import { HttpError, notFound } from '../errors.js';
import { addDays, median, nairobiToday } from '../util.js';

// Farmer reports from the last RECENT_DAYS count as the market's current price; with none, the sample guide shows.
export const RECENT_DAYS = 14;

/** Today's price of one crop at every market, cheapest first. */
export function cropPrices(crop, today = nairobiToday()) {
  if (!cropByKey(crop)) throw notFound('Crop');
  const since = addDays(today, -RECENT_DAYS);
  const markets = all('SELECT id, name, county FROM markets ORDER BY name');
  const rows = all(
    `SELECT market_id, price_per_kg, source, observed_on FROM prices
     WHERE crop = ? AND (source = 'sample' OR observed_on >= ?) ORDER BY observed_on DESC`,
    crop,
    since,
  );
  const list = markets.map((m) => {
    const mine = rows.filter((r) => r.market_id === m.id);
    const reports = mine.filter((r) => r.source === 'farmer');
    if (reports.length) {
      return {
        market_id: m.id,
        market: m.name,
        county: m.county,
        price_per_kg: median(reports.map((r) => r.price_per_kg)),
        source: 'farmer',
        reports: reports.length,
        updated_on: reports[0].observed_on,
      };
    }
    const sample = mine.find((r) => r.source === 'sample');
    return sample
      ? { market_id: m.id, market: m.name, county: m.county, price_per_kg: sample.price_per_kg, source: 'sample', reports: 0, updated_on: sample.observed_on }
      : null;
  });
  const prices = list.filter(Boolean).sort((a, b) => a.price_per_kg - b.price_per_kg);
  return {
    crop,
    prices,
    median_per_kg: median(prices.map((p) => p.price_per_kg)),
    trend: priceTrend(crop, today),
  };
}

/** The median farmer-reported price per week over the last 8 weeks (oldest first), for a small chart. */
export function priceTrend(crop, today = nairobiToday()) {
  const weeks = [];
  for (let w = 7; w >= 0; w--) {
    const end = addDays(today, -7 * w);
    const start = addDays(end, -6);
    const values = all(
      "SELECT price_per_kg FROM prices WHERE crop = ? AND source = 'farmer' AND observed_on BETWEEN ? AND ?",
      crop,
      start,
      end,
    ).map((r) => r.price_per_kg);
    weeks.push({ week_ending: end, median_per_kg: median(values), reports: values.length });
  }
  return weeks;
}

/** Every crop's median price across markets, for the market overview. */
export function overview(cropKeys, today = nairobiToday()) {
  return cropKeys.map((crop) => {
    const { median_per_kg, prices } = cropPrices(crop, today);
    return { crop, median_per_kg, markets: prices.length, from_farmers: prices.some((p) => p.source === 'farmer') };
  });
}

export function reportPrice(userId, { market_id, crop, price_per_kg, observed_on }) {
  if (!one('SELECT 1 FROM markets WHERE id = ?', market_id)) throw notFound('Market');
  if (!cropByKey(crop)) throw notFound('Crop');
  const today = nairobiToday();
  if (observed_on > today) throw new HttpError(400, 'FUTURE_DATE', 'The date cannot be in the future');
  // One report per farmer, market, crop and day: a second one corrects the first.
  run("DELETE FROM prices WHERE user_id = ? AND market_id = ? AND crop = ? AND observed_on = ? AND source = 'farmer'", userId, market_id, crop, observed_on);
  run(
    "INSERT INTO prices (market_id, crop, price_per_kg, source, user_id, observed_on) VALUES (?, ?, ?, 'farmer', ?, ?)",
    market_id,
    crop,
    price_per_kg,
    userId,
    observed_on,
  );
}
