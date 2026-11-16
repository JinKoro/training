import { TIMER_URL, getToken } from './api';

/** Rest-timer push via the existing Cloudflare worker (Apple Web Push; works only from the home-screen app on iPhone). */
const VAPID_PUBLIC_KEY = 'BBNp3N111r3Hl06kNkE5fWo5WCRQzqmlw_9f7afJTTgo0erK2NopkenjQqXLavUO6QhWLIFPLCuABTUiA__JeT8';

const keyBytes = (v: string) => Uint8Array.from(atob(v.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0));

async function endpoint(ask: boolean): Promise<string | null> {
  try {
    if (!('serviceWorker' in navigator) || !('Notification' in window) || !('PushManager' in window)) return null;
    if (Notification.permission === 'default' && ask) await Notification.requestPermission();
    if (Notification.permission !== 'granted') return null;
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription())
      ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) });
    return sub.endpoint.includes('.push.apple.com') ? sub.endpoint : null;
  } catch {
    return null;
  }
}

async function call(path: string, body: Record<string, unknown>) {
  try {
    const token = getToken();
    await fetch(`${TIMER_URL}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  } catch { /* fire and forget */ }
}

/**
 * Pushes arrive without a payload, so the service worker reads what is due from this small record
 * (Cache Storage, which both the page and the worker can reach): the rest end, and the idle reminder's time and text.
 */
interface PushState { restAt?: number | null; remindAt?: number | null; remindText?: string; url?: string }
const STATE_URL = './push-state';
async function patchState(p: PushState) {
  try {
    const c = await caches.open('podhod-push');
    const old = (await (await c.match(STATE_URL))?.json().catch(() => ({}))) ?? {};
    await c.put(STATE_URL, new Response(JSON.stringify({ ...old, ...p })));
  } catch { /* no Cache Storage: the generic text is shown */ }
}

export async function pushStart(seconds: number, ask = false) {
  const ep = await endpoint(ask);
  if (!ep) return;
  if (seconds <= 0) return pushStop();
  const s = Math.min(1800, Math.max(1, Math.round(seconds)));
  await patchState({ restAt: Date.now() + s * 1000 });
  await call('/start', { endpoint: ep, seconds: s });
}

export async function pushStop() {
  const ep = await endpoint(false);
  if (!ep) return;
  await patchState({ restAt: null });
  await call('/stop', { endpoint: ep });
}

/** «Не забудьте про тренировку» after `seconds` without any action in the workout; every action moves it. */
export async function remindStart(seconds: number, text: string, url: string) {
  const ep = await endpoint(false);
  if (!ep) return;
  const s = Math.min(1800, Math.max(1, Math.round(seconds)));
  await patchState({ remindAt: Date.now() + s * 1000, remindText: text, url });
  await call('/start', { endpoint: ep, seconds: s, kind: 'remind' });
}

export async function remindStop() {
  const ep = await endpoint(false);
  if (!ep) return;
  await patchState({ remindAt: null });
  await call('/stop', { endpoint: ep, kind: 'remind' });
}
