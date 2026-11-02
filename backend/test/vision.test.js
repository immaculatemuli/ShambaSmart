import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

process.env.DB_PATH = ':memory:';
const KEYS = ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN', 'GEMINI_API_KEY', 'GROQ_API_KEY'];
for (const k of KEYS) delete process.env[k];
const { askVisionModel, chosenProvider } = await import('../src/services/vision.js');

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  for (const k of KEYS) delete process.env[k];
});

/** Answers the AI service's address with `reply`, and remembers what was sent. */
function fakeService(reply) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return reply();
  };
  return calls;
}
const ok = (content) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
const photo = { system: 'You check crops.', text: 'Maize.', image: 'AAAA', mediaType: 'image/jpeg', schema: { type: 'object' } };

test('without a key the photo check says it is not set up', async () => {
  assert.equal(chosenProvider(), null);
  await assert.rejects(askVisionModel(photo), { status: 503, code: 'DIAGNOSIS_NOT_CONFIGURED' });
});

test('Llama 4 Scout on Cloudflare is used first, with JSON asked for in the instructions only', async () => {
  process.env.CLOUDFLARE_ACCOUNT_ID = 'acc123';
  process.env.CLOUDFLARE_API_TOKEN = 'cf-token';
  process.env.GEMINI_API_KEY = 'g-key';
  const calls = fakeService(() => ok('{"healthy":true}'));
  assert.equal(await askVisionModel(photo), '{"healthy":true}');
  const [{ url, init, body }] = calls;
  assert.equal(url, 'https://api.cloudflare.com/client/v4/accounts/acc123/ai/v1/chat/completions');
  assert.equal(init.headers.Authorization, 'Bearer cf-token');
  assert.equal(body.model, '@cf/meta/llama-4-scout-17b-16e-instruct');
  assert.equal(body.messages[1].content[1].image_url.url, 'data:image/jpeg;base64,AAAA');
  assert.equal(body.response_format, undefined);
});

test('a Cloudflare token without the account id does not count as set up', () => {
  process.env.CLOUDFLARE_API_TOKEN = 'cf-token';
  assert.equal(chosenProvider(), null);
});

test('Gemini is used next and gets the photo, the instructions and a JSON schema', async () => {
  process.env.GEMINI_API_KEY = 'g-key';
  process.env.GROQ_API_KEY = 'q-key';
  const calls = fakeService(() => ok('{"healthy":true}'));
  assert.equal(await askVisionModel(photo), '{"healthy":true}');
  const [{ url, init, body }] = calls;
  assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
  assert.equal(init.headers.Authorization, 'Bearer g-key');
  assert.equal(body.model, 'gemini-3.8-flash');
  assert.equal(body.messages[0].content, 'You check crops.');
  assert.equal(body.messages[1].content[1].image_url.url, 'data:image/jpeg;base64,AAAA');
  assert.equal(body.response_format.type, 'json_schema');
});

test('Groq is used when it is the only key, asking for plain JSON', async () => {
  process.env.GROQ_API_KEY = 'q-key';
  const calls = fakeService(() => ok('{}'));
  await askVisionModel(photo);
  assert.equal(calls[0].url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(calls[0].body.model, 'qwen/qwen3.8-27b');
  assert.deepEqual(calls[0].body.response_format, { type: 'json_object' });
});

test('service problems become messages a farmer understands', async () => {
  process.env.GEMINI_API_KEY = 'g-key';
  const quiet = console.error;
  console.error = () => {};
  try {
    fakeService(() => new Response('quota', { status: 429 }));
    await assert.rejects(askVisionModel(photo), { status: 503, code: 'DIAGNOSIS_BUSY' });
    fakeService(() => new Response('bad key', { status: 401 }));
    await assert.rejects(askVisionModel(photo), { code: 'DIAGNOSIS_NOT_CONFIGURED' });
    fakeService(() => {
      throw new TypeError('fetch failed');
    });
    await assert.rejects(askVisionModel(photo), { code: 'DIAGNOSIS_UNREACHABLE' });
  } finally {
    console.error = quiet;
  }
});
