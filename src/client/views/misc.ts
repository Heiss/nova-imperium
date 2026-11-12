import type { RoundRules } from '../../shared/achievements.ts';
import type { Universe } from '../../shared/types.ts';
import { explainOptionsHTML } from '../logic/explain.ts';
import { coords, esc, fmt } from '../logic/format.ts';
import type { AdminState, GameState } from '../logic/types.ts';
import { box, type Ui, type V } from './common.ts';

export function highscore(v: V): string {
  const list = Object.entries(v.s.players).sort(
    (a, b) => b[1].points - a[1].points,
  );
  const rows = list.map(([id, x], i) => {
    const pl = v.s.galaxy.find((p) => p.owner === id);
    const home = pl
      ? `${esc(pl.name)} <span class="lnk" data-act="gto" data-g="${pl.g}" data-s="${pl.s}">${coords(pl)}</span>`
      : '-';
    return `<tr class="${id === v.s.me.id ? 'me' : ''}"><td class="n">${i + 1}</td><td>${esc(x.name)}</td><td>${home}</td><td class="n">${fmt(x.points)}</td></tr>`;
  });
  return `<h2>Highscore</h2><div class="box"><table><tr><th class="n">Platz</th><th>Spieler</th><th>Heimatplanet</th><th class="n">Punkte</th></tr>${rows.join('')}</table></div><div class="dim">1 Punkt = 1.000 verbaute Rohstoffe (Gebäude, Forschung, Schiffe, Verteidigung).</div>`;
}

const rules = (u: Universe): string => `<ul class="rules">
 <li>Speed-Universum <b>x${u.speed}</b>: Produktion, Bauzeiten und Flüge laufen ${u.speed}× so schnell wie im Original.</li>
 <li>${u.galaxies} Galaxien × ${u.systems} Systeme × ${u.positions} Positionen. Jeder Spieler hat einen Heimatplaneten.</li>
 <li>Eine Bauschleife für Gebäude, eine Forschung gleichzeitig. Die Schiffsschmiede arbeitet Aufträge nacheinander ab.</li>
 <li>Kampf wie damals: bis zu 6 Runden, Schilde laden jede Runde neu, Schnellfeuer, 70 % der zerstörten Verteidigung wird wiederaufgebaut.</li>
 <li>Gewinnt der Angreifer, nimmt er bis zu 50 % der Rohstoffe mit, so viel in die Laderäume passt.</li>
 <li>Noobschutz: Wer weniger als ein Fünftel deiner Punkte hat, ist vor deinen Angriffen und Auspex-Erkundungen geschützt (auf der Sternenkarte mit (n) markiert).</li>
 <li>Flottenslots: 1 + Stufe der Kogitator-Doktrin. Der Server rechnet rund um die Uhr – auch wenn du offline bist.</li>
 <li>Kein Premium, keine Dunkle Materie – nur Rohstoffe und Geduld.</li></ul>`;

const passwordMinimum = (ui: Ui): string =>
  ui.passwordMinLength === undefined
    ? ''
    : `minlength="${ui.passwordMinLength}"`;

