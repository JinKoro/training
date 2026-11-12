import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

/**
 * Height of the phone shell. Launched from the home screen, iOS reports a viewport shorter by the status bar
 * until something scrolls, which left a band under the tab bar. The installed app always covers the whole
 * screen, so there the screen height is right; in the browser the window height is.
 */
function syncAppHeight() {
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia('(display-mode: standalone)').matches;
  // The installed app on this iPhone does not get the bottom strip of the screen: sizing to the screen pushed the
  // tab bar under it. Use the real window height; `standalone` is kept for the debug readout.
  void standalone;
  document.documentElement.style.setProperty('--app-h', `${window.innerHeight}px`);
}
syncAppHeight();
for (const ev of ['resize', 'orientationchange', 'pageshow']) window.addEventListener(ev, () => { syncAppHeight(); setTimeout(syncAppHeight, 300); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) { syncAppHeight(); nudgeViewport(); } });

/**
 * iOS bug on the installed app with a translucent status bar: after launch the window is shorter than the screen
 * by the status bar height (measured on device: screen 956, window 894, safe-top 62), leaving a dead strip under
 * the tab bar. A scroll of the page makes iOS recompute it, so scroll by one pixel and back once at launch.
 */
function nudgeViewport() {
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia('(display-mode: standalone)').matches;
  const portrait = matchMedia('(orientation: portrait)').matches;
  const full = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
  if (!standalone || window.innerHeight >= full - 4) return;
  const root = document.documentElement, body = document.body;
  const prev = [root.style.height, body.style.height, body.style.minHeight];
  body.style.minHeight = '0';
  body.style.height = `${full + 2}px`;
  window.scrollTo(0, 1);
  requestAnimationFrame(() => {
    window.scrollTo(0, 0);
    requestAnimationFrame(() => {
      [root.style.height, body.style.height, body.style.minHeight] = prev;
      syncAppHeight();
      setTimeout(syncAppHeight, 300);
    });
  });
}
window.addEventListener('load', () => setTimeout(nudgeViewport, 50));

/**
 * iOS still rubber-bands the whole page (dragging the tab bar up with it) when a swipe lands on something that
 * cannot scroll. On the phone, let a touch move only inside an element that really scrolls; block the rest.
 */
function canScroll(el: Element | null): boolean {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    const st = getComputedStyle(n);
    if (/(auto|scroll)/.test(st.overflowY) && n.scrollHeight > n.clientHeight + 1) return true;
    if (/(auto|scroll)/.test(st.overflowX) && n.scrollWidth > n.clientWidth + 1) return true;
  }
  return false;
}
document.addEventListener('touchmove', (e) => {
  if (!document.querySelector('.shell-m')) return;
  if (e.touches.length > 1) return; // pinch zoom stays possible
  if (!canScroll(e.target as Element)) e.preventDefault();
}, { passive: false });

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
}
