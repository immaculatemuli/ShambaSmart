import { all, EXPENSE_CATEGORIES, insert, one, run } from '../db.js';
import { notFound } from '../errors.js';

// Expense and harvest records, and the money summary (spent, earned, profit) for a period and per plot.

async function checkPlot(userId, plotId) {
  if (plotId && !(await one('SELECT 1 AS ok FROM plots WHERE id = ? AND user_id = ?', plotId, userId))) throw notFound('Plot');
}

/** WHERE conditions for a date column and an optional plot (`alias`: the table's prefix, e.g. 'e.'). */
function range(column, { from, to, plotId }, alias = '') {
  const where = [];
  const params = [];
  if (from) {
    where.push(`${column} >= ?`);
    params.push(from);
  }
  if (to) {
    where.push(`${column} <= ?`);
    params.push(to);
  }
  if (plotId) {
    where.push(`${alias}plot_id = ?`);
    params.push(plotId);
  }
  return { sql: where.length ? ` AND ${where.join(' AND ')}` : '', params };
}

export function listExpenses(userId, filter = {}) {
  const r = range('e.spent_on', filter, 'e.');
  return all(
    `SELECT e.*, p.name AS plot_name FROM expenses e LEFT JOIN plots p ON p.id = e.plot_id
     WHERE e.user_id = ?${r.sql} ORDER BY e.spent_on DESC, e.id DESC LIMIT 500`,
    userId,
    ...r.params,
  );
}

export async function addExpense(userId, { plot_id, category, amount, spent_on, note }) {
  await checkPlot(userId, plot_id);
  return insert(
    'INSERT INTO expenses (user_id, plot_id, category, amount, spent_on, note) VALUES (?, ?, ?, ?, ?, ?)',
    userId,
    plot_id ?? null,
    category,
    amount,
    spent_on,
    note ?? null,
  );
}

export async function deleteExpense(userId, id) {
  if (!(await run('DELETE FROM expenses WHERE id = ? AND user_id = ?', id, userId)).changes) throw notFound('Expense');
}

export function listHarvests(userId, filter = {}) {
  const r = range('h.harvested_on', filter, 'h.');
  return all(
    `SELECT h.*, p.name AS plot_name FROM harvests h LEFT JOIN plots p ON p.id = h.plot_id
     WHERE h.user_id = ?${r.sql} ORDER BY h.harvested_on DESC, h.id DESC LIMIT 500`,
    userId,
    ...r.params,
  );
}

export async function addHarvest(userId, { plot_id, crop, quantity, unit, income, harvested_on, note }) {
  await checkPlot(userId, plot_id);
  return insert(
    'INSERT INTO harvests (user_id, plot_id, crop, quantity, unit, income, harvested_on, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    userId,
    plot_id ?? null,
    crop,
    quantity,
    unit,
    income ?? 0,
    harvested_on,
    note ?? null,
  );
}

export async function deleteHarvest(userId, id) {
  if (!(await run('DELETE FROM harvests WHERE id = ? AND user_id = ?', id, userId)).changes) throw notFound('Harvest');
}

/** Money in and out for a period (and optionally one plot): totals, spending by category, and per plot. */
export async function summary(userId, filter = {}) {
  const e = range('spent_on', filter);
  const h = range('harvested_on', filter);
  const spent = (await one(`SELECT COALESCE(SUM(amount), 0) AS n FROM expenses WHERE user_id = ?${e.sql}`, userId, ...e.params)).n;
  const earned = (await one(`SELECT COALESCE(SUM(income), 0) AS n FROM harvests WHERE user_id = ?${h.sql}`, userId, ...h.params)).n;
  const byCategory = await all(
    `SELECT category, SUM(amount) AS amount FROM expenses WHERE user_id = ?${e.sql} GROUP BY category ORDER BY amount DESC`,
    userId,
    ...e.params,
  );

  // Per plot, in two grouped queries rather than two per plot.
  const pe = range('spent_on', { ...filter, plotId: undefined });
  const ph = range('harvested_on', { ...filter, plotId: undefined });
  const spentBy = await all(`SELECT plot_id, SUM(amount) AS n FROM expenses WHERE user_id = ? AND plot_id IS NOT NULL${pe.sql} GROUP BY plot_id`, userId, ...pe.params);
  const earnedBy = await all(`SELECT plot_id, SUM(income) AS n FROM harvests WHERE user_id = ? AND plot_id IS NOT NULL${ph.sql} GROUP BY plot_id`, userId, ...ph.params);
  const plots = await all('SELECT id, name, crop, status FROM plots WHERE user_id = ? ORDER BY planted_on DESC', userId);
  const byPlot = plots
    .filter((p) => !filter.plotId || p.id === filter.plotId)
    .map((p) => {
      const plotSpent = spentBy.find((r) => r.plot_id === p.id)?.n ?? 0;
      const plotEarned = earnedBy.find((r) => r.plot_id === p.id)?.n ?? 0;
      return { plot_id: p.id, name: p.name, crop: p.crop, status: p.status, spent: plotSpent, earned: plotEarned, profit: plotEarned - plotSpent };
    })
    .filter((p) => p.spent || p.earned);

  return {
    spent,
    earned,
    profit: earned - spent,
    by_category: byCategory.filter((c) => EXPENSE_CATEGORIES.includes(c.category)),
    by_plot: byPlot,
  };
}
