import { all, EXPENSE_CATEGORIES, one, run } from '../db.js';
import { notFound } from '../errors.js';

// Expense and harvest records, and the money summary (spent, earned, profit) for a period and per plot.

function checkPlot(userId, plotId) {
  if (plotId && !one('SELECT 1 FROM plots WHERE id = ? AND user_id = ?', plotId, userId)) throw notFound('Plot');
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

export function addExpense(userId, { plot_id, category, amount, spent_on, note }) {
  checkPlot(userId, plot_id);
  const { lastInsertRowid } = run(
    'INSERT INTO expenses (user_id, plot_id, category, amount, spent_on, note) VALUES (?, ?, ?, ?, ?, ?)',
    userId,
    plot_id ?? null,
    category,
    amount,
    spent_on,
    note ?? null,
  );
  return Number(lastInsertRowid);
}

export function deleteExpense(userId, id) {
  if (!run('DELETE FROM expenses WHERE id = ? AND user_id = ?', id, userId).changes) throw notFound('Expense');
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

export function addHarvest(userId, { plot_id, crop, quantity, unit, income, harvested_on, note }) {
  checkPlot(userId, plot_id);
  const { lastInsertRowid } = run(
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
  return Number(lastInsertRowid);
}

export function deleteHarvest(userId, id) {
  if (!run('DELETE FROM harvests WHERE id = ? AND user_id = ?', id, userId).changes) throw notFound('Harvest');
}

/** Money in and out for a period (and optionally one plot): totals, spending by category, and per plot. */
export function summary(userId, filter = {}) {
  const e = range('spent_on', filter);
  const h = range('harvested_on', filter);
  const spent = one(`SELECT COALESCE(SUM(amount), 0) AS n FROM expenses WHERE user_id = ?${e.sql}`, userId, ...e.params).n;
  const earned = one(`SELECT COALESCE(SUM(income), 0) AS n FROM harvests WHERE user_id = ?${h.sql}`, userId, ...h.params).n;
  const byCategory = all(
    `SELECT category, SUM(amount) AS amount FROM expenses WHERE user_id = ?${e.sql} GROUP BY category ORDER BY amount DESC`,
    userId,
    ...e.params,
  );
  const plots = all('SELECT id, name, crop, status FROM plots WHERE user_id = ? ORDER BY planted_on DESC', userId);
  const byPlot = plots
    .filter((p) => !filter.plotId || p.id === filter.plotId)
    .map((p) => {
      const pe = range('spent_on', { ...filter, plotId: p.id });
      const ph = range('harvested_on', { ...filter, plotId: p.id });
      const plotSpent = one(`SELECT COALESCE(SUM(amount), 0) AS n FROM expenses WHERE user_id = ?${pe.sql}`, userId, ...pe.params).n;
      const plotEarned = one(`SELECT COALESCE(SUM(income), 0) AS n FROM harvests WHERE user_id = ?${ph.sql}`, userId, ...ph.params).n;
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
