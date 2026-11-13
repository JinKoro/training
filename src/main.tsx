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
// After a rotation iOS (home-screen app) keeps reporting the old height for a while, and the events can fire before it
// settles, which left the shell at landscape height (menu in the middle of the screen). Re-check for a second.
function syncSoon() {
  syncAppHeight();
  for (const ms of [100, 300, 600, 1000, 1500]) setTimeout(syncAppHeight, ms);
}
for (const ev of ['resize', 'orientationchange', 'pageshow']) window.addEventListener(ev, syncSoon);
window.visualViewport?.addEventListener('resize', syncSoon);
screen.orientation?.addEventListener?.('change', syncSoon);
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
  if ((e.target as Element).closest?.('.sheet')) return; // sheets scroll on their own (long lists, e.g. categories)
  if (!canScroll(e.target as Element)) e.preventDefault();
}, { passive: false });

// iOS applies :active (the press-scale on buttons) only when a touchstart listener exists.
document.addEventListener('touchstart', () => {}, { passive: true });

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

/**
 * The installed app keeps showing an old build for a while (Pages caches index.html for 10 minutes and iOS holds
 * on to the page). On launch and on return to the app, look for a newer build and reload into it.
 */
async function checkForUpdate() {
  try {
    const html = await (await fetch(`${import.meta.env.BASE_URL}index.html`, { cache: 'no-store' })).text();
    const latest = html.match(/assets\/index-[\w-]+\.js/)?.[0];
    const current = [...document.scripts].map((x) => x.src).find((src) => /assets\/index-[\w-]+\.js/.test(src));
    if (latest && current && !current.includes(latest)) location.reload();
  } catch { /* offline: keep the current build */ }
}
if (import.meta.env.PROD) {
  void checkForUpdate();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void checkForUpdate(); });
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
}
