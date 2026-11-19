import {
  ROUND_SETTINGS,
  type RoundRules,
  type RoundSetting,
  roundFieldId,
} from '../../core/round.ts';
import {
  GIFT_MINUTES,
  GIFT_RESOURCES,
  GIFT_SHIPS_EACH,
} from '../../core/endzeit.ts';
import { articleHref } from '../logic/address.ts';
import { ENDZEIT_NOTE } from '../logic/endzeit.ts';
import { reportFormHTML } from '../logic/error-report.ts';
import { explainOptionsHTML } from '../logic/explain.ts';
import { levelOptionsHTML } from '../logic/level-mode.ts';
import { homePlanetOf } from '../logic/friends.ts';
import { mainPlanetHTML } from '../logic/main-planet.ts';
import {
  highscoreButtonsHTML,
  highscoreCategory,
  highscoreNote,
  highscoreRanking,
} from '../logic/highscore.ts';
import { OWN_ACTIVITY_PLACEHOLDER } from '../logic/own-activity.ts';
import { vacationHTML } from '../logic/vacation.ts';
import { gainWarning } from '../logic/market.ts';
import { pushKindsHTML, shownPushOff } from '../logic/push-options.ts';
import { esc, fmt } from '../logic/format.ts';
import type { AdminState, GameState } from '../logic/types.ts';
import { box, homeCell, type Ui, type V } from './common.ts';

export function highscore(v: V): string {
  // One ranking per category (#78 D3); `points` is that of the category.
  const cat = highscoreCategory(v.ui.highscore);
  const list = highscoreRanking(v.s.players, cat);
  const rows = list.map(([id, x], i) => {
    // A planet, never a moon (#53).
    const home = homeCell(homePlanetOf(v.s.galaxy, id));
    return `<tr class="${id === v.s.me.id ? 'me' : ''}"><td class="n">${i + 1}</td><td>${esc(x.name)}</td><td>${home}</td><td class="n">${fmt(x.points)}</td></tr>`;
  });
  return `<h2 id="highscore-h">Highscore</h2>${highscoreButtonsHTML(cat)}<div class="box"><table class="scores"><tr><th class="n">Platz</th><th>Spieler</th><th>Heimatplanet</th><th class="n">Punkte</th></tr>${rows.join('')}</table></div><div class="dim">${highscoreNote(cat)}</div>`;
}

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

/** The article of the Lexicanum that replaced the box „Regeln dieses Universums“ (#288, B4). */
const UNIVERSE_ARTICLE = 'rule-universe';

export const help = (v: V): string => `<h2>Optionen</h2>
 ${box('Optionen', `<div class="flex">Spähschädel pro Auspex-Erkundung von der Sternenkarte: <input type="number" id="o_probes" min="1" value="${v.s.me.probes || 1}" aria-label="Spähschädel pro Auspex-Erkundung"></div><div class="flex mt"><label for="o_explain">(?)-Symbol:</label> <select id="o_explain">${explainOptionsHTML(v.s.me.explain)}</select></div><div class="flex mt"><label for="o_levels">Stufenübersicht:</label> <select id="o_levels">${levelOptionsHTML(v.s.me.levelTable)}</select></div><p><button data-act="saveopt">Speichern</button></p>`)}
 ${box('Hauptplanet', mainPlanetHTML(v.s, v.now))}
 ${box('Urlaubsmodus', vacationHTML(v.s.round.vacationHours))}
 ${box('Meine Aktivität &amp; Spielzeit', OWN_ACTIVITY_PLACEHOLDER)}
 ${box('Darstellung', `<label class="switch"><input type="checkbox" id="o_anim" ${v.ui.animations ? 'checked' : ''}> Animationen</label><p class="dim">Planeten drehen sich, Wolken ziehen. Gilt für dieses Gerät; ist im System „Bewegung reduzieren“ eingestellt, bleibt alles ruhig.</p>`)}
 ${passwordBox(v.ui)}
 ${passkeysBox()}
 ${box('App installieren', '<p>Öffne das Browsermenü und wähle „App installieren“ oder „Zum Startbildschirm hinzufügen“. Auf iPhone und iPad öffne Nova Imperium in Safari, tippe auf „Teilen“ und wähle „Zum Home-Bildschirm“ und „Als Web-App öffnen“. Zum Spielen brauchst du eine Internetverbindung.</p><button data-act="installApp" id="pwa-install" hidden>App installieren</button>')}
 ${notificationBoxes(v.s, v.ui)}
 ${box(
   'Problem melden',
   reportFormHTML('reportform', {
     source: 'form',
     page: v.ui.view,
     version: v.ui.news?.version ?? '',
     requestId: v.ui.lastRequestId ?? null,
   }),
 )}
 ${deleteAccountBox(v.s.round)}
 <p>Tempo, Größe und alle Einstellungen dieser Runde stehen im Lexicanum: <a class="lx-a" href="${articleHref(UNIVERSE_ARTICLE)}" data-act="lex" data-a="${UNIVERSE_ARTICLE}">Dieses Universum</a>.</p>`;

