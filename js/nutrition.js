// Food diary: daily totals, meals, add food via search / barcode / recent / custom / quick add.

import { state, save, uid, ymd, addDays, parseYmd, dayEntries, dayTotals, targets, fmtW, fromDisplayW, toDisplayW, unit } from './store.js';
import { h, fill, fmt, openSheet, toast, bar, confirmSheet } from './ui.js';
import { lookupBarcode, searchLocal, searchOnline } from './foodapi.js';
import { mountScanner, scanFile } from './scanner.js';

const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
let viewDate = null; // null = always today
document.addEventListener('visibilitychange', () => { if (!document.hidden && location.hash.startsWith('#/food')) { const v = document.getElementById('view'); if (v) renderToday(v); } });

export function renderToday(root) {
  const date = viewDate || ymd();
  const t = dayTotals(date), tg = targets();
  const remaining = tg.kcal - t.kcal;
  const pct = Math.min(1, t.kcal / (tg.kcal || 1));
  const today = ymd();

  fill(root, 
    h('div.datebar',
      h('button.icon-btn', { onclick: () => { viewDate = addDays(date, -1); rerender(root); }, 'aria-label': 'Previous day' }, '‹'),
      h('button.datebtn', { onclick: () => { viewDate = null; rerender(root); } }, dateLabel(date)),
      h('button.icon-btn', { onclick: () => { const n = addDays(date, 1); viewDate = n >= ymd() ? null : n; rerender(root); }, 'aria-label': 'Next day', disabled: date >= today }, '›')),

    h('section.card.summary',
      h('div.ring', { style: { '--p': pct, '--c': remaining < 0 ? 'var(--bad)' : 'var(--accent)' } },
        h('div.ring-inner',
          h('div.big', fmt(Math.abs(remaining))),
          h('div.muted.small', remaining < 0 ? 'kcal over' : 'kcal left'))),
      h('div.summary-side',
        h('div.kv', h('span.muted', 'Eaten'), h('b', fmt(t.kcal))),
        h('div.kv', h('span.muted', 'Target'), h('b', fmt(tg.kcal))),
        bar('Protein', t.protein, tg.protein, 'g', 'p'),
        bar('Carbs', t.carbs, tg.carbs, 'g', 'c'),
        bar('Fat', t.fat, tg.fat, 'g', 'f'))),

    installTip(root),
    weightCard(root, date),

    ...MEALS.map(meal => mealCard(root, date, meal)),
  );
}

function rerender(root) { renderToday(root); }

