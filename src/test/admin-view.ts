// The page „Admin“, the dialogs of the admin and the login as markup, for the
// tests of the components (#118, bundle 7): rendered on the server side of
// Svelte, without its comments.
import { render } from 'svelte/server';
import {
  adminPage,
  endzeitDialogPage,
  roundDialogPage,
} from '../client/logic/admin.ts';
import { authPage } from '../client/logic/auth.ts';
import type { Ui, V } from '../client/views/common.ts';
import Admin from '../client/views/Admin.svelte';
import Auth from '../client/views/Auth.svelte';
import EndzeitDialog from '../client/views/EndzeitDialog.svelte';
import RoundDialog from '../client/views/RoundDialog.svelte';
import { normalize, stripComments } from './markup.ts';

/** The page; a state of a test that has no players has none (the diagnostics list them). */
export const adminView = (v: V): string =>
  stripComments(
    render(Admin, {
      props: {
        page: adminPage({ ...v, s: { ...v.s, players: v.s.players ?? {} } }),
      },
    }).body,
  );

export const roundDialogView = (
  ...args: Parameters<typeof roundDialogPage>
): string =>
  stripComments(
    render(RoundDialog, { props: { page: roundDialogPage(...args) } }).body,
  );

export const endzeitDialogView = (minutes: number): string =>
  stripComments(
    render(EndzeitDialog, { props: { page: endzeitDialogPage(minutes) } }).body,
  );

export const authView = (ui: Ui): string =>
  stripComments(render(Auth, { props: { page: authPage(ui) } }).body);

/** The page „Admin“ as a browser shows it (normalize() of markup.ts), for the tests of what it says. */
export const adminMarkup = (v: V): string => normalize(adminView(v));

/** The dialog „Neue Runde“ as a browser shows it. */
export const roundDialogMarkup = (
  ...args: Parameters<typeof roundDialogPage>
): string => normalize(roundDialogView(...args));
