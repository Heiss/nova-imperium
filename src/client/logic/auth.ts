// What the login, the registration and the steps after them show (#118,
// bundle 7; okf/architecture/patterns.md, section 9), without the HTML: the
// component Auth renders it. The ids, `data-act`s and form ids belong to
// main.ts (`authform`, `forgotform`, `resetform`, `codeform`, the acts
// `forgot`, `authback`, `authswitch`, `passkeyLogin`) and read the fields
// (`#a_name`, `#a_pw`, `#a_planet`, `#a_gal`, `#remember-login`,
// `#recovery_email`, `#pw_next`, `#login_code`).
import type { Ui } from '../views/common.ts';

/** The screen of `ui.auth`: the login, the registration with an invitation, or one of the steps. */
export type AuthPage =
  | { kind: 'forgot' }
  | { kind: 'reset'; minLength: number | undefined }
  | { kind: 'code' }
  | { kind: 'login' }
  | {
      kind: 'register';
      minLength: number | undefined;
      /** The address of the invitation, which the player cannot change. */
      email: string;
      /** The galaxies to choose from, 1 to the number of the universe. */
      galaxies: number[];
    };

/** The screen for the state of the login; the registration only with a checked invitation. */
export function authPage(
  ui: Pick<Ui, 'auth' | 'invite' | 'passwordMinLength'>,
): AuthPage {
  const minLength = ui.passwordMinLength;
  if (ui.auth === 'forgot') return { kind: 'forgot' };
  if (ui.auth === 'reset') return { kind: 'reset', minLength };
  if (ui.auth === 'code') return { kind: 'code' };
  if (ui.auth === 'register' && ui.invite !== null)
    return {
      kind: 'register',
      minLength,
      email: ui.invite.email,
      galaxies: Array.from({ length: ui.invite.galaxies }, (_, i) => i + 1),
    };
  return { kind: 'login' };
}
