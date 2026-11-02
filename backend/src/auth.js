import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { one } from './db.js';
import { HttpError } from './errors.js';

// The app (phone and web) sends "Authorization: Bearer <token>"; the token lasts JWT_EXPIRES_IN.
export const signToken = (user) => jwt.sign({ sub: String(user.id) }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

export const USER_COLUMNS = 'id, name, phone, county, latitude, longitude';

export function authenticate(req, _res, next) {
  const header = req.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'UNAUTHENTICATED', 'Please sign in'));
  let sub;
  try {
    ({ sub } = jwt.verify(token, config.jwtSecret));
  } catch {
    return next(new HttpError(401, 'UNAUTHENTICATED', 'Your sign-in has expired. Please sign in again'));
  }
  const user = one(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, Number(sub));
  if (!user) return next(new HttpError(401, 'UNAUTHENTICATED', 'Please sign in'));
  req.user = user;
  next();
}
