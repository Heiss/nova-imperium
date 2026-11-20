// The account boxes of the lock screen of the vacation mode, still HTML
// (views/vacation-lock.ts), and the dialog „Account löschen“.
import type { RoundRules } from '../../core/round.ts';
import { deleteAccountText } from '../logic/options.ts';
import { pushKindsHTML, shownPushOff } from '../logic/push-options.ts';
import type { GameState } from '../logic/types.ts';
import { box, type Ui } from './common.ts';

// The phone-overflow spec of the E2E suite reads the names of the tabs here.
export { ADMIN_TABS } from '../logic/admin.ts';

const passwordMinimum = (ui: Ui): string =>
  ui.passwordMinLength === undefined
    ? ''
    : `minlength="${ui.passwordMinLength}"`;

/** The push kinds (#192); only on a server that sends Web Push. */
const pushKindsBox = (s: Pick<GameState, 'me' | 'round'>, ui: Ui): string => {
  const kinds = pushKindsHTML(
    ui.webPush,
    shownPushOff(ui, s.me.pushOff),
    s.round.guilds,
  );
  return kinds ? box('Benachrichtigungen', kinds) : '';
};

/** The box „Passwort ändern“ of the account options. */
export const passwordBox = (ui: Ui): string =>
  box(
    'Passwort ändern',
    `<form id="passwordform" class="flex">
 <label for="pw_current">Bisheriges Passwort</label> <input id="pw_current" type="password" autocomplete="current-password" required>
 <label for="pw_next">Neues Passwort</label> <input id="pw_next" type="password" autocomplete="new-password" ${passwordMinimum(ui)} required>
 <label for="pw_confirm">Neues Passwort wiederholen</label> <input id="pw_confirm" type="password" autocomplete="new-password" ${passwordMinimum(ui)} required>
 <button type="submit">Passwort ändern</button></form>`,
  );

/** The box „Passkeys“ of the account options. */
export const passkeysBox = (): string =>
  box(
    'Passkeys',
    '<p>Auf unterstützten Geräten kannst du dich mit einem Passkey anmelden.</p><form id="passkeyform" class="flex"><label for="passkey-password">Passwort für neuen Passkey</label><input id="passkey-password" type="password" autocomplete="current-password" required><button type="submit">Passkey hinzufügen</button></form><p><button type="button" data-act="listPasskeys">Gespeicherte Passkeys anzeigen</button></p><div id="passkey-list"></div>',
  );

/** The boxes of the push settings: the kinds and the browser notifications. */
export const notificationBoxes = (
  s: Pick<GameState, 'me' | 'round'>,
  ui: Ui,
): string =>
  `${pushKindsBox(s, ui)}
 ${box('Browser-Benachrichtigungen', '<p>Meldungen zu Aufträgen, Flotten und neuen Nachrichten auf diesem Gerät.</p><button data-act="pushEnable">Aktivieren</button> <button data-act="pushDisable">Deaktivieren</button>')}`;

/** A sentence about guilds, only in a round with guilds (#191). */
const guildNote = (round: RoundRules, sentence: string): string =>
  round.guilds ? ` ${sentence}` : '';

/** The box „Account löschen“ of the options. */
export const deleteAccountBox = (round: RoundRules): string =>
  box(
    'Account löschen',
    `<p>${deleteAccountText(round)}</p><button type="button" class="red" data-act="deleteAccount">Account löschen</button>`,
  );

/** The confirmation of „Account löschen“ with the password. */
export const deleteAccountDialog = (round: RoundRules): string =>
  `<form id="deleteaccountform"><p>Dein Konto und deine Spielstände werden unwiderruflich gelöscht.${guildNote(round, 'Eine von dir geleitete Gilde wird aufgelöst.')}</p><p><label for="delete-account-password">Passwort zur Bestätigung</label> <input id="delete-account-password" type="password" autocomplete="current-password" required></p><button class="red" type="submit">Account endgültig löschen</button> <button type="button" data-act="closeModal">Abbrechen</button></form>`;
