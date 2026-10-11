// Training: routines, the routine generator UI, routine editor, live workout logging
// with progression targets and a rest timer.

import { state, save, uid, ymd, toDisplayW, fromDisplayW, fmtW, unit, loadStep, historyFor, e1rm, bestE1rm } from './store.js';
import { h, fill, fmt, openSheet, toast, confirmSheet } from './ui.js';
import { icon } from './icons.js';
import { EQUIPMENT, SLOTS } from './exercises.js';
import { SPLITS, generateRoutine, getExercise, allExercises, availableFor, hasEquip, nextDayIndex } from './generator.js';

const SLOT_NAMES = {
  squat: 'Squat', hinge: 'Hinge', lunge: 'Lunge / single-leg', quad_iso: 'Quads', ham_curl: 'Hamstrings', glute: 'Glutes', calf: 'Calves',
  h_push: 'Chest press', incline_push: 'Incline press', v_push: 'Overhead press', chest_fly: 'Chest fly', h_pull: 'Rows', v_pull: 'Vertical pull',
  rear_delt: 'Rear delts', side_delt: 'Side delts', biceps: 'Biceps', triceps: 'Triceps', abs: 'Abs',
};

const PRESETS = {
  'Full gym': EQUIPMENT.map(e => e.id),
  'Home gym': ['barbell', 'rack', 'bench', 'adj_bench', 'dumbbells', 'pullup_bar', 'bands'],
  'Dumbbells + bench': ['dumbbells', 'bench', 'adj_bench'],
  'Bodyweight + bands': ['bands', 'pullup_bar'],
};

let go = () => {};
export function setNavigator(fn) { go = fn; }

// ================= Train tab =================

// Colour family for an exercise, used for its avatar badge and muscle chips.
const CATS = {
  push: ['h_push', 'incline_push', 'v_push', 'chest_fly', 'triceps', 'side_delt'],
  pull: ['h_pull', 'v_pull', 'rear_delt', 'biceps'],
  legs: ['squat', 'hinge', 'lunge', 'quad_iso', 'ham_curl', 'glute', 'calf'],
  core: ['abs'],
};
export const catOf = slot => Object.keys(CATS).find(c => CATS[c].includes(slot)) || 'core';
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

export function exAvatar(ex, size = 'md') {
  return h(`div.ex-avatar.${size}.cat-${catOf(ex.slot)}`, icon('dumbbell', size === 'sm' ? 16 : 20));
}

function muscleChips(exIds, max = 4) {
  const seen = [];
  for (const id of exIds) {
    const ex = getExercise(id);
    const m = ex.muscles?.[0];
    if (m && !seen.some(s => s.m === m)) seen.push({ m, cat: catOf(ex.slot) });
  }
  return h('div.chips', seen.slice(0, max).map(s => h(`span.mchip.cat-${s.cat}`, cap(s.m))), seen.length > max ? h('span.mchip', `+${seen.length - max}`) : null);
}

const estMinutes = day => Math.round(day.exercises.reduce((t, e) => t + e.sets * 2.6, 0) / 5) * 5 || 0;

export function renderTrain(root) {
  const routine = state.routines.find(r => r.id === state.activeRoutineId);
  const recent = [...state.workouts].reverse().slice(0, 5);

  fill(root,
    state.active ? h('button.resume', { onclick: () => go('#/workout') },
      h('span.pulse'),
      h('div.grow', h('div.resume-title', state.active.name), h('div.small', 'Workout in progress — tap to resume')),
      icon('right', 20)) : null,

    routine ? routineSection(routine) : h('section.card.hero',
      h('div.hero-icon', icon('sparkles', 28)),
      h('h2', 'Build your program'),
      h('p.muted', 'Pick your equipment and how many days you can train. You\'ll get a complete routine you can edit.'),
      h('button.btn.wide', { onclick: openGenerator }, icon('sparkles', 18), 'Generate a routine')),

    h('button.row-btn', { onclick: () => startWorkout(null, null) }, h('div.row-ic', icon('plus', 18)), h('span.grow', 'Start an empty workout'), icon('right', 18, 'faint')),

    h('div.section-label', 'Recent workouts'),
    recent.length ? h('section.card.flush', recent.map(workoutRow)) : h('section.card.empty', h('p.muted', 'Finished workouts show up here.')),

    h('div.section-label', 'Routines'),
    h('section.card.flush',
      state.routines.map(r => h('div.list-row',
        h('button.grow.row-main', { onclick: () => openRoutineEditor(r) },
          h('div.row-title', r.name, r.id === state.activeRoutineId ? h('span.pill', 'Active') : null),
          h('div.row-meta', `${r.days.length} day${r.days.length > 1 ? 's' : ''} / week · ${r.days.map(d => d.name).join(', ')}`)),
        r.id !== state.activeRoutineId ? h('button.btn.soft.sm', { onclick: () => { state.activeRoutineId = r.id; save(); } }, 'Use') : null,
        h('button.icon-btn', { 'aria-label': 'Edit routine', onclick: () => openRoutineEditor(r) }, icon('edit', 18)))),
      h('div.card-actions',
        h('button.btn.soft.grow', { onclick: openGenerator }, icon('sparkles', 18), 'Generate'),
        h('button.btn.ghost.grow', { onclick: () => { const r = { id: uid(), name: 'My routine', days: [{ id: uid(), name: 'Day 1', exercises: [] }], createdAt: Date.now() }; state.routines.push(r); if (!state.activeRoutineId) state.activeRoutineId = r.id; save(); openRoutineEditor(r); } }, icon('plus', 18), 'Blank'))),
  );
}

