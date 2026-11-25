import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { login } from '../logic/login.ts';
import { client } from '../logic/state.svelte.ts';
import type { GameState } from '../logic/types.ts';
import { clientFeature } from './login.ts';
import { fakeCtx } from './test-ctx.ts';

vi.mock('../passkeys.ts', () => ({
  signInWithPasskey: vi.fn(async () => ({ state: { me: { name: 'Pass' } } })),
}));

let fields: Record<
  string,
  { value?: string; checked?: boolean; focus?: () => void }
>;

beforeEach(() => {
  fields = {};
  vi.stubGlobal('document', {
    querySelector: (sel: string) => fields[sel] ?? null,
  });
  Object.assign(login, { challenge: null, remember: false, resetToken: null });
  Object.assign(client.ui, { auth: 'login', invite: null });
  client.game = null;
});
afterEach(() => {
  vi.unstubAllGlobals();
  client.game = null;
});

const forms = (ctx = fakeCtx()) => clientFeature.forms(ctx);
const acts = (ctx = fakeCtx()) => clientFeature.acts(ctx);

/** The state an answer of the server brings; `apply` of the frame takes it over. */
const state = (planet = { g: 3, s: 7 }): GameState =>
  ({ me: { name: 'Anna' }, planet }) as unknown as GameState;

describe('the login', () => {
  it('sends the name, the password and the wish to stay logged in, and shows the game', async () => {
    fields['#a_name'] = { value: 'Anna' };
    fields['#a_pw'] = { value: 'geheim' };
    fields['#remember-login'] = { checked: true };
    const ctx = fakeCtx({
      api: vi.fn(async () => ({ state: state() })),
      apply: vi.fn((s: GameState) => void (client.game = s)),
    });
    await forms(ctx).authform!();
    expect(ctx.api).toHaveBeenCalledWith('/api/login', {
      name: 'Anna',
      password: 'geheim',
      remember: true,
    });
    expect(client.ui.auth).toBeNull();
    // The Sternenkarte opens at the home system.
    expect([client.ui.gal, client.ui.sys]).toEqual([3, 7]);
    expect(ctx.render).toHaveBeenCalledWith(true);
    expect(ctx.toast).not.toHaveBeenCalled();
  });

  it('asks for the code of the mail when the server sends a challenge, and keeps the wish to stay logged in', async () => {
    fields['#remember-login'] = { checked: true };
    const ctx = fakeCtx({ api: vi.fn(async () => ({ challenge: 'c1' })) });
    await forms(ctx).authform!();
    expect(client.ui.auth).toBe('code');
    expect(login.challenge).toBe('c1');
    expect(ctx.apply).not.toHaveBeenCalled();

    fields['#login_code'] = { value: '123456' };
    const code = fakeCtx({
      api: vi.fn(async () => ({ state: state() })),
      apply: vi.fn(),
    });
    await forms(code).codeform!();
    expect(code.api).toHaveBeenCalledWith('/api/login/code', {
      challenge: 'c1',
      code: '123456',
      remember: true,
    });
    expect(login.challenge).toBeNull();
    expect(client.ui.auth).toBeNull();
  });

  it('asks for a new code of the sign-in under way, and shows a refusal (101b, #401)', async () => {
    login.challenge = 'c1';
    client.ui.auth = 'code';
    const ctx = fakeCtx({ api: vi.fn(async () => ({ ok: true })) });
    await acts(ctx).resendcode!();
    expect(ctx.api).toHaveBeenCalledWith('/api/login/resend', {
      challenge: 'c1',
    });
    expect(ctx.toast).not.toHaveBeenCalled();
    expect([login.challenge, client.ui.auth]).toEqual(['c1', 'code']);
    const refused = fakeCtx({
      api: vi.fn(async () => {
        throw new Error('Der Anmeldecode ist ungültig oder abgelaufen.');
      }),
    });
    await acts(refused).resendcode!();
    expect(refused.toast).toHaveBeenCalledWith(
      'Der Anmeldecode ist ungültig oder abgelaufen.',
      expect.objectContaining({
        message: 'Der Anmeldecode ist ungültig oder abgelaufen.',
      }),
    );
  });

  it('shows a refusal as a note and stays on the screen', async () => {
    const ctx = fakeCtx({
      api: vi.fn(async () => {
        throw new Error('Falsches Passwort.');
      }),
    });
    await forms(ctx).authform!();
    expect(ctx.toast).toHaveBeenCalledWith(
      'Falsches Passwort.',
      expect.objectContaining({ message: 'Falsches Passwort.' }),
    );
    expect(ctx.render).not.toHaveBeenCalled();
    expect(client.ui.auth).toBe('login');
  });

  it('logs in by passkey with the chosen wish and shows the game', async () => {
    const ctx = fakeCtx({ apply: vi.fn() });
    await acts(ctx).passkeyLogin!();
    expect(client.ui.auth).toBeNull();
    expect(ctx.apply).toHaveBeenCalledWith({ me: { name: 'Pass' } });
    expect(ctx.render).toHaveBeenCalledWith(true);
  });
});

