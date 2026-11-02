import { config } from '../config.js';
import { HttpError } from '../errors.js';

// The AI model that reads crop photos. All the choices are free and speak the same "OpenAI-style" chat API, so one
// small client covers them:
//   cloudflare - Meta's Llama 4 Scout on Cloudflare Workers AI (free account at dash.cloudflare.com: 10,000
//                "neurons" a day, roughly 60-90 photo checks). Needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.
//   gemini     - Google Gemini (free key from aistudio.google.com).
//   groq       - Groq (free key from console.groq.com).
//   ollama     - a model running on this computer with Ollama (e.g. llama3.2-vision). No key, no internet, but it
//                needs a strong computer (16 GB of memory), and an online server cannot reach it.
// VISION_PROVIDER picks one; left empty, the first one with a key is used, in the order above.
// `json`: how the service is asked for JSON: a schema, "any JSON", or only in the instructions (Llama 4 Scout on
// Cloudflare has no JSON mode; the answer is read forgivingly in services/diagnose.js).
const cloudflareAccount = () => process.env.CLOUDFLARE_ACCOUNT_ID;
export const PROVIDERS = {
  cloudflare: {
    url: () => `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccount()}/ai/v1`,
    model: '@cf/meta/llama-4-scout-17b-16e-instruct',
    key: () => cloudflareAccount() && process.env.CLOUDFLARE_API_TOKEN,
    json: 'instructions',
  },
  gemini: {
    url: () => 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-3.8-flash',
    key: () => process.env.GEMINI_API_KEY,
    json: 'schema',
  },
  groq: {
    url: () => 'https://api.groq.com/openai/v1',
    model: 'qwen/qwen3.8-27b',
    key: () => process.env.GROQ_API_KEY,
    json: 'object',
  },
  ollama: {
    url: () => (process.env.OLLAMA_URL || 'http://localhost:11434') + '/v1',
    model: 'llama3.2-vision',
    key: () => 'ollama',
    json: 'object',
  },
};
const AUTO_ORDER = ['cloudflare', 'gemini', 'groq'];

export function chosenProvider() {
  const name = config.visionProvider || AUTO_ORDER.find((n) => PROVIDERS[n].key()) || null;
  const provider = name ? PROVIDERS[name] : null;
  if (!provider || !provider.key()) return null;
  return { name, ...provider, model: config.visionModel || provider.model };
}

const notSetUp = () => new HttpError(503, 'DIAGNOSIS_NOT_CONFIGURED', 'The photo check is not set up on this server yet');

/**
 * Sends one photo with instructions and returns the model's text answer (expected to be JSON).
 * `schema`: the JSON schema of the answer, used where the provider supports it.
 */
export async function askVisionModel({ system, text, image, mediaType, schema }) {
  const provider = chosenProvider();
  if (!provider) throw notSetUp();

  const body = {
    model: provider.model,
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content: [
          { type: 'text', text },
          { type: 'image_url', image_url: { url: `data:${mediaType};base64,${image}` } },
        ],
      },
    ],
    temperature: 0.2,
    max_tokens: 4000,
  };
  if (provider.json === 'schema') body.response_format = { type: 'json_schema', json_schema: { name: 'crop_check', schema } };
  if (provider.json === 'object') body.response_format = { type: 'json_object' };

  let res;
  try {
    res = await fetch(`${provider.url()}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.key()}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    throw new HttpError(503, 'DIAGNOSIS_UNREACHABLE', 'The photo check could not be reached. Please try again');
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error(`Photo check: ${provider.name} answered ${res.status}: ${detail.slice(0, 500)}`);
    if (res.status === 401 || res.status === 403) throw notSetUp();
    // Free tiers have a per-minute and per-day allowance.
    if (res.status === 429 || res.status >= 500) throw new HttpError(503, 'DIAGNOSIS_BUSY', 'The photo check is busy. Please try again in a minute');
    if (res.status === 400 || res.status === 413) throw new HttpError(400, 'BAD_PHOTO', 'This photo could not be read. Please take it again (JPEG or PNG)');
    throw new HttpError(502, 'DIAGNOSIS_FAILED', 'The photo check failed. Please try again');
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}