function routineSection(routine) {
  if (!routine.days.length) return h('section.card.hero',
    h('h2', routine.name), h('p.muted', 'This routine has no training days yet.'),
    h('button.btn.wide', { onclick: () => openRoutineEditor(routine) }, icon('edit', 18), 'Add days'));
  const ni = nextDayIndex(routine);
  const next = routine.days[ni];
  const others = routine.days.map((d, i) => ({ d, i })).filter(x => x.i !== ni);
  const lastDone = id => { const w = [...state.workouts].reverse().find(w => w.dayId === id); return w ? new Date(w.start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null; };

  return [
    h('section.card.next-card',
      h('div.eyebrow', h('span', 'Up next'), h('span.faint', ` · ${routine.name}`)),
      h('h2.day-title', next.name),
      h('div.row-meta', [`${next.exercises.length} exercises`, `~${estMinutes(next)} min`, lastDone(next.id) ? `last ${lastDone(next.id)}` : null].filter(Boolean).join(' · ')),
      muscleChips(next.exercises.map(e => e.exId)),
      h('ol.plan', next.exercises.map((e, i) => {
        const ex = getExercise(e.exId);
        return h('li', h('span.plan-n', i + 1), h('span.grow', ex.name), h('span.plan-sets', `${e.sets} × ${e.reps[0]}–${e.reps[1]}`));
      })),
      h('button.btn.wide.big', { onclick: () => startWorkout(routine, next) }, icon('play', 18), `Start ${next.name}`)),
    others.length ? h('div.section-label', 'Other days') : null,
    others.length ? h('section.card.flush', others.map(({ d }) => h('div.list-row',
      h('div.grow.row-main',
        h('div.row-title', d.name),
        h('div.row-meta', `${d.exercises.length} exercises · ${[...new Set(d.exercises.map(e => cap(getExercise(e.exId).muscles?.[0] || '')))].filter(Boolean).slice(0, 3).join(', ')}`)),
      h('button.play-btn', { 'aria-label': `Start ${d.name}`, onclick: () => startWorkout(routine, d) }, icon('play', 16))))) : null,
  ];
}

export function workoutRow(w) {
  const sets = w.entries.reduce((s, e) => s + e.sets.filter(x => x.done).length, 0);
  const mins = w.end ? Math.round((w.end - w.start) / 60000) : null;
  const d = new Date(w.start);
  return h('button.list-row', { onclick: () => openWorkoutDetail(w) },
    h('div.date-badge', h('span', d.toLocaleDateString(undefined, { weekday: 'short' })), h('b', d.getDate())),
    h('div.grow.row-main',
      h('div.row-title', w.name),
      h('div.row-meta', [mins ? `${mins} min` : null, `${sets} sets`, w.volume ? `${fmt(toDisplayW(w.volume))} ${unit()}` : null].filter(Boolean).join(' · '))),
    w.prs?.length ? h('span.pill.gold', icon('trophy', 12), ` ${w.prs.length}`) : null,
    icon('right', 18, 'faint'));
}

function openWorkoutDetail(w) {
  const s = openSheet(w.name, [
    h('p.muted.small', new Date(w.start).toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })),
    ...w.entries.map(en => {
      const ex = getExercise(en.exId);
      return h('div.detail-ex',
        h('div.ex-head', exAvatar(ex, 'sm'), h('div.grow.ex-name', ex.name)),
        h('div.detail-sets', en.sets.filter(x => x.done).map((x, i) => h('div.detail-set', h('span.set-num', i + 1), h('span', `${x.w ? `${toDisplayW(x.w)} ${unit()}` : 'BW'} × ${x.r}`)))));
    }),
    w.notes ? h('p.note', w.notes) : null,
    h('button.btn.danger-soft.wide', {
      onclick: async () => {
        if (!(await confirmSheet('Delete this workout from your history?', { ok: 'Delete', danger: true }))) return;
        state.workouts = state.workouts.filter(x => x.id !== w.id); save(); s.close();
      },
    }, icon('trash', 18), 'Delete workout'),
  ]);
}

