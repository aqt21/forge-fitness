// Builds a weekly routine from days/week, equipment, experience and session length.
// Each day is a template of movement slots; each slot gets the best exercise the
// equipment allows. Variant 1 picks the second-best option so A/B days differ.

import { EXERCISES, exerciseById } from './exercises.js';
import { state, uid } from './store.js';

// [slot, sets, variant]
const T = {
  fullA:  { name: 'Full Body A', slots: [['squat', 3, 0], ['h_push', 3, 0], ['h_pull', 3, 0], ['ham_curl', 2, 0], ['side_delt', 3, 0], ['triceps', 2, 0], ['calf', 2, 0], ['abs', 2, 0]] },
  fullB:  { name: 'Full Body B', slots: [['hinge', 3, 0], ['incline_push', 3, 0], ['v_pull', 3, 0], ['lunge', 2, 0], ['rear_delt', 2, 0], ['biceps', 2, 0], ['quad_iso', 2, 0], ['abs', 2, 1]] },
  fullC:  { name: 'Full Body C', slots: [['squat', 3, 1], ['v_push', 3, 0], ['h_pull', 3, 1], ['glute', 2, 0], ['chest_fly', 2, 0], ['side_delt', 2, 1], ['biceps', 2, 1], ['calf', 2, 1]] },
  upperA: { name: 'Upper A', slots: [['h_push', 3, 0], ['h_pull', 3, 0], ['v_push', 3, 0], ['v_pull', 3, 0], ['side_delt', 3, 0], ['biceps', 2, 0], ['triceps', 2, 0], ['rear_delt', 2, 0]] },
  upperB: { name: 'Upper B', slots: [['incline_push', 3, 0], ['v_pull', 3, 1], ['h_push', 3, 1], ['h_pull', 3, 1], ['side_delt', 3, 1], ['triceps', 2, 1], ['biceps', 2, 1], ['chest_fly', 2, 0]] },
  lowerA: { name: 'Lower A', slots: [['squat', 3, 0], ['hinge', 3, 1], ['quad_iso', 3, 0], ['ham_curl', 3, 0], ['calf', 3, 0], ['abs', 3, 0], ['glute', 2, 0]] },
  lowerB: { name: 'Lower B', slots: [['hinge', 3, 0], ['lunge', 3, 0], ['glute', 3, 0], ['ham_curl', 3, 1], ['quad_iso', 2, 1], ['calf', 3, 1], ['abs', 3, 1]] },
  push:   { name: 'Push', slots: [['h_push', 3, 0], ['incline_push', 3, 0], ['v_push', 3, 0], ['side_delt', 3, 0], ['chest_fly', 2, 0], ['triceps', 3, 0], ['triceps', 2, 1]] },
  pull:   { name: 'Pull', slots: [['v_pull', 3, 0], ['h_pull', 3, 0], ['h_pull', 3, 1], ['rear_delt', 3, 0], ['biceps', 3, 0], ['biceps', 2, 1], ['abs', 2, 0]] },
  legs:   { name: 'Legs', slots: [['squat', 3, 0], ['hinge', 3, 1], ['lunge', 2, 0], ['quad_iso', 3, 0], ['ham_curl', 3, 0], ['calf', 3, 0], ['abs', 2, 1]] },
  push2:  { name: 'Push 2', slots: [['incline_push', 3, 1], ['h_push', 3, 1], ['v_push', 3, 1], ['side_delt', 3, 1], ['chest_fly', 2, 1], ['triceps', 3, 1], ['triceps', 2, 2]] },
  pull2:  { name: 'Pull 2', slots: [['h_pull', 3, 2], ['v_pull', 3, 1], ['v_pull', 3, 2], ['rear_delt', 3, 1], ['biceps', 3, 1], ['biceps', 2, 2], ['abs', 2, 1]] },
  legs2:  { name: 'Legs 2', slots: [['hinge', 3, 0], ['squat', 3, 1], ['glute', 3, 0], ['ham_curl', 3, 1], ['quad_iso', 2, 1], ['calf', 3, 1], ['abs', 2, 0]] },
};

export const SPLITS = {
  2: { name: 'Full Body (2×/week)', days: ['fullA', 'fullB'], why: 'Each muscle trained twice a week across two full-body sessions.' },
  3: { name: 'Full Body (3×/week)', days: ['fullA', 'fullB', 'fullC'], why: 'Three varied full-body sessions — every muscle gets hit 2–3× per week.' },
  4: { name: 'Upper / Lower', days: ['upperA', 'lowerA', 'upperB', 'lowerB'], why: 'Each muscle trained twice a week with more volume per session.' },
  5: { name: 'Upper / Lower / Push / Pull / Legs', days: ['upperA', 'lowerA', 'push', 'pull', 'legs'], why: 'Hybrid split: twice-weekly frequency with extra volume.' },
  6: { name: 'Push / Pull / Legs ×2', days: ['push', 'pull', 'legs', 'push2', 'pull2', 'legs2'], why: 'Classic PPL run twice — high volume, each muscle twice a week.' },
};

const MAX_EXERCISES = { 45: 5, 60: 6, 75: 7, 90: 8 };

export function allExercises() { return [...EXERCISES, ...state.customExercises]; }
export function getExercise(id) { return exerciseById(id) || state.customExercises.find(e => e.id === id) || { id, name: 'Unknown exercise', slot: 'abs', equip: [], muscles: [], reps: [8, 12] }; }

export function hasEquip(ex, owned) { return (ex.equip || []).every(e => owned.includes(e)); }

export function availableFor(slot, owned) {
  return allExercises().filter(e => e.slot === slot && hasEquip(e, owned)).sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
}

export function generateRoutine({ days, equipment, experience = 'intermediate', minutes = 60 }) {
  const split = SPLITS[days];
  const cap = MAX_EXERCISES[minutes] || 6;
  const missing = new Set();
  const routineDays = split.days.map(key => {
    const tpl = T[key];
    const used = new Set();
    const exercises = [];
    for (const [slot, sets, variant] of tpl.slots) {
      if (exercises.length >= cap) break;
      const options = availableFor(slot, equipment).filter(e => !used.has(e.id));
      if (!options.length) { missing.add(slot); continue; }
      // Prefer loadable exercises; only fall back to bodyweight/band moves when nothing else fits.
      const loaded = options.filter(o => o.equip.length && !(o.equip.length === 1 && o.equip[0] === 'bands'));
      const pool = loaded.length ? loaded : options;
      const ex = pool[Math.min(variant, pool.length - 1)];
      used.add(ex.id);
      let s = sets;
      if (experience === 'beginner') s = ex.kind === 'compound' ? 3 : 2;
      if (experience === 'advanced' && exercises.length < 3) s += 1;
      exercises.push({ exId: ex.id, sets: s, reps: [...ex.reps] });
    }
    return { id: uid(), name: tpl.name, exercises };
  });
  return {
    id: uid(),
    name: `${split.name}`,
    description: split.why,
    meta: { days, equipment, experience, minutes },
    days: routineDays,
    missing: [...missing],
    createdAt: Date.now(),
  };
}

// Day that should come next in the rotation for a routine.
export function nextDayIndex(routine) {
  const last = [...state.workouts].reverse().find(w => w.routineId === routine.id);
  if (!last || !routine.days.length) return 0;
  const i = routine.days.findIndex(d => d.id === last.dayId);
  return i < 0 ? 0 : (i + 1) % routine.days.length;
}
