// Progress: body-weight trend, calories vs target, strength (e1RM) per exercise, workout history.

import { state, ymd, addDays, parseYmd, dayTotals, targets, toDisplayW, unit, e1rm, historyFor, fmtW } from './store.js';
import { h, fill, fmt, lineChart, barChart } from './ui.js';
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
  let trendText = '';
  if (avg.length >= 2) {
    const days = (avg[avg.length - 1].x - avg[0].x) / 86400000;
    if (days >= 6) {
      const perWeek = ((avg[avg.length - 1].y - avg[0].y) / days) * 7;
      trendText = `Trend: ${perWeek >= 0 ? '+' : ''}${fmt(perWeek, 2)} ${unit()}/week`;
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
    return lineChart([{ points: pts, cls: 'accent' }], { yLabel: `Estimated 1RM (${unit()})` });
  };

  const liftSel = h('select.input.lift-select', { onchange: e => { liftId = e.target.value; renderProgress(root); } },
    trained.map(id => h('option', { value: id, selected: id === liftId }, getExercise(id).name)));

  const thisWeek = state.workouts.filter(w => w.date > addDays(today, -7)).length;

  fill(root, 
    h('div.seg', [[7, '7d'], [30, '30d'], [90, '90d'], [365, '1y']].map(([v, l]) => h('button' + (v === range ? '.on' : ''), { onclick: () => { range = v; renderProgress(root); } }, l))),

    h('section.card',
      h('div.row.center', h('h3.grow', 'Body weight'), h('span.small.muted', trendText)),
      lineChart([{ points: raw, cls: 'faint', line: false, dotR: 4 }, { points: avg, cls: 'accent', dots: false }], { yLabel: `${unit()} · dots = daily, line = 7-day average` })),

    h('section.card',
      h('div.row.center', h('h3.grow', 'Calories — last 14 days'), h('span.small.muted', logged.length ? `avg ${fmt(avgCal)} kcal` : '')),
      barChart(cal, { target: targets().kcal })),

    h('section.card',
      h('h3', 'Strength'),
      trained.length ? liftSel : null,
      liftChart(),
      liftId ? h('button.btn.ghost.sm', { onclick: () => showHistory(liftId) }, 'Full history') : null),

    h('section.card',
      h('h3', 'Personal records'),
      prList()),

    h('div.section-label', `Workouts · ${thisWeek} in the last 7 days`),
    h('section.card.list', state.workouts.length ? [...state.workouts].reverse().slice(0, 50).map(workoutRow) : h('p.muted.pad', 'No workouts yet.')),
  );
}

function prList() {
  const best = {};
  for (const w of state.workouts) for (const en of w.entries) for (const s of en.sets) {
    const v = e1rm(s.w || 0, s.r);
    if (v && (!best[en.exId] || v > best[en.exId].v)) best[en.exId] = { v, s, date: w.date };
  }
  const rows = Object.entries(best).sort((a, b) => b[1].v - a[1].v).slice(0, 12);
  if (!rows.length) return h('p.muted.small', 'Your best lifts will appear here.');
  return h('div.list', rows.map(([id, b]) => h('div.entry',
    h('div.grow', h('div', getExercise(id).name), h('div.small.muted', `${toDisplayW(b.s.w)} ${unit()} × ${b.s.r} · ${b.date}`)),
    h('div.right', h('b', fmtW(b.v)), h('div.small.muted', 'e1RM')))));
}
