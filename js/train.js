// Training: routines, the routine generator UI, routine editor, live workout logging
// with progression targets and a rest timer.

import { state, save, uid, ymd, toDisplayW, fromDisplayW, fmtW, unit, loadStep, historyFor, e1rm, bestE1rm } from './store.js';
import { h, fill, fmt, openSheet, toast, confirmSheet } from './ui.js';
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

export function renderTrain(root) {
  const routine = state.routines.find(r => r.id === state.activeRoutineId);
  const recent = [...state.workouts].reverse().slice(0, 5);

  fill(root, 
    state.active ? h('section.card.active-banner',
      h('div.grow', h('b', state.active.name), h('div.small.muted', `In progress · started ${new Date(state.active.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`)),
      h('button.btn', { onclick: () => go('#/workout') }, 'Resume')) : null,

    routine ? currentRoutineCard(routine) : h('section.card.hero',
      h('h2', 'Build your program'),
      h('p.muted', 'Tell me what equipment you have and how many days you can train — I\'ll build a full routine you can edit.'),
      h('button.btn.wide', { onclick: openGenerator }, 'Generate a routine')),

    h('div.section-label', 'Routines'),
    h('section.card.list',
      state.routines.length ? state.routines.map(r => h('div.entry',
        h('div.grow', { onclick: () => openRoutineEditor(r) },
          h('div', r.name, r.id === state.activeRoutineId ? h('span.pill', 'Active') : null),
          h('div.small.muted', `${r.days.length} day${r.days.length > 1 ? 's' : ''}/week · ${r.days.map(d => d.name).join(', ')}`)),
        r.id !== state.activeRoutineId ? h('button.btn.ghost.sm', { onclick: () => { state.activeRoutineId = r.id; save(); } }, 'Use') : null,
        h('button.btn.ghost.sm', { onclick: () => openRoutineEditor(r) }, 'Edit'))) : h('p.muted.pad', 'No routines yet.'),
      h('div.row.gap.pad',
        h('button.btn.grow', { onclick: openGenerator }, '✨ Generate'),
        h('button.btn.ghost.grow', { onclick: () => { const r = { id: uid(), name: 'My routine', days: [{ id: uid(), name: 'Day 1', exercises: [] }], createdAt: Date.now() }; state.routines.push(r); if (!state.activeRoutineId) state.activeRoutineId = r.id; save(); openRoutineEditor(r); } }, '+ Blank'))),

    h('button.btn.ghost.wide', { onclick: () => startWorkout(null, null) }, 'Start an empty workout'),

    h('div.section-label', 'Recent workouts'),
    h('section.card.list', recent.length ? recent.map(workoutRow) : h('p.muted.pad', 'Finished workouts show up here.')),
  );
}

function currentRoutineCard(routine) {
  const ni = nextDayIndex(routine);
  return h('section.card',
    h('div.small.muted', 'Current routine'),
    h('h2', routine.name),
    h('div.days', routine.days.map((d, i) => h('div.day' + (i === ni ? '.next' : ''),
      h('div.grow',
        h('div', h('b', d.name), i === ni ? h('span.pill', 'Up next') : null),
        h('div.small.muted', d.exercises.map(e => getExercise(e.exId).name).join(' · ') || 'No exercises')),
      h('button.btn.sm' + (i === ni ? '' : '.ghost'), { onclick: () => startWorkout(routine, d) }, 'Start')))));
}

export function workoutRow(w) {
  const sets = w.entries.reduce((s, e) => s + e.sets.filter(x => x.done).length, 0);
  const mins = w.end ? Math.round((w.end - w.start) / 60000) : null;
  return h('button.entry', { onclick: () => openWorkoutDetail(w) },
    h('div.grow', h('div', w.name), h('div.small.muted', `${new Date(w.start).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${w.entries.length} exercises · ${sets} sets${mins ? ` · ${mins} min` : ''}`)),
    w.prs?.length ? h('span.pill.gold', `${w.prs.length} PR`) : null);
}

