import type { Universe } from '../../shared/types.ts';
import { coords, dt, esc, fmt } from '../logic/format.ts';
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
 <li>Eine Bauschleife für Gebäude, eine Forschung gleichzeitig. Die Werft arbeitet Aufträge nacheinander ab.</li>
 <li>Kampf wie damals: bis zu 6 Runden, Schilde laden jede Runde neu, Schnellfeuer, 70 % der zerstörten Verteidigung wird wiederaufgebaut.</li>
 <li>Gewinnt der Angreifer, nimmt er bis zu 50 % der Rohstoffe mit, so viel in die Laderäume passt.</li>
 <li>Noobschutz: Wer weniger als ein Fünftel deiner Punkte hat, ist vor deinen Angriffen und Spionagen geschützt (in der Galaxie mit (n) markiert).</li>
 <li>Flottenslots: 1 + Stufe der Computertechnik. Der Server rechnet rund um die Uhr – auch wenn du offline bist.</li>
 <li>Kein Premium, keine Dunkle Materie – nur Rohstoffe und Geduld.</li></ul>`;

export const help = (v: V): string => `<h2>Hilfe &amp; Optionen</h2>
 ${box('Optionen', `<div class="flex">Sonden pro Spionage aus der Galaxie: <input type="number" id="o_probes" min="1" value="${v.s.me.probes || 1}" aria-label="Sonden pro Spionage"> <button data-act="saveopt">Speichern</button></div>`)}
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

function invitations(a: AdminState, ui: Ui): string {
  const rows = a.invitations
    .map(
      (i) =>
        `<tr><td>${esc(i.email)}</td><td>${dt(i.created)}</td><td>${dt(i.expires)}</td><td><button class="small red" data-act="revoke" data-id="${esc(i.id)}">Widerrufen</button></td></tr>`,
    )
    .join('');
  const list = rows
    ? `<table class="mini mt"><tr><th>Adresse</th><th>erstellt</th><th>gültig bis</th><th></th></tr>${rows}</table>`
    : '<p class="dim">Keine offenen Einladungen.</p>';
  const link = ui.lastLink
    ? `<div class="notice mt">Einladungslink (gilt einmal, nur jetzt sichtbar):<br><input id="inv_link" class="wide" readonly value="${esc(ui.lastLink)}" aria-label="Einladungslink"> <button class="small" data-act="copyLink">Kopieren</button></div>`
    : '';
  return `<form id="inviteform" class="flex"><label for="inv_email">E-Mail-Adresse</label> <input id="inv_email" type="email" required autocomplete="off" data-nokeep> <button type="submit">Einladen</button></form>${link}${list}`;
}

export function admin(v: V): string {
  const a = v.s.admin;
  if (!a) return '<h2>Admin</h2><div class="notice">Nur für den Admin.</div>';
  return `<h2>Admin</h2>
 ${box('Einladungen', invitations(a, v.ui))}
 ${box('Universum', settingsForm(v.s, a))}
 ${box('Neue Runde', 'Alle Spieler behalten ihr Konto, bekommen aber einen frischen Planeten, Forschung wird zurückgesetzt. <button class="red" data-act="reset">Neue Runde starten</button>')}`;
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

/** Login, or registration with an invitation link (#invite=…). */
export function auth(ui: Ui): string {
  const reg = ui.auth === 'register' && ui.invite !== null;
  const note = reg
    ? ''
    : '<p class="dim">Ein Konto bekommst du nur mit einer Einladung vom Admin.</p>';
  const back = reg
    ? '<span class="lnk ml" data-act="authswitch">Ich habe schon ein Konto</span>'
    : '';
  return `<div class="box auth"><div class="hd">${reg ? 'Neues Imperium gründen' : 'Login'}</div><div class="bd"><form id="authform"><table class="kv">
 <tr><td><label for="a_name">Name</label></td><td><input id="a_name" maxlength="20" autocomplete="username" required></td></tr>
 <tr><td><label for="a_pw">Passwort</label></td><td><input id="a_pw" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" required></td></tr>
 ${reg ? registerRows(ui) : ''}
 </table><p><button type="submit">${reg ? 'Imperium gründen' : 'Einloggen'}</button> ${back}</p>${note}</form></div></div>`;
}
