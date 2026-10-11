// Persistent app state, kept in localStorage on this device.
// All body weights and lift loads are stored in kilograms; the UI converts.

const KEY = 'forge.v1';
const LB = 0.45359237;

const DEFAULT_STATE = () => ({
  v: 1,
  settings: {
    units: 'lb',            // 'lb' | 'kg'
    sex: 'male',
    age: 30,
    heightCm: 178,
    activity: 1.55,
    goal: 'maintain',       // 'cut' | 'maintain' | 'bulk'
    rate: 0.5,              // % body weight per week for cut/bulk
    autoTargets: true,
    targets: { kcal: 2400, protein: 160, carbs: 260, fat: 75 },
    restSec: 120,
    usdaKey: '',
    equipment: [],
  },
  foods: {},                // id -> food (custom foods + foods you've logged)
  diary: {},                // 'YYYY-MM-DD' -> [entry]
  weights: {},              // 'YYYY-MM-DD' -> kg
  routines: [],
  activeRoutineId: null,
  workouts: [],             // completed sessions, newest last
  active: null,             // workout in progress
  customExercises: [],
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_STATE();
    const s = JSON.parse(raw);
    const d = DEFAULT_STATE();
    return { ...d, ...s, settings: { ...d.settings, ...s.settings, targets: { ...d.settings.targets, ...(s.settings?.targets || {}) } } };
  } catch (e) {
    console.error('Failed to load state', e);
    return DEFAULT_STATE();
  }
}

export const state = load();

const listeners = new Set();
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function save({ silent = false } = {}) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save', e);
    alert('Could not save your data (storage full or blocked). Export a backup from Settings.');
  }
  if (!silent) listeners.forEach(fn => fn());
}

export function replaceState(next) {
  const d = DEFAULT_STATE();
  const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const arr = v => (Array.isArray(v) ? v : []);
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, d, next, {
    settings: { ...d.settings, ...obj(next.settings), targets: { ...d.settings.targets, ...obj(next.settings?.targets) } },
    foods: obj(next.foods), diary: obj(next.diary), weights: obj(next.weights),
    routines: arr(next.routines), workouts: arr(next.workouts), customExercises: arr(next.customExercises),
  });
  save();
}

// Ask the browser not to evict our data (Safari clears unused site storage otherwise).
navigator.storage?.persist?.().catch(() => {});

export function resetState() { replaceState(DEFAULT_STATE()); }

// ---------- ids & dates ----------
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function ymd(d = new Date()) {
  const z = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
export function parseYmd(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
export function addDays(s, n) { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); }

// ---------- units ----------
export const unit = () => state.settings.units;
export function toDisplayW(kg) {
  if (kg == null || kg === '') return '';
  const v = unit() === 'lb' ? kg / LB : kg;
  return Math.round(v * 10) / 10;
}
export function fromDisplayW(v) {
  if (v === '' || v == null || isNaN(+v)) return null;
  return unit() === 'lb' ? +v * LB : +v;
}
export const fmtW = kg => (kg == null ? '–' : `${toDisplayW(kg)} ${unit()}`);
// Smallest sensible load jump in display units.
export const loadStep = () => (unit() === 'lb' ? 5 : 2.5);

// ---------- nutrition helpers ----------
export function dayEntries(date) { return state.diary[date] || (state.diary[date] = []); }

export function dayTotals(date) {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const e of state.diary[date] || []) {
    t.kcal += e.kcal || 0; t.protein += e.protein || 0; t.carbs += e.carbs || 0; t.fat += e.fat || 0;
  }
  return t;
}

// Latest body weight on or before a date.
export function weightOn(date = ymd()) {
  const keys = Object.keys(state.weights).filter(k => k <= date).sort();
  return keys.length ? state.weights[keys[keys.length - 1]] : null;
}

// Mifflin-St Jeor TDEE with a goal adjustment and simple macro split.
export function computeTargets(s = state.settings) {
  const kg = weightOn() ?? (s.sex === 'male' ? 80 : 65);
  const bmr = 10 * kg + 6.25 * s.heightCm - 5 * s.age + (s.sex === 'male' ? 5 : -161);
  const tdee = bmr * s.activity;
  // 1 kg of tissue change ≈ 7700 kcal
  const weekly = (s.rate / 100) * kg * 7700;
  let kcal = tdee;
  if (s.goal === 'cut') kcal -= weekly / 7;
  if (s.goal === 'bulk') kcal += weekly / 7;
  kcal = Math.round(kcal / 10) * 10;
  const protein = Math.round(kg * (s.goal === 'cut' ? 2.2 : 1.8));
  const fat = Math.round((kcal * 0.25) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, carbs, fat, tdee: Math.round(tdee), bmr: Math.round(bmr) };
}

export function targets() {
  return state.settings.autoTargets ? computeTargets() : state.settings.targets;
}

// ---------- lifting helpers ----------
export const e1rm = (w, r) => (r > 0 && w > 0 ? w * (1 + Math.min(r, 12) / 30) : 0);

// Every completed set for an exercise, newest session first.
export function historyFor(exId) {
  const out = [];
  for (let i = state.workouts.length - 1; i >= 0; i--) {
    const w = state.workouts[i];
    for (const en of w.entries) {
      if (en.exId === exId) {
        const sets = en.sets.filter(s => s.done && s.r > 0);
        if (sets.length) out.push({ date: w.date, workoutId: w.id, sets });
      }
    }
  }
  return out;
}

export function bestE1rm(exId) {
  let best = 0;
  for (const h of historyFor(exId)) for (const s of h.sets) best = Math.max(best, e1rm(s.w || 0, s.r));
  return best;
}
