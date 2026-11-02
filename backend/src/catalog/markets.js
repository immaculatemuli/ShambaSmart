import { all, one, transaction } from '../db.js';
import { nairobiToday } from '../util.js';

// Main wholesale markets, and rough guide prices (KES per kg) ShambaSmart starts with so the price screen is not
// empty on day one. They are shown marked "sample guide" until farmers report real prices at that market.
export const MARKETS = [
  ['Wakulima (Marikiti)', 'Nairobi'],
  ['Kongowea', 'Mombasa'],
  ['Kibuye', 'Kisumu'],
  ['Wakulima Nakuru', 'Nakuru'],
  ['Eldoret Municipal', 'Uasin Gishu'],
  ['Karatina', 'Nyeri'],
  ['Daraja Mbili', 'Kisii'],
  ['Gakoromone', 'Meru'],
  ['Kitale', 'Trans Nzoia'],
  ['Machakos', 'Machakos'],
];

const GUIDE_PRICE = { maize: 45, beans: 120, tomatoes: 70, kale: 35, cabbage: 30, potatoes: 50, onions: 100, green_grams: 140, sorghum: 55 };

// Fixed nudges per market (some sell cheaper than others) so the guide is not one number repeated.
const MARKET_FACTOR = [1.1, 1.15, 1.0, 0.95, 0.9, 0.95, 1.0, 0.95, 0.88, 1.05];

/** Adds the markets and sample prices to an empty database (does nothing once there are markets). */
export async function seedMarkets() {
  if ((await one('SELECT COUNT(*) AS n FROM markets')).n > 0) return;
  const today = nairobiToday();
  await transaction(async (tx) => {
    for (const [i, [name, county]] of MARKETS.entries()) {
      const marketId = await tx.insert('INSERT INTO markets (name, county) VALUES (?, ?)', name, county);
      // One statement per market (not per price): an online database is a network trip away.
      const crops = Object.entries(GUIDE_PRICE);
      await tx.run(
        `INSERT INTO prices (market_id, crop, price_per_kg, source, observed_on) VALUES ${crops.map(() => "(?, ?, ?, 'sample', ?)").join(', ')}`,
        ...crops.flatMap(([crop, price]) => [marketId, crop, Math.round(price * MARKET_FACTOR[i]), today]),
      );
    }
  });
}

export const listMarkets = () => all('SELECT id, name, county FROM markets ORDER BY name');
