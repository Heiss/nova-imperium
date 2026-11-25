// The login, the registration and the steps after them render as before #118,
// bundle 7 („no visible change“ of the issue; each migration step changes no
// behaviour, owner, 2026-11-13). The old view is frozen here: auth() of
// src/client/views/misc.ts with its steps (the forgotten password, the new
// password, the code of the mail). On every combination of the state of the
// login that the generator reaches (fixed fast-check seed 118) both render
// the same markup, up to what a browser does not show (normalize() of
// markup.ts), and the same text in every line, cell and button
// (textContents(), which sees a space that normalize() cannot); a test checks
// the ids, `data-act`s and form ids that main.ts reads.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { esc } from '../client/logic/format.ts';
import type { Ui } from '../client/views/common.ts';
import { authView } from './admin-view.ts';
import { normalize, textContents } from './markup.ts';

// ----- frozen: the login before #118, bundle 7 -----

const passwordMinimum = (ui: Ui): string =>
  ui.passwordMinLength === undefined
    ? ''
    : `minlength="${ui.passwordMinLength}"`;

function registerRows(ui: Ui): string {
  const options = Array.from(
    { length: ui.invite?.galaxies ?? 1 },
    (_, i) => `<option value="${i + 1}">${i + 1}</option>`,
  ).join('');
  return `<tr><td>E-Mail</td><td><input id="a_email" value="${esc(ui.invite?.email)}" readonly aria-label="E-Mail"></td></tr>
 <tr><td><label for="a_planet">Planetenname</label></td><td><input id="a_planet" maxlength="20" value="Heimatplanet"></td></tr>
 <tr><td><label for="a_gal">Galaxie</label></td><td><select id="a_gal">${options}</select> <span class="dim">gleiche wie deine Freunde = kürzere Flüge</span></td></tr>`;
}

const backToLogin =
  '<button class="small" type="button" data-act="authback">Zurück zum Login</button>';

function authStep(
  title: string,
  form: string,
  input: string,
  button: string,
): string {
  return `<div class="box auth"><div class="hd">${title}</div><div class="bd">
  <form id="${form}">${input}<p><button type="submit">${button}</button> ${backToLogin}</p></form>
  </div></div>`;
}

/** Login, or registration with an invitation link (#invite=…). */
function extraAuth(ui: Ui): string | null {
  if (ui.auth === 'forgot')
    return authStep(
      'Passwort vergessen',
      'forgotform',
      '<label for="recovery_email">Hinterlegte E-Mail-Adresse</label> <input id="recovery_email" type="email" autocomplete="email" required>',
      'Link anfordern',
    );
  if (ui.auth === 'reset')
    return authStep(
      'Neues Passwort festlegen',
      'resetform',
      `<label for="pw_next">Neues Passwort</label> <input id="pw_next" type="password" autocomplete="new-password" ${passwordMinimum(ui)} required>`,
      'Passwort speichern',
    );
  // Changed on purpose since #118: the hint of the code step (owner,
  // 2026-11-25, text 3 of #401); „Code erneut senden“ comes only after 30 s,
  // so it is not in the first render.
  if (ui.auth === 'code')
    return authStep(
      'Anmeldecode',
      'codeform',
      '<p>Wir haben dir einen Code per E-Mail geschickt.</p> <label for="login_code">Sechsstelliger Code aus deiner E-Mail</label> <input id="login_code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" required>',
      'Anmelden',
    );

  return null;
}

export function auth(ui: Ui): string {
  const extra = extraAuth(ui);
  if (extra) return extra;
  const reg = ui.auth === 'register' && ui.invite !== null;
  const note = reg
    ? ''
    : '<p><button type="button" data-act="passkeyLogin">Mit Passkey anmelden</button></p><p class="dim">Ein Konto bekommst du nur mit einer Einladung vom Admin.</p>';
  const back = reg
    ? '<span class="lnk ml" data-act="authswitch">Ich habe schon ein Konto</span>'
    : '<button class="small" type="button" data-act="forgot">Passwort vergessen?</button>';
  return `<div class="box auth"><div class="hd">${reg ? 'Neues Imperium gründen' : 'Login'}</div><div class="bd"><form id="authform"><table class="kv">
 <tr><td><label for="a_name">Name</label></td><td><input id="a_name" maxlength="20" autocomplete="username" required></td></tr>
 <tr><td><label for="a_pw">Passwort</label></td><td><input id="a_pw" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" ${reg ? passwordMinimum(ui) : ''} required></td></tr>
 ${reg ? registerRows(ui) : '<tr><td colspan="2"><label><input id="remember-login" type="checkbox"> Login auf diesem Gerät speichern</label></td></tr>'}
 </table><p><button type="submit">${reg ? 'Imperium gründen' : 'Einloggen'}</button> ${back}</p>${note}</form></div></div>`;
}