function dateLabel(d) {
  const t = ymd();
  if (d === t) return 'Today';
  if (d === addDays(t, -1)) return 'Yesterday';
  return parseYmd(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

// Safari can clear data for sites not added to the Home Screen, so nudge people to install.
function installTip(root) {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  let hidden = false;
  try { hidden = localStorage.getItem('forge.hideInstall') === '1'; } catch {}
  if (standalone || hidden) return null;
  const ios = /iPhone|iPad/.test(navigator.userAgent);
  return h('section.card.row.gap.center.tip',
    h('div.grow.small', h('b', 'Install Forge: '), ios ? 'tap Share → "Add to Home Screen". ' : 'use your browser menu → "Install app" / "Add to Home screen". ',
      h('span.muted', 'It opens full-screen and keeps your data safe.')),
    h('button.icon-btn', { 'aria-label': 'Dismiss', onclick: () => { try { localStorage.setItem('forge.hideInstall', '1'); } catch {} rerender(root); } }, '✕'));
}

function weightCard(root, date) {
  const kg = state.weights[date];
  const input = h('input.input', { type: 'number', inputmode: 'decimal', step: '0.1', placeholder: unit(), value: kg != null ? toDisplayW(kg) : '' });
  return h('section.card.row.gap.center.weigh',
    h('div.grow', h('div.small.muted', 'Weigh-in'), kg != null ? h('b', fmtW(kg)) : h('span.muted', 'Not logged')),
    input,
    h('button.btn.sm', {
      onclick: () => {
        const v = fromDisplayW(input.value);
        if (v == null || v <= 0) { delete state.weights[date]; } else state.weights[date] = v;
        save(); toast('Weight saved');
      },
    }, 'Save'));
}

function mealCard(root, date, meal) {
  const entries = (state.diary[date] || []).filter(e => e.meal === meal);
  const kcal = entries.reduce((s, e) => s + (e.kcal || 0), 0);
  return h('section.card.meal',
    h('div.meal-head',
      h('h3', meal),
      h('span.muted', entries.length ? `${fmt(kcal)} kcal` : ''),
      h('div.grow'),
      entries.length || !(state.diary[addDays(date, -1)] || []).some(e => e.meal === meal) ? null : h('button.btn.ghost.sm', { onclick: () => copyMeal(date, meal) }, 'Copy yesterday'),
      h('button.btn.sm', { onclick: () => openAddFood(date, meal) }, '+ Add')),
    entries.map(e => h('button.entry', { onclick: () => openEntry(e, date) },
      h('div.grow',
        h('div', e.name),
        h('div.muted.small', [e.brand, e.amountLabel].filter(Boolean).join(' · '))),
      h('div.right',
        h('div', fmt(e.kcal)),
        h('div.muted.small', `${fmt(e.protein)}P ${fmt(e.carbs)}C ${fmt(e.fat)}F`)))));
}

function copyMeal(date, meal) {
  const prev = (state.diary[addDays(date, -1)] || []).filter(e => e.meal === meal);
  if (!prev.length) return toast(`Nothing logged for ${meal.toLowerCase()} yesterday`);
  dayEntries(date).push(...prev.map(e => ({ ...e, id: uid(), ts: Date.now() })));
  save();
  toast(`Copied ${prev.length} item${prev.length > 1 ? 's' : ''}`);
}

// ---------- add food ----------

export function openAddFood(date, meal) {
  const tabs = ['Search', 'Scan', 'Recent', 'My foods', 'Quick add'];
  let active = 'Search', scanner = null;
  const content = h('div');
  const tabBar = h('div.tabs');
  const sheet = openSheet(`Add to ${meal}`, [tabBar, content], { full: true, onClose: () => scanner?.stop() });

  function show(tab) {
    scanner?.stop(); scanner = null;
    active = tab;
    fill(tabBar, ...tabs.map(t => h('button.tab' + (t === active ? '.on' : ''), { onclick: () => show(t) }, t)));
    if (tab === 'Search') fill(content, searchPane());
    if (tab === 'Scan') fill(content, scanPane());
    if (tab === 'Recent') fill(content, listPane(recentFoods(), 'Foods you log will show up here.'));
    if (tab === 'My foods') fill(content, h('button.btn.wide', { onclick: () => openFoodEditor(null, f => pick(f)) }, '+ Create custom food'),
      listPane(Object.values(state.foods).filter(f => f.custom).sort((a, b) => a.name.localeCompare(b.name)), 'No custom foods yet.'));
    if (tab === 'Quick add') fill(content, quickAddPane());
  }

  const pick = food => openFoodDetail(food, { date, meal, onDone: () => sheet.close() });

  function foodRow(f) {
    const serving = f.servings?.[0];
    const basis = serving ? serving.grams / 100 : 1;
    return h('button.entry', { onclick: () => pick(f) },
      h('div.grow',
        h('div', f.name),
        h('div.muted.small', [f.brand, serving ? serving.label : '100 g'].filter(Boolean).join(' · '))),
      h('div.right', h('div', fmt(f.per100.kcal * basis)), h('div.muted.small', 'kcal')));
  }

  function listPane(foods, empty) {
    return foods.length ? h('div.list', foods.map(foodRow)) : h('p.muted.pad', empty);
  }

  function searchPane() {
    const input = h('input.input.wide', { type: 'search', placeholder: 'Search foods (e.g. "greek yogurt", "chicken breast")', enterkeyhint: 'search' });
    const results = h('div');
    let ctrl, timer;
    async function run() {
      const q = input.value.trim();
      ctrl?.abort();
      if (q.length < 2) { fill(results); return; }
      const local = searchLocal(q);
      const localSec = local.length ? [h('div.section-label', 'Your foods'), h('div.list', local.map(foodRow))] : [];
      fill(results, ...localSec, h('p.muted.pad', 'Searching online…'));
      ctrl = new AbortController();
      const signal = ctrl.signal;
      try {
        const { usda, off, errors } = await searchOnline(q, signal);
        if (signal.aborted || input.value.trim() !== q) return;
        fill(results, ...localSec,
          usda.length ? h('div.section-label', 'Generic foods (USDA)') : null,
          usda.length ? h('div.list', usda.map(foodRow)) : null,
          off.length ? h('div.section-label', 'Branded foods (Open Food Facts)') : null,
          off.length ? h('div.list', off.map(foodRow)) : null,
          !usda.length && !off.length ? h('p.muted.pad', 'No matches online. Try different words, scan the barcode, or create a custom food.') : null,
          errors.length ? h('p.small.warn.pad', errors.join(' · ')) : null);
      } catch (e) {
        if (e.name !== 'AbortError') fill(results, ...localSec, h('p.warn.pad', 'Search failed: ' + e.message));
      }
    }
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 450); });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { clearTimeout(timer); run(); input.blur(); } });
    setTimeout(() => input.focus(), 250);
    return h('div', input, results);
  }

  function scanPane() {
    const cam = h('div');
    const status = h('div.pad.small');
    const manual = h('input.input.grow', { type: 'text', inputmode: 'numeric', placeholder: 'Or type barcode digits' });
    const fileIn = h('input', { type: 'file', accept: 'image/*', capture: 'environment', style: { display: 'none' } });

    async function handle(code) {
      fill(status, h('span.muted', `Looking up ${code}…`));
      try {
        const food = await lookupBarcode(code);
        if (!food) {
          fill(status, h('div.warn', `Barcode ${code} isn't in the database yet.`),
            h('button.btn.sm', { style: { marginTop: '8px' }, onclick: () => openFoodEditor({ barcode: code }, f => pick(f)) }, 'Create it from the label'),
            h('button.btn.ghost.sm', { style: { marginTop: '8px', marginLeft: '8px' }, onclick: () => show('Scan') }, 'Scan again'));
          return;
        }
        fill(status, h('button.btn.ghost.sm', { onclick: () => show('Scan') }, 'Scan another'));
        if (food.missingNutrition) {
          toast('Found it, but nutrition info is missing — fill it in from the label');
          openFoodEditor({ ...food, custom: true }, f => pick(f));
        } else pick(food);
      } catch (e) {
        fill(status, h('div.warn', 'Lookup failed: ' + e.message), h('button.btn.ghost.sm', { onclick: () => show('Scan') }, 'Try again'));
      }
    }

    fileIn.addEventListener('change', async () => {
      const f = fileIn.files[0];
      if (!f) return;
      fill(status, h('span.muted', 'Reading photo…'));
      try { handle(await scanFile(f)); } catch { fill(status, h('div.warn', 'No barcode found in that photo. Try a closer, sharper shot.')); }
    });

    scanner = mountScanner(cam, code => handle(code), msg => fill(cam, h('p.warn.pad', msg)));
    return h('div',
      cam, status,
      h('div.row.gap', manual, h('button.btn', { onclick: () => manual.value.trim() && handle(manual.value.replace(/\D/g, '')) }, 'Look up')),
      h('button.btn.ghost.wide', { style: { marginTop: '10px' }, onclick: () => fileIn.click() }, '📷 Scan from a photo instead'),
      fileIn);
  }

  function quickAddPane() {
    const f = { name: h('input.input', { placeholder: 'Description (optional)' }) };
    for (const k of ['kcal', 'protein', 'carbs', 'fat']) f[k] = h('input.input', { type: 'number', inputmode: 'decimal', placeholder: '0' });
    return h('div.form',
      h('label', 'Name', f.name),
      h('div.grid2',
        h('label', 'Calories', f.kcal), h('label', 'Protein (g)', f.protein),
        h('label', 'Carbs (g)', f.carbs), h('label', 'Fat (g)', f.fat)),
      h('p.muted.small', 'Leave calories blank to calculate from macros.'),
      h('button.btn.wide', {
        onclick: () => {
          const v = k => +f[k].value || 0;
          const kcal = f.kcal.value ? v('kcal') : v('protein') * 4 + v('carbs') * 4 + v('fat') * 9;
          if (!kcal) return toast('Enter calories or macros');
          dayEntries(date).push({ id: uid(), ts: Date.now(), meal, name: f.name.value.trim() || 'Quick add', kcal, protein: v('protein'), carbs: v('carbs'), fat: v('fat'), quick: true });
          save(); toast('Added'); sheet.close();
        },
      }, 'Add'));
  }

  show(active);
}

