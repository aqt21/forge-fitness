// Food diary: daily totals, meals, add food via search / barcode / recent / custom / quick add.

import { state, save, uid, ymd, addDays, parseYmd, dayEntries, dayTotals, targets, fmtW, fromDisplayW, toDisplayW, unit } from './store.js';
import { h, fill, fmt, openSheet, toast, confirmSheet } from './ui.js';
import { icon } from './icons.js';
import { lookupBarcode, searchLocal, searchOnline } from './foodapi.js';
import { mountScanner, scanFile } from './scanner.js';

const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
let viewDate = null; // null = always today
document.addEventListener('visibilitychange', () => { if (!document.hidden && location.hash.startsWith('#/food')) { const v = document.getElementById('view'); if (v) renderToday(v); } });

const MEAL_ICONS = { Breakfast: 'sunrise', Lunch: 'sun', Dinner: 'moon', Snacks: 'apple' };
const num = n => Math.round(n || 0).toLocaleString();

// Ring shows calories left by default; tap it to show calories eaten (remembered per device).
let ringMode = 'left';
try { ringMode = localStorage.getItem('forge.ringMode') || 'left'; } catch {}

export function renderToday(root) {
  const date = viewDate || ymd();
  const t = dayTotals(date), tg = targets();
  const remaining = tg.kcal - t.kcal;
  const today = ymd();

  fill(root,
    h('div.datebar',
      h('button.icon-btn', { onclick: () => { viewDate = addDays(date, -1); rerender(root); }, 'aria-label': 'Previous day' }, icon('left', 22)),
      h('button.datepill', { onclick: () => { viewDate = null; rerender(root); } }, icon('calendar', 16), dateLabel(date)),
      h('button.icon-btn', { onclick: () => { const n = addDays(date, 1); viewDate = n >= ymd() ? null : n; rerender(root); }, 'aria-label': 'Next day', disabled: date >= today }, icon('right', 22))),

    h('section.card.summary',
      h('button.ring-btn', {
        'aria-label': `${num(Math.abs(remaining))} kcal ${remaining < 0 ? 'over' : 'left'}, ${num(t.kcal)} eaten. Tap to switch view.`,
        onclick: () => { ringMode = ringMode === 'left' ? 'eaten' : 'left'; try { localStorage.setItem('forge.ringMode', ringMode); } catch {} rerender(root); },
      }, ring(t.kcal / (tg.kcal || 1), remaining < 0),
        h('div.ring-center',
          h('div.ring-num', ringMode === 'left' ? num(Math.abs(remaining)) : num(t.kcal)),
          h('div.ring-l', ringMode === 'left' ? (remaining < 0 ? 'kcal over' : 'kcal left') : `of ${num(tg.kcal)} kcal`))),
      h('div.macros',
        macroRow('Protein', 'p', t.protein, tg.protein),
        macroRow('Carbs', 'c', t.carbs, tg.carbs),
        macroRow('Fat', 'f', t.fat, tg.fat))),
    h('div.kcal-eq',
      eqItem(num(tg.kcal), 'Target'), h('span.eq-op', '−'), eqItem(num(t.kcal), 'Eaten'), h('span.eq-op', '='),
      eqItem(num(remaining), 'Left', remaining < 0 ? 'bad' : 'good')),

    installTip(root),
    weightCard(root, date),

    ...MEALS.map(meal => mealCard(root, date, meal)),
  );
}

function ring(pct, over) {
  const r = 52, c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct));
  const svg = `<svg viewBox="0 0 120 120" class="ring-svg"><circle cx="60" cy="60" r="${r}" class="ring-track"/>` +
    `<circle cx="60" cy="60" r="${r}" class="ring-bar${over ? ' over' : ''}" stroke-dasharray="${(c * p).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 60 60)"/></svg>`;
  return h('div', { html: svg });
}

function macroRow(label, cls, v, target) {
  const pct = target > 0 ? Math.min(100, (v / target) * 100) : 0;
  return h(`div.macro.${cls}`,
    h('div.macro-top', h('span.macro-name', h('i.dot'), label), h('span.macro-v', h('b', Math.round(v || 0)), ` / ${Math.round(target)}g`)),
    h('div.track', h('div.fill', { style: { width: pct + '%' } })));
}

function eqItem(v, l, cls = '') {
  return h('div.eq' + (cls ? '.' + cls : ''), h('b', v), h('span', l));
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
  return h('section.card.tip',
    h('div.tip-ic', icon('download', 18)),
    h('div.grow.small', h('b', 'Install Forge'), h('div.muted', ios ? 'Tap Share → "Add to Home Screen" so it opens full-screen and your data stays safe.' : 'Use your browser menu → "Install app" so it opens full-screen and your data stays safe.')),
    h('button.icon-btn', { 'aria-label': 'Dismiss', onclick: () => { try { localStorage.setItem('forge.hideInstall', '1'); } catch {} rerender(root); } }, icon('x', 18)));
}

