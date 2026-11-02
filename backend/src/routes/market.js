import { Router } from 'express';
import { z } from 'zod';
import { CROP_KEYS } from '../catalog/crops.js';
import { cropPrices, overview, reportPrice } from '../services/prices.js';
import { nairobiToday } from '../util.js';
import { id, isoDate, parse } from '../validate.js';

const router = Router();

router.get('/prices', async (_req, res) => res.json({ crops: await overview(CROP_KEYS) }));

router.get('/prices/:crop', async (req, res) => res.json(await cropPrices(req.params.crop)));

router.post('/prices', async (req, res) => {
  const body = parse(
    z.object({
      market_id: id,
      crop: z.enum(CROP_KEYS),
      price_per_kg: z.number().int().positive().max(5000),
      observed_on: isoDate.default(nairobiToday),
    }),
    req.body,
  );
  await reportPrice(req.user.id, body);
  res.status(201).json({ ok: true });
});

export default router;
