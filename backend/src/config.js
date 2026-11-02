import { fileURLToPath } from 'node:url';

const env = process.env;
const num = (value, fallback) => (value === undefined || value === '' ? fallback : Number(value));

export const config = {
  env: env.NODE_ENV ?? 'development',
  port: num(env.PORT, 4000),
  jwtSecret: env.JWT_SECRET ?? 'dev-only-insecure-secret',
  jwtExpiresIn: env.JWT_EXPIRES_IN ?? '30d',
  dbPath: env.DB_PATH ?? './data/shambasmart.db',
  // The built web app (app/dist from `expo export --platform web`), served at the main address when it exists.
  webAppDir: env.WEB_APP_DIR || fileURLToPath(new URL('../../app/dist', import.meta.url)),
  // The free AI services allow a limited number of photo checks a day in all, so one farmer gets this many.
  diagnosesPerDay: num(env.DIAGNOSES_PER_DAY, 15),
  // Which free AI service reads crop photos: gemini, groq or ollama (services/vision.js). Empty: the first with a key.
  visionProvider: env.VISION_PROVIDER || null,
  // A different model at that service than the usual one (optional).
  visionModel: env.VISION_MODEL || null,
  trustProxy: num(env.TRUST_PROXY, 0),
};

if (config.env === 'production' && config.jwtSecret === 'dev-only-insecure-secret') {
  throw new Error('JWT_SECRET must be set in production');
}
