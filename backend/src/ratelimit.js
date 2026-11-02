import { HttpError } from './errors.js';

/** At most `limit` requests per `windowMs` for each key (e.g. address + phone number). Kept in memory. */
export function rateLimit({ limit, windowMs, key }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.until < now) hits.delete(k);
  }, windowMs).unref();

  return (req, _res, next) => {
    const k = key(req);
    const now = Date.now();
    const entry = hits.get(k);
    if (!entry || entry.until < now) {
      hits.set(k, { count: 1, until: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > limit) {
      return next(new HttpError(429, 'TOO_MANY_TRIES', 'Too many tries. Please wait a few minutes and try again'));
    }
    next();
  };
}
