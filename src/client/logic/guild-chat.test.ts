// The guild chat in the browser (#169, CodeRabbit on #216): an answer that
// comes in late opens the admin's chat only for the admin who asked, and
// empties the text field only while it holds the sent text.
import { describe, expect, it } from 'vitest';
import { clearsChat, sameSignIn } from './guild-chat.ts';
import type { GameState } from './types.ts';

const signedIn = (player: string): GameState =>
  ({ me: { id: player } }) as unknown as GameState;

describe('sameSignIn', () => {
  it('holds while the admin who asked is still signed in', () => {
    expect(sameSignIn(signedIn('u1'), 'u1')).toBe(true);
  });

  it('fails after a logout', () => {
    expect(sameSignIn(null, 'u1')).toBe(false);
  });

  it('fails when another account signed in meanwhile', () => {
    expect(sameSignIn(signedIn('u2'), 'u1')).toBe(false);
  });

  it('fails when nobody was signed in when the request started', () => {
    expect(sameSignIn(null, undefined)).toBe(false);
    expect(sameSignIn(signedIn('u1'), undefined)).toBe(false);
  });
});

describe('clearsChat', () => {
  it('empties the field that still holds the sent text', () => {
    expect(clearsChat('Hallo', 'Hallo')).toBe(true);
  });

  it('keeps a draft typed while the message was on its way', () => {
    expect(clearsChat('Hallo', 'Hallo, und noch')).toBe(false);
    expect(clearsChat('Hallo', 'Neuer Entwurf')).toBe(false);
    expect(clearsChat('Hallo', '')).toBe(false);
  });

  it('does nothing when the field is gone', () => {
    expect(clearsChat('Hallo', undefined)).toBe(false);
  });
});
