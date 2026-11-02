import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.DB_PATH = ':memory:';
const { calendarTasks } = await import('../src/services/calendar.js');
const { buildAlerts } = await import('../src/services/alerts.js');
const { CROPS } = await import('../src/catalog/crops.js');

const day = (date, over = {}) => ({ date, temp_max: 26, temp_min: 14, rain_mm: 0, rain_chance: 10, wind_kmh: 10, code: 1, ...over });
const week = (start, over = {}) =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${start}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const date = d.toISOString().slice(0, 10);
    return day(date, typeof over === 'function' ? over(i) : over);
  });

test('every crop calendar has a planting and a harvest step, in order, with both languages', () => {
  for (const crop of CROPS) {
    const days = crop.calendar.map((s) => s.day);
    assert.deepEqual(days, [...days].sort((a, b) => a - b), crop.key);
    assert.ok(crop.calendar.some((s) => s.kind === 'plant'), `${crop.key} has no planting step`);
    assert.ok(crop.calendar.some((s) => s.kind === 'harvest'), `${crop.key} has no harvest step`);
    for (const s of crop.calendar) assert.ok(s.title.sw && s.details.sw && s.title.en && s.details.en, `${crop.key} day ${s.day}`);
  }
});

test('a plot planted weeks ago gets only the steps still ahead (and the last few days)', () => {
  const tasks = calendarTasks('maize', '2026-03-01', '2026-03-25');
  assert.ok(tasks.every((t) => t.due_on >= '2026-03-22'));
  assert.equal(tasks[0].day, 21); // 3 days ago: still shown
  const fresh = calendarTasks('maize', '2026-03-20', '2026-03-01');
  assert.equal(fresh[0].due_on, '2026-03-06'); // land preparation, 14 days before planting
});

test('heavy rain and a top-dressing on a wet day give warnings with a better day', () => {
  const days = week('2026-06-08', (i) => (i === 1 ? { rain_mm: 35 } : { rain_mm: 0.5 }));
  const tasks = [{ id: 7, kind: 'fertilize', title: 'Top-dress', due_on: '2026-06-09', plot_name: 'Upper field' }];
  const alerts = buildAlerts({ days, plots: [{ crop: 'maize' }], tasks, today: '2026-06-08' });
  const heavy = alerts.find((a) => a.id === 'heavy-rain');
  assert.match(heavy.title, /tomorrow/);
  const clash = alerts.find((a) => a.id === 'task-rain-7');
  assert.match(clash.title, /Top-dress \(Upper field\)/);
  assert.match(clash.message, /Today looks dry/);
});

test('a dry week warns only farmers with crops in the ground', () => {
  const days = week('2026-07-01');
  assert.ok(buildAlerts({ days, plots: [{ crop: 'beans' }], today: '2026-07-01' }).some((a) => a.id === 'dry-week'));
  assert.ok(!buildAlerts({ days, plots: [], today: '2026-07-01' }).some((a) => a.id === 'dry-week'));
});

test('the start of the long rains says it is time to plant, in Kiswahili too', () => {
  const days = week('2026-03-20', { rain_mm: 8 });
  const en = buildAlerts({ days, today: '2026-03-20' }).find((a) => a.id === 'planting-window');
  assert.match(en.message, /Maize/);
  const sw = buildAlerts({ days, today: '2026-03-20', lang: 'sw' }).find((a) => a.id === 'planting-window');
  assert.equal(sw.title, 'Mvua nzuri: wakati wa kupanda');
  assert.match(sw.message, /Mahindi/);
  const dry = buildAlerts({ days: week('2026-03-20'), today: '2026-03-20' });
  assert.ok(dry.some((a) => a.id === 'planting-wait'));
});

test('cool wet days warn about blight only where tomatoes or potatoes grow', () => {
  const days = week('2026-05-04', { rain_mm: 6, temp_max: 20 });
  assert.ok(buildAlerts({ days, plots: [{ crop: 'potatoes' }], today: '2026-05-04' }).some((a) => a.id === 'blight'));
  assert.ok(!buildAlerts({ days, plots: [{ crop: 'maize' }], today: '2026-05-04' }).some((a) => a.id === 'blight'));
});

test('planting reminders cover the next three days', () => {
  const days = week('2026-06-01');
  const tasks = [
    { id: 1, kind: 'plant', title: 'Plant beans', due_on: '2026-06-03', plot_name: 'A' },
    { id: 2, kind: 'plant', title: 'Plant maize', due_on: '2026-06-06', plot_name: 'B' },
  ];
  const ids = buildAlerts({ days, tasks, today: '2026-06-01' }).map((a) => a.id);
  assert.ok(ids.includes('plant-1'));
  assert.ok(!ids.includes('plant-2'));
});
