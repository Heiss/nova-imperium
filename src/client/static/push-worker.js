/* global clients, self */
const views = ['buildings', 'research', 'shipyard', 'fleet', 'messages'];

self.addEventListener('push', (event) => {
  const { title, view, tag } = event.data?.json() ?? {};
  if (typeof title !== 'string' || !views.includes(view)) return;
  event.waitUntil(
    self.registration.showNotification('Nova Imperium', {
      body: title,
      icon: '/icon-192.png',
      tag,
      data: view,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const view = event.notification.data;
  if (views.includes(view))
    event.waitUntil(clients.openWindow('/?view=' + view));
});
