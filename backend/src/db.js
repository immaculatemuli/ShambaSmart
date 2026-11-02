import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.js';

// ISO-8601 UTC with milliseconds, same format as Date#toISOString(), so text comparison works.
export const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

if (config.dbPath !== ':memory:') mkdirSync(dirname(config.dbPath), { recursive: true });

export const db = new DatabaseSync(config.dbPath);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

export const EXPENSE_CATEGORIES = ['seed', 'fertilizer', 'chemicals', 'labour', 'land', 'equipment', 'transport', 'water', 'other'];
export const TASK_KINDS = ['prepare', 'nursery', 'plant', 'weed', 'fertilize', 'scout', 'spray', 'water', 'harvest', 'other'];
const list = (values) => values.map((v) => `'${v}'`).join(', ');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  phone         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  county        TEXT,                -- one of the 47 counties (catalog/counties.js); sets the weather location
  latitude      REAL,                -- from the GPS when the farmer shares it, else the county's centre
  longitude     REAL,
  created_at    TEXT NOT NULL DEFAULT (${NOW})
);

-- A plot (shamba) planted with one crop for one season. Harvested plots stay for the records.
CREATE TABLE IF NOT EXISTS plots (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  crop        TEXT NOT NULL,          -- crop key from catalog/crops.js
  variety     TEXT,
  size_acres  REAL,
  planted_on  TEXT NOT NULL,          -- YYYY-MM-DD (transplanting date for crops raised in a nursery)
  status      TEXT NOT NULL DEFAULT 'growing' CHECK (status IN ('growing', 'harvested')),
  notes       TEXT,
  created_at  TEXT NOT NULL DEFAULT (${NOW})
);
CREATE INDEX IF NOT EXISTS idx_plots_user ON plots(user_id, status);

-- Farm activities: made from the crop calendar when a plot is added (source 'calendar'), or added by the farmer.
CREATE TABLE IF NOT EXISTS tasks (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plot_id    INTEGER REFERENCES plots(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL DEFAULT 'other' CHECK (kind IN (${list(TASK_KINDS)})),
  title      TEXT NOT NULL,
  title_sw   TEXT,
  details    TEXT,
  details_sw TEXT,
  due_on     TEXT NOT NULL,
  done_at    TEXT,
  source     TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('calendar', 'manual')),
  created_at TEXT NOT NULL DEFAULT (${NOW})
);
CREATE INDEX IF NOT EXISTS idx_tasks_user_due ON tasks(user_id, done_at, due_on);

-- Money spent, in whole shillings.
CREATE TABLE IF NOT EXISTS expenses (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plot_id    INTEGER REFERENCES plots(id) ON DELETE SET NULL,
  category   TEXT NOT NULL CHECK (category IN (${list(EXPENSE_CATEGORIES)})),
  amount     INTEGER NOT NULL CHECK (amount >= 0),
  spent_on   TEXT NOT NULL,
  note       TEXT,
  created_at TEXT NOT NULL DEFAULT (${NOW})
);
CREATE INDEX IF NOT EXISTS idx_expenses_user ON expenses(user_id, spent_on);

-- What was harvested, and what it brought in when sold (income, whole shillings; 0 when kept for the home).
CREATE TABLE IF NOT EXISTS harvests (
  id           INTEGER PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plot_id      INTEGER REFERENCES plots(id) ON DELETE SET NULL,
  crop         TEXT NOT NULL,
  quantity     REAL NOT NULL CHECK (quantity > 0),
  unit         TEXT NOT NULL,          -- kg, bag, crate, bunch, head ...
  income       INTEGER NOT NULL DEFAULT 0 CHECK (income >= 0),
  harvested_on TEXT NOT NULL,
  note         TEXT,
  created_at   TEXT NOT NULL DEFAULT (${NOW})
);
CREATE INDEX IF NOT EXISTS idx_harvests_user ON harvests(user_id, harvested_on);

CREATE TABLE IF NOT EXISTS markets (
  id     INTEGER PRIMARY KEY,
  name   TEXT NOT NULL UNIQUE,
  county TEXT NOT NULL
);

-- Price per kg in shillings. 'sample' rows are the guide prices ShambaSmart starts with; 'farmer' rows are what
-- farmers saw or sold at, and replace the sample at that market once there are recent ones.
CREATE TABLE IF NOT EXISTS prices (
  id           INTEGER PRIMARY KEY,
  market_id    INTEGER NOT NULL REFERENCES markets(id),
  crop         TEXT NOT NULL,
  price_per_kg INTEGER NOT NULL CHECK (price_per_kg > 0),
  source       TEXT NOT NULL CHECK (source IN ('sample', 'farmer')),
  user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  observed_on  TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (${NOW})
);
CREATE INDEX IF NOT EXISTS idx_prices_crop ON prices(crop, market_id, observed_on);

-- Photo checks. The photo itself is not kept, only what was found.
CREATE TABLE IF NOT EXISTS diagnoses (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plot_id    INTEGER REFERENCES plots(id) ON DELETE SET NULL,
  crop       TEXT,
  result     TEXT NOT NULL,           -- JSON (services/diagnose.js)
  created_at TEXT NOT NULL DEFAULT (${NOW})
);
CREATE INDEX IF NOT EXISTS idx_diagnoses_user ON diagnoses(user_id, created_at);
`);

/** Runs fn inside one transaction (all or nothing). */
export function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export const one = (sql, ...params) => db.prepare(sql).get(...params);
export const all = (sql, ...params) => db.prepare(sql).all(...params);
export const run = (sql, ...params) => db.prepare(sql).run(...params);
