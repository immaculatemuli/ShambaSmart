import { Router } from 'express';
import { COUNTIES } from '../catalog/counties.js';
import { CROPS, cropByKey } from '../catalog/crops.js';
import { listMarkets } from '../catalog/markets.js';
import { EXPENSE_CATEGORIES, TASK_KINDS } from '../db.js';
import { notFound } from '../errors.js';
import { languageOf, pick } from '../lang.js';
import { addDays, nairobiToday } from '../util.js';
import { isoDate, parse } from '../validate.js';

// Public lists the app needs before and after signing in: crops, counties, markets.
const router = Router();

router.get('/catalog', async (req, res) => {
  const lang = languageOf(req);
  const month = Number(nairobiToday().slice(5, 7));
  res.json({
    crops: CROPS.map((c) => ({
      key: c.key,
      name: pick(c.name, lang),
      days: c.days,
      spacing: c.spacing,
      seasons: c.seasons,
      irrigated: !!c.irrigated,
      in_season: c.seasons.includes(month),
      nursery: c.calendar.some((s) => s.kind === 'nursery'),
    })),
    counties: COUNTIES,
    markets: await listMarkets(),
    expense_categories: EXPENSE_CATEGORIES,
    task_kinds: TASK_KINDS,
  });
});

/** A crop's calendar laid out from a planting day (default today), to preview before adding a plot. */
router.get('/crops/:key/calendar', (req, res) => {
  const crop = cropByKey(req.params.key);
  if (!crop) throw notFound('Crop');
  const lang = languageOf(req);
  const plantedOn = req.query.planted_on ? parse(isoDate, req.query.planted_on) : nairobiToday();
  res.json({
    crop: crop.key,
    name: pick(crop.name, lang),
    planted_on: plantedOn,
    steps: crop.calendar.map((s) => ({
      day: s.day,
      kind: s.kind,
      title: pick(s.title, lang),
      details: pick(s.details, lang),
      due_on: addDays(plantedOn, s.day),
    })),
  });
});

export default router;
