import { Router } from 'express';
import { z } from 'zod';
import { CROP_KEYS } from '../catalog/crops.js';
import { languageOf } from '../lang.js';
import { rateLimit } from '../ratelimit.js';
import { deleteDiagnosis, diagnosePhoto, getDiagnosis, listDiagnoses, MEDIA_TYPES } from '../services/diagnose.js';
import { id, note, parse } from '../validate.js';

const router = Router();

// On top of the daily limit: stops a stuck app sending the same photo over and over.
const burst = rateLimit({ limit: 5, windowMs: 60_000, key: (req) => `diagnose|${req.user.id}` });

router.post('/diagnoses', burst, async (req, res) => {
  const body = parse(
    z.object({
      image: z.string().min(100).regex(/^[A-Za-z0-9+/=]+$/, 'The photo must be base64 (no data: prefix)'),
      media_type: z.enum(MEDIA_TYPES),
      crop: z.enum(CROP_KEYS).optional().nullable(),
      plot_id: id.optional().nullable(),
      note,
    }),
    req.body,
  );
  res.status(201).json(await diagnosePhoto(req.user.id, body, languageOf(req)));
});

router.get('/diagnoses', (req, res) => res.json({ diagnoses: listDiagnoses(req.user.id) }));

router.get('/diagnoses/:id', (req, res) => res.json(getDiagnosis(req.user.id, parse(id, req.params.id))));

router.delete('/diagnoses/:id', (req, res) => {
  deleteDiagnosis(req.user.id, parse(id, req.params.id));
  res.json({ ok: true });
});

export default router;
