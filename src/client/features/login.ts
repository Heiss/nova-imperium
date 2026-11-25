// The steps of the login (#118, bundle 7; formerly in main.ts): the login and
// the registration with an invitation, the code of the mail, the forgotten
// password and the new one, the login by passkey, and the form „Passwort
// ändern“ of the options (the same call as the new password). The screens are
// views/Auth.svelte; what the steps remember between two screens is
// logic/login.ts.
import { $, val } from '../dom.ts';
import { coords } from '../logic/format.ts';
import { homeSystem, login } from '../logic/login.ts';
import { client } from '../logic/state.svelte.ts';
import type { GameState } from '../logic/types.ts';
import { signInWithPasskey } from '../passkeys.ts';
import type { ClientCtx, ClientFeature } from './contract.ts';

/** Takes over the state of a login that went through and shows the game; a new account is welcomed. */
function signedIn(
  ctx: ClientCtx,
  reply: Record<string, unknown>,
  welcome = false,
): void {
  client.ui.auth = null;
  ctx.apply(reply.state as GameState);
  homeSystem(client.ui, client.game);
  if (welcome && client.game?.planet)
    ctx.toast(
      `Willkommen, ${client.game.me.name}! Dein Planet liegt bei ${coords(client.game.planet)}.`,
    );
  ctx.render(true);
}

/** The mail asks for a code, or the account was just created and must log in. */
function continueLogin(
  ctx: ClientCtx,
  reply: Record<string, unknown>,
): boolean {
  if (!reply.loginRequired && reply.code !== true && reply.app !== true)
    return false;
  // The code of the authenticator app, or of the mail (102a, #401).
  client.ui.auth =
    reply.app === true ? 'app' : reply.code === true ? 'code' : 'login';
  client.ui.invite = null;
  ctx.render(true);
  if (reply.loginRequired) ctx.toast('Konto erstellt. Melde dich jetzt an.');
  return true;
}

const rememberChosen = (): boolean =>
  Boolean($<HTMLInputElement>('#remember-login')?.checked);

async function submitAuth(ctx: ClientCtx): Promise<void> {
  const { ui } = client;
  const registering = ui.auth === 'register' && ui.invite;
  login.remember = rememberChosen();
  const body: Record<string, unknown> = {
    name: val('#a_name'),
    password: val('#a_pw'),
    remember: login.remember,
  };
  if (registering)
    Object.assign(body, {
      token: ui.invite!.token,
      planet: val('#a_planet'),
      gal: val('#a_gal'),
    });
  try {
    const j = await ctx.api(registering ? '/api/register' : '/api/login', body);
    if (continueLogin(ctx, j)) return;
    ui.invite = null;
    signedIn(ctx, j, !!registering);
  } catch (e) {
    ctx.toast((e as Error).message, e as Error);
  }
}

async function loginByPasskey(ctx: ClientCtx): Promise<void> {
  try {
    signedIn(ctx, await signInWithPasskey(ctx.api, rememberChosen()));
  } catch (error) {
    ctx.toast((error as Error).message, error as Error);
  }
}

async function submitLoginCode(ctx: ClientCtx): Promise<void> {
  try {
    // The sign-in of this browser and the wish to stay logged in are in its
    // cookie (129a, #401).
    const j = await ctx.api('/api/login/code', { code: val('#login_code') });
    signedIn(ctx, j);
  } catch (e) {
    ctx.toast((e as Error).message, e as Error);
  }
}

/** A new code for the sign-in under way (101b, #401). */
async function resendLoginCode(ctx: ClientCtx): Promise<void> {
  try {
    await ctx.api('/api/login/resend', {});
  } catch (e) {
    ctx.toast((e as Error).message, e as Error);
  }
}

async function submitForgot(ctx: ClientCtx): Promise<void> {
  try {
    await ctx.api('/api/password/forgot', { email: val('#recovery_email') });
    client.ui.auth = 'login';
    ctx.render(true);
    ctx.toast(
      'Falls die Adresse hinterlegt ist, erhältst du einen Link per E-Mail.',
    );
  } catch (e) {
    ctx.toast((e as Error).message, e as Error);
  }
}

async function submitPassword(ctx: ClientCtx, reset: boolean): Promise<void> {
  const password = val('#pw_next');
  const confirmation = val('#pw_confirm');
  if (!reset && password !== confirmation) {
    ctx.toast('Die neuen Passwörter stimmen nicht überein.', true);
    $('#pw_confirm')?.focus();
    return;
  }
  try {
    await ctx.api(reset ? '/api/password/reset' : '/api/password/change', {
      password,
      ...(reset
        ? {
            token: login.resetToken,
            // The code of the app, if the account has one (104, #401).
            ...(client.ui.resetApp ? { code: val('#reset_code') } : {}),
          }
        : { current: val('#pw_current'), confirmation }),
    });
    client.game = null;
    login.resetToken = null;
    client.ui.auth = 'login';
    ctx.render(true);
    ctx.toast('Passwort gespeichert. Melde dich mit deinem neuen Passwort an.');
  } catch (e) {
    ctx.toast((e as Error).message, e as Error);
  }
}

/** Shows another screen of the login. */
const showAuth =
  (ctx: ClientCtx, next: () => typeof client.ui.auth) => (): void => {
    client.ui.auth = next();
    ctx.render(true);
  };

export const clientFeature = {
  acts: (ctx) => ({
    forgot: showAuth(ctx, () => 'forgot'),
    authback: async () => {
      // Back from the code step, the sign-in under way ends (#401). The
      // login shows only after the answer: its cleared cookie must not come
      // after the cookie of a new sign-in begun at once.
      if (client.ui.auth === 'code' || client.ui.auth === 'app')
        await ctx.api('/api/login/cancel', {}).catch(() => undefined);
      login.resetToken = null;
      showAuth(ctx, () => 'login')();
    },
    authswitch: showAuth(ctx, () =>
      client.ui.auth === 'register' ? 'login' : 'register',
    ),
    passkeyLogin: () => loginByPasskey(ctx),
    resendcode: () => resendLoginCode(ctx),
  }),
  forms: (ctx) => ({
    authform: () => submitAuth(ctx),
    codeform: () => submitLoginCode(ctx),
    forgotform: () => submitForgot(ctx),
    resetform: () => submitPassword(ctx, true),
    passwordform: () => submitPassword(ctx, false),
  }),
} satisfies ClientFeature;