function recentFoods() {
  return Object.values(state.foods).filter(f => f.lastUsed).sort((a, b) => b.lastUsed - a.lastUsed).slice(0, 40);
}

// ---------- amount picker ----------

function unitOptions(food) {
  return [...(food.servings || []), { label: 'g', grams: 1 }, { label: 'oz', grams: 28.3495 }];
}

export function openFoodDetail(food, { date, meal, entry = null, onDone }) {
  const opts = unitOptions(food);
  let unitIdx = 0;
  if (entry) unitIdx = Math.max(0, opts.findIndex(o => o.label === entry.unitLabel));
  const amount = h('input.input', { type: 'number', inputmode: 'decimal', step: 'any', value: entry ? entry.amount : (opts[0].grams === 1 ? 100 : 1) });
  const unitSel = h('select.input', opts.map((o, i) => h('option', { value: i, selected: i === unitIdx }, o.label)));
  const mealSel = h('select.input', MEALS.map(m => h('option', { value: m, selected: m === (entry?.meal || meal) }, m)));
  const out = h('div.macro-grid');

  function calc() {
    const o = opts[+unitSel.value];
    const grams = (+amount.value || 0) * o.grams;
    const k = grams / 100;
    return { grams, o, kcal: food.per100.kcal * k, protein: food.per100.protein * k, carbs: food.per100.carbs * k, fat: food.per100.fat * k };
  }
  function update() {
    const c = calc();
    fill(out, 
      ...[['kcal', 'Calories'], ['protein', 'Protein'], ['carbs', 'Carbs'], ['fat', 'Fat']].map(([k, l]) =>
        h('div.mstat', h('div.big', fmt(c[k], k === 'kcal' ? 0 : 1)), h('div.muted.small', l))));
  }
  let prevIdx = +unitSel.value;
  unitSel.addEventListener('change', () => {
    // Keep the same quantity of food when switching units.
    const grams = (+amount.value || 0) * opts[prevIdx].grams, o = opts[+unitSel.value];
    amount.value = +(grams / o.grams).toFixed(o.grams === 1 ? 0 : 2) || (o.grams === 1 ? 100 : 1);
    prevIdx = +unitSel.value;
    update();
  });
  amount.addEventListener('input', update);
  update();

  const sheet = openSheet(food.name, [
    h('p.muted.small', [food.brand, food.source, food.barcode ? 'Barcode ' + food.barcode : null].filter(Boolean).join(' · ')),
    out,
    h('div.row.gap', h('label.grow', 'Amount', amount), h('label.grow', 'Unit', unitSel)),
    h('label', 'Meal', mealSel),
    h('p.muted.small', `Per 100 g: ${fmt(food.per100.kcal)} kcal · ${fmt(food.per100.protein, 1)}P ${fmt(food.per100.carbs, 1)}C ${fmt(food.per100.fat, 1)}F`),
    h('div.row.gap',
      entry ? h('button.btn.danger.grow', { onclick: () => { removeEntry(date, entry.id); sheet.close(); onDone?.(); } }, 'Delete') : null,
      h('button.btn.ghost', { onclick: () => openFoodEditor({ ...food, custom: true }, f => { sheet.close(); openFoodDetail(f, { date, meal, entry, onDone }); }) }, 'Edit food'),
      h('button.btn.grow', {
        onclick: () => {
          const c = calc();
          if (!c.grams) return toast('Enter an amount');
          const stored = state.foods[food.id] = { ...food, lastUsed: Date.now(), lastUnit: c.o.label };
          const e = {
            id: entry?.id || uid(), ts: entry?.ts || Date.now(), meal: mealSel.value,
            foodId: stored.id, name: food.name, brand: food.brand, per100: food.per100,
            amount: +amount.value, unitLabel: c.o.label, unitGrams: c.o.grams, grams: c.grams,
            amountLabel: `${fmt(+amount.value, 2)} ${c.o.label}`,
            kcal: c.kcal, protein: c.protein, carbs: c.carbs, fat: c.fat,
          };
          const list = dayEntries(date);
          const i = list.findIndex(x => x.id === e.id);
          if (i >= 0) list[i] = e; else list.push(e);
          save();
          toast(entry ? 'Updated' : `Added to ${e.meal}`);
          sheet.close();
          onDone?.();
        },
      }, entry ? 'Save' : 'Add')),
  ]);
}

