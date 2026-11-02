import { z } from 'zod';
import { cropByKey } from '../catalog/crops.js';
import { config } from '../config.js';
import { all, one, run } from '../db.js';
import { HttpError, notFound } from '../errors.js';
import { askVisionModel } from './vision.js';

// Crop photo checks: a free AI model (services/vision.js) looks at the photo and answers in a fixed shape
// (RESULT_SCHEMA). The photo is sent once and not kept; only the answer is saved for the farmer's history.

export const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// The free providers take images up to about 4 MB; the app shrinks photos to well under this.
const MAX_IMAGE_BYTES = 3.5 * 1024 * 1024;

const RESULT_SCHEMA = {
  type: 'object',
  required: ['is_plant', 'crop', 'healthy', 'confidence', 'summary', 'problems', 'actions', 'prevention', 'see_expert', 'photo_tip'],
  properties: {
    is_plant: { type: 'boolean' },
    crop: { type: 'string' },
    healthy: { type: 'boolean' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    summary: { type: 'string' },
    problems: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'type', 'likelihood', 'signs'],
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: ['disease', 'pest', 'nutrient', 'water', 'other'] },
          likelihood: { type: 'string', enum: ['likely', 'possible'] },
          signs: { type: 'string' },
        },
      },
    },
    actions: { type: 'array', items: { type: 'string' } },
    prevention: { type: 'array', items: { type: 'string' } },
    see_expert: { type: 'boolean' },
    photo_tip: { type: 'string' },
  },
};

// Free models sometimes leave a field out or use a slightly different word, so the answer is read forgivingly:
// anything missing gets a safe default, and an unknown word falls back to the most careful choice.
const text = z.string().catch('');
const list = z.array(z.string()).catch([]);
const ResultShape = z.object({
  is_plant: z.boolean().catch(true),
  crop: text,
  healthy: z.boolean().catch(false),
  confidence: z.enum(['low', 'medium', 'high']).catch('low'),
  summary: text,
  problems: z
    .array(
      z.object({
        name: text,
        type: z.enum(['disease', 'pest', 'nutrient', 'water', 'other']).catch('other'),
        likelihood: z.enum(['likely', 'possible']).catch('possible'),
        signs: text,
      }),
    )
    .catch([]),
  actions: list,
  prevention: list,
  see_expert: z.boolean().catch(false),
  photo_tip: text,
});

const SYSTEM = `You help small-scale farmers in Kenya check the health of their crops from a phone photo.

Look closely at the photo and say what you see: the crop, whether it looks healthy, and the most likely problems (disease, pest, nutrient shortage, water stress). Base every finding on what is visible, and say "possible" rather than "likely" when the signs could have several causes. When the photo is blurry, too far away, too dark or shows too little of the plant, set confidence to "low" and explain in photo_tip how to take a better one (close up, in daylight, the affected leaf both sides, plus the whole plant).

Advice must suit a small farm with little money: start with practical steps (removing and destroying affected plants, rotation, spacing, weeding, clean seed, resistant varieties, timing), then, if needed, the kind of product to ask for at an agrovet by its active ingredient or type, never a single brand. When you mention a pesticide or fungicide, remind the farmer to wear protection, follow the label, and respect the waiting time before harvest. Set see_expert to true for serious or spreading problems, and always for diseases that must be reported or contained, such as maize lethal necrosis, banana Xanthomonas wilt, bacterial wilt in potatoes or tomatoes, and cassava brown streak.

Write in short, plain sentences a farmer can act on. Keep actions and prevention to at most five points each.

Answer with one JSON object only, no other text, with exactly these fields:
{
  "is_plant": true or false (false when the photo does not show a crop or plant part),
  "crop": "the crop you see",
  "healthy": true or false,
  "confidence": "low" | "medium" | "high",
  "summary": "one or two plain sentences for the farmer",
  "problems": [{"name": "common name farmers know, with the local name if there is one", "type": "disease" | "pest" | "nutrient" | "water" | "other", "likelihood": "likely" | "possible", "signs": "what in the photo points to it"}],
  "actions": ["what to do now, most important first"],
  "prevention": ["how to stop it next season"],
  "see_expert": true or false,
  "photo_tip": "how to take a clearer photo when confidence is low, otherwise an empty string"
}
"problems" is an empty list when the crop is healthy.`;

