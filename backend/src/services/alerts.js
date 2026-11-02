import { CROPS, cropByKey } from '../catalog/crops.js';
import { pick } from '../lang.js';
import { daysBetween } from '../util.js';

// Turns the 7-day forecast, the farmer's growing crops and their coming tasks into short alerts and planting
// reminders. Plain rules (no AI), so they are quick, free and the same every time.
// levels: 'warning' (act now), 'info' (good to know), 'good' (a chance to take).

const HEAVY_RAIN_MM = 30;
const RAIN_SPOILS_WORK_MM = 10;
const DRY_WEEK_MM = 5;
const PLANTING_RAIN_MM = 25;
const HOT_C = 33;
const COLD_C = 6;
const WINDY_KMH = 40;
const RAIN_SEASON_MONTHS = [3, 4, 10, 11];

const WEEKDAYS = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  sw: ['Jumapili', 'Jumatatu', 'Jumanne', 'Jumatano', 'Alhamisi', 'Ijumaa', 'Jumamosi'],
};

function dayName(date, today, lang) {
  const ahead = daysBetween(today, date);
  if (ahead === 0) return lang === 'sw' ? 'leo' : 'today';
  if (ahead === 1) return lang === 'sw' ? 'kesho' : 'tomorrow';
  const name = WEEKDAYS[lang][new Date(`${date}T00:00:00Z`).getUTCDay()];
  return lang === 'sw' ? `siku ya ${name}` : `on ${name}`;
}


/** A day good for spraying or top-dressing: almost no rain and little wind. */
const isWorkable = (day) => day.rain_mm < 2 && (day.wind_kmh ?? 0) < 20;

/**
 * @param days     forecast days from services/weather.js (today first)
 * @param plots    the farmer's growing plots ({ crop, name })
 * @param tasks    open tasks due in the coming week ({ id, kind, title, due_on, plot_name })
 */
