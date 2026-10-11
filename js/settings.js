// Settings: profile → calorie/macro targets, units, rest timer, data backup.

import { state, save, computeTargets, weightOn, toDisplayW, unit, replaceState, resetState, ymd } from './store.js';
import { h, fill, fmt, toast, confirmSheet } from './ui.js';
import { icon } from './icons.js';

export function renderSettings(root) {
  const s = state.settings;
  // Only layout-changing settings re-render the page; other edits save quietly so the
  // next field you tap keeps focus.
  const STRUCTURAL = ['units', 'goal', 'autoTargets'];
  const set = (k, v) => { s[k] = v; if (STRUCTURAL.includes(k)) save(); else { save({ silent: true }); drawAuto(); } };
  const auto = h('div');
  function drawAuto() {
    const ct = computeTargets();
    fill(auto,
      h('div.macro-grid',
        ...[['kcal', 'kcal'], ['protein', 'protein g'], ['carbs', 'carbs g'], ['fat', 'fat g']].map(([k, l]) => h('div.mstat', h('div.big', fmt(ct[k])), h('div.small.muted', l)))),
      h('p.small.muted', `Estimated maintenance ≈ ${fmt(ct.tdee)} kcal/day (BMR ${fmt(ct.bmr)}). Targets update as your weight changes. Watch your weight trend for 2–3 weeks and adjust if it isn't moving as planned.`),
      h('button.btn.ghost.sm', { onclick: () => { s.targets = { kcal: ct.kcal, protein: ct.protein, carbs: ct.carbs, fat: ct.fat }; s.autoTargets = false; save(); } }, 'Customize these numbers'));
  }
  drawAuto();
  const bw = weightOn();

  const sel = (key, opts, cast = String) => h('select.input', { onchange: e => set(key, cast(e.target.value)) },
    opts.map(([v, l]) => h('option', { value: v, selected: s[key] === v }, l)));
  const numIn = (key, attrs = {}) => h('input.input', { type: 'number', inputmode: 'decimal', value: s[key], onchange: e => set(key, +e.target.value || s[key]), ...attrs });

  const heightIn = unit() === 'lb'
    ? (() => {
      const total = Math.round(s.heightCm / 2.54);
      const ft = h('input.input', { type: 'number', value: Math.floor(total / 12) });
      const inch = h('input.input', { type: 'number', value: total % 12 });
      const upd = () => set('heightCm', ((+ft.value || 0) * 12 + (+inch.value || 0)) * 2.54);
      ft.onchange = upd; inch.onchange = upd;
      return h('div.row.gap', h('label.grow', 'Height (ft)', ft), h('label.grow', 'in', inch));
    })()
    : h('label', 'Height (cm)', numIn('heightCm'));

  const manual = {};
  for (const k of ['kcal', 'protein', 'carbs', 'fat']) manual[k] = h('input.input', { type: 'number', inputmode: 'numeric', value: Math.round(s.targets[k]), onchange: e => { s.targets[k] = +e.target.value || 0; save({ silent: true }); } });

  const fileIn = h('input', { type: 'file', accept: 'application/json', style: { display: 'none' } });
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files[0];
    if (!f) return;
    fileIn.value = ''; // so picking the same file again still fires
    try {
      const data = JSON.parse(await f.text());
      if (!data || typeof data !== 'object' || !data.settings) throw new Error('Not a Forge backup');
      if (!(await confirmSheet('Replace ALL data on this device with this backup?', { ok: 'Restore', danger: true }))) return;
      replaceState(data);
      toast('Backup restored');
    } catch (e) { toast('Restore failed: ' + e.message); }
  });

  fill(root, 
    h('section.card.form',
      h('h3', icon('user', 18), 'Profile'),
      h('div.grid2',
        h('label', 'Units', sel('units', [['lb', 'Pounds (lb)'], ['kg', 'Kilograms (kg)']])),
        h('label', 'Sex', sel('sex', [['male', 'Male'], ['female', 'Female']]))),
      h('div.grid2', h('label', 'Age', numIn('age')), heightIn),
      h('label', 'Activity (outside the gym)', sel('activity', [[1.35, 'Mostly sitting'], [1.45, 'Lightly active'], [1.55, 'Moderately active'], [1.7, 'Very active'], [1.85, 'Physical job + training']], Number)),
      h('p.small.muted', bw ? `Using your latest weigh-in: ${toDisplayW(bw)} ${unit()}` : 'Log your weight on the Food tab for accurate targets.')),

    h('section.card.form',
      h('h3', icon('target', 18), 'Goal & targets'),
      h('div.grid2',
        h('label', 'Goal', sel('goal', [['cut', 'Lose fat'], ['maintain', 'Maintain'], ['bulk', 'Build muscle']])),
        s.goal !== 'maintain' ? h('label', 'Rate (% body weight / week)', sel('rate', [[0.25, '0.25% (slow)'], [0.5, '0.5% (moderate)'], [0.75, '0.75%'], [1, '1% (aggressive)']], Number)) : h('div')),
      h('label.check', h('input', { type: 'checkbox', checked: s.autoTargets, onchange: e => set('autoTargets', e.target.checked) }), h('span', 'Calculate targets automatically')),
      s.autoTargets
        ? auto
        : h('div.grid2',
          h('label', 'Calories', manual.kcal), h('label', 'Protein (g)', manual.protein),
          h('label', 'Carbs (g)', manual.carbs), h('label', 'Fat (g)', manual.fat))),

    h('section.card.form',
      h('h3', icon('dumbbell', 18), 'Training'),
      h('label', 'Default rest timer', sel('restSec', [[60, '1:00'], [90, '1:30'], [120, '2:00'], [150, '2:30'], [180, '3:00'], [240, '4:00']], Number))),

    h('section.card.form',
      h('h3', icon('search', 18), 'Food search'),
      h('label', 'USDA API key (optional)', h('input.input', { value: s.usdaKey, placeholder: 'Uses a shared demo key if empty', onchange: e => set('usdaKey', e.target.value.trim()) })),
      h('p.small.muted', 'Generic-food search uses USDA FoodData Central. The shared demo key is rate-limited; a free personal key from api.data.gov removes the limit. Barcodes use Open Food Facts (no key needed).')),

    h('section.card.form',
      h('h3', icon('download', 18), 'Your data'),
      h('p.small.muted', 'Everything is stored only on this device, in this browser. Export a backup regularly — clearing browser data deletes it.'),
      h('div.row.gap',
        h('button.btn.grow', {
          onclick: async () => {
            const name = `forge-backup-${ymd()}.json`;
            const blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' });
            // Home-screen apps on iPhone can't use download links; the share sheet ("Save to Files") works.
            const file = new File([blob], name, { type: 'application/json' });
            if (navigator.canShare?.({ files: [file] })) {
              try { await navigator.share({ files: [file], title: 'Forge backup' }); return; } catch (e) { if (e.name === 'AbortError') return; }
            }
            const url = URL.createObjectURL(blob);
            const a = h('a', { href: url, download: name });
            document.body.append(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
          },
        }, 'Export backup'),
        h('button.btn.ghost.grow', { onclick: () => fileIn.click() }, 'Restore backup')),
      fileIn,
      h('button.btn.ghost.danger-text.wide', {
        onclick: async () => {
          if (!(await confirmSheet('Erase all food logs, workouts, routines and settings on this device?', { ok: 'Erase everything', danger: true }))) return;
          resetState(); toast('All data erased');
        },
      }, 'Erase all data')),
  );
}
