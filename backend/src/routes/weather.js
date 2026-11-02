import { Router } from 'express';
import { HttpError } from '../errors.js';
import { languageOf } from '../lang.js';
import { buildAlerts } from '../services/alerts.js';
import { listPlots, listTasks } from '../services/calendar.js';
import { summary } from '../services/records.js';
import { getForecast } from '../services/weather.js';
import { addDays, nairobiToday } from '../util.js';

const router = Router();

/** The forecast for the farmer's place with alerts for their crops and coming work, or null with no place set. */
async function weatherFor(user, lang) {
  if (user.latitude == null || user.longitude == null) return null;
  const today = nairobiToday();
  const forecast = await getForecast(user.latitude, user.longitude);
  const plots = (await listPlots(user.id, lang)).filter((p) => p.status === 'growing');
  const tasks = await listTasks(user.id, lang, { status: 'open', to: addDays(today, 7) });
  return { ...forecast, alerts: buildAlerts({ days: forecast.days, plots, tasks, lang, today }) };
}

router.get('/weather', async (req, res) => {
  const weather = await weatherFor(req.user, languageOf(req));
  if (!weather) throw new HttpError(409, 'NO_LOCATION', 'Choose your county (or share your location) to see the weather');
  res.json(weather);
});

/** Everything the home screen shows, in one request. The weather may be missing (no place set, or no forecast). */
router.get('/home', async (req, res) => {
  const lang = languageOf(req);
  const today = nairobiToday();
  let weather = null;
  let weatherError = null;
  try {
    weather = await weatherFor(req.user, lang);
  } catch (error) {
    weatherError = error.message;
  }
  const plots = await listPlots(req.user.id, lang);
  const monthStart = `${today.slice(0, 7)}-01`;
  res.json({
    today,
    user: req.user,
    weather,
    weather_error: weatherError,
    tasks: await listTasks(req.user.id, lang, { status: 'open', to: addDays(today, 7) }),
    plots: plots.filter((p) => p.status === 'growing'),
    month: await summary(req.user.id, { from: monthStart, to: today }),
  });
});

export default router;
