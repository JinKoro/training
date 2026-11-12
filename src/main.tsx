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
  let h = window.innerHeight;
  if (standalone) {
    const portrait = matchMedia('(orientation: portrait)').matches;
    h = Math.max(h, portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height));
  }
  document.documentElement.style.setProperty('--app-h', `${h}px`);
}
syncAppHeight();
for (const ev of ['resize', 'orientationchange', 'pageshow']) window.addEventListener(ev, () => { syncAppHeight(); setTimeout(syncAppHeight, 300); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) syncAppHeight(); });

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
}
