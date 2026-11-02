import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { authenticate } from './auth.js';
import { seedMarkets } from './catalog/markets.js';
import { config } from './config.js';
import { HttpError } from './errors.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import diagnoseRoutes from './routes/diagnose.js';
import farmRoutes from './routes/farm.js';
import marketRoutes from './routes/market.js';
import recordRoutes from './routes/records.js';
import weatherRoutes from './routes/weather.js';

// The web app (Expo's web build) loads only its own files. react-native-web puts styles inline, and photos chosen
// for a check are shown from blob: and data: addresses before sending.
const WEB_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; " +
  "connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

/** The built web app at the main address; any other page address is one of its screens (e.g. /plot/3). */
function serveWebApp(app) {
  const dir = config.webAppDir;
  if (!existsSync(join(dir, 'index.html'))) return;
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    res.set('Content-Security-Policy', WEB_CSP);
    next();
  });
  app.use(express.static(dir, { index: 'index.html', maxAge: '1h' }));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(join(dir, 'index.html')));
}

export function createApp() {
  seedMarkets();
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', config.trustProxy);

  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'no-referrer');
    // During development the web app runs on Expo's own server (localhost:8081) and calls this one.
    const origin = req.get('origin');
    if (config.env !== 'production' && origin && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Language');
      res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE');
      if (req.method === 'OPTIONS') return res.sendStatus(204);
    }
    next();
  });

  // Photos are large; everything else is small.
  app.use('/api/diagnoses', express.json({ limit: '8mb' }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.use('/api', authRoutes);
  app.use('/api', catalogRoutes);
  const signedIn = express.Router();
  signedIn.use(authenticate);
  signedIn.use(farmRoutes, weatherRoutes, diagnoseRoutes, marketRoutes, recordRoutes);
  app.use('/api', signedIn);

  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'NOT_FOUND', 'Not found')));
  serveWebApp(app);

  // eslint-disable-next-line no-unused-vars
  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ error: { code: 'TOO_LARGE', message: 'That is too large to send' } });
    }
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { code: 'BAD_JSON', message: 'Invalid request' } });
    }
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: { code: error.code, message: error.message, details: error.details } });
    }
    console.error(error);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong. Please try again' } });
  });
  return app;
}