// ================= Generator =================

export function openGenerator() {
  const cfg = { days: 4, equipment: state.settings.equipment.length ? [...state.settings.equipment] : [...PRESETS['Full gym']], experience: 'intermediate', minutes: 60 };
  const body = h('div.form');
  const sheet = openSheet('Generate a routine', body, { full: true });

  function seg(options, value, onPick) {
    return h('div.seg', options.map(([v, l]) => h('button' + (v === value ? '.on' : ''), { onclick: () => { onPick(v); draw(); } }, l)));
  }

  function draw() {
    fill(body, 
      h('div.field-label', 'Days per week'),
      seg([2, 3, 4, 5, 6].map(n => [n, String(n)]), cfg.days, v => cfg.days = v),
      h('p.small.muted', `${SPLITS[cfg.days].name} — ${SPLITS[cfg.days].why}`),

      h('div.field-label', 'Equipment you have'),
      h('div.chips', Object.entries(PRESETS).map(([name, list]) => h('button.chip', { onclick: () => { cfg.equipment = [...list]; draw(); } }, name))),
      h('div.checks', EQUIPMENT.map(e => h('label.check',
        h('input', { type: 'checkbox', checked: cfg.equipment.includes(e.id), onchange: ev => { cfg.equipment = ev.target.checked ? [...cfg.equipment, e.id] : cfg.equipment.filter(x => x !== e.id); } }),
        h('span', e.name)))),
      h('p.small.muted', 'Bodyweight exercises are always available.'),

      h('div.field-label', 'Experience'),
      seg([['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']], cfg.experience, v => cfg.experience = v),

      h('div.field-label', 'Time per session'),
      seg([[45, '45 min'], [60, '60 min'], [75, '75 min'], [90, '90 min']], cfg.minutes, v => cfg.minutes = v),

      h('button.btn.wide.big', { style: { marginTop: '20px' }, onclick: preview }, icon('sparkles', 18), 'Build routine'));
  }

  function preview() {
    const r = generateRoutine(cfg);
    fill(body, 
      h('h2', r.name), h('p.muted.small', r.description),
      r.missing.length ? h('p.small.warn.warn-box', `Your equipment can't train: ${r.missing.map(m => SLOT_NAMES[m].toLowerCase()).join(', ')}. ${r.missing.some(m => ['h_pull', 'v_pull', 'rear_delt'].includes(m)) ? 'A pull-up bar or resistance bands would fill the pulling gap cheaply.' : ''}`) : null,
      ...r.days.map(d => h('div.card.preview-day',
        h('div.row-title', d.name),
        h('ol.plan', d.exercises.map((e, i) => h('li', h('span.plan-n', i + 1), h('span.grow', getExercise(e.exId).name), h('span.plan-sets', `${e.sets} × ${e.reps[0]}–${e.reps[1]}`)))))),
      h('div.row.gap.sticky-actions',
        h('button.btn.ghost.grow', { onclick: draw }, icon('left', 18), 'Change'),
        h('button.btn.grow', {
          onclick: () => {
            state.settings.equipment = cfg.equipment;
            delete r.missing;
            state.routines.push(r);
            state.activeRoutineId = r.id;
            save();
            sheet.close();
            toast('Routine saved and set as active');
          },
        }, 'Save & use')),
      h('p.small.muted', 'You can swap any exercise afterwards in the routine editor.'));
  }

  draw();
}

// ================= Routine editor =================

