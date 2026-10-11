// Progress: body-weight trend, calories vs target, strength (e1RM) per exercise, workout history.

import { state, ymd, addDays, parseYmd, dayTotals, targets, toDisplayW, unit, e1rm, historyFor, fmtW } from './store.js';
import { h, fill, fmt, lineChart, barChart } from './ui.js';
import { icon } from './icons.js';
import { getExercise } from './generator.js';
import { workoutRow, showHistory } from './train.js';

let range = 30;
let liftId = null;

export function renderProgress(root) {
  const today = ymd();
  const from = addDays(today, -range + 1);

  // Body weight + 7-day moving average
  const wDays = Object.keys(state.weights).filter(d => d >= from).sort();
  const raw = wDays.map(d => ({ x: parseYmd(d), y: toDisplayW(state.weights[d]) }));
  const avg = wDays.map(d => {
    const win = Object.keys(state.weights).filter(k => k <= d && k > addDays(d, -7));
    return { x: parseYmd(d), y: win.reduce((s, k) => s + toDisplayW(state.weights[k]), 0) / win.length };
  });
  const trend = { text: null, cls: '' };
  if (avg.length >= 2) {
    const days = (avg[avg.length - 1].x - avg[0].x) / 86400000;
    if (days >= 6) {
      const perWeek = ((avg[avg.length - 1].y - avg[0].y) / days) * 7;
      trend.text = `${perWeek >= 0 ? '▲' : '▼'} ${fmt(Math.abs(perWeek), 2)} ${unit()}/wk`;
      // Colour by goal: losing is good on a cut, gaining is good on a bulk.
      const goal = state.settings.goal;
      trend.cls = goal === 'maintain' ? '' : ((perWeek < 0) === (goal === 'cut') ? 'good' : 'warn');
    }
  }

  // Calories (last 14 days)
  const calDays = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const cal = calDays.map(d => ({ label: `${parseYmd(d).getMonth() + 1}/${parseYmd(d).getDate()}`, y: Math.round(dayTotals(d).kcal) }));
  const logged = cal.filter(c => c.y > 0);
  const avgCal = logged.length ? logged.reduce((s, c) => s + c.y, 0) / logged.length : 0;

  // Lifts: exercises you've trained, by most recent
  const trained = [];
  for (let i = state.workouts.length - 1; i >= 0; i--) for (const en of state.workouts[i].entries) if (!trained.includes(en.exId)) trained.push(en.exId);
  if (!trained.includes(liftId)) liftId = trained[0] || null;

  const liftChart = () => {
    if (!liftId) return h('p.muted.small', 'Finish a workout to see strength trends.');
    const pts = historyFor(liftId).filter(x => x.date >= from).map(x => ({ x: parseYmd(x.date), y: toDisplayW(Math.max(...x.sets.map(s => e1rm(s.w || 0, s.r)))) }));
    return lineChart([{ points: pts, cls: 'accent', area: true }]);
  };

  const liftSel = h('select.input.lift-select', { 'aria-label': 'Exercise', onchange: e => { liftId = e.target.value; renderProgress(root); } },
    trained.map(id => h('option', { value: id, selected: id === liftId }, getExercise(id).name)));

  const thisWeek = state.workouts.filter(w => w.date > addDays(today, -7)).length;
  const latestW = avg.length ? avg[avg.length - 1].y : null;
  const best = liftId ? Math.max(0, ...historyFor(liftId).flatMap(x => x.sets.map(s => e1rm(s.w || 0, s.r)))) : 0;

  // Card header: title + one headline number, MacroFactor-style.
  const head = (ic, title, value, sub, subCls = '') => h('div.chart-head',
    h('div.chart-title', icon(ic, 16), title),
    h('div.chart-stat', h('span.stat-v', value ?? '—'), sub ? h('span.stat-sub' + (subCls ? '.' + subCls : ''), sub) : null));

  fill(root,
    h('div.seg', [[7, '1W'], [30, '1M'], [90, '3M'], [365, '1Y']].map(([v, l]) => h('button' + (v === range ? '.on' : ''), { onclick: () => { range = v; renderProgress(root); } }, l))),

    h('div.stat-strip',
      h('div.strip-item', h('b', thisWeek), h('span', 'workouts / 7d')),
      h('div.strip-item', h('b', logged.length ? fmt(avgCal) : '—'), h('span', 'avg kcal / 14d')),
      h('div.strip-item', h('b', state.workouts.filter(w => w.date > addDays(today, -30)).reduce((n, w) => n + (w.prs?.length || 0), 0)), h('span', 'PRs / 30d'))),

    h('section.card',
      head('scale', 'Body weight', latestW != null ? `${fmt(latestW, 1)} ${unit()}` : null, trend.text, trend.cls),
      lineChart([{ points: raw, cls: 'faint', line: false, dotR: 4 }, { points: avg, cls: 'accent', dots: false, area: true }]),
      h('div.legend', h('span', h('i.lg-dot'), 'Daily weigh-in'), h('span', h('i.lg-line'), '7-day average'))),

    h('section.card',
      head('food', 'Calories', logged.length ? `${fmt(avgCal)}` : null, logged.length ? 'avg kcal · 14 days' : null),
      barChart(cal, { target: targets().kcal }),
      h('div.legend', h('span', h('i.lg-bar'), 'Eaten'), h('span', h('i.lg-goal'), `Target ${fmt(targets().kcal)}`))),

    h('section.card',
      head('dumbbell', 'Strength', best ? fmtW(best) : null, best ? 'best e1RM' : null),
      trained.length ? liftSel : null,
      liftChart(),
      liftId ? h('button.btn.ghost.sm.wide', { onclick: () => showHistory(liftId) }, icon('clock', 16), 'Full history') : null),

    h('div.section-label', 'Personal records'),
    prList(root),

    h('div.section-label', 'Workout history'),
    state.workouts.length ? h('section.card.flush', [...state.workouts].reverse().slice(0, 50).map(workoutRow)) : h('section.card.empty', h('p.muted', 'No workouts yet.')),
  );
}

let showAllPrs = false;
function prList(root) {
  const best = {};
  for (const w of state.workouts) for (const en of w.entries) for (const s of en.sets) {
    const v = e1rm(s.w || 0, s.r);
    if (v && (!best[en.exId] || v > best[en.exId].v)) best[en.exId] = { v, s, date: w.date };
  }
  const all = Object.entries(best).sort((a, b) => b[1].v - a[1].v);
  const rows = showAllPrs ? all : all.slice(0, 6);
  if (!rows.length) return h('section.card.empty', h('p.muted', 'Your best lifts will appear here.'));
  return h('section.card.flush', rows.map(([id, b]) => h('div.list-row',
    h('div.pr-ic', icon('trophy', 16)),
    h('div.grow.row-main', h('div.row-title', getExercise(id).name), h('div.row-meta', `${toDisplayW(b.s.w)} ${unit()} × ${b.s.r} · ${parseYmd(b.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`)),
    h('div.right', h('div.num', fmtW(b.v)), h('div.row-meta', 'e1RM')))),
    all.length > 6 ? h('button.list-row.more-row', { onclick: () => { showAllPrs = !showAllPrs; renderProgress(root); } }, showAllPrs ? 'Show fewer' : `Show all ${all.length}`) : null);
}
