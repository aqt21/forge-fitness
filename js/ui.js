// Tiny DOM helpers: element builder, bottom sheets, toasts, confirm.

import { icon } from './icons.js';

export function h(tag, attrs, ...children) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  if (attrs != null && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
    children.unshift(attrs);
    attrs = null;
  }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && k !== 'list' && k !== 'type') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

// replaceChildren() that skips null/false like h() does.
export function fill(el, ...children) { el.replaceChildren(); append(el, children); return el; }

export const fmt = (n, d = 0) => (n == null || isNaN(n) ? '–' : String(+Number(n).toFixed(d)));

// ---------- sheets (stackable modal panels that slide up) ----------
const stack = [];

export function openSheet(title, body, { onClose, full = false } = {}) {
  const panel = h('div.sheet' + (full ? '.full' : ''),
    h('div.grabber'),
    h('div.sheet-head',
      h('h2', title),
      h('button.icon-btn.close-btn', { 'aria-label': 'Close', onclick: () => close() }, icon('x', 18))),
    h('div.sheet-body', body));
  const backdrop = h('div.backdrop', { onclick: e => { if (e.target === backdrop) close(); } }, panel);
  document.body.append(backdrop);
  document.body.classList.add('no-scroll');
  requestAnimationFrame(() => backdrop.classList.add('open'));
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    stack.splice(stack.indexOf(api), 1);
    backdrop.classList.remove('open');
    setTimeout(() => backdrop.remove(), 200);
    if (!stack.length) document.body.classList.remove('no-scroll');
    onClose?.();
  }
  const api = { close, panel, body: panel.querySelector('.sheet-body'), setBody(node) { fill(api.body, node); } };
  stack.push(api);
  return api;
}

document.addEventListener('keydown', e => { if (e.key === 'Escape' && stack.length) stack[stack.length - 1].close(); });

export function toast(msg, ms = 2200) {
  const t = h('div.toast', msg);
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, ms);
}

export function confirmSheet(message, { ok = 'Confirm', danger = false } = {}) {
  return new Promise(resolve => {
    let result = false;
    const s = openSheet('Are you sure?', [
      h('p', message),
      h('div.row.gap',
        h('button.btn.ghost.grow', { onclick: () => s.close() }, 'Cancel'),
        h('button.btn.grow' + (danger ? '.danger' : ''), { onclick: () => { result = true; s.close(); } }, ok)),
    ], { onClose: () => resolve(result) });
  });
}

// Horizontal progress bar with label.
export function bar(label, value, target, unitLabel = 'g', cls = '') {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  const over = target > 0 && value > target * 1.05;
  return h('div.macro' + (cls ? '.' + cls : ''),
    h('div.macro-top', h('span', label), h('span.muted', `${fmt(value)} / ${fmt(target)}${unitLabel}`)),
    h('div.track', h('div.fill' + (over ? '.over' : ''), { style: { width: pct + '%' } })));
}

