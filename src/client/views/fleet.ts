import { MISSION, SHIPS } from '../../shared/catalog.ts';
import { shipSpeed } from '../../shared/flight.ts';
import { fmt } from '../logic/format.ts';
import { fleetTable } from './overview.ts';
import { box, type V } from './common.ts';

function shipRows(v: V): string {
  const { P, R } = v;
  return Object.entries(SHIPS)
    .filter(([k]) => (P.ships[k] ?? 0) > 0)
    .map(
      ([k, d]) =>
        `<tr><td>${d.n}</td><td class="n">${fmt(P.ships[k])}</td><td class="n">${fmt(shipSpeed(k, R))}</td><td><input type="number" min="0" class="fs" id="f_${k}" data-k="${k}" placeholder="0" aria-label="Anzahl ${d.n}"> <span class="lnk" data-act="fmax" data-k="${k}">max</span></td></tr>`,
    )
    .join('');
}

function targetForm(v: V, slotsFull: boolean): string {
  const { P, s, ui } = v;
  const t = ui.ft ?? { g: P.g, s: P.s, p: P.p };
  const u = s.cfg;
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
  <tr><td>Ziel</td><td><input class="c3" type="number" id="t_g" value="${t.g}" min="1" max="${u.galaxies}" aria-label="Galaxie">:<input class="c3" type="number" id="t_s" value="${t.s}" min="1" max="${u.systems}" aria-label="System">:<input class="c3" type="number" id="t_p" value="${t.p}" min="1" max="${u.positions}" aria-label="Position"> <span id="t_info" class="dim"></span></td></tr>
  <tr><td>Auftrag</td><td><select id="t_m" aria-label="Auftrag">${missions}</select></td></tr>
  <tr><td>Geschwindigkeit</td><td><select id="t_v" aria-label="Geschwindigkeit">${speeds}</select></td></tr>
  <tr><td>Ladung (Metall / Kristall / Deuterium)</td><td><input type="number" id="c_m" min="0" placeholder="0" aria-label="Metall"> <input type="number" id="c_c" min="0" placeholder="0" aria-label="Kristall"> <input type="number" id="c_d" min="0" placeholder="0" aria-label="Deuterium"> <span class="lnk" data-act="cmax">alles</span></td></tr>
  <tr><td>Entfernung</td><td id="i_dist">-</td></tr><tr><td>Flugdauer (eine Richtung)</td><td id="i_dur">-</td></tr>
  <tr><td>Ankunft / Rückkehr</td><td id="i_arr">-</td></tr><tr><td>Treibstoff</td><td id="i_fuel">-</td></tr><tr><td>Laderaum</td><td id="i_cap">-</td></tr>
 </table><div class="mt10"><button data-act="send" ${slotsFull ? 'disabled' : ''}>Flotte losschicken</button> ${slotsFull ? '<span class="bad">Alle Flottenslots belegt (Computertechnik erhöht die Anzahl).</span>' : ''}</div>`;
}

export function fleet(v: V): string {
  const slots = 1 + (v.R.research.computer ?? 0);
  const used = v.s.fleets.filter((f) => f.owner === v.s.me.id).length;
  const rows = shipRows(v);
  const head = box(
    `Flotten unterwegs (${used} / ${slots} Slots)`,
    fleetTable(v, false),
  );
  if (!rows)
    return `<h2>Flotte</h2>${head}<div class="notice">Auf diesem Planeten stehen keine Schiffe. Baue welche in der Schiffswerft.</div>`;
  const pick = `<table><tr><th>Schiff</th><th class="n">vorhanden</th><th class="n">Tempo</th><th>Anzahl</th></tr>${rows}</table>
  <div class="mt"><span class="lnk" data-act="fall">alle Schiffe</span> · <span class="lnk" data-act="fnone">keine Schiffe</span></div>`;
  return `<h2>Flotte</h2>${head}${box('1. Schiffe auswählen', pick)}${box('2. Ziel und Auftrag', targetForm(v, used >= slots))}`;
}
