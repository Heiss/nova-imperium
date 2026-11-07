type Api = (url: string, body?: object) => Promise<Record<string, unknown>>;

function supported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function applicationKey(value: string): Uint8Array<ArrayBuffer> {
  const data = atob(value.replaceAll('-', '+').replaceAll('_', '/'));
  return Uint8Array.from(data, (character) => character.charCodeAt(0));
}

export async function enablePush(api: Api): Promise<void> {
  if (!supported())
    throw new Error(
      'Web Push ist hier nicht verfügbar. Auf dem iPhone öffne Nova Imperium vom Home-Bildschirm.',
    );
  if ((await Notification.requestPermission()) !== 'granted')
    throw new Error('Benachrichtigungen wurden nicht erlaubt.');
  const { publicKey } = await api('/api/push/key');
  if (typeof publicKey !== 'string') throw new Error('Push-Schlüssel fehlt.');
  await navigator.serviceWorker.register('/push-worker.js');
  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationKey(publicKey),
    }));
  await api('/api/push/subscribe', subscription.toJSON());
}

export async function disablePush(api: Api): Promise<void> {
  if (!supported()) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  try {
    await api('/api/push/unsubscribe', { endpoint: subscription.endpoint });
  } finally {
    await subscription.unsubscribe();
  }
}