describe('the registration', () => {
  it('sends the token of the invitation with the planet and the galaxy, welcomes the player and drops the invitation', async () => {
    Object.assign(client.ui, {
      auth: 'register',
      invite: { token: 'tok', email: 'a@b.de', galaxies: 2 },
    });
    fields['#a_name'] = { value: 'Anna' };
    fields['#a_pw'] = { value: 'geheim' };
    fields['#a_planet'] = { value: 'Heimat' };
    fields['#a_gal'] = { value: '2' };
    const ctx = fakeCtx({
      api: vi.fn(async () => ({ state: state({ g: 2, s: 5 }) })),
      apply: vi.fn((s: GameState) => void (client.game = s)),
    });
    await forms(ctx).authform!();
    expect(ctx.api).toHaveBeenCalledWith('/api/register', {
      name: 'Anna',
      password: 'geheim',
      remember: false,
      token: 'tok',
      planet: 'Heimat',
      gal: '2',
    });
    expect(client.ui.invite).toBeNull();
    expect(ctx.toast).toHaveBeenCalledWith(
      expect.stringMatching(/^Willkommen, Anna! Dein Planet liegt bei /),
    );
  });

  it('asks the new player to log in when the server wants a login after the registration', async () => {
    Object.assign(client.ui, {
      auth: 'register',
      invite: { token: 'tok', email: 'a@b.de', galaxies: 1 },
    });
    const ctx = fakeCtx({ api: vi.fn(async () => ({ loginRequired: true })) });
    await forms(ctx).authform!();
    expect(client.ui.auth).toBe('login');
    expect(client.ui.invite).toBeNull();
    expect(ctx.toast).toHaveBeenCalledWith(
      'Konto erstellt. Melde dich jetzt an.',
    );
  });
});

describe('the screens', () => {
  it('goes to „Passwort vergessen“, switches between login and registration, and back', () => {
    const ctx = fakeCtx();
    acts(ctx).forgot!();
    expect(client.ui.auth).toBe('forgot');
    client.ui.auth = 'login';
    acts(ctx).authswitch!();
    expect(client.ui.auth).toBe('register');
    acts(ctx).authswitch!();
    expect(client.ui.auth).toBe('login');
    expect(ctx.render).toHaveBeenCalledTimes(3);
  });

  it('forgets the challenge and the reset link when going back to the login', () => {
    Object.assign(login, { challenge: 'c', resetToken: 't' });
    client.ui.auth = 'reset';
    acts().authback!();
    expect(login).toMatchObject({ challenge: null, resetToken: null });
    expect(client.ui.auth).toBe('login');
  });

  it('asks for the link, then shows the login with the same answer for every address', async () => {
    fields['#recovery_email'] = { value: 'a@b.de' };
    client.ui.auth = 'forgot';
    const ctx = fakeCtx();
    await forms(ctx).forgotform!();
    expect(ctx.api).toHaveBeenCalledWith('/api/password/forgot', {
      email: 'a@b.de',
    });
    expect(client.ui.auth).toBe('login');
    expect(ctx.toast).toHaveBeenCalledWith(
      'Falls die Adresse hinterlegt ist, erhältst du einen Link per E-Mail.',
    );
  });
});

describe('the new password', () => {
  it('sets it with the token of the link and goes back to the login', async () => {
    login.resetToken = 'tok';
    fields['#pw_next'] = { value: 'neu12345' };
    fields['#pw_confirm'] = { value: '' };
    const ctx = fakeCtx();
    await forms(ctx).resetform!();
    expect(ctx.api).toHaveBeenCalledWith('/api/password/reset', {
      password: 'neu12345',
      token: 'tok',
    });
    expect(login.resetToken).toBeNull();
    expect(client.game).toBeNull();
    expect(client.ui.auth).toBe('login');
    expect(ctx.toast).toHaveBeenCalledWith(
      'Passwort gespeichert. Melde dich mit deinem neuen Passwort an.',
    );
  });

  it('changes the password of the options with the old one and refuses two different new ones without a request', async () => {
    fields['#pw_current'] = { value: 'alt' };
    fields['#pw_next'] = { value: 'neu12345' };
    const focus = vi.fn();
    fields['#pw_confirm'] = { value: 'anders', focus };
    const ctx = fakeCtx();
    await forms(ctx).passwordform!();
    expect(ctx.api).not.toHaveBeenCalled();
    expect(ctx.toast).toHaveBeenCalledWith(
      'Die neuen Passwörter stimmen nicht überein.',
      true,
    );
    // The field of the confirmation gets the focus.
    expect(focus).toHaveBeenCalled();

    fields['#pw_confirm'] = { value: 'neu12345' };
    await forms(ctx).passwordform!();
    expect(ctx.api).toHaveBeenCalledWith('/api/password/change', {
      password: 'neu12345',
      current: 'alt',
      confirmation: 'neu12345',
    });
  });
});
