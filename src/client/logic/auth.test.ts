// What the login, the registration and the steps after them show (#118): the
// screen for the state of the login. The markup is compared with the view
// before in src/test/auth-reference.test.ts.
import { describe, expect, it } from 'vitest';
import { authPage } from './auth.ts';

type State = Parameters<typeof authPage>[0];
const state = (over: Partial<State> = {}): State => ({
  auth: 'login',
  invite: null,
  passwordMinLength: undefined,
  ...over,
});

describe('the screen of the login', () => {
  it('is the login for a state of the login and for an unknown one', () => {
    expect(authPage(state())).toEqual({ kind: 'login' });
    expect(authPage(state({ auth: 'nothing' as never }))).toEqual({
      kind: 'login',
    });
  });

  it('is the step after the login that the state names', () => {
    expect(authPage(state({ auth: 'forgot' }))).toEqual({ kind: 'forgot' });
    expect(authPage(state({ auth: 'code' }))).toEqual({ kind: 'code' });
    expect(authPage(state({ auth: 'reset', passwordMinLength: 10 }))).toEqual({
      kind: 'reset',
      minLength: 10,
    });
    expect(authPage(state({ auth: 'reset' }))).toEqual({
      kind: 'reset',
      minLength: undefined,
    });
  });

  it('is the registration only with a checked invitation, with its address and the galaxies to choose from', () => {
    const invite = { email: 'a@b.de', galaxies: 3 } as State['invite'];
    expect(
      authPage(state({ auth: 'register', invite, passwordMinLength: 8 })),
    ).toEqual({
      kind: 'register',
      minLength: 8,
      email: 'a@b.de',
      galaxies: [1, 2, 3],
    });
    expect(authPage(state({ auth: 'register' }))).toEqual({ kind: 'login' });
    // An invitation alone does not open the registration.
    expect(authPage(state({ invite }))).toEqual({ kind: 'login' });
  });
});
