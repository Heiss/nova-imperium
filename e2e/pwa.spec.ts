// The installable app: the home-screen offer on a phone and the
// announcement that the online-only push worker shows.
import { expect, test } from '@playwright/test';

test('offers home-screen installation on a phone @phone', async ({ page }) => {
  await page.goto('/');
  const offer = page.locator('#pwa-offer');
  await expect(offer).toBeVisible();
  await offer.getByRole('button', { name: 'App installieren' }).click();
  await expect(
    page.getByText('Zum Spielen brauchst du eine Internetverbindung.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Schließen' }).click();
  await offer.getByRole('button', { name: 'Später' }).click();
  await expect(offer).toBeHidden();
  await page.reload();
  await expect(page.locator('.auth')).toBeVisible();
  await expect(offer).toBeHidden();
});

test('displays an announcement received by the online-only push worker', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['notifications']);
  await page.goto('/');
  const cdp = await context.newCDPSession(page);
  const registrationId = new Promise<string>((resolve) => {
    cdp.on('ServiceWorker.workerRegistrationUpdated', ({ registrations }) => {
      const current = registrations.find((item) => !item.isDeleted);
      if (current) resolve(current.registrationId);
    });
  });
  await cdp.send('ServiceWorker.enable');
  const registration = context.waitForEvent('serviceworker');
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/push-worker.js');
    await navigator.serviceWorker.ready;
  });
  const worker = await registration;
  await worker.evaluate(() => {
    const scope = globalThis as unknown as {
      registration: ServiceWorkerRegistration;
      testNotification?: { title: string; body?: string; data: unknown };
    };
    scope.registration.showNotification = async (title, options) => {
      scope.testNotification = {
        title,
        body: options?.body,
        data: options?.data,
      };
    };
  });
  const text = 'Servernachricht: Wartung';
  await cdp.send('ServiceWorker.deliverPushMessage', {
    origin: new URL(page.url()).origin,
    registrationId: await registrationId,
    data: JSON.stringify({
      title: text,
      view: 'messages',
      tag: 'announcement-test',
    }),
  });
  await expect
    .poll(() =>
      worker.evaluate(() => Reflect.get(globalThis, 'testNotification')),
    )
    .toEqual({ title: 'Nova Imperium', body: text, data: 'messages' });
  expect(await page.evaluate(() => caches.keys())).toEqual([]);
});
