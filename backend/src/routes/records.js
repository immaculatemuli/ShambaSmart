import { Router } from 'express';
import { z } from 'zod';
import { CROP_KEYS } from '../catalog/crops.js';
import { EXPENSE_CATEGORIES } from '../db.js';
import * as records from '../services/records.js';
import { id, isoDate, kes, note, parse } from '../validate.js';

const router = Router();

const period = z.object({ from: isoDate.optional(), to: isoDate.optional(), plot_id: id.optional() });
const filterOf = (query) => {
  const q = parse(period, query);
  return { from: q.from, to: q.to, plotId: q.plot_id };
};

router.get('/records/summary', async (req, res) => res.json(await records.summary(req.user.id, filterOf(req.query))));

router.get('/expenses', async (req, res) => res.json({ expenses: await records.listExpenses(req.user.id, filterOf(req.query)) }));

router.post('/expenses', async (req, res) => {
  const body = parse(
    z.object({
      plot_id: id.optional().nullable(),
      category: z.enum(EXPENSE_CATEGORIES),
      amount: kes.refine((n) => n > 0, 'Enter the amount'),
      spent_on: isoDate,
      note,
    }),
    req.body,
  );
  res.status(201).json({ id: await records.addExpense(req.user.id, body) });
});

router.delete('/expenses/:id', async (req, res) => {
  await records.deleteExpense(req.user.id, parse(id, req.params.id));
  res.json({ ok: true });
});

router.get('/harvests', async (req, res) => res.json({ harvests: await records.listHarvests(req.user.id, filterOf(req.query)) }));

router.post('/harvests', async (req, res) => {
  const body = parse(
    z.object({
      plot_id: id.optional().nullable(),
      crop: z.enum(CROP_KEYS),
      quantity: z.number().positive().max(10_000_000),
      unit: z.string().trim().min(1).max(20),
      income: kes.optional(),
      harvested_on: isoDate,
      note,
    }),
    req.body,
  );
  res.status(201).json({ id: await records.addHarvest(req.user.id, body) });
});

router.delete('/harvests/:id', async (req, res) => {
  await records.deleteHarvest(req.user.id, parse(id, req.params.id));
  res.json({ ok: true });
});

export default router;
