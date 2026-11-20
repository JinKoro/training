self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

/** What the page scheduled (src/lib/push.ts): which push this is — rest end or the idle reminder. */
async function pushState() {
  try {
    const c = await caches.open('podhod-push');
    const r = await c.match('./push-state');
    return r ? await r.json() : {};
  } catch {
    return {};
  }
}

const near = (t) => typeof t === 'number' && Math.abs(Date.now() - t) < 120000;

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    const s = await pushState();
    if (near(s.remindAt) && !near(s.restAt)) {
      await self.registration.showNotification('Не забудьте про тренировку', {
        body: s.remindText || 'Тренировка ещё идёт',
        tag: 'workout-remind',
        data: { url: s.url },
      });
      return;
    }
    await self.registration.showNotification('Отдых окончен', {
      body: 'Пора к следующему подходу',
      tag: 'rest-timer',
      data: { url: s.url },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url;
  event.waitUntil((async () => {
    const [client] = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (client) {
      await client.focus();
      if (url && 'navigate' in client) { try { await client.navigate(url); } catch { /* stays where it was */ } }
    } else {
      await self.clients.openWindow(url || './');
    }
  })());
});
