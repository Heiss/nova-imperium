// What the steps of the login remember (#118, bundle 7) and where the
// Sternenkarte opens after signing in.
import { describe, expect, it } from 'vitest';
import type { GameState } from './types.ts';
import { homeSystem, login } from './login.ts';

const game = (g: number, s: number) =>
  ({ planet: { g, s } }) as unknown as Pick<GameState, 'planet'>;

describe('the state of the login', () => {
  it('starts with no challenge, not remembered and no reset token', () => {
    expect(login).toEqual({
      challenge: null,
      remember: false,
      resetToken: null,
    });
  });
});

describe('homeSystem', () => {
  it('opens the Sternenkarte at the galaxy and system of the home planet', () => {
    const ui = { gal: 1, sys: 1 };
    homeSystem(ui, game(3, 42));
    expect(ui).toEqual({ gal: 3, sys: 42 });
  });
  it('keeps the view when there is no game', () => {
    const ui = { gal: 2, sys: 7 };
    homeSystem(ui, null);
    expect(ui).toEqual({ gal: 2, sys: 7 });
  });
  it('keeps the view when the game has no planet yet', () => {
    const ui = { gal: 2, sys: 7 };
    homeSystem(ui, { planet: null } as unknown as Pick<GameState, 'planet'>);
    expect(ui).toEqual({ gal: 2, sys: 7 });
  });
});