// Simple responsive SVG line chart. points: [{x: Date|number, y}]
export function lineChart(series, { height = 240, yLabel = '', goal = null } = {}) {
  const all = series.flatMap(s => s.points);
  if (all.length < 2) return h('p.muted.small', 'Log a few more entries to see a chart.');
  const W = 600, H = height, pad = { l: 58, r: 12, t: 14, b: 34 };
  const xs = all.map(p => +p.x), ys = all.map(p => p.y).concat(goal != null ? [goal] : []);
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (x0 === x1) x1 = x0 + 1;
  const span = y1 - y0 || Math.abs(y1) * 0.1 || 1;
  y0 -= span * 0.1; y1 += span * 0.1;
  const X = x => pad.l + ((x - x0) / (x1 - x0)) * (W - pad.l - pad.r);
  const Y = y => pad.t + (1 - (y - y0) / (y1 - y0)) * (H - pad.t - pad.b);
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'chart');
  const add = (tag, a) => { const e = document.createElementNS(ns, tag); for (const k in a) e.setAttribute(k, a[k]); svg.append(e); return e; };
  for (let i = 0; i <= 3; i++) {
    const v = y0 + ((y1 - y0) * i) / 3;
    add('line', { x1: pad.l, x2: W - pad.r, y1: Y(v), y2: Y(v), class: 'grid' });
    add('text', { x: pad.l - 8, y: Y(v) + 4, 'text-anchor': 'end', class: 'axis' }).textContent = Math.round(v);
  }
  const d0 = new Date(x0), d1 = new Date(x1);
  const lab = d => `${d.getMonth() + 1}/${d.getDate()}`;
  add('text', { x: pad.l, y: H - 6, class: 'axis' }).textContent = lab(d0);
  add('text', { x: W - pad.r, y: H - 6, 'text-anchor': 'end', class: 'axis' }).textContent = lab(d1);
  if (goal != null) add('line', { x1: pad.l, x2: W - pad.r, y1: Y(goal), y2: Y(goal), class: 'goal' });
  // Pass 1: gradient areas, so they sit underneath every dot and line.
  for (const s of series) {
    const pts = [...s.points].sort((a, b) => a.x - b.x);
    if (s.area && pts.length > 1) {
      const gid = 'g' + Math.random().toString(36).slice(2, 8);
      const defs = add('defs', {});
      defs.innerHTML = `<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="area-top"/><stop offset="1" class="area-bot"/></linearGradient>`;
      const line = pts.map((p, i) => (i ? 'L' : 'M') + X(+p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join(' ');
      add('path', { d: `${line} L${X(+pts[pts.length - 1].x).toFixed(1)} ${H - pad.b} L${X(+pts[0].x).toFixed(1)} ${H - pad.b} Z`, fill: `url(#${gid})`, class: 'area' });
    }
  }
  for (const s of series) {
    const pts = [...s.points].sort((a, b) => a.x - b.x);
    if (s.dots !== false) for (const p of pts) add('circle', { cx: X(+p.x), cy: Y(p.y), r: s.dotR || 5, class: 'dot ' + (s.cls || '') });
    if (pts.length > 1 && s.line !== false) add('path', { d: pts.map((p, i) => (i ? 'L' : 'M') + X(+p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join(' '), class: 'line ' + (s.cls || '') });
  }
  return h('div.chart-wrap', yLabel ? h('div.muted.small', yLabel) : null, svg);
}

// Bar chart for daily values vs a target line.
export function barChart(items, { height = 220, target = null } = {}) {
  const W = 600, H = height, pad = { l: 58, r: 12, t: 14, b: 34 };
  // Round the axis top up to a friendly number (e.g. 3000 rather than 3058).
  const raw = Math.max(1, ...items.map(i => i.y), target || 0) * 1.08;
  const mag = Math.pow(10, Math.floor(Math.log10(raw))) / 2;
  const max = Math.ceil(raw / mag) * mag;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'chart');
  const add = (tag, a) => { const e = document.createElementNS(ns, tag); for (const k in a) e.setAttribute(k, a[k]); svg.append(e); return e; };
  const bw = (W - pad.l - pad.r) / items.length;
  const Y = v => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  for (let i = 0; i <= 2; i++) {
    const v = (max * i) / 2;
    add('line', { x1: pad.l, x2: W - pad.r, y1: Y(v), y2: Y(v), class: 'grid' });
    add('text', { x: pad.l - 8, y: Y(v) + 4, 'text-anchor': 'end', class: 'axis' }).textContent = Math.round(v);
  }
  items.forEach((it, i) => {
    if (it.y > 0) add('rect', { x: pad.l + i * bw + bw * 0.15, y: Y(it.y), width: bw * 0.7, height: Y(0) - Y(it.y), rx: 3, class: 'barrect' + (target && it.y > target * 1.05 ? ' over' : '') });
    const step = Math.ceil(items.length / 7), last = items.length - 1;
    if (i === last || (i % step === 0 && last - i >= step))
      add('text', { x: pad.l + i * bw + bw / 2, y: H - 6, 'text-anchor': 'middle', class: 'axis' }).textContent = it.label;
  });
  if (target) add('line', { x1: pad.l, x2: W - pad.r, y1: Y(target), y2: Y(target), class: 'goal' });
  return h('div.chart-wrap', svg);
}
