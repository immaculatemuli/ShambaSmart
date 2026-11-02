import { cropByKey } from '../catalog/crops.js';
import { all, NOW, one, run, transaction } from '../db.js';
import { notFound } from '../errors.js';
import { pick } from '../lang.js';
import { addDays, daysBetween, nairobiToday } from '../util.js';

// Calendar steps more than this many days in the past when a plot is added are left out: a farmer adding a crop
// planted a month ago doesn't need "Plant maize" waiting as overdue.
const PAST_STEP_GRACE_DAYS = 3;

/** The calendar tasks for a crop planted on `plantedOn`, skipping ones already well past. */
export function calendarTasks(cropKey, plantedOn, today = nairobiToday()) {
  const crop = cropByKey(cropKey);
  if (!crop) return [];
  return crop.calendar
    .map((s) => ({ ...s, due_on: addDays(plantedOn, s.day) }))
    .filter((s) => daysBetween(s.due_on, today) <= PAST_STEP_GRACE_DAYS);
}

export function createPlot(userId, { name, crop, variety, size_acres, planted_on, notes }) {
  return transaction(() => {
    const { lastInsertRowid: plotId } = run(
      'INSERT INTO plots (user_id, name, crop, variety, size_acres, planted_on, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      userId,
      name,
      crop,
      variety ?? null,
      size_acres ?? null,
      planted_on,
      notes ?? null,
    );
    for (const s of calendarTasks(crop, planted_on)) {
      run(
        `INSERT INTO tasks (user_id, plot_id, kind, title, title_sw, details, details_sw, due_on, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'calendar')`,
        userId,
        plotId,
        s.kind,
        s.title.en,
        s.title.sw,
        s.details.en,
        s.details.sw,
        s.due_on,
      );
    }
    return Number(plotId);
  });
}

export function plotOf(userId, plotId) {
  const plot = one('SELECT * FROM plots WHERE id = ? AND user_id = ?', plotId, userId);
  if (!plot) throw notFound('Plot');
  return plot;
}

/** A plot as the app shows it: with its crop's name, age in days and progress through the season. */
export function describePlot(plot, lang, today = nairobiToday()) {
  const crop = cropByKey(plot.crop);
  const age = daysBetween(plot.planted_on, today);
  const total = crop?.days ?? null;
  return {
    ...plot,
    crop_name: crop ? pick(crop.name, lang) : plot.crop,
    age_days: age,
    season_days: total,
    progress: total ? Math.max(0, Math.min(1, age / total)) : null,
    expected_harvest_on: total ? addDays(plot.planted_on, total) : null,
  };
}

export function listPlots(userId, lang) {
  const plots = all(
    `SELECT p.*,
       (SELECT COUNT(*) FROM tasks t WHERE t.plot_id = p.id AND t.done_at IS NULL) AS open_tasks,
       (SELECT MIN(t.due_on) FROM tasks t WHERE t.plot_id = p.id AND t.done_at IS NULL) AS next_task_on
     FROM plots p WHERE p.user_id = ? ORDER BY p.status = 'harvested', p.planted_on DESC`,
    userId,
  );
  return plots.map((p) => describePlot(p, lang));
}

export function updatePlot(userId, plotId, changes) {
  plotOf(userId, plotId);
  const fields = Object.entries(changes).filter(([, v]) => v !== undefined);
  if (fields.length) {
    run(`UPDATE plots SET ${fields.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ?`, ...fields.map(([, v]) => v), plotId);
  }
  // A harvested plot's remaining calendar steps are no longer needed.
  if (changes.status === 'harvested') {
    run("DELETE FROM tasks WHERE plot_id = ? AND done_at IS NULL AND source = 'calendar'", plotId);
  }
}

export function deletePlot(userId, plotId) {
  plotOf(userId, plotId);
  run('DELETE FROM plots WHERE id = ?', plotId);
}

const TASK_SELECT = `SELECT t.*, p.name AS plot_name, p.crop AS plot_crop FROM tasks t LEFT JOIN plots p ON p.id = t.plot_id`;

export function localizeTask(task, lang) {
  const { title_sw, details_sw, ...rest } = task;
  return {
    ...rest,
    title: lang === 'sw' && title_sw ? title_sw : task.title,
    details: lang === 'sw' && details_sw ? details_sw : task.details,
  };
}

/**
 * The farmer's tasks. status: 'open' (not done), 'done', or 'all'. from/to limit the due date (open tasks that are
 * overdue are always included with 'open' so nothing slips).
 */
export function listTasks(userId, lang, { status = 'open', from, to, plotId } = {}) {
  const where = ['t.user_id = ?'];
  const params = [userId];
  if (status === 'open') where.push('t.done_at IS NULL');
  if (status === 'done') where.push('t.done_at IS NOT NULL');
  if (plotId) {
    where.push('t.plot_id = ?');
    params.push(plotId);
  }
  if (from && status !== 'open') {
    where.push('t.due_on >= ?');
    params.push(from);
  }
  if (to) {
    where.push('t.due_on <= ?');
    params.push(to);
  }
  const order = status === 'done' ? 't.done_at DESC' : 't.due_on, t.id';
  return all(`${TASK_SELECT} WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT 300`, ...params).map((t) => localizeTask(t, lang));
}

export function createTask(userId, { plot_id, kind, title, details, due_on }) {
  if (plot_id) plotOf(userId, plot_id);
  const { lastInsertRowid } = run(
    "INSERT INTO tasks (user_id, plot_id, kind, title, details, due_on, source) VALUES (?, ?, ?, ?, ?, ?, 'manual')",
    userId,
    plot_id ?? null,
    kind,
    title,
    details ?? null,
    due_on,
  );
  return Number(lastInsertRowid);
}

function taskOf(userId, taskId) {
  const task = one('SELECT * FROM tasks WHERE id = ? AND user_id = ?', taskId, userId);
  if (!task) throw notFound('Task');
  return task;
}

export function setTaskDone(userId, taskId, done) {
  taskOf(userId, taskId);
  run(`UPDATE tasks SET done_at = ${done ? NOW : 'NULL'} WHERE id = ?`, taskId);
}

/** Moves a task to another day (e.g. rain is coming, so spraying waits). */
export function rescheduleTask(userId, taskId, dueOn) {
  taskOf(userId, taskId);
  run('UPDATE tasks SET due_on = ? WHERE id = ?', dueOn, taskId);
}

export function deleteTask(userId, taskId) {
  taskOf(userId, taskId);
  run('DELETE FROM tasks WHERE id = ?', taskId);
}
