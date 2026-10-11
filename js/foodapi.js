// Food lookups: Open Food Facts (barcodes + branded foods) and USDA FoodData Central
// (generic foods like "chicken breast"). Results are normalized to:
// { id, name, brand, barcode, per100: {kcal, protein, carbs, fat}, servings: [{label, grams}], source }

import { state } from './store.js';

const OFF = 'https://world.openfoodfacts.org';
const OFF_FIELDS = 'code,product_name,product_name_en,generic_name,brands,serving_size,serving_quantity,nutriments,quantity';

const num = v => (v == null || v === '' || isNaN(+v) ? null : +v);

function normalizeOff(p) {
  if (!p) return null;
  const n = p.nutriments || {};
  let kcal = num(n['energy-kcal_100g']);
  if (kcal == null && num(n.energy_100g) != null) kcal = num(n.energy_100g) / 4.184;
  const per100 = {
    kcal: kcal ?? 0,
    protein: num(n.proteins_100g) ?? 0,
    carbs: num(n.carbohydrates_100g) ?? 0,
    fat: num(n.fat_100g) ?? 0,
  };
  const name = p.product_name || p.product_name_en || p.generic_name;
  if (!name) return null;
  const servings = [];
  const sq = num(p.serving_quantity);
  if (sq && sq > 0) servings.push({ label: p.serving_size ? `1 serving (${p.serving_size})` : `1 serving (${sq} g)`, grams: sq });
  return {
    id: 'off:' + p.code,
    name: name.trim(),
    brand: (p.brands || '').split(',')[0].trim(),
    barcode: p.code,
    per100,
    servings,
    missingNutrition: kcal == null,
    source: 'Open Food Facts',
  };
}

export async function lookupBarcode(code) {
  code = String(code).trim();
  // A food you created/edited for this barcode wins.
  const same = b => b && b.padStart(13, '0') === code.padStart(13, '0');
  const local = Object.values(state.foods).find(f => same(f.barcode) && f.custom);
  if (local) return local;
  const res = await fetch(`${OFF}/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`);
  if (!res.ok && res.status !== 404) throw new Error('Lookup failed (' + res.status + ')');
  const data = await res.json();
  if (data.status !== 1 && data.status !== 'success') {
    // Fall back to any previously-logged copy.
    return Object.values(state.foods).find(f => same(f.barcode)) || null;
  }
  return normalizeOff(data.product);
}

async function searchOff(q, signal) {
  const url = `${OFF}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=20&fields=${OFF_FIELDS}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('Open Food Facts search failed');
  const data = await res.json();
  return (data.products || []).map(normalizeOff).filter(f => f && !f.missingNutrition);
}

const USDA_IDS = { kcal: [1008, 2047, 2048], protein: [1003], carbs: [1005], fat: [1004] };

async function searchUsda(q, signal) {
  const key = state.settings.usdaKey || 'DEMO_KEY';
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(q)}&pageSize=15&dataType=Foundation,SR%20Legacy,Survey%20(FNDDS)`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(res.status === 429 ? 'USDA rate limit reached — add a free API key in Settings' : 'USDA search failed');
  const data = await res.json();
  return (data.foods || []).map(f => {
    const get = ids => {
      for (const id of ids) {
        const n = (f.foodNutrients || []).find(x => x.nutrientId === id);
        if (n && n.value != null) return n.value;
      }
      return 0;
    };
    const servings = (f.foodMeasures || [])
      .filter(m => m.gramWeight > 0 && m.disseminationText && m.disseminationText !== 'Quantity not specified')
      .slice(0, 4)
      .map(m => ({ label: m.disseminationText, grams: m.gramWeight }));
    const per100 = { kcal: get(USDA_IDS.kcal), protein: get(USDA_IDS.protein), carbs: get(USDA_IDS.carbs), fat: get(USDA_IDS.fat) };
    // Some Foundation foods omit energy; derive it from macros.
    if (!per100.kcal) per100.kcal = per100.protein * 4 + per100.carbs * 4 + per100.fat * 9;
    return { id: 'usda:' + f.fdcId, name: titleCase(f.description), brand: 'USDA', per100, servings, source: 'USDA' };
  }).filter(f => f.per100.kcal > 0 || /water|tea|coffee|diet/i.test(f.name));
}

function titleCase(s = '') {
  return s.toLowerCase().replace(/(^|[\s,(])([a-z])/g, (m, a, b) => a + b.toUpperCase());
}

// Searches your own foods instantly, then both online databases in parallel.
export function searchLocal(q) {
  const t = q.toLowerCase().split(/\s+/).filter(Boolean);
  return Object.values(state.foods)
    .filter(f => t.every(w => (f.name + ' ' + (f.brand || '')).toLowerCase().includes(w)))
    .sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0))
    .slice(0, 15);
}

export async function searchOnline(q, signal) {
  const [usda, off] = await Promise.allSettled([searchUsda(q, signal), searchOff(q, signal)]);
  const errors = [usda, off].filter(r => r.status === 'rejected' && r.reason?.name !== 'AbortError').map(r => r.reason.message);
  return {
    usda: usda.status === 'fulfilled' ? usda.value : [],
    off: off.status === 'fulfilled' ? off.value : [],
    errors,
  };
}
