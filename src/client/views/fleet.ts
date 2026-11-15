import { SHIPS, canFly } from '../../core/catalog.ts';
import { fleetSlots, shipSpeed } from '../../core/flight.ts';
import { MISSION } from '../../core/missions.ts';
import { moonAt } from '../logic/moon.ts';
import { text } from '../../core/text.ts';
import { esc, fmt } from '../logic/format.ts';
import { fleetRows, type FleetRow } from '../logic/overview.ts';
import { box, cd, type V } from './common.ts';

const fleetText = (row: FleetRow): string =>
  row.parts.map((p) => (p.bold ? `<b>${esc(p.text)}</b>` : p.text)).join('');

function fleetRow(v: V, row: FleetRow): string {
  const button = row.recall
    ? `<button class="small" data-act="recall" data-id="${esc(row.id)}">Rückruf</button>`
    : '';
  return `<tr><td class="n w110">${cd(row.due.end, v.now)}</td><td class="${row.cls}">${fleetText(row)}</td><td class="w80">${button}</td></tr>`;
}

/** The fleet movements of the player, as the overview shows them (#118). */
function fleetTable(v: V): string {
  const list = fleetRows(v, false);
  return list.length
    ? `<table>${list.map((row) => fleetRow(v, row)).join('')}</table>`
    : '<span class="dim">Keine Flottenbewegungen.</span>';
}

function shipRows(v: V): string {
  const { P, R } = v;
  return Object.entries(SHIPS)
    .filter(([k]) => (P.ships[k] ?? 0) > 0 && canFly(k))
    .map(
      ([k]) =>
        `<tr><td>${text(k)!.n}</td><td class="n">${fmt(P.ships[k])}</td><td class="n">${fmt(shipSpeed(k, R))}</td><td><input type="number" min="0" class="fs" id="f_${k}" data-k="${k}" placeholder="0" aria-label="Anzahl ${text(k)!.n}"> <span class="lnk" data-act="fmax" data-k="${k}">max</span></td></tr>`,
    )
    .join('');
}

function targetForm(v: V, slotsFull: boolean): string {
  const { P, s, ui } = v;
  const t = ui.ft ?? { g: P.g, s: P.s, p: P.p };
  const u = s.cfg;
  // „Mond“ only where one is (#53); main.ts updates it with the coordinates.
  const moon = !!moonAt(s.galaxy, t);
  const toMoon = moon && t.kind === 'moon';
  const kinds = `<select id="t_k" aria-label="Zielart"><option value="planet">Planet</option><option value="moon"${moon ? '' : ' disabled'}${toMoon ? ' selected' : ''}>Mond</option></select>`;
  const missions = Object.entries(MISSION)
    .map(
      ([k, name]) =>
        `<option value="${k}" ${ui.fm === k ? 'selected' : ''}>${name}</option>`,
    )
    .join('');
  const speeds = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
    .map((x) => `<option value="${x}">${x * 10} %</option>`)
    .join('');
  return `<table class="kv">
  <tr><td>Ziel</td><td><input class="c3" type="number" id="t_g" value="${t.g}" min="1" max="${u.galaxies}" aria-label="Galaxie">:<input class="c3" type="number" id="t_s" value="${t.s}" min="1" max="${u.systems}" aria-label="System">:<input class="c3" type="number" id="t_p" value="${t.p}" min="1" max="${u.positions}" aria-label="Position"> ${kinds} <span id="t_info" class="dim"></span></td></tr>
  <tr><td>Auftrag</td><td><select id="t_m" aria-label="Auftrag">${missions}</select></td></tr>
  <tr><td>Geschwindigkeit</td><td><select id="t_v" aria-label="Geschwindigkeit">${speeds}</select></td></tr>
  <tr><td>Ladung (Adamant / Psikristall / Promethium)</td><td><input type="number" id="c_m" min="0" placeholder="0" aria-label="Adamant"> <input type="number" id="c_c" min="0" placeholder="0" aria-label="Psikristall"> <input type="number" id="c_d" min="0" placeholder="0" aria-label="Promethium"> <span class="lnk" data-act="cmax">alles</span></td></tr>
  <tr><td>Entfernung</td><td id="i_dist">-</td></tr><tr><td>Flugdauer (eine Richtung)</td><td id="i_dur">-</td></tr>
  <tr><td>Ankunft / Rückkehr</td><td id="i_arr">-</td></tr><tr><td>Treibstoff</td><td id="i_fuel">-</td></tr><tr><td>Laderaum</td><td id="i_cap">-</td></tr>
 </table><div class="mt10"><button data-act="send" ${slotsFull ? 'disabled' : ''}>Flotte losschicken</button> ${slotsFull ? '<span class="bad">Alle Flottenslots belegt (Kogitator-Doktrin erhöht die Anzahl).</span>' : ''}</div>`;
}

export function fleet(v: V): string {
  const slots = fleetSlots(v.R);
  // The gift of the „Endzeit“ takes no slot (#161).
  const used = v.s.fleets.filter(
    (f) => f.owner === v.s.me.id && !f.gift,
  ).length;
  const rows = shipRows(v);
  const head = box(
    `Flotten unterwegs (${used} / ${slots} Slots)`,
    fleetTable(v),
  );
  if (!rows)
    return `<h2>Flotte</h2>${head}<div class="notice">Auf diesem Planeten stehen keine Schiffe. Baue welche in der Schiffsschmiede.</div>`;
  const pick = `<table><tr><th>Schiff</th><th class="n">vorhanden</th><th class="n">Tempo</th><th>Anzahl</th></tr>${rows}</table>
  <div class="mt"><span class="lnk" data-act="fall">alle Schiffe</span> · <span class="lnk" data-act="fnone">keine Schiffe</span></div>`;
  return `<h2>Flotte</h2>${head}${box('1. Schiffe auswählen', pick)}${box('2. Ziel und Auftrag', targetForm(v, used >= slots))}`;
}
