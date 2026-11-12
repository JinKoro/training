import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

/**
 * Real screen height for the phone shell. Launched from the home screen, iOS reports a short viewport until the
 * first scroll, so 100dvh / inset:0 left the tab bar floating above the bottom edge. In standalone mode the app
 * covers the whole screen, so the screen size is the truth; otherwise use the window height.
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
setTimeout(syncAppHeight, 100);
setTimeout(syncAppHeight, 600);

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
}