function weightCard(root, date) {
  const kg = state.weights[date];
  const input = h('input.input.weigh-in', { type: 'number', inputmode: 'decimal', step: '0.1', placeholder: unit(), 'aria-label': `Body weight in ${unit()}`, value: kg != null ? toDisplayW(kg) : '' });
  return h('section.card.weigh',
    h('div.tip-ic.weigh-ic', icon('scale', 18)),
    h('div.grow', h('div.row-title', 'Weigh-in'), h('div.row-meta', kg != null ? `Logged ${fmtW(kg)}` : 'Not logged yet')),
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
  const sum = k => entries.reduce((s, e) => s + (e[k] || 0), 0);
  const canCopy = !entries.length && (state.diary[addDays(date, -1)] || []).some(e => e.meal === meal);
  return h('section.card.meal',
    h('div.meal-head',
      h(`div.meal-ic.m-${meal.toLowerCase()}`, icon(MEAL_ICONS[meal], 18)),
      h('div.grow',
        h('div.meal-name', meal),
        entries.length ? h('div.row-meta', `P ${Math.round(sum('protein'))}g · C ${Math.round(sum('carbs'))}g · F ${Math.round(sum('fat'))}g`) : h('div.row-meta', 'Nothing logged')),
      entries.length ? h('div.meal-kcal', h('b', num(sum('kcal'))), h('span', 'kcal')) : null),
    entries.length ? h('div.food-list', entries.map(e => h('button.food-row', { onclick: () => openEntry(e, date) },
      h('div.grow',
        h('div.food-name', e.name),
        h('div.row-meta', [e.amountLabel, e.brand].filter(Boolean).join(' · '))),
      h('div.food-kcal', num(e.kcal))))) : null,
    h('div.meal-foot',
      h('button.add-food', { onclick: () => openAddFood(date, meal) }, icon('plus', 18), 'Add food'),
      canCopy ? h('button.foot-btn', { onclick: () => copyMeal(date, meal) }, icon('copy', 16), 'Copy yesterday') : null,
      h('button.foot-icon', { 'aria-label': `Scan a barcode for ${meal}`, onclick: () => openAddFood(date, meal, 'Scan') }, icon('barcode', 20))));
}

function copyMeal(date, meal) {
  const prev = (state.diary[addDays(date, -1)] || []).filter(e => e.meal === meal);
  if (!prev.length) return toast(`Nothing logged for ${meal.toLowerCase()} yesterday`);
  dayEntries(date).push(...prev.map(e => ({ ...e, id: uid(), ts: Date.now() })));
  save();
  toast(`Copied ${prev.length} item${prev.length > 1 ? 's' : ''}`);
}

// ---------- add food ----------

export function openAddFood(date, meal, startTab = 'Search') {
  const tabs = ['Search', 'Scan', 'Recent', 'My foods', 'Quick add'];
  const TAB_ICONS = { Search: 'search', Scan: 'barcode', Recent: 'clock', 'My foods': 'user', 'Quick add': 'zap' };
  let active = startTab, scanner = null;
  const content = h('div');
  const tabBar = h('div.tabs');
  const sheet = openSheet(`Add to ${meal}`, [tabBar, content], { full: true, onClose: () => scanner?.stop() });

  function show(tab) {
    scanner?.stop(); scanner = null;
    active = tab;
    fill(tabBar, ...tabs.map(t => h('button.tab' + (t === active ? '.on' : ''), { onclick: () => show(t) }, icon(TAB_ICONS[t], 15), t)));
    if (tab === 'Search') fill(content, searchPane());
    if (tab === 'Scan') fill(content, scanPane());
    if (tab === 'Recent') fill(content, listPane(recentFoods(), 'Foods you log will show up here.'));
    if (tab === 'My foods') fill(content, h('button.btn.soft.wide', { onclick: () => openFoodEditor(null, f => pick(f)) }, icon('plus', 18), 'Create custom food'),
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
    const input = h('input.input.wide.search-in', { type: 'search', placeholder: 'Search foods, e.g. "greek yogurt"', enterkeyhint: 'search' });
    const results = h('div');
    let ctrl, timer;
    // Before typing: show recent foods, or a hint pointing at the scanner.
    function idle() {
      const recent = recentFoods().slice(0, 12);
      fill(results, recent.length
        ? [h('div.section-label', 'Recent'), h('div.list', recent.map(foodRow))]
        : h('div.search-empty', icon('search', 28), h('p', 'Search generic foods (USDA) and branded products (Open Food Facts).'),
          h('button.btn.soft', { onclick: () => show('Scan') }, icon('barcode', 18), 'Scan a barcode instead')));
    }
    idle();
    async function run() {
      const q = input.value.trim();
      ctrl?.abort();
      if (q.length < 2) { idle(); return; }
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
      h('button.btn.ghost.wide', { style: { marginTop: '10px' }, onclick: () => fileIn.click() }, icon('camera', 18), 'Scan from a photo instead'),
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
