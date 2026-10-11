// Camera barcode scanning. Uses html5-qrcode, which uses the phone's native
// BarcodeDetector when available (Android Chrome) and a JS decoder otherwise (iPhone).

import { h, fill } from './ui.js';

const LIB = 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';
let libPromise;

function loadLib() {
  if (window.Html5Qrcode) return Promise.resolve();
  return (libPromise ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = LIB;
    s.onload = resolve;
    s.onerror = () => { libPromise = null; reject(new Error('Could not load the scanner. Check your connection.')); };
    document.head.append(s);
  }));
}

function formats() {
  const F = window.Html5QrcodeSupportedFormats;
  return [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128];
}

// Mounts a live scanner into `container`. Calls onCode(code) once, then stops.
// Returns { stop }.
export function mountScanner(container, onCode, onError) {
  const id = 'scan-' + Math.random().toString(36).slice(2);
  const region = h('div.scan-region', { id });
  const hint = h('div.scan-hint', 'Point the camera at a barcode');
  fill(container, h('div.scan-wrap', region, hint));
  let scanner, stopped = false, fired = false;

  (async () => {
    try {
      await loadLib();
      if (stopped) return;
      scanner = new window.Html5Qrcode(id, {
        formatsToSupport: formats(),
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        verbose: false,
      });
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 12, qrbox: (w, hgt) => ({ width: Math.floor(w * 0.85), height: Math.floor(Math.min(hgt * 0.5, w * 0.5)) }), aspectRatio: 1.333 },
        text => {
          if (fired) return;
          fired = true;
          navigator.vibrate?.(60);
          stop().then(() => onCode(normalizeCode(text)));
        },
        () => {},
      );
      if (stopped) stop();
    } catch (e) {
      const msg = String(e?.message || e);
      onError?.(/Permission|NotAllowed/i.test(msg)
        ? 'Camera permission was denied. Allow camera access for this site, or type the barcode / scan from a photo below.'
        : /NotFound|no camera|Requested device/i.test(msg)
          ? 'No camera found. Type the barcode or scan from a photo below.'
          : 'Camera unavailable: ' + msg);
    }
  })();

  async function stop() {
    stopped = true;
    try { if (scanner?.isScanning) await scanner.stop(); scanner?.clear(); } catch {}
  }
  return { stop };
}

// Decode a barcode from a still photo (fallback when live camera is blocked).
export async function scanFile(file) {
  await loadLib();
  const holder = h('div', { id: 'scanfile-' + Date.now(), style: { display: 'none' } });
  document.body.append(holder);
  try {
    const s = new window.Html5Qrcode(holder.id, { formatsToSupport: formats(), experimentalFeatures: { useBarCodeDetectorIfSupported: true }, verbose: false });
    const text = await s.scanFile(file, false);
    return normalizeCode(text);
  } finally {
    holder.remove();
  }
}

// UPC-A scanned as EAN-13 has a leading 0; Open Food Facts accepts either, keep digits only.
function normalizeCode(t) { return String(t).replace(/\D/g, '') || String(t); }