/** A sentence about guilds, only in a round with guilds (#191). */
const guildNote = (round: RoundRules, sentence: string): string =>
  round.guilds ? ` ${sentence}` : '';

/** The box „Account löschen“ of the options. */
export const deleteAccountBox = (round: RoundRules): string =>
  box(
    'Account löschen',
    `<p>Dein Konto und deine Spielstände werden dauerhaft gelöscht.${guildNote(round, 'Leitest du eine Gilde, wird sie aufgelöst.')}</p><button type="button" class="red" data-act="deleteAccount">Account löschen</button>`,
  );

/** The confirmation of „Account löschen“ with the password. */
export const deleteAccountDialog = (round: RoundRules): string =>
  `<form id="deleteaccountform"><p>Dein Konto und deine Spielstände werden unwiderruflich gelöscht.${guildNote(round, 'Eine von dir geleitete Gilde wird aufgelöst.')}</p><p><label for="delete-account-password">Passwort zur Bestätigung</label> <input id="delete-account-password" type="password" autocomplete="current-password" required></p><button class="red" type="submit">Account endgültig löschen</button> <button type="button" data-act="closeModal">Abbrechen</button></form>`;

/** The options of a setting with named choices, the current one selected (#283). */
const choiceOptions = (
  choices: readonly { value: number; label: string }[],
  current: number,
): string =>
  choices
    .map(
      (c) =>
        `<option value="${c.value}"${c.value === current ? ' selected' : ''}>${esc(c.label)}</option>`,
    )
    .join('');

function settingsForm(s: GameState, a: AdminState): string {
  const rows = a.specs
    .map((x) => {
      const value = s.cfg[x.key];
      const hint = x.size
        ? ' – nur vergrößern, solange dort Planeten liegen'
        : '';
      // A setting of the round with named choices is a selection (#283).
      const field = x.choices
        ? `<select id="set_${x.key}" data-setting="${x.key}" data-nokeep>${choiceOptions(x.choices, Number(value))}</select>`
        : `<input type="number" id="set_${x.key}" data-setting="${x.key}" min="${x.min}" max="${x.max}" value="${value}" data-nokeep> <span class="dim">${fmt(x.min)} bis ${fmt(x.max)}${hint}</span>`;
      return `<tr><td><label for="set_${x.key}">${esc(x.label)}</label></td><td>${field}</td></tr>`;
    })
    .join('');
  const warning = gainWarning(s.cfg);
  const gain = warning
    ? `<p class="notice" role="alert">${esc(warning)}</p>`
    : '';
  return `<table class="kv">${rows}</table>${gain}<p class="dim">Änderungen wirken sofort. Laufende Bauaufträge und Flüge behalten ihre Endzeit.</p><button data-act="saveSettings">Einstellungen speichern</button>`;
}

/**
 * The link of the last invitation is no draft: a refresh that keeps the
 * inputs would put the link of the invitation before back into the field
 * (#239), so it is not kept.
 */
