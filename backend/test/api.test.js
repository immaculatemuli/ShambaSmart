import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

process.env.DB_PATH = ':memory:';
process.env.DIAGNOSES_PER_DAY = '2';
const { createApp } = await import('../src/app.js');
const { setWeatherFetch } = await import('../src/services/weather.js');
const { setModelCall } = await import('../src/services/diagnose.js');
const { nairobiToday, addDays } = await import('../src/util.js');

const today = nairobiToday();
let server;
let base;
let token;

async function call(method, path, body, { auth = true, lang } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  if (lang) headers['X-Language'] = lang;
  const res = await fetch(`${base}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json() };
}

before(async () => {
  setWeatherFetch(async () => ({
    ok: true,
    json: async () => ({
      current: { temperature_2m: 24, weather_code: 3 },
      daily: {
        time: Array.from({ length: 7 }, (_, i) => addDays(today, i)),
        weather_code: [61, 3, 3, 1, 1, 1, 1],
        temperature_2m_max: [25, 26, 27, 27, 28, 28, 27],
        temperature_2m_min: [14, 14, 15, 15, 15, 15, 15],
        precipitation_sum: [40, 0, 0, 0, 0, 0, 0],
        precipitation_probability_max: [90, 10, 5, 5, 5, 5, 5],
        wind_speed_10m_max: [12, 8, 8, 8, 8, 8, 8],
      },
    }),
  }));
  server = (await createApp()).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(() => server.close());

test('register, sign in and choose a county', async () => {
  const reg = await call('POST', '/auth/register', { name: 'Wanjiku', phone: '0712 345 678', password: 'shamba1', county: 'Nyeri' });
  assert.equal(reg.status, 201);
  assert.equal(reg.body.user.phone, '254712345678');
  assert.equal(reg.body.user.latitude, -0.42);

  const again = await call('POST', '/auth/register', { name: 'Other', phone: '254712345678', password: 'shamba1' });
  assert.equal(again.status, 409);

  const wrong = await call('POST', '/auth/login', { phone: '0712345678', password: 'nope' });
  assert.equal(wrong.status, 401);
  const login = await call('POST', '/auth/login', { phone: '0712345678', password: 'shamba1' });
  assert.equal(login.status, 200);
  token = login.body.token;

  const moved = await call('PATCH', '/me', { county: 'Nakuru' });
  assert.equal(moved.body.user.county, 'Nakuru');
  assert.equal((await call('GET', '/plots', null, { auth: false })).status, 401);
});

test('the catalog lists crops in the chosen language', async () => {
  const sw = await call('GET', '/catalog', null, { lang: 'sw' });
  assert.equal(sw.body.crops.find((c) => c.key === 'maize').name, 'Mahindi');
  assert.equal(sw.body.counties.length, 47);
  assert.equal(sw.body.markets.length, 10);
  const preview = await call('GET', '/crops/beans/calendar?planted_on=2026-03-15');
  assert.equal(preview.body.steps.find((s) => s.kind === 'plant').due_on, '2026-03-15');
});

let plotId;
test('adding a plot lays out its crop calendar; tasks can be done and moved', async () => {
  const created = await call('POST', '/plots', { name: 'Lower field', crop: 'maize', size_acres: 1.5, planted_on: addDays(today, 14) });
  assert.equal(created.status, 201);
  plotId = created.body.id;

  const detail = await call('GET', `/plots/${plotId}`, null, { lang: 'sw' });
  assert.equal(detail.body.plot.crop_name, 'Mahindi');
  assert.equal(detail.body.tasks.length, 10);
  assert.equal(detail.body.tasks[0].title, 'Tayarisha shamba');

  const open = await call('GET', '/tasks?status=open');
  const planting = open.body.tasks.find((t) => t.kind === 'plant');
  assert.equal(planting.due_on, addDays(today, 14));
  assert.equal(planting.plot_name, 'Lower field');

  await call('PATCH', `/tasks/${planting.id}`, { done: true, due_on: addDays(today, 15) });
  const done = await call('GET', '/tasks?status=done');
  assert.equal(done.body.tasks[0].id, planting.id);
  assert.equal(done.body.tasks[0].due_on, addDays(today, 15));

  const own = await call('POST', '/tasks', { title: 'Buy CAN fertilizer', kind: 'other', due_on: today });
  assert.equal(own.status, 201);
});

test('home shows weather alerts, coming tasks and growing plots', async () => {
  const home = await call('GET', '/home');
  assert.equal(home.status, 200);
  assert.equal(home.body.weather.days.length, 7);
  assert.ok(home.body.weather.alerts.some((a) => a.id === 'heavy-rain'));
  assert.ok(home.body.tasks.some((t) => t.title === 'Buy CAN fertilizer'));
  assert.equal(home.body.plots.length, 1);
});

test('expenses and harvests add up to a profit, overall and per plot', async () => {
  assert.equal((await call('POST', '/expenses', { category: 'seed', amount: 1800, spent_on: today, plot_id: plotId })).status, 201);
  await call('POST', '/expenses', { category: 'fertilizer', amount: 3500, spent_on: today, plot_id: plotId });
  await call('POST', '/expenses', { category: 'transport', amount: 300, spent_on: today });
  const bad = await call('POST', '/expenses', { category: 'magic', amount: 10, spent_on: today });
  assert.equal(bad.status, 400);
  await call('POST', '/harvests', { crop: 'maize', quantity: 12, unit: 'bag', income: 42000, harvested_on: today, plot_id: plotId });

  const all = await call('GET', '/records/summary');
  assert.equal(all.body.spent, 5600);
  assert.equal(all.body.earned, 42000);
  assert.equal(all.body.profit, 36400);
  assert.equal(all.body.by_category[0].category, 'fertilizer');
  assert.deepEqual(all.body.by_plot.map((p) => p.profit), [36700]);

  const plot = await call('GET', `/records/summary?plot_id=${plotId}`);
  assert.equal(plot.body.spent, 5300);
  assert.equal((await call('GET', `/expenses?plot_id=${plotId}`)).body.expenses.length, 2);
});

test('marking a plot harvested clears its remaining calendar steps', async () => {
  await call('PATCH', `/plots/${plotId}`, { status: 'harvested' });
  const open = await call('GET', `/tasks?status=open&plot_id=${plotId}`);
  assert.equal(open.body.tasks.length, 0);
  const plot = await call('GET', `/plots/${plotId}`);
  assert.equal(plot.body.plot.name, 'Lower field');
});

test('farmer price reports replace the sample guide at that market', async () => {
  const before = await call('GET', '/prices/tomatoes');
  assert.ok(before.body.prices.every((p) => p.source === 'sample'));
  const market = before.body.prices[0].market_id;

  await call('POST', '/prices', { market_id: market, crop: 'tomatoes', price_per_kg: 80 });
  await call('POST', '/prices', { market_id: market, crop: 'tomatoes', price_per_kg: 90 }); // corrects the first
  const after = await call('GET', '/prices/tomatoes');
  const row = after.body.prices.find((p) => p.market_id === market);
  assert.equal(row.source, 'farmer');
  assert.equal(row.price_per_kg, 90);
  assert.equal(row.reports, 1);
  assert.equal(after.body.trend.at(-1).median_per_kg, 90);

  const future = await call('POST', '/prices', { market_id: market, crop: 'tomatoes', price_per_kg: 80, observed_on: addDays(today, 2) });
  assert.equal(future.status, 400);
});

const ARMYWORM = {
  is_plant: true,
  crop: 'Mahindi',
  healthy: false,
  confidence: 'high',
  summary: 'Viwavijeshi vinakula majani.',
  problems: [{ name: 'Viwavijeshi (fall armyworm)', type: 'pest', likelihood: 'likely', signs: 'Matundu na kinyesi' }],
  actions: ['Kagua mimea 20'],
  prevention: ['Panda mapema'],
  see_expert: false,
  photo_tip: '',
};

test('a photo check sends the photo to the AI model and keeps the answer', async () => {
  let sent;
  setModelCall(async (request) => {
    sent = request;
    return JSON.stringify(ARMYWORM);
  });
  const image = Buffer.alloc(2000, 7).toString('base64');
  const res = await call('POST', '/diagnoses', { image, media_type: 'image/jpeg', crop: 'maize', note: 'holes in leaves' }, { lang: 'sw' });
  assert.equal(res.status, 201);
  assert.equal(res.body.result.problems[0].type, 'pest');
  assert.equal(sent.image, image);
  assert.equal(sent.mediaType, 'image/jpeg');
  assert.match(sent.text, /Maize[\s\S]*holes in leaves[\s\S]*Kiswahili/);

  const list = await call('GET', '/diagnoses');
  assert.equal(list.body.diagnoses.length, 1);
  assert.equal(list.body.diagnoses[0].result.crop, 'Mahindi');
});

test('photo checks read untidy answers, reject useless ones and stop at the daily limit', async () => {
  const image = Buffer.alloc(2000, 7).toString('base64');
  setModelCall(async () => 'I could not tell.');
  assert.equal((await call('POST', '/diagnoses', { image, media_type: 'image/png' })).status, 502);

  // Wrapped in a code block, a field missing and an unknown word: still read, carefully.
  const { see_expert: _, ...partial } = { ...ARMYWORM, confidence: 'very sure' };
  setModelCall(async () => `Here is the result:\n\`\`\`json\n${JSON.stringify(partial)}\n\`\`\``);
  const untidy = await call('POST', '/diagnoses', { image, media_type: 'image/png' });
  assert.equal(untidy.status, 201);
  assert.equal(untidy.body.result.confidence, 'low');
  assert.equal(untidy.body.result.see_expert, false);

  // Two checks today already: the limit in these tests is 2.
  const limited = await call('POST', '/diagnoses', { image, media_type: 'image/png' });
  assert.equal(limited.status, 429);
});

test('deleting the account needs the password and removes the farm', async () => {
  assert.equal((await call('DELETE', '/me', { password: 'wrong' })).status, 400);
  assert.equal((await call('DELETE', '/me', { password: 'shamba1' })).status, 200);
  assert.equal((await call('GET', '/me')).status, 401);
});