function openWorkoutDetail(w) {
  const s = openSheet(w.name, [
    h('p.muted.small', new Date(w.start).toLocaleString()),
    ...w.entries.map(en => h('div.card.inner',
      h('b', getExercise(en.exId).name),
      h('div.small', en.sets.filter(x => x.done).map(x => `${toDisplayW(x.w) || 0}×${x.r}`).join(', ') || '—'))),
    w.notes ? h('p', w.notes) : null,
    h('button.btn.danger.wide', {
      onclick: async () => {
        if (!(await confirmSheet('Delete this workout from your history?', { ok: 'Delete', danger: true }))) return;
        state.workouts = state.workouts.filter(x => x.id !== w.id); save(); s.close();
      },
    }, 'Delete workout'),
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

      h('button.btn.wide', { style: { marginTop: '16px' }, onclick: preview }, 'Build routine'));
  }

  function preview() {
    const r = generateRoutine(cfg);
    fill(body, 
      h('h3', r.name), h('p.muted.small', r.description),
      r.missing.length ? h('p.small.warn', `Your equipment can't train: ${r.missing.map(m => SLOT_NAMES[m].toLowerCase()).join(', ')}. ${r.missing.some(m => ['h_pull', 'v_pull', 'rear_delt'].includes(m)) ? 'A pull-up bar or resistance bands would fill the pulling gap cheaply.' : ''}`) : null,
      ...r.days.map(d => h('div.card.inner',
        h('b', d.name),
        h('ol.exlist', d.exercises.map(e => h('li', `${getExercise(e.exId).name}`, h('span.muted', ` — ${e.sets} × ${e.reps[0]}–${e.reps[1]}`)))))),
      h('div.row.gap',
        h('button.btn.ghost.grow', { onclick: draw }, '‹ Change'),
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
      ...routine.days.map((d, di) => h('div.card.inner',
        h('div.row.gap.center',
          h('input.input.grow.dayname', { value: d.name, onchange: e => { d.name = e.target.value.trim() || `Day ${di + 1}`; save({ silent: true }); } }),
          h('button.icon-btn', { title: 'Move day up', disabled: di === 0, onclick: () => { move(routine.days, di, -1); draw(); } }, '↑'),
          h('button.icon-btn.danger-text', { title: 'Delete day', onclick: async () => { if (await confirmSheet(`Delete ${d.name}?`, { ok: 'Delete', danger: true })) { routine.days.splice(di, 1); draw(); } } }, '🗑')),
        ...d.exercises.map((e, ei) => exerciseEditRow(d, e, ei, draw)),
        h('button.btn.ghost.sm', { onclick: () => pickExercise(null, ex => { d.exercises.push({ exId: ex.id, sets: 3, reps: [...ex.reps] }); draw(); }) }, '+ Add exercise'))),
      h('button.btn.ghost.wide', { onclick: () => { routine.days.push({ id: uid(), name: `Day ${routine.days.length + 1}`, exercises: [] }); draw(); } }, '+ Add day'),
      h('div.row.gap', { style: { marginTop: '12px' } },
        h('button.btn.danger.grow', {
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
    h('div.grow',
      h('div', ex.name),
      h('div.row.gap.center.small',
        num(e.sets, v => e.sets = v), h('span.muted', 'sets ×'),
        num(e.reps[0], v => e.reps[0] = v), h('span.muted', '–'), num(e.reps[1], v => e.reps[1] = v), h('span.muted', 'reps'))),
    h('div.col',
      h('button.icon-btn', { title: 'Swap', onclick: () => pickExercise(ex.slot, nx => { e.exId = nx.id; e.reps = [...nx.reps]; redraw(); }) }, '⇄'),
      h('button.icon-btn', { title: 'Move up', disabled: ei === 0, onclick: () => { move(day.exercises, ei, -1); redraw(); } }, '↑'),
      h('button.icon-btn.danger-text', { title: 'Remove', onclick: () => { day.exercises.splice(ei, 1); redraw(); } }, '✕')));
}

// Exercise picker. If `slot` is given, alternatives for that movement are listed first.
export function pickExercise(slot, onPick) {
  let q = '', mine = state.settings.equipment.length > 0;
  const list = h('div.list');
  const search = h('input.input.wide', { type: 'search', placeholder: 'Search exercises or muscles', oninput: e => { q = e.target.value.toLowerCase(); draw(); } });
  const toggle = h('label.check', h('input', { type: 'checkbox', checked: mine, onchange: e => { mine = e.target.checked; draw(); } }), h('span', 'Only my equipment'));
  const sheet = openSheet(slot ? `Swap: ${SLOT_NAMES[slot]}` : 'Add exercise', [search, state.settings.equipment.length ? toggle : null, list,
    h('button.btn.ghost.wide', { onclick: () => createCustomExercise(ex => { sheet.close(); onPick(ex); }) }, '+ Create custom exercise')], { full: true });

  function row(ex) {
    return h('button.entry', { onclick: () => { sheet.close(); onPick(ex); } },
      h('div.grow', h('div', ex.name), h('div.small.muted', `${ex.muscles.join(', ')} · ${ex.equip.length ? ex.equip.map(id => EQUIPMENT.find(x => x.id === id)?.name.split(' (')[0] || id).join(' + ') : 'Bodyweight'}`)));
  }
  function draw() {
    const owned = state.settings.equipment;
    const pool = allExercises().filter(e => (!mine || hasEquip(e, owned)) &&
      (!q || (e.name + ' ' + e.muscles.join(' ') + ' ' + SLOT_NAMES[e.slot]).toLowerCase().includes(q)));
    const groups = slot && !q ? [slot, ...SLOTS.filter(s => s !== slot)] : SLOTS;
    fill(list, ...groups.flatMap(s => {
      const items = pool.filter(e => e.slot === s).sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
      return items.length ? [h('div.section-label', SLOT_NAMES[s] + (s === slot ? ' — alternatives' : '')), ...items.map(row)] : [];
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

  const elapsed = h('span.muted.small');
  const tick = () => { const m = Math.floor((Date.now() - w.start) / 60000); elapsed.textContent = `${Math.floor(m / 60) ? Math.floor(m / 60) + 'h ' : ''}${m % 60}m`; };
  tick();
  clearInterval(root._tick); root._tick = setInterval(() => { if (!document.body.contains(elapsed)) return clearInterval(root._tick); tick(); }, 30000);

  const redraw = () => renderWorkout(root);

  fill(root, 
    h('div.workout-head',
      h('input.input.title-input', { value: w.name, onchange: e => { w.name = e.target.value || 'Workout'; save({ silent: true }); } }),
      elapsed),
    ...w.entries.map((en, i) => entryCard(w, en, i, redraw)),
    h('button.btn.ghost.wide', { onclick: () => pickExercise(null, ex => { w.entries.push(newEntry(ex.id)); save({ silent: true }); redraw(); }) }, '+ Add exercise'),
    h('textarea.input.wide', { placeholder: 'Notes', rows: 2, value: w.notes, onchange: e => { w.notes = e.target.value; save({ silent: true }); } }),
    h('div.row.gap', { style: { margin: '12px 0 90px' } },
      h('button.btn.ghost.danger-text.grow', {
        onclick: async () => {
          if (!(await confirmSheet('Discard this workout? Nothing will be saved.', { ok: 'Discard', danger: true }))) return;
          state.active = null; stopRest(); save(); location.replace('#/train');
        },
      }, 'Discard'),
      h('button.btn.grow', { onclick: finish }, 'Finish workout')),
  );
  drawRest();
}

function entryCard(w, en, idx, redraw) {
  const ex = getExercise(en.exId);
  const sug = suggestion(en.exId, en.reps);
  const best = bestE1rm(en.exId);
  const last = historyFor(en.exId)[0];

  return h('section.card.exercise',
    h('div.ex-head',
      h('div.grow',
        h('h3', ex.name),
        h('div.small.muted', `${en.reps[0]}–${en.reps[1]} reps${best ? ` · best e1RM ${fmtW(best)}` : ''}`)),
      h('button.icon-btn', { title: 'Exercise options', onclick: () => exerciseMenu(w, en, idx, redraw) }, '⋯')),
    sug ? h('div.target' + (sug.up ? '.up' : ''), h('b', `Target: ${sug.w ? `${toDisplayW(sug.w)} ${unit()}` : 'BW'} × ${sug.r}`), h('span.small', ' — ' + sug.why), h('div.small.muted', 'Last time: ' + sug.lastLine)) : h('div.target.small.muted', 'First time — pick a weight you could do for ' + (en.reps[1] + 2) + ' reps.'),
    h('div.set-head', h('span', 'Set'), h('span', 'Previous'), h('span', unit()), h('span', 'Reps'), h('span', '')),
    ...en.sets.map((s, si) => setRow(en, s, si, sug, last, ex)),
    h('div.row.gap',
      h('button.btn.ghost.sm.grow', { onclick: () => { const prev = en.sets[en.sets.length - 1]; en.sets.push({ w: prev?.w ?? null, r: null, done: false }); save({ silent: true }); redraw(); } }, '+ Set'),
      en.sets.length > 1 ? h('button.btn.ghost.sm.grow', { onclick: () => { en.sets.pop(); save({ silent: true }); redraw(); } }, '− Set') : null));
}

function setRow(en, s, si, sug, last, ex) {
  const prev = last?.sets[si];
  const wIn = h('input.input.num', { type: 'number', inputmode: 'decimal', step: 'any', value: s.w != null ? toDisplayW(s.w) : '', placeholder: sug?.w ? toDisplayW(sug.w) : (ex.bw ? '0' : '') });
  const rIn = h('input.input.num', { type: 'number', inputmode: 'numeric', value: s.r ?? '', placeholder: sug ? sug.r : en.reps[1] });
  const rowEl = h('div.set-row' + (s.done ? '.done' : ''));
  const sync = () => {
    s.w = wIn.value === '' ? null : fromDisplayW(wIn.value);
    s.r = rIn.value === '' ? null : Math.round(+rIn.value);
    // Carry the weight down to empty sets below.
    if (s.w != null) for (let j = si + 1; j < en.sets.length; j++) if (en.sets[j].w == null && !en.sets[j].done) en.sets[j].w = s.w;
    save({ silent: true });
  };
  wIn.addEventListener('change', () => {
    sync();
    // Show the carried-down weight in every later empty row.
    let r = rowEl.nextElementSibling;
    for (let j = si + 1; r?.classList.contains('set-row'); j++, r = r.nextElementSibling) {
      const inp = r.querySelector('input');
      if (!inp.value && en.sets[j].w != null) inp.value = toDisplayW(en.sets[j].w);
    }
  });
  rIn.addEventListener('change', sync);
  const check = h('button.check-btn', {
    'aria-label': 'Complete set',
    onclick: () => {
      if (!s.done) {
        if (wIn.value === '') wIn.value = s.w != null ? toDisplayW(s.w) : wIn.placeholder;
        if (rIn.value === '' && rIn.placeholder !== '') rIn.value = rIn.placeholder;
        sync();
        if (!s.r) { toast('Enter reps first'); return; }
        s.done = true;
        unlockAudio();
        startRest(state.settings.restSec);
        const prevBest = bestE1rm(en.exId);
        if (prevBest && !en.prToasted && e1rm(s.w || 0, s.r) > prevBest + 0.01) { en.prToasted = true; toast('🏆 New estimated 1RM!'); }
      } else s.done = false;
      rowEl.classList.toggle('done', s.done);
      save({ silent: true });
    },
  }, '✓');
  rowEl.append(h('span.setno', si + 1), h('span.prev.small.muted', prev ? `${prev.w ? toDisplayW(prev.w) : 'BW'}×${prev.r}` : '–'), wIn, rIn, check);
  return rowEl;
}

function exerciseMenu(w, en, idx, redraw) {
  const ex = getExercise(en.exId);
  const s = openSheet(ex.name, h('div.menu',
    h('button.btn.ghost.wide', { onclick: () => { s.close(); pickExercise(ex.slot, nx => { en.exId = nx.id; en.reps = [...nx.reps]; save({ silent: true }); redraw(); }); } }, '⇄ Swap exercise'),
    h('button.btn.ghost.wide', { disabled: idx === 0, onclick: () => { move(w.entries, idx, -1); save({ silent: true }); s.close(); redraw(); } }, '↑ Move up'),
    h('button.btn.ghost.wide', { disabled: idx === w.entries.length - 1, onclick: () => { move(w.entries, idx, 1); save({ silent: true }); s.close(); redraw(); } }, '↓ Move down'),
    h('button.btn.ghost.wide', { onclick: () => { s.close(); showHistory(en.exId); } }, '📈 History'),
    h('button.btn.ghost.wide.danger-text', { onclick: () => { w.entries.splice(idx, 1); save({ silent: true }); s.close(); redraw(); } }, '✕ Remove from workout')));
}

export function showHistory(exId) {
  const hist = historyFor(exId);
  openSheet(getExercise(exId).name, hist.length ? hist.slice(0, 30).map(x => h('div.entry',
    h('div.grow', h('div', new Date(x.date + 'T12:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })), h('div.small.muted', x.sets.map(s => `${s.w ? toDisplayW(s.w) : 'BW'}×${s.r}`).join(', '))),
    h('div.small', `e1RM ${toDisplayW(Math.max(...x.sets.map(s => e1rm(s.w || 0, s.r)))) || '–'}`))) : h('p.muted', 'No history yet.'));
}

function finish() {
  const w = state.active;
  const entries = w.entries.map(en => ({ ...en, sets: en.sets.filter(s => s.done && s.r > 0) })).filter(en => en.sets.length);
  if (!entries.length) { toast('Complete at least one set (tap ✓) before finishing'); return; }
  const prs = [];
  for (const en of entries) {
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
  openSheet('Workout complete 💪', [
    h('div.macro-grid',
      h('div.mstat', h('div.big', Math.round((done.end - done.start) / 60000)), h('div.small.muted', 'minutes')),
      h('div.mstat', h('div.big', entries.reduce((a, e) => a + e.sets.length, 0)), h('div.small.muted', 'sets')),
      h('div.mstat', h('div.big', fmt(toDisplayW(volume))), h('div.small.muted', `${unit()} volume`)),
      h('div.mstat', h('div.big', prs.length), h('div.small.muted', 'PRs'))),
    prs.length ? h('div', h('div.section-label', 'New personal records'), prs.map(p => h('div', `🏆 ${getExercise(p.exId).name} — e1RM ${fmtW(p.e1rm)}`))) : null,
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
      h('button.icon-btn', { onclick: () => { restEnd -= 15000; restTotal = Math.max(1, restTotal - 15); update(); } }, '−15'),
      h('div.rest-time.grow'),
      h('button.icon-btn', { onclick: () => { restEnd += 15000; restTotal += 15; update(); } }, '+15'),
      h('button.btn.sm.ghost', { onclick: stopRest }, 'Skip'));
    document.body.append(el);
  }
  function update() {
    const left = Math.max(0, Math.round((restEnd - Date.now()) / 1000));
    el.querySelector('.rest-time').textContent = `Rest ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
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
