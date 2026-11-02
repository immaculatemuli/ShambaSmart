import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { authenticate, signToken, USER_COLUMNS } from '../auth.js';
import { countyByName } from '../catalog/counties.js';
import { insert, one, run } from '../db.js';
import { HttpError } from '../errors.js';
import { rateLimit } from '../ratelimit.js';
import { normalizePhone } from '../util.js';
import { parse, password, phone } from '../validate.js';

const router = Router();

const county = z
  .string()
  .refine((c) => countyByName(c), 'Unknown county')
  .optional()
  .nullable();

const tries = rateLimit({ limit: 10, windowMs: 15 * 60_000, key: (req) => `${req.ip}|${normalizePhone(req.body?.phone) ?? ''}` });

const userOf = (id) => one(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, id);

router.post('/auth/register', tries, async (req, res) => {
  const body = parse(z.object({ name: z.string().trim().min(2).max(80), phone, password, county }), req.body);
  if (await one('SELECT 1 AS ok FROM users WHERE phone = ?', body.phone)) {
    throw new HttpError(409, 'PHONE_TAKEN', 'This phone number already has an account. Please sign in');
  }
  const place = body.county ? countyByName(body.county) : null;
  const id = await insert(
    'INSERT INTO users (name, phone, password_hash, county, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?)',
    body.name,
    body.phone,
    await bcrypt.hash(body.password, 10),
    place?.name ?? null,
    place?.latitude ?? null,
    place?.longitude ?? null,
  );
  const user = await userOf(id);
  res.status(201).json({ token: signToken(user), user });
});

router.post('/auth/login', tries, async (req, res) => {
  const body = parse(z.object({ phone, password: z.string().min(1) }), req.body);
  const row = await one('SELECT id, password_hash FROM users WHERE phone = ?', body.phone);
  if (!row || !(await bcrypt.compare(body.password, row.password_hash))) {
    throw new HttpError(401, 'WRONG_PASSWORD', 'Wrong phone number or password');
  }
  const user = await userOf(row.id);
  res.json({ token: signToken(user), user });
});

router.get('/me', authenticate, (req, res) => res.json({ user: req.user }));

/** Name and farm location. Choosing a county moves the weather there unless exact GPS numbers come with it. */
router.patch('/me', authenticate, async (req, res) => {
  const body = parse(
    z.object({
      name: z.string().trim().min(2).max(80).optional(),
      county,
      latitude: z.number().min(-5).max(5.5).optional(),
      longitude: z.number().min(33.5).max(42.5).optional(),
    }),
    req.body,
  );
  const next = { ...req.user };
  if (body.name) next.name = body.name;
  if (body.county !== undefined) {
    const place = body.county ? countyByName(body.county) : null;
    next.county = place?.name ?? null;
    next.latitude = place?.latitude ?? null;
    next.longitude = place?.longitude ?? null;
  }
  if (body.latitude !== undefined && body.longitude !== undefined) {
    next.latitude = body.latitude;
    next.longitude = body.longitude;
  }
  await run('UPDATE users SET name = ?, county = ?, latitude = ?, longitude = ? WHERE id = ?', next.name, next.county, next.latitude, next.longitude, req.user.id);
  res.json({ user: await userOf(req.user.id) });
});

router.post('/me/password', authenticate, async (req, res) => {
  const body = parse(z.object({ current_password: z.string().min(1), new_password: password }), req.body);
  const { password_hash } = await one('SELECT password_hash FROM users WHERE id = ?', req.user.id);
  if (!(await bcrypt.compare(body.current_password, password_hash))) {
    throw new HttpError(400, 'WRONG_PASSWORD', 'Your current password is not right');
  }
  await run('UPDATE users SET password_hash = ? WHERE id = ?', await bcrypt.hash(body.new_password, 10), req.user.id);
  res.json({ ok: true });
});

/** Deletes the account and everything recorded with it. Price reports stay, without the farmer's name. */
router.delete('/me', authenticate, async (req, res) => {
  const body = parse(z.object({ password: z.string().min(1) }), req.body);
  const { password_hash } = await one('SELECT password_hash FROM users WHERE id = ?', req.user.id);
  if (!(await bcrypt.compare(body.password, password_hash))) {
    throw new HttpError(400, 'WRONG_PASSWORD', 'Your password is not right');
  }
  await run('DELETE FROM users WHERE id = ?', req.user.id);
  res.json({ ok: true });
});

export default router;