function invitations(ui: Ui): string {
  const link = ui.lastLink
    ? `<div class="notice mt">Einladungslink (gilt einmal, nur jetzt sichtbar):<br><input id="inv_link" class="wide" readonly value="${esc(ui.lastLink)}" aria-label="Einladungslink" data-nokeep> <button class="small" data-act="copyLink">Kopieren</button></div>`
    : '';
  return `<form id="inviteform" class="flex"><label for="inv_email">E-Mail-Adresse</label> <input id="inv_email" type="email" required autocomplete="off" data-nokeep> <button type="submit">Einladen</button></form>${link}<div id="admin-invitations"></div>`;
}

/** The field of one setting of the round (#283), preselected with `value`. */
function roundField(s: RoundSetting, value: number | boolean): string {
  const id = roundFieldId(s);
  const label = esc(s.label);
  if (s.kind === 'switch') {
    const note = s.note ? ` aria-describedby="${id}-note"` : '';
    return `<label><input type="checkbox" id="${id}"${note} ${value ? 'checked' : ''}> ${label}</label>`;
  }
  const field = s.choices
    ? `<select id="${id}">${choiceOptions(s.choices, Number(value))}</select>`
    : `<input type="number" id="${id}" min="${s.min}" max="${s.max}" step="1" value="${Number(value)}" required> <span class="dim">${s.min} bis ${s.max}</span>`;
  return `<label for="${id}">${label}</label> ${field}`;
}

/** One setting as its own paragraph, with the note below a checkbox. */
function roundRow(s: RoundSetting, value: number | boolean): string {
  const note =
    s.kind === 'switch' && s.note
      ? `<br>\n  <span id="${roundFieldId(s)}-note">${esc(s.note)}</span>`
      : '';
  return `<p>${roundField(s, value)}${note}</p>`;
}

/**
 * The rows of the dialog „Neue Runde“, one per setting of the registry
 * (#283); the members of a group with a legend in one fieldset.
 */
function roundRows(
  round: RoundRules,
  settings: readonly RoundSetting[],
): string[] {
  const values = round as unknown as Record<string, number | boolean>;
  const rows: string[] = [];
  for (const [i, s] of settings.entries()) {
    const legend = s.group?.legend;
    if (!legend) rows.push(roundRow(s, values[s.name]!));
    else if (settings[i - 1]?.group !== s.group) {
      const members = settings
        .filter((x) => x.group === s.group)
        .map((x) => roundField(x, values[x.name]!));
      rows.push(
        `<fieldset><legend>${esc(legend)}</legend>\n    ${members.join('<br>\n    ')}\n  </fieldset>`,
      );
    }
  }
  return rows;
}

export function roundDialog(
  round: RoundRules,
  settings: readonly RoundSetting[] = ROUND_SETTINGS,
): string {
  return `<p><b>Wirklich eine neue Runde starten?</b><br>
  Planeten, Flotten, Forschung, Nachrichten und Belohnungsfortschritt werden zurückgesetzt. Das kann nicht rückgängig gemacht werden.</p>
  ${roundRows(round, settings).join('\n  ')}
  <p><button class="red" data-act="doReset">Ja, neue Runde</button> <button data-act="closeModal">Abbrechen</button></p>`;
}

/** The box „Endzeit“ of the tab „Universum“ (#161): once per round. */
function endzeitBox(a: AdminState): string {
  const body = a.endzeit.done
    ? `<p>${ENDZEIT_NOTE.done}</p>`
    : '<p>Jeder Spieler mit Heimatplanet erhält einmal pro Runde die Gabe des Gottkaisers als Verlegung zu seinem Heimatplaneten.</p><button class="red" data-act="endzeit">Endzeit einläuten</button>';
  return box('Endzeit', body);
}