export const help = (v: V): string => `<h2>Hilfe &amp; Optionen</h2>
 ${box('Optionen', `<div class="flex">Spähschädel pro Auspex-Erkundung von der Sternenkarte: <input type="number" id="o_probes" min="1" value="${v.s.me.probes || 1}" aria-label="Spähschädel pro Auspex-Erkundung"></div><div class="flex mt"><label for="o_explain">Erklärungstexte:</label> <select id="o_explain">${explainOptionsHTML(v.s.me.explain)}</select></div><p><button data-act="saveopt">Speichern</button></p>`)}
 ${box('Darstellung', `<label class="switch"><input type="checkbox" id="o_anim" ${v.ui.animations ? 'checked' : ''}> Animationen</label><p class="dim">Planeten drehen sich, Wolken ziehen. Gilt für dieses Gerät; ist im System „Bewegung reduzieren“ eingestellt, bleibt alles ruhig.</p>`)}
 ${box(
   'Passwort ändern',
   `<form id="passwordform" class="flex">
 <label for="pw_current">Bisheriges Passwort</label> <input id="pw_current" type="password" autocomplete="current-password" required>
 <label for="pw_next">Neues Passwort</label> <input id="pw_next" type="password" autocomplete="new-password" ${passwordMinimum(v.ui)} required>
 <label for="pw_confirm">Neues Passwort wiederholen</label> <input id="pw_confirm" type="password" autocomplete="new-password" ${passwordMinimum(v.ui)} required>
 <button type="submit">Passwort ändern</button></form>`,
 )}
 ${box('Passkeys', '<p>Auf unterstützten Geräten kannst du dich mit einem Passkey anmelden.</p><form id="passkeyform" class="flex"><label for="passkey-password">Passwort für neuen Passkey</label><input id="passkey-password" type="password" autocomplete="current-password" required><button type="submit">Passkey hinzufügen</button></form><p><button type="button" data-act="listPasskeys">Gespeicherte Passkeys anzeigen</button></p><div id="passkey-list"></div>')}
 ${box('App installieren', '<p>Öffne das Browsermenü und wähle „App installieren“ oder „Zum Startbildschirm hinzufügen“. Auf iPhone und iPad öffne Nova Imperium in Safari, tippe auf „Teilen“ und wähle „Zum Home-Bildschirm“ und „Als Web-App öffnen“. Zum Spielen brauchst du eine Internetverbindung.</p><button data-act="installApp" id="pwa-install" hidden>App installieren</button>')}
 ${box('Browser-Benachrichtigungen', '<p>Meldungen zu Aufträgen, Flotten und neuen Nachrichten auf diesem Gerät.</p><button data-act="pushEnable">Aktivieren</button> <button data-act="pushDisable">Deaktivieren</button>')}
 ${box('Account löschen', '<p>Dein Konto und deine Spielstände werden dauerhaft gelöscht. Leitest du eine Gilde, wird sie aufgelöst.</p><button type="button" class="red" data-act="deleteAccount">Account löschen</button>')}
 ${box('Regeln dieses Universums', rules(v.s.cfg))}`;

function settingsForm(s: GameState, a: AdminState): string {
  const rows = a.specs
    .map((x) => {
      const value = s.cfg[x.key];
      const hint = x.size
        ? ' – nur vergrößern, solange dort Planeten liegen'
        : '';
      return `<tr><td><label for="set_${x.key}">${esc(x.label)}</label></td><td><input type="number" id="set_${x.key}" data-setting="${x.key}" min="${x.min}" max="${x.max}" value="${value}" data-nokeep> <span class="dim">${fmt(x.min)} bis ${fmt(x.max)}${hint}</span></td></tr>`;
    })
    .join('');
  return `<table class="kv">${rows}</table><p class="dim">Änderungen wirken sofort. Laufende Bauaufträge und Flüge behalten ihre Endzeit.</p><button data-act="saveSettings">Einstellungen speichern</button>`;
}

function invitations(ui: Ui): string {
  const link = ui.lastLink
    ? `<div class="notice mt">Einladungslink (gilt einmal, nur jetzt sichtbar):<br><input id="inv_link" class="wide" readonly value="${esc(ui.lastLink)}" aria-label="Einladungslink"> <button class="small" data-act="copyLink">Kopieren</button></div>`
    : '';
  return `<form id="inviteform" class="flex"><label for="inv_email">E-Mail-Adresse</label> <input id="inv_email" type="email" required autocomplete="off" data-nokeep> <button type="submit">Einladen</button></form>${link}<div id="admin-invitations"></div>`;
}

export function roundDialog(round: RoundRules): string {
  return `<p><b>Wirklich eine neue Runde starten?</b><br>
  Planeten, Flotten, Forschung, Nachrichten und Belohnungsfortschritt werden zurückgesetzt. Das kann nicht rückgängig gemacht werden.</p>
  <fieldset><legend>Belohnungen für die neue Runde</legend>
    <label><input type="checkbox" id="round-achievements" ${round.achievements ? 'checked' : ''}> Achievements aktivieren</label><br>
    <label><input type="checkbox" id="round-daily" ${round.daily ? 'checked' : ''}> Tagesbelohnungen aktivieren</label>
  </fieldset>
  <p><button class="red" data-act="doReset">Ja, neue Runde</button> <button data-act="closeModal">Abbrechen</button></p>`;
}

export const ADMIN_TABS = {
  events: 'Ereignisprotokoll',
  players: 'Spieler',
  orders: 'Aufträge',
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
    <section id="admin-panel-invitations" role="tabpanel" aria-labelledby="admin-tab-invitations" hidden>${box('Einladungen', invitations(v.ui))}</section>
    <section id="admin-panel-universe" role="tabpanel" aria-labelledby="admin-tab-universe" hidden>
      ${box('Universum', settingsForm(v.s, a))}
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