export function openRoutineEditor(routine) {
  const body = h('div');
  const sheet = openSheet('Edit routine', body, { full: true, onClose: () => save() });

  function draw() {
    save({ silent: true });
    const nameIn = h('input.input.wide', { value: routine.name, onchange: e => { routine.name = e.target.value.trim() || 'Routine'; save({ silent: true }); } });
    fill(body, 
      h('label', 'Routine name', nameIn),
      routine.description ? h('p.small.muted', routine.description) : null,
      ...routine.days.map((d, di) => h('div.card.edit-day',
        h('div.edit-day-head',
          h('span.day-n', di + 1),
          h('input.input.grow.dayname', { value: d.name, 'aria-label': 'Day name', onchange: e => { d.name = e.target.value.trim() || `Day ${di + 1}`; save({ silent: true }); } }),
          h('button.icon-btn', { 'aria-label': 'Move day up', disabled: di === 0, onclick: () => { move(routine.days, di, -1); draw(); } }, icon('up', 18)),
          h('button.icon-btn.danger-text', { 'aria-label': 'Delete day', onclick: async () => { if (await confirmSheet(`Delete ${d.name}?`, { ok: 'Delete', danger: true })) { routine.days.splice(di, 1); draw(); } } }, icon('trash', 18))),
        ...d.exercises.map((e, ei) => exerciseEditRow(d, e, ei, draw)),
        h('button.add-set', { onclick: () => pickExercise(null, ex => { d.exercises.push({ exId: ex.id, sets: 3, reps: [...ex.reps] }); draw(); }) }, icon('plus', 16), 'Add exercise'))),
      h('button.row-btn.accent', { onclick: () => { routine.days.push({ id: uid(), name: `Day ${routine.days.length + 1}`, exercises: [] }); draw(); } }, h('div.row-ic', icon('plus', 18)), h('span.grow', 'Add day')),
      h('div.row.gap', { style: { marginTop: '12px' } },
        h('button.btn.danger-soft.grow', {
          onclick: async () => {
            if (!(await confirmSheet(`Delete routine "${routine.name}"? Your workout history is kept.`, { ok: 'Delete', danger: true }))) return;
            state.routines = state.routines.filter(r => r.id !== routine.id);
            if (state.activeRoutineId === routine.id) state.activeRoutineId = state.routines[0]?.id || null;
            save(); sheet.close();
          },
        }, 'Delete routine'),
        h('button.btn.grow', { onclick: () => sheet.close() }, 'Done')));
  }
  draw();
}

function move(arr, i, d) { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; }

function exerciseEditRow(day, e, ei, redraw) {
  const ex = getExercise(e.exId);
  const num = (val, set, w = '3.2em') => h('input.input.num', { type: 'number', inputmode: 'numeric', value: val, style: { width: w }, onchange: ev => { set(Math.max(1, +ev.target.value || 1)); save({ silent: true }); } });
  return h('div.edit-row',
    exAvatar(ex, 'sm'),
    h('div.grow',
      h('div.row-title', ex.name),
      h('div.row.gap.center.small.edit-nums',
        num(e.sets, v => e.sets = v), h('span.muted', 'sets ×'),
        num(e.reps[0], v => e.reps[0] = v), h('span.muted', '–'), num(e.reps[1], v => e.reps[1] = v), h('span.muted', 'reps'))),
    h('div.edit-actions',
      h('button.icon-btn', { 'aria-label': 'Replace exercise', onclick: () => pickExercise(ex.slot, nx => { e.exId = nx.id; e.reps = [...nx.reps]; redraw(); }) }, icon('swap', 18)),
      h('button.icon-btn', { 'aria-label': 'Move up', disabled: ei === 0, onclick: () => { move(day.exercises, ei, -1); redraw(); } }, icon('up', 18)),
      h('button.icon-btn.danger-text', { 'aria-label': 'Remove exercise', onclick: () => { day.exercises.splice(ei, 1); redraw(); } }, icon('x', 18))));
}

// Exercise picker. If `slot` is given, alternatives for that movement are listed first.
export function pickExercise(slot, onPick) {
  let q = '', mine = state.settings.equipment.length > 0;
  const list = h('div');
  const search = h('input.input.wide.search-in', { type: 'search', placeholder: 'Search exercises or muscles', oninput: e => { q = e.target.value.toLowerCase(); draw(); } });
  const toggle = h('label.check', h('input', { type: 'checkbox', checked: mine, onchange: e => { mine = e.target.checked; draw(); } }), h('span', 'Only my equipment'));
  const sheet = openSheet(slot ? `Swap: ${SLOT_NAMES[slot]}` : 'Add exercise', [search, state.settings.equipment.length ? toggle : null, list,
    h('button.btn.soft.wide', { onclick: () => createCustomExercise(ex => { sheet.close(); onPick(ex); }) }, icon('plus', 18), 'Create custom exercise')], { full: true });

  function row(ex) {
    return h('button.list-row', { onclick: () => { sheet.close(); onPick(ex); } },
      exAvatar(ex, 'sm'),
      h('div.grow.row-main', h('div.row-title', ex.name), h('div.row-meta', `${ex.muscles.join(', ')} · ${ex.equip.length ? ex.equip.map(id => EQUIPMENT.find(x => x.id === id)?.name.split(' (')[0] || id).join(' + ') : 'Bodyweight'}`)));
  }
  function draw() {
    const owned = state.settings.equipment;
    const pool = allExercises().filter(e => (!mine || hasEquip(e, owned)) &&
      (!q || (e.name + ' ' + e.muscles.join(' ') + ' ' + SLOT_NAMES[e.slot]).toLowerCase().includes(q)));
    const groups = slot && !q ? [slot, ...SLOTS.filter(s => s !== slot)] : SLOTS;
    fill(list, ...groups.flatMap(s => {
      const items = pool.filter(e => e.slot === s).sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
      return items.length ? [h('div.section-label', SLOT_NAMES[s] + (s === slot ? ' — alternatives' : '')), h('div.card.flush', items.map(row))] : [];
    }));
    if (!pool.length) fill(list, h('p.muted.pad', 'No matches.'));
  }
  draw();
}

