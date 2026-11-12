import { TIMER_URL } from './api';

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
    await fetch(`${TIMER_URL}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch { /* fire and forget */ }
}

export async function pushStart(seconds: number, ask = false) {
  const ep = await endpoint(ask);
  if (!ep) return;
  if (seconds <= 0) return pushStop();
  await call('/start', { endpoint: ep, seconds: Math.min(1800, Math.max(1, Math.round(seconds))) });
}

export async function pushStop() {
  const ep = await endpoint(false);
  if (ep) await call('/stop', { endpoint: ep });
}