/** Tests replace the model call. */
let askModel = askVisionModel;
export const setModelCall = (fn) => {
  askModel = fn;
};

function checkDailyLimit(userId) {
  const { n } = one("SELECT COUNT(*) AS n FROM diagnoses WHERE user_id = ? AND created_at >= strftime('%Y-%m-%dT00:00:00Z','now')", userId);
  if (n >= config.diagnosesPerDay) {
    throw new HttpError(429, 'DAILY_LIMIT', `You have used today's ${config.diagnosesPerDay} photo checks. Please try again tomorrow`);
  }
}

/** The JSON object in a model's answer, also when it is wrapped in ```json fences or a sentence. */
function readAnswer(answer) {
  const start = answer.indexOf('{');
  const end = answer.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no JSON');
  const result = ResultShape.parse(JSON.parse(answer.slice(start, end + 1)));
  // An answer with nothing in it is not worth showing.
  if (!result.summary && !result.problems.length && !result.actions.length && !result.photo_tip) throw new Error('empty answer');
  return result;
}

export async function diagnosePhoto(userId, { image, media_type, crop, plot_id, note }, lang) {
  const bytes = Math.floor((image.length * 3) / 4);
  if (bytes > MAX_IMAGE_BYTES) throw new HttpError(413, 'IMAGE_TOO_LARGE', 'The photo is too large. Please take it again at a lower quality');
  if (plot_id && !one('SELECT 1 FROM plots WHERE id = ? AND user_id = ?', plot_id, userId)) throw notFound('Plot');
  checkDailyLimit(userId);

  const cropName = crop ? (cropByKey(crop)?.name.en ?? crop) : null;
  const context = [
    cropName ? `The farmer says this is ${cropName}.` : 'The farmer did not say which crop this is.',
    note ? `The farmer's note: "${note}"` : null,
    lang === 'sw'
      ? 'Write every text value in Kiswahili (simple, everyday Kiswahili as spoken by Kenyan farmers). Keep the JSON field names and the fixed words (low, medium, high, disease, pest, nutrient, water, other, likely, possible) in English.'
      : 'Write every text value in simple English.',
  ]
    .filter(Boolean)
    .join('\n');

  const answer = await askModel({ system: SYSTEM, text: context, image, mediaType: media_type, schema: RESULT_SCHEMA });
  let result;
  try {
    result = readAnswer(answer);
  } catch {
    throw new HttpError(502, 'BAD_ANSWER', 'The photo check did not finish. Please try again');
  }

  const { lastInsertRowid } = run(
    'INSERT INTO diagnoses (user_id, plot_id, crop, result) VALUES (?, ?, ?, ?)',
    userId,
    plot_id ?? null,
    crop ?? null,
    JSON.stringify(result),
  );
  return { id: Number(lastInsertRowid), crop: crop ?? null, plot_id: plot_id ?? null, created_at: new Date().toISOString(), result };
}

const fromRow = (row) => ({ ...row, result: JSON.parse(row.result) });

export function listDiagnoses(userId) {
  return all(
    `SELECT d.id, d.plot_id, d.crop, d.result, d.created_at, p.name AS plot_name
     FROM diagnoses d LEFT JOIN plots p ON p.id = d.plot_id WHERE d.user_id = ? ORDER BY d.id DESC LIMIT 50`,
    userId,
  ).map(fromRow);
}

export function getDiagnosis(userId, id) {
  const row = one(
    `SELECT d.id, d.plot_id, d.crop, d.result, d.created_at, p.name AS plot_name
     FROM diagnoses d LEFT JOIN plots p ON p.id = d.plot_id WHERE d.id = ? AND d.user_id = ?`,
    id,
    userId,
  );
  if (!row) throw notFound('Photo check');
  return fromRow(row);
}

export function deleteDiagnosis(userId, id) {
  getDiagnosis(userId, id);
  run('DELETE FROM diagnoses WHERE id = ?', id);
}