function createCustomExercise(onDone) {
  const name = h('input.input', { placeholder: 'e.g. Belt Squat' });
  const slotSel = h('select.input', SLOTS.map(s => h('option', { value: s }, SLOT_NAMES[s])));
  const lo = h('input.input', { type: 'number', value: 8 }), hi = h('input.input', { type: 'number', value: 12 });
  const bw = h('input', { type: 'checkbox' });
  const s = openSheet('Custom exercise', h('div.form',
    h('label', 'Name', name), h('label', 'Movement type', slotSel),
    h('div.grid2', h('label', 'Min reps', lo), h('label', 'Max reps', hi)),
    h('label.check', bw, h('span', 'Bodyweight exercise (log added weight)')),
    h('button.btn.wide', {
      onclick: () => {
        if (!name.value.trim()) return toast('Name it first');
        const ex = { id: 'cx_' + uid(), name: name.value.trim(), slot: slotSel.value, priority: 50, equip: [], muscles: [SLOT_NAMES[slotSel.value].toLowerCase()], secondary: [], kind: 'compound', reps: [+lo.value || 8, Math.max(+hi.value || 12, (+lo.value || 8) + 1)], bw: bw.checked, custom: true };
        state.customExercises.push(ex); save(); s.close(); onDone(ex);
      },
    }, 'Save')));
}

// ================= Live workout =================

export function startWorkout(routine, day) {
  if (state.active) { toast('Finish or discard your current workout first'); go('#/workout'); return; }
  state.active = {
    id: uid(), date: ymd(), start: Date.now(),
    routineId: routine?.id || null, dayId: day?.id || null,
    name: day ? `${day.name}` : 'Workout',
    entries: (day?.exercises || []).map(e => newEntry(e.exId, e.sets, e.reps)),
    notes: '',
  };
  save();
  go('#/workout');
}

function newEntry(exId, sets = 3, reps = null) {
  const ex = getExercise(exId);
  return { id: uid(), exId, reps: reps ? [...reps] : [...ex.reps], sets: Array.from({ length: sets }, () => ({ w: null, r: null, done: false })) };
}

// Double progression: hit the top of the rep range on every set → add load; otherwise add reps.
export function suggestion(exId, reps) {
  const last = historyFor(exId)[0];
  if (!last) return null;
  const ex = getExercise(exId);
  const top = Math.max(...last.sets.map(s => s.w || 0));
  const topSets = last.sets.filter(s => (s.w || 0) === top);
  const bestReps = Math.max(...topSets.map(s => s.r));
  const allTop = topSets.every(s => s.r >= reps[1]);
  const lastLine = last.sets.map(s => `${s.w ? toDisplayW(s.w) : 'BW'}×${s.r}`).join(', ');
  if (allTop) {
    if (ex.bw && !top) return { w: 0, r: reps[1] + 1, why: 'Hit the top of the range — add reps or a little weight', lastLine };
    const stepKg = fromDisplayW(loadStep());
    return { w: top + stepKg, r: reps[0], why: `Hit ${reps[1]} reps on every set — increase the weight`, lastLine, up: true };
  }
  return { w: top, r: Math.min(reps[1], Math.max(reps[0], bestReps + 1)), why: 'Same weight, beat last time\'s reps', lastLine };
}

let restEnd = 0, restTotal = 0, restTimer = null;