function openEntry(e, date) {
  if (e.quick) {
    const s = openSheet(e.name, [
      h('p', `${fmt(e.kcal)} kcal · ${fmt(e.protein)}P ${fmt(e.carbs)}C ${fmt(e.fat)}F`),
      h('button.btn.danger.wide', { onclick: () => { removeEntry(date, e.id); s.close(); } }, 'Delete'),
    ]);
    return;
  }
  const food = state.foods[e.foodId] || { id: e.foodId || uid(), name: e.name, brand: e.brand, per100: e.per100, servings: e.unitLabel && !['g', 'oz'].includes(e.unitLabel) ? [{ label: e.unitLabel, grams: e.unitGrams }] : [] };
  openFoodDetail(food, { date, meal: e.meal, entry: e });
}

function removeEntry(date, id) {
  state.diary[date] = (state.diary[date] || []).filter(x => x.id !== id);
  save();
  toast('Removed');
}

// ---------- custom food editor (values entered per serving, like a nutrition label) ----------

export function openFoodEditor(food, onSaved) {
  const sv = food?.servings?.[0];
  const g = sv?.grams || 100;
  const per = k => (food?.per100 ? +(food.per100[k] * g / 100).toFixed(1) : '');
  const f = {
    name: h('input.input', { value: food?.name || '', placeholder: 'e.g. Protein bar' }),
    brand: h('input.input', { value: food?.brand && food.brand !== 'USDA' ? food.brand : '', placeholder: 'Optional' }),
    barcode: h('input.input', { value: food?.barcode || '', inputmode: 'numeric', placeholder: 'Optional' }),
    servingLabel: h('input.input', { value: sv ? sv.label.replace(/^1 serving \((.*)\)$/, '$1') : '', placeholder: 'e.g. 1 bar' }),
    grams: h('input.input', { type: 'number', inputmode: 'decimal', value: g }),
  };
  for (const k of ['kcal', 'protein', 'carbs', 'fat']) f[k] = h('input.input', { type: 'number', inputmode: 'decimal', value: per(k) });

  const s = openSheet(food?.id ? 'Edit food' : 'New food', h('div.form',
    h('label', 'Name', f.name),
    h('div.grid2', h('label', 'Brand', f.brand), h('label', 'Barcode', f.barcode)),
    h('div.grid2', h('label', 'Serving name', f.servingLabel), h('label', 'Serving size (g or ml)', f.grams)),
    h('p.muted.small', 'Nutrition per serving (copy from the label):'),
    h('div.grid2',
      h('label', 'Calories', f.kcal), h('label', 'Protein (g)', f.protein),
      h('label', 'Carbs (g)', f.carbs), h('label', 'Fat (g)', f.fat)),
    h('button.btn.wide', {
      onclick: () => {
        const name = f.name.value.trim();
        const grams = +f.grams.value;
        if (!name) return toast('Give it a name');
        if (!(grams > 0)) return toast('Serving size must be more than 0');
        const k = 100 / grams;
        const label = f.servingLabel.value.trim();
        const isNew = !food?.id || !food.id.startsWith('custom:');
        const saved = {
          id: isNew ? 'custom:' + uid() : food.id,
          custom: true,
          name, brand: f.brand.value.trim(), barcode: f.barcode.value.replace(/\D/g, '') || undefined,
          per100: { kcal: (+f.kcal.value || 0) * k, protein: (+f.protein.value || 0) * k, carbs: (+f.carbs.value || 0) * k, fat: (+f.fat.value || 0) * k },
          servings: [{ label: label ? `${label} (${grams} g)` : `1 serving (${grams} g)`, grams }],
          source: 'Custom',
          lastUsed: food?.lastUsed,
        };
        state.foods[saved.id] = saved;
        save();
        toast('Food saved');
        s.close();
        onSaved?.(saved);
      },
    }, 'Save food'),
    food?.id?.startsWith('custom:') ? h('button.btn.ghost.wide.danger-text', {
      onclick: async () => {
        if (!(await confirmSheet(`Delete "${food.name}" from your foods? Diary entries stay.`, { ok: 'Delete', danger: true }))) return;
        delete state.foods[food.id]; save(); s.close();
      },
    }, 'Delete food') : null));
}
