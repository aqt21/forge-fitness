// "Install app" support. Chrome/Edge/Android fire `beforeinstallprompt` when the app is
// installable; we keep that event so our own Install button can open the native dialog.
// iPhone/iPad have no such API, so we explain the Share → Add to Home Screen steps instead.

import { h, openSheet, toast } from './ui.js';

let deferred = window.__installPrompt || null;
const listeners = new Set();
const notify = () => listeners.forEach(fn => fn());

window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; notify(); });
window.addEventListener('appinstalled', () => { deferred = null; notify(); });

export const onInstallChange = fn => listeners.add(fn);

export const isInstalled = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const canPrompt = () => !!deferred;

// Opens the browser's install dialog. Resolves 'accepted' | 'dismissed' | 'unavailable'.
export async function promptInstall() {
  if (!deferred) return 'unavailable';
  const e = deferred;
  deferred = null;
  e.prompt();
  const { outcome } = await e.userChoice;
  notify();
  return outcome;
}

// Manual steps for browsers where we can't open the dialog ourselves.
export function manualSteps() {
  const ua = navigator.userAgent;
  if (isIOS()) {
    return /CriOS/.test(ua)
      ? ['Tap the Share icon (top-right of the address bar)', 'Tap "Add to Home Screen"', 'Tap "Add"']
      : ['Tap the Share button at the bottom of Safari', 'Scroll down and tap "Add to Home Screen"', 'Tap "Add"'];
  }
  if (/Android/.test(ua)) {
    return ['Tap the ⋮ menu (top-right in Chrome)', 'Tap "Add to home screen" or "Install app"', 'Choose "Install" (not "Create shortcut")'];
  }
  return ['Click the install icon at the right end of the address bar', 'Or open the ⋮ menu → "Cast, save and share" → "Install page as app"'];
}

// One entry point for every Install button: native dialog when possible, otherwise steps.
export async function startInstall() {
  if (canPrompt()) {
    const outcome = await promptInstall();
    if (outcome === 'accepted') toast('Installing Forge…');
    return;
  }
  openSheet('Install Forge', [
    h('p.muted', isIOS()
      ? 'On iPhone and iPad, apps like this are installed from the Share menu:'
      : 'Your browser didn\'t offer a one-tap install here, so do it from the menu:'),
    h('ol.steps', manualSteps().map((s, i) => h('li', h('span.plan-n', i + 1), h('span', s)))),
    h('p.small.muted', 'Once installed, Forge opens full-screen from your home screen and your data is protected from browser cleanup. Already installed? Open it from your home screen or app list.'),
  ]);
}