export function renderWorkout(root) {
  const w = state.active;
  if (!w) { location.replace('#/train'); return; }

  const redraw = () => renderWorkout(root);
  const stat = (label) => { const v = h('div.wk-stat-v'); return [h('div.wk-stat', v, h('div.wk-stat-l', label)), v]; };
  const [durEl, durV] = stat('Duration');
  const [volEl, volV] = stat(`Volume (${unit()})`);
  const [setEl, setV] = stat('Sets');

  // Live header numbers (Hevy-style): duration ticks every second, volume/sets on each change.
  function updateStats() {
    const secs = Math.floor((Date.now() - w.start) / 1000);
    const hh = Math.floor(secs / 3600), mm = Math.floor((secs % 3600) / 60), ss = secs % 60;
    durV.textContent = hh ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${mm}:${String(ss).padStart(2, '0')}`;
    let vol = 0, done = 0, total = 0;
    for (const en of w.entries) for (const s of en.sets) { total++; if (s.done) { done++; vol += (s.w || 0) * (s.r || 0); } }
    volV.textContent = fmt(toDisplayW(vol)) || '0';
    setV.textContent = `${done}/${total}`;
  }
  updateStats();
  clearInterval(root._tick);
  root._tick = setInterval(() => { if (!document.body.contains(durV)) return clearInterval(root._tick); updateStats(); }, 1000);

  fill(root,
    h('div.wk-bar',
      h('div.wk-bar-top',
        h('input.title-input', { value: w.name, 'aria-label': 'Workout name', onchange: e => { w.name = e.target.value || 'Workout'; save({ silent: true }); } }),
        h('button.btn.finish', { onclick: finish }, 'Finish')),
      h('div.wk-stats', durEl, volEl, setEl)),
    ...w.entries.map((en, i) => entryCard(w, en, i, redraw, updateStats)),
    h('button.row-btn.accent', { onclick: () => pickExercise(null, ex => { w.entries.push(newEntry(ex.id)); save({ silent: true }); redraw(); }) },
      h('div.row-ic', icon('plus', 18)), h('span.grow', 'Add exercise')),
    h('section.card.notes',
      h('div.field-label', 'Notes'),
      h('textarea.input', { placeholder: 'How did it feel? Anything to remember next time?', rows: 2, value: w.notes, onchange: e => { w.notes = e.target.value; save({ silent: true }); } })),
    h('button.btn.danger-soft.wide.discard', {
      onclick: async () => {
        if (!(await confirmSheet('Discard this workout? Nothing will be saved.', { ok: 'Discard', danger: true }))) return;
        state.active = null; stopRest(); save(); location.replace('#/train');
      },
    }, icon('trash', 18), 'Discard workout'),
  );
  drawRest();
}

function entryCard(w, en, idx, redraw, updateStats) {
  const ex = getExercise(en.exId);
  const sug = suggestion(en.exId, en.reps);
  const best = bestE1rm(en.exId);
  const last = historyFor(en.exId)[0];
  const count = h('span.ex-count');
  const card = h('section.ex-card');
  const refresh = () => {
    const d = en.sets.filter(s => s.done).length;
    count.textContent = `${d}/${en.sets.length}`;
    card.classList.toggle('all-done', d === en.sets.length && d > 0);
    updateStats();
  };

  const muscle = ex.muscles?.[0] ? ex.muscles[0].charAt(0).toUpperCase() + ex.muscles[0].slice(1) : null;
  card.append(
    h('div.ex-head',
      exAvatar(ex),
      h('div.grow',
        h('div.ex-name', ex.name),
        h('div.ex-meta', [muscle, `${en.reps[0]}–${en.reps[1]} reps`, best ? `best ${fmtW(best)} e1RM` : null].filter(Boolean).join(' · '))),
      count,
      h('button.icon-btn', { 'aria-label': 'Exercise options', onclick: () => exerciseMenu(w, en, idx, redraw) }, icon('more', 20))),
    sug
      ? h('div.ex-target' + (sug.up ? '.up' : ''),
        icon(sug.up ? 'up' : 'target', 16),
        h('div.grow', h('b', `${sug.w ? `${toDisplayW(sug.w)} ${unit()}` : 'BW'} × ${sug.r}`), h('span', ` · ${sug.why}`), h('div.target-last', `Last time: ${sug.lastLine}`)))
      : h('div.ex-target.first', icon('info', 16), h('div.grow', `First time — pick a weight you could lift about ${en.reps[1] + 2} times.`)),
    h('div.set-table',
      h('div.set-head', h('span', 'Set'), h('span', 'Previous'), h('span', unit()), h('span', 'Reps'), h('span', icon('check', 14))),
      ...en.sets.map((s, si) => setRow(en, s, si, sug, last, ex, refresh))),
    h('button.add-set', { onclick: () => { const prev = en.sets[en.sets.length - 1]; en.sets.push({ w: prev?.w ?? null, r: null, done: false, auto: true }); save({ silent: true }); redraw(); } }, icon('plus', 16), 'Add set'));
  refresh();
  return card;
}

function setRow(en, s, si, sug, last, ex, refresh) {
  const prev = last?.sets[si];
  const wIn = h('input.cell', { type: 'number', inputmode: 'decimal', step: 'any', 'aria-label': `Set ${si + 1} weight`, value: s.w != null ? toDisplayW(s.w) : '', placeholder: sug?.w ? toDisplayW(sug.w) : (ex.bw ? '0' : '–') });
  const rIn = h('input.cell', { type: 'number', inputmode: 'numeric', 'aria-label': `Set ${si + 1} reps`, value: s.r ?? '', placeholder: sug ? sug.r : en.reps[1] });
  const rowEl = h('div.set-row' + (s.done ? '.done' : ''));
  const sync = () => {
    s.w = wIn.value === '' ? null : fromDisplayW(wIn.value);
    s.r = rIn.value === '' ? null : Math.round(+rIn.value);
    save({ silent: true });
    refresh();
  };
  // Carry this set's weight down to later sets that are empty or were themselves
  // auto-filled — never over a weight you typed — and show it in their inputs.
  const carryDown = () => {
    let r = rowEl.nextElementSibling;
    for (let j = si + 1; j < en.sets.length; j++, r = r?.nextElementSibling) {
      const t = en.sets[j];
      if (s.w == null || t.done || !(t.w == null || t.auto)) continue;
      t.w = s.w; t.auto = true;
      const inp = r?.querySelector('input');
      if (inp) inp.value = toDisplayW(t.w);
    }
    save({ silent: true });
  };
  wIn.addEventListener('change', () => { s.auto = false; sync(); carryDown(); });
  rIn.addEventListener('change', sync);
  const check = h('button.check-btn', {
    'aria-label': `Complete set ${si + 1}`,
    onclick: () => {
      if (!s.done) {
        if (wIn.value === '') wIn.value = s.w != null ? toDisplayW(s.w) : (wIn.placeholder === '–' ? '' : wIn.placeholder);
        if (rIn.value === '' && rIn.placeholder !== '') rIn.value = rIn.placeholder;
        sync();
        if (!s.r) { toast('Enter reps first'); return; }
        s.done = true;
        unlockAudio();
        startRest(state.settings.restSec);
        const prevBest = bestE1rm(en.exId);
        if (prevBest && !en.prToasted && e1rm(s.w || 0, s.r) > prevBest + 0.01) { en.prToasted = true; toast('New estimated 1RM!'); }
      } else s.done = false;
      rowEl.classList.toggle('done', s.done);
      save({ silent: true });
      refresh();
    },
  }, icon('check', 18));
  // Tapping "previous" copies last session's numbers into this set.
  const prevBtn = h('button.prev', {
    disabled: !prev,
    onclick: () => { if (!prev || s.done) return; wIn.value = prev.w ? toDisplayW(prev.w) : ''; rIn.value = prev.r; s.auto = false; sync(); carryDown(); },
  }, prev ? `${prev.w ? toDisplayW(prev.w) : 'BW'} × ${prev.r}` : '—');
  rowEl.append(h('span.set-num', si + 1), prevBtn, wIn, rIn, check);
  return rowEl;
}

function exerciseMenu(w, en, idx, redraw) {
  const ex = getExercise(en.exId);
  const item = (ic, label, fn, opts = {}) => h('button.menu-item' + (opts.danger ? '.danger' : ''), { disabled: opts.disabled, onclick: fn }, icon(ic, 20), h('span', label));
  const s = openSheet(ex.name, h('div.menu',
    item('swap', 'Replace exercise', () => { s.close(); pickExercise(ex.slot, nx => { en.exId = nx.id; en.reps = [...nx.reps]; save({ silent: true }); redraw(); }); }),
    item('chart', 'History', () => { s.close(); showHistory(en.exId); }),
    item('up', 'Move up', () => { move(w.entries, idx, -1); save({ silent: true }); s.close(); redraw(); }, { disabled: idx === 0 }),
    item('down', 'Move down', () => { move(w.entries, idx, 1); save({ silent: true }); s.close(); redraw(); }, { disabled: idx === w.entries.length - 1 }),
    item('x', 'Remove last set', () => { en.sets.pop(); save({ silent: true }); s.close(); redraw(); }, { disabled: en.sets.length <= 1 }),
    item('trash', 'Remove exercise', () => { w.entries.splice(idx, 1); save({ silent: true }); s.close(); redraw(); }, { danger: true })));
}

export function showHistory(exId) {
  const hist = historyFor(exId);
  openSheet(getExercise(exId).name, hist.length ? h('div.card.flush', hist.slice(0, 30).map(x => h('div.list-row',
    h('div.grow.row-main',
      h('div.row-title', new Date(x.date + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })),
      h('div.row-meta', x.sets.map(s => `${s.w ? toDisplayW(s.w) : 'BW'}×${s.r}`).join('  ·  '))),
    h('div.right', h('div.num', fmt(toDisplayW(Math.max(...x.sets.map(s => e1rm(s.w || 0, s.r)))))), h('div.row-meta', 'e1RM'))))) : h('p.muted', 'No history yet.'));
}

async function finish() {
  const w = state.active;
  const open = w.entries.reduce((n, en) => n + en.sets.filter(s => !s.done).length, 0);
  if (open && w.entries.some(en => en.sets.some(s => s.done)) &&
    !(await confirmSheet(`Finish with ${open} unchecked set${open > 1 ? 's' : ''}? They won't be saved.`, { ok: 'Finish workout' }))) return;
  const entries = w.entries.map(en => ({ ...en, sets: en.sets.filter(s => s.done && s.r > 0).map(({ auto, ...s }) => s) })).filter(en => en.sets.length);
  if (!entries.length) { toast('Complete at least one set (tap ✓) before finishing'); return; }
  const prs = [];
  for (const en of entries) {
    delete en.prToasted;
    const prev = bestE1rm(en.exId);
    const now = Math.max(...en.sets.map(s => e1rm(s.w || 0, s.r)));
    if (prev && now > prev + 0.01) prs.push({ exId: en.exId, e1rm: now });
  }
  const volume = entries.reduce((t, en) => t + en.sets.reduce((a, s) => a + (s.w || 0) * s.r, 0), 0);
  const done = { ...w, entries, end: Date.now(), prs, volume };
  state.workouts.push(done);
  state.active = null;
  stopRest();
  save();
  location.replace('#/train');
  const tile = (ic, v, l) => h('div.tile', icon(ic, 18), h('div.tile-v', v), h('div.tile-l', l));
  openSheet('Workout complete', [
    h('div.done-hero', h('div.done-badge', icon('check', 30)), h('h3', done.name), h('p.muted.small', new Date(done.start).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }))),
    h('div.tiles',
      tile('clock', `${Math.round((done.end - done.start) / 60000)} min`, 'Duration'),
      tile('dumbbell', entries.reduce((a, e) => a + e.sets.length, 0), 'Sets'),
      tile('zap', `${fmt(toDisplayW(volume))}`, `Volume (${unit()})`),
      tile('trophy', prs.length, 'Records')),
    prs.length ? h('div', h('div.section-label', 'New personal records'), h('div.card.flush', prs.map(p => h('div.list-row',
      h('div.pr-ic', icon('trophy', 18)),
      h('div.grow.row-main', h('div.row-title', getExercise(p.exId).name), h('div.row-meta', 'New best estimated 1RM')),
      h('div.num', fmtW(p.e1rm)))))) : null,
  ]);
}

