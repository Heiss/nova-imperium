import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthError } from './logic/transport.ts';
import { client } from './logic/state.svelte.ts';
import { session, signedOut, whenSignedOut } from './session.ts';

afterEach(() => {
  client.game = null;
  client.ui.auth = null;
  session.booting = true;
  whenSignedOut(() => undefined);
});

describe('the session is gone', () => {
  it('forgets the game, shows the login and stops the caller', () => {
    const show = vi.fn();
    whenSignedOut(show);
    session.booting = false;
    client.game = {} as never;
    expect(() => signedOut('Bitte einloggen.')).toThrow(AuthError);
    expect(client.game).toBeNull();
    expect(client.ui.auth).toBe('login');
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('keeps a screen of the login that is already open', () => {
    session.booting = false;
    client.ui.auth = 'register';
    expect(() => signedOut(undefined)).toThrow('Bitte einloggen.');
    expect(client.ui.auth).toBe('register');
  });

  it('renders nothing while the page starts (#272)', () => {
    const show = vi.fn();
    whenSignedOut(show);
    expect(() => signedOut('x')).toThrow(AuthError);
    expect(show).not.toHaveBeenCalled();
    expect(client.ui.auth).toBe('login');
  });
});