export function buildAlerts({ days, plots = [], tasks = [], lang = 'en', today }) {
  const alerts = [];
  const add = (id, level, icon, title, message) => alerts.push({ id, level, icon, title: pick(title, lang), message: pick(message, lang) });
  const growing = new Set(plots.map((p) => p.crop));
  const weekRain = days.reduce((sum, d) => sum + (d.rain_mm ?? 0), 0);
  const rainyDays = days.filter((d) => d.rain_mm >= 2).length;

  const heavy = days.find((d) => d.rain_mm >= HEAVY_RAIN_MM);
  if (heavy) {
    const when = dayName(heavy.date, today, lang);
    add('heavy-rain', 'warning', 'rainy', { en: `Heavy rain ${when}`, sw: `Mvua kubwa ${when}` }, {
      en: `About ${Math.round(heavy.rain_mm)} mm expected. Clear drainage channels, and hold off fertilizer and spraying so they are not washed away.`,
      sw: `Takriban mm ${Math.round(heavy.rain_mm)} zinatarajiwa. Safisha mitaro, na usiweke mbolea wala kunyunyizia dawa ili zisisombwe na maji.`,
    });
  }

  // Spraying or fertilizer planned for a wet day: suggest the next workable day.
  for (const task of tasks) {
    if (task.kind !== 'spray' && task.kind !== 'fertilize') continue;
    const day = days.find((d) => d.date === task.due_on);
    if (!day || day.rain_mm < RAIN_SPOILS_WORK_MM) continue;
    const better = days.find((d) => d.date >= today && d.date !== day.date && isWorkable(d));
    const when = dayName(day.date, today, lang);
    const plot = task.plot_name ? ` (${task.plot_name})` : '';
    add(
      `task-rain-${task.id}`,
      'warning',
      'umbrella',
      { en: `Rain on the day of: ${task.title}${plot}`, sw: `Mvua siku ya: ${task.title}${plot}` },
      better
        ? {
            en: `Rain is expected ${when}. ${capitalize(dayName(better.date, today, 'en'))} looks dry and calm: a better day for it.`,
            sw: `Mvua inatarajiwa ${when}. ${capitalize(dayName(better.date, today, 'sw'))} kunaonekana kukavu na shwari: siku bora zaidi.`,
          }
        : {
            en: `Rain is expected ${when}. Wait for a dry spell so it is not washed away.`,
            sw: `Mvua inatarajiwa ${when}. Subiri kipindi kikavu ili isisombwe na maji.`,
          },
    );
  }

  if (plots.length && weekRain < DRY_WEEK_MM) {
    add('dry-week', 'warning', 'sunny', { en: 'Dry week ahead', sw: 'Wiki kavu inakuja' }, {
      en: `Less than ${DRY_WEEK_MM} mm of rain expected this week. Water seedlings early or late in the day, and mulch to keep the soil moist.`,
      sw: `Mvua chini ya mm ${DRY_WEEK_MM} inatarajiwa wiki hii. Mwagilia miche asubuhi au jioni, na uweke matandazo kuhifadhi unyevu.`,
    });
  }

  const hot = days.find((d) => d.temp_max >= HOT_C);
  if (hot) {
    const when = dayName(hot.date, today, lang);
    add('heat', 'info', 'thermometer', { en: `Hot weather ${when}`, sw: `Joto kali ${when}` }, {
      en: `Up to ${Math.round(hot.temp_max)}°C. Water in the morning or evening, not at midday, and shade nursery beds.`,
      sw: `Hadi ${Math.round(hot.temp_max)}°C. Mwagilia asubuhi au jioni, si mchana, na uweke kivuli kwenye vitalu.`,
    });
  }

  const cold = days.find((d) => d.temp_min <= COLD_C);
  if (cold) {
    const when = dayName(cold.date, today, lang);
    add('cold', 'warning', 'snow', { en: `Cold night ${when}`, sw: `Usiku wa baridi ${when}` }, {
      en: `Down to ${Math.round(cold.temp_min)}°C. Frost can burn potatoes, tomatoes and young seedlings: cover nursery beds overnight.`,
      sw: `Hadi ${Math.round(cold.temp_min)}°C. Barafu inaweza kuunguza viazi, nyanya na miche: funika vitalu usiku.`,
    });
  }

  const windy = days.find((d) => d.wind_kmh >= WINDY_KMH);
  if (windy) {
    const when = dayName(windy.date, today, lang);
    add('wind', 'info', 'flag', { en: `Strong wind ${when}`, sw: `Upepo mkali ${when}` }, {
      en: `Gusts up to ${Math.round(windy.wind_kmh)} km/h. Stake tall crops and do not spray: the spray drifts away.`,
      sw: `Upepo hadi km ${Math.round(windy.wind_kmh)} kwa saa. Shikilia mimea mirefu kwa miti na usinyunyizie dawa: inapeperushwa.`,
    });
  }

  // Blight loves several wet, cool days in a row.
  const blightCrops = ['tomatoes', 'potatoes'].filter((c) => growing.has(c));
  if (blightCrops.length && longestRun(days, (d) => d.rain_mm >= 2 && d.temp_max <= 24) >= 3) {
    const names = blightCrops.map((c) => pick(cropByKey(c).name, lang).toLowerCase()).join(lang === 'sw' ? ' na ' : ' and ');
    add('blight', 'warning', 'leaf', { en: 'Blight weather', sw: 'Hali ya hewa ya baka' }, {
      en: `Several cool, wet days in a row: late blight spreads fast on ${names}. Check leaves daily and protect with a recommended fungicide on a dry morning.`,
      sw: `Siku kadhaa za baridi na mvua mfululizo: baka chelewa huenea haraka kwenye ${names}. Kagua majani kila siku na ukinge kwa dawa iliyopendekezwa asubuhi kavu.`,
    });
  }

  // Planting window: start of the long or short rains.
  const month = Number(today.slice(5, 7));
  if (RAIN_SEASON_MONTHS.includes(month)) {
    const inSeason = CROPS.filter((c) => c.seasons.includes(month) && !c.irrigated).map((c) => pick(c.name, lang));
    const list = inSeason.join(', ');
    if (weekRain >= PLANTING_RAIN_MM && rainyDays >= 3) {
      add('planting-window', 'good', 'water', { en: 'Good rains: time to plant', sw: 'Mvua nzuri: wakati wa kupanda' }, {
        en: `About ${Math.round(weekRain)} mm of rain expected this week. Plant once the soil is wet to a hand's depth. In season now: ${list}.`,
        sw: `Takriban mm ${Math.round(weekRain)} za mvua zinatarajiwa wiki hii. Panda udongo ukilowa kina cha kiganja. Msimu huu: ${list}.`,
      });
    } else {
      add('planting-wait', 'info', 'time', { en: 'Planting season: wait for steady rain', sw: 'Msimu wa kupanda: subiri mvua ya kutosha' }, {
        en: `Only about ${Math.round(weekRain)} mm expected this week. Prepare land and buy seed now, and plant when about ${PLANTING_RAIN_MM} mm has fallen.`,
        sw: `Takriban mm ${Math.round(weekRain)} tu zinatarajiwa wiki hii. Tayarisha shamba na ununue mbegu sasa, na upande mvua ya mm ${PLANTING_RAIN_MM} ikinyesha.`,
      });
    }
  }

  // Reminders for planting and nursery work in the next 3 days.
  for (const task of tasks) {
    if (task.kind !== 'plant' && task.kind !== 'nursery') continue;
    const ahead = daysBetween(today, task.due_on);
    if (ahead < 0 || ahead > 3) continue;
    const when = dayName(task.due_on, today, lang);
    const plot = task.plot_name ? ` (${task.plot_name})` : '';
    add(`plant-${task.id}`, 'info', 'calendar', { en: `Planting reminder${plot}`, sw: `Kumbusho la kupanda${plot}` }, {
      en: `${task.title} ${when}. Have seed and fertilizer ready.`,
      sw: `${task.title} ${when}. Andaa mbegu na mbolea.`,
    });
  }

  const order = { warning: 0, good: 1, info: 2 };
  return alerts.sort((a, b) => order[a.level] - order[b.level]);
}

function longestRun(days, test) {
  let best = 0;
  let run = 0;
  for (const d of days) {
    run = test(d) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

