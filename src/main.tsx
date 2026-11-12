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
document.addEventListener('visibilitychange', () => { if (!document.hidden) syncAppHeight(); });

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
