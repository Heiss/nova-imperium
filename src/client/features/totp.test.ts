// The box „Authenticator-App“ of „Optionen“ (#401; owner, 2026-11-25, text
// 4 and 137a): the setup, its confirmation and the removal over the server.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { client } from '../logic/state.svelte.ts';
import { totpSetup } from '../logic/totp-setup.svelte.ts';
import { clientFeature } from './totp.ts';
import { fakeCtx } from './test-ctx.ts';

let fields: Record<string, { value?: string; focus?: () => void }>;

beforeEach(() => {
  fields = {};
  vi.stubGlobal('document', {
    querySelector: (sel: string) => fields[sel] ?? null,
  });
  totpSetup.uri = null;
  totpSetup.secret = null;
  client.game = game('anna');
});
afterEach(() => {
  client.game = null;
  vi.unstubAllGlobals();
});

const game = (id: string) => ({ me: { id } }) as never;

const STATE = { me: { totp: true } };

describe('the authenticator app of the account', () => {
  it('shows the address and the key of a new setup and focuses the code', async () => {
    const focus = vi.fn();
    fields['#totp_code'] = { focus };
    const ctx = fakeCtx({
      api: vi.fn(async () => ({ uri: 'otpauth://x', secret: 'ABC' })),
    });
    await clientFeature.acts(ctx).totpSetup!();
    expect(ctx.api).toHaveBeenCalledWith('/api/totp/setup', {});
    expect({ ...totpSetup }).toEqual({ uri: 'otpauth://x', secret: 'ABC' });
    expect(ctx.render).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
  });

  it('confirms the setup with a code, loads the state and says so', async () => {
    totpSetup.uri = 'otpauth://x';
    totpSetup.secret = 'ABC';
    fields['#totp_code'] = { value: '123456' };
    const api = vi.fn(async (url: string) =>
      url === '/api/state' ? STATE : { ok: true },
    );
    const ctx = fakeCtx({ api, apply: vi.fn() });
    await clientFeature.forms(ctx).totpconfirmform!();
    expect(api.mock.calls).toEqual([
      ['/api/totp/confirm', { code: '123456' }],
      ['/api/state'],
    ]);
    expect(ctx.apply).toHaveBeenCalledWith(STATE, true);
    expect({ ...totpSetup }).toEqual({ uri: null, secret: null });
    expect(ctx.toast).toHaveBeenCalledWith('Authenticator-App eingerichtet.');
  });

  it('removes the app with the password and a code, and says so', async () => {
    fields['#totp_password'] = { value: 'geheim' };
    fields['#totp_remove_code'] = { value: '654321' };
    const api = vi.fn(async (url: string) =>
      url === '/api/state' ? STATE : { ok: true },
    );
    const ctx = fakeCtx({ api, apply: vi.fn() });
    await clientFeature.forms(ctx).totpremoveform!();
    expect(api.mock.calls[0]).toEqual([
      '/api/totp/remove',
      { password: 'geheim', code: '654321' },
    ]);
    expect(ctx.toast).toHaveBeenCalledWith('Authenticator-App entfernt.');
  });

  it('shows a refusal of the server and keeps the setup', async () => {
    totpSetup.uri = 'otpauth://x';
    totpSetup.secret = 'ABC';
    const refused = new Error('Der Code der Authenticator-App ist ungültig.');
    for (const run of [
      (c: ReturnType<typeof fakeCtx>) => clientFeature.acts(c).totpSetup!(),
      (c: ReturnType<typeof fakeCtx>) =>
        clientFeature.forms(c).totpconfirmform!(),
      (c: ReturnType<typeof fakeCtx>) =>
        clientFeature.forms(c).totpremoveform!(),
    ]) {
      const ctx = fakeCtx({
        api: vi.fn(async () => {
          throw refused;
        }),
      });
      await run(ctx);
      expect(ctx.toast).toHaveBeenCalledWith(refused.message, refused);
    }
    expect({ ...totpSetup }).toEqual({ uri: 'otpauth://x', secret: 'ABC' });
  });
});

// A late answer of „Einrichten“ (CodeRabbit of #417): the secret belongs to
// the account that asked, never to the one signed in later in the same tab.
describe('the setup of an account that is gone', () => {
  async function lateSetup(
    after: () => void,
  ): Promise<ReturnType<typeof fakeCtx>> {
    let answer: (v: unknown) => void = () => undefined;
    const ctx = fakeCtx({
      api: vi.fn(() => new Promise((r) => (answer = r))) as never,
    });
    const asked = clientFeature.acts(ctx).totpSetup!();
    after();
    answer({ uri: 'otpauth://anna', secret: 'ANNA' });
    await asked;
    return ctx;
  }

  it('drops an answer that comes in after a sign-out or for another account', async () => {
    for (const after of [
      () => (client.game = null),
      () => (client.game = game('berta')),
    ]) {
      client.game = game('anna');
      const ctx = await lateSetup(after);
      expect({ ...totpSetup }).toEqual({ uri: null, secret: null });
      expect(ctx.render).not.toHaveBeenCalled();
    }
  });

  it('drops an answer when no account asked', async () => {
    client.game = null;
    const ctx = await lateSetup(() => (client.game = game('anna')));
    expect({ ...totpSetup }).toEqual({ uri: null, secret: null });
    expect(ctx.render).not.toHaveBeenCalled();
  });
});