// ----- the comparison -----

const EMAILS = ['a@b.de', 'x"y@z.de', 'a&b@c<d>.de', "o'x@y.de"];

const state = fc.record({
  auth: fc.constantFrom('login', 'register', 'forgot', 'reset', 'code', null),
  invite: fc.option(
    fc.record({
      token: fc.constant('t'),
      email: fc.constantFrom(...EMAILS),
      galaxies: fc.integer({ min: 0, max: 9 }),
    }),
    { nil: null },
  ),
  passwordMinLength: fc.constantFrom(undefined, 8, 12),
}) as fc.Arbitrary<Ui>;

const login = (over: Partial<Ui> = {}): Ui =>
  ({
    auth: 'login',
    invite: null,
    passwordMinLength: undefined,
    ...over,
  }) as Ui;

const invite = { token: 't', email: 'a@b.de', galaxies: 3 };

const HAND_BUILT: [string, Ui][] = [
  ['the login', login()],
  ['the login with a minimum length known', login({ passwordMinLength: 10 })],
  ['no step yet', login({ auth: null })],
  ['the registration', login({ auth: 'register', invite })],
  [
    'the registration of a universe with one galaxy',
    login({ auth: 'register', invite: { ...invite, galaxies: 1 } }),
  ],
  [
    'the registration with a minimum length and an address of markup',
    login({
      auth: 'register',
      invite: { ...invite, email: 'a&b@c<d>.de' },
      passwordMinLength: 12,
    }),
  ],
  ['a registration without an invitation', login({ auth: 'register' })],
  ['the forgotten password', login({ auth: 'forgot' })],
  ['the new password', login({ auth: 'reset', passwordMinLength: 8 })],
  ['the new password without a known minimum', login({ auth: 'reset' })],
  ['the code of the mail', login({ auth: 'code' })],
];

describe('the login against the view before #118, bundle 7', () => {
  it('renders every state of the login as before', () => {
    fc.assert(
      fc.property(state, (ui) => {
        expect(normalize(authView(ui))).toBe(normalize(auth(ui)));
        expect(textContents(authView(ui))).toEqual(textContents(auth(ui)));
      }),
      { seed: 118, numRuns: 300 },
    );
  });

  it('renders the hand-built cases as before', () => {
    for (const [name, ui] of HAND_BUILT) {
      expect(normalize(authView(ui)), name).toBe(normalize(auth(ui)));
      expect(textContents(authView(ui)), name).toEqual(textContents(auth(ui)));
    }
  });

  it('keeps the ids, marks and forms that main.ts reads', () => {
    const marks: [string, Ui, string[]][] = [
      [
        'login',
        login(),
        [
          'id="authform"',
          'id="a_name"',
          'id="a_pw"',
          'id="remember-login"',
          'data-act="forgot"',
          'data-act="passkeyLogin"',
        ],
      ],
      [
        'registration',
        login({ auth: 'register', invite }),
        [
          'id="authform"',
          'id="a_email"',
          'id="a_planet"',
          'id="a_gal"',
          'data-act="authswitch"',
          'autocomplete="new-password"',
        ],
      ],
      [
        'forgot',
        login({ auth: 'forgot' }),
        ['id="forgotform"', 'id="recovery_email"'],
      ],
      ['reset', login({ auth: 'reset' }), ['id="resetform"', 'id="pw_next"']],
      [
        'code',
        login({ auth: 'code' }),
        ['id="codeform"', 'id="login_code"', 'pattern="[0-9]{6}"'],
      ],
    ];
    for (const [name, ui, list] of marks)
      for (const mark of list)
        expect(authView(ui), `${name} ${mark}`).toContain(mark);
    for (const step of ['forgot', 'reset', 'code'] as const)
      expect(authView(login({ auth: step }))).toContain('data-act="authback"');
  });
});
