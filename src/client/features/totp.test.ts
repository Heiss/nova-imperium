// The box „Authenticator-App“ of „Optionen“ (#401; owner, 2026-11-25, text
// 4 and 137a): the setup, its confirmation and the removal over the server.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
});
afterEach(() => vi.unstubAllGlobals());

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
