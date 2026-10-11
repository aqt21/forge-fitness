import { state, onChange } from './store.js';
import { renderToday } from './nutrition.js';
import { renderTrain, renderWorkout, setNavigator } from './train.js';
import { renderProgress } from './progress.js';
import { renderSettings } from './settings.js';
import { icon } from './icons.js';

const routes = {
  '#/food': { title: 'Food', render: renderToday },
  '#/train': { title: 'Train', render: renderTrain },
  '#/workout': { title: 'Workout', render: renderWorkout, nav: '#/train' },
  '#/progress': { title: 'Progress', render: renderProgress },
  '#/settings': { title: 'Settings', render: renderSettings },
};

const view = document.getElementById('view');
document.querySelectorAll('nav a').forEach(a => a.prepend(icon(a.dataset.ic, 24)));
const title = document.getElementById('title');

function current() { return routes[location.hash] ? location.hash : '#/food'; }

function render() {
  const key = current();
  const r = routes[key];
  title.textContent = r.title;
  document.body.dataset.route = key.slice(2);
  document.querySelectorAll('nav a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === (r.nav || key)));
  document.querySelector('nav a[href="#/train"]').classList.toggle('live', !!state.active);
  r.render(view);
}

function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}
setNavigator(go);

window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
// The live workout view manages its own redraws so inputs keep focus.
onChange(() => { if (current() !== '#/workout') render(); });
render();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