/** The confirmation of the „Endzeit“ with its flight time (#161). */
export function endzeitDialog(minutes: number): string {
  return `<p><b>Endzeit einläuten – alle Spieler erhalten die Gabe des Gottkaisers.</b><br>
  Jeder Spieler mit Heimatplanet bekommt eine Verlegung zu seinem Heimatplaneten: je ${fmt(GIFT_SHIPS_EACH)} Schiffe jedes flugfähigen Typs und je ${fmt(GIFT_RESOURCES)} Adamant, Psikristall und Promethium. Bei der Ankunft werden Forschung und Gebäude des Heimatplaneten so weit ausgebaut, dass alles freigeschaltet ist. Das geht nur einmal pro Runde.</p>
  <p><label for="endzeit-minutes">Flugzeit der Gabe (Minuten)</label> <input type="number" id="endzeit-minutes" min="${GIFT_MINUTES.min}" max="${GIFT_MINUTES.max}" step="1" value="${minutes}" required> <span class="dim">${fmt(GIFT_MINUTES.min)} bis ${fmt(GIFT_MINUTES.max)} (72 h), in Echtzeit</span></p>
  <p><button class="red" data-act="doEndzeit">Ja, Endzeit einläuten</button> <button data-act="closeModal">Abbrechen</button></p>`;
}

export const ADMIN_TABS = {
  events: 'Ereignisprotokoll',
  players: 'Spieler',
  orders: 'Aufträge',
  errors: 'Fehler',
  invitations: 'Einladungen',
  universe: 'Universum',
  announce: 'Servernachricht',
} as const;

export type AdminTab = keyof typeof ADMIN_TABS;
export const diagnosticTab = (
  tab: string,
): tab is 'events' | 'players' | 'orders' =>
  tab === 'events' || tab === 'players' || tab === 'orders';

export function admin(v: V): string {
  const a = v.s.admin;
  if (!a) return '<h2>Admin</h2><div class="notice">Nur für den Admin.</div>';
  return `<h2>Admin</h2>
    <div role="tablist" aria-label="Admin-Bereiche" class="flex">${Object.entries(
      ADMIN_TABS,
    )
      .map(
        ([key, label]) =>
          `<button id="admin-tab-${key}" type="button" role="tab" aria-selected="false" aria-controls="admin-panel-${diagnosticTab(key) ? 'diagnostics' : key}" tabindex="-1" data-act="adminTab" data-tab="${key}">${label}</button>`,
      )
      .join('')}</div>
    <section id="admin-panel-diagnostics" role="tabpanel" hidden>${box('Diagnose und Protokoll', '<div id="admin-diagnostics"></div>')}</section>
    <section id="admin-panel-errors" role="tabpanel" aria-labelledby="admin-tab-errors" hidden>${box('Fehler', '<div id="admin-errors"></div>')}</section>
    <section id="admin-panel-invitations" role="tabpanel" aria-labelledby="admin-tab-invitations" hidden>${box('Einladungen', invitations(v.ui))}</section>
    <section id="admin-panel-universe" role="tabpanel" aria-labelledby="admin-tab-universe" hidden>
      ${box('Universum', settingsForm(v.s, a))}
      ${endzeitBox(a)}
      ${box('Neue Runde', 'Alle Spieler behalten ihr Konto und bekommen einen frischen Planeten. <button class="red" data-act="reset">Neue Runde starten</button>')}
    </section>
    <section id="admin-panel-announce" role="tabpanel" aria-labelledby="admin-tab-announce" hidden>${box(
      'Servernachricht',
      '<p>Die Nachricht geht an alle Spieler und per Push an Geräte mit aktivierten Benachrichtigungen.</p><form id="announceform"><label for="announce-text">Nachricht</label><br><textarea id="announce-text" maxlength="500" rows="4" required></textarea><p><button type="submit">An alle senden</button></p></form>',
    )}</section>`;
}

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
  if (ui.auth === 'code')
    return authStep(
      'Anmeldecode',
      'codeform',
      '<label for="login_code">Sechsstelliger Code aus deiner E-Mail</label> <input id="login_code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" required>',
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
