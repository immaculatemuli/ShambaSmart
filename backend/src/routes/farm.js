import { Router } from 'express';
import { z } from 'zod';
import { CROP_KEYS } from '../catalog/crops.js';
import { TASK_KINDS } from '../db.js';
import { languageOf } from '../lang.js';
import * as calendar from '../services/calendar.js';
import { listDiagnoses } from '../services/diagnose.js';
import { listExpenses, listHarvests, summary } from '../services/records.js';
import { id, isoDate, note, parse } from '../validate.js';

// Plots (what is planted where) and farm activities (the crop calendar and the farmer's own tasks).
const router = Router();

const plotFields = {
  name: z.string().trim().min(1).max(60),
  crop: z.enum(CROP_KEYS),
  variety: note,
  size_acres: z.number().positive().max(10_000).optional().nullable(),
  planted_on: isoDate,
  notes: note,
};

router.get('/plots', async (req, res) => {
  res.json({ plots: await calendar.listPlots(req.user.id, languageOf(req)) });
});

router.post('/plots', async (req, res) => {
  const body = parse(z.object(plotFields), req.body);
  const plotId = await calendar.createPlot(req.user.id, body);
  res.status(201).json({ id: plotId });
});

router.get('/plots/:id', async (req, res) => {
  const lang = languageOf(req);
  const plotId = parse(id, req.params.id);
  const plot = calendar.describePlot(await calendar.plotOf(req.user.id, plotId), lang);
  res.json({
    plot,
    tasks: await calendar.listTasks(req.user.id, lang, { status: 'all', plotId }),
    expenses: await listExpenses(req.user.id, { plotId }),
    harvests: await listHarvests(req.user.id, { plotId }),
    money: await summary(req.user.id, { plotId }),
    diagnoses: (await listDiagnoses(req.user.id)).filter((d) => d.plot_id === plotId),
  });
});

router.patch('/plots/:id', async (req, res) => {
  const body = parse(
    z.object({
      name: plotFields.name.optional(),
      variety: note,
      size_acres: plotFields.size_acres,
      notes: note,
      status: z.enum(['growing', 'harvested']).optional(),
    }),
    req.body,
  );
  // Only fields that were sent are changed (note turns a missing field into null, so drop those).
  const changes = Object.fromEntries(Object.entries(body).filter(([k]) => k in (req.body ?? {})));
  await calendar.updatePlot(req.user.id, parse(id, req.params.id), changes);
  res.json({ ok: true });
});

router.delete('/plots/:id', async (req, res) => {
  await calendar.deletePlot(req.user.id, parse(id, req.params.id));
  res.json({ ok: true });
});

router.get('/tasks', async (req, res) => {
  const q = parse(
    z.object({
      status: z.enum(['open', 'done', 'all']).optional(),
      from: isoDate.optional(),
      to: isoDate.optional(),
      plot_id: id.optional(),
    }),
    req.query,
  );
  res.json({ tasks: await calendar.listTasks(req.user.id, languageOf(req), { ...q, plotId: q.plot_id }) });
});

router.post('/tasks', async (req, res) => {
  const body = parse(
    z.object({
      plot_id: id.optional().nullable(),
      kind: z.enum(TASK_KINDS).default('other'),
      title: z.string().trim().min(1).max(120),
      details: note,
      due_on: isoDate,
    }),
    req.body,
  );
  res.status(201).json({ id: await calendar.createTask(req.user.id, body) });
});

router.patch('/tasks/:id', async (req, res) => {
  const body = parse(z.object({ done: z.boolean().optional(), due_on: isoDate.optional() }), req.body);
  const taskId = parse(id, req.params.id);
  if (body.done !== undefined) await calendar.setTaskDone(req.user.id, taskId, body.done);
  if (body.due_on) await calendar.rescheduleTask(req.user.id, taskId, body.due_on);
  res.json({ ok: true });
});

router.delete('/tasks/:id', async (req, res) => {
  await calendar.deleteTask(req.user.id, parse(id, req.params.id));
  res.json({ ok: true });
});

export default router;