// ---------- rest timer ----------

function startRest(sec) { restTotal = sec; restEnd = Date.now() + sec * 1000; drawRest(); }
function stopRest() { restEnd = 0; clearInterval(restTimer); restTimer = null; document.querySelector('.rest')?.remove(); }

function drawRest() {
  clearInterval(restTimer);
  if (!restEnd) return;
  let el = document.querySelector('.rest');
  if (!el) {
    el = h('div.rest',
      h('div.rest-fill'),
      h('div.rest-ic', icon('timer', 18)),
      h('div.grow', h('div.rest-time'), h('div.rest-l', 'Rest')),
      h('button.rest-btn', { 'aria-label': 'Remove 15 seconds', onclick: () => { restEnd -= 15000; restTotal = Math.max(1, restTotal - 15); update(); } }, '−15'),
      h('button.rest-btn', { 'aria-label': 'Add 15 seconds', onclick: () => { restEnd += 15000; restTotal += 15; update(); } }, '+15'),
      h('button.rest-btn.skip', { onclick: stopRest }, 'Skip'));
    document.body.append(el);
  }
  function update() {
    const left = Math.max(0, Math.round((restEnd - Date.now()) / 1000));
    el.querySelector('.rest-time').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    el.querySelector('.rest-fill').style.width = `${(left / restTotal) * 100}%`;
    if (left <= 0) { beep(); navigator.vibrate?.([200, 100, 200]); stopRest(); }
  }
  update();
  restTimer = setInterval(update, 500);
}

// iOS only plays audio from a context created/resumed during a tap, so unlock it on ✓.
let audioCtx = null;
function unlockAudio() {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch {}
}

function beep() {
  try {
    const ctx = audioCtx;
    if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.2, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    o.start(); o.stop(ctx.currentTime + 0.6);
  } catch {}
}
