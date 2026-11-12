self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  event.waitUntil(self.registration.showNotification('Отдых окончен', {
    body: 'Пора к следующему подходу',
    tag: 'rest-timer',
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const [client] = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (client) await client.focus();
    else await self.clients.openWindow('./');
  })());
});
