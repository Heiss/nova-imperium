import { BUILD, RES, UNIT } from '../../shared/catalog.ts';
import {
  afford,
  caps,
  lvlCost,
  prod,
  reqMissing,
  researchTime,
  satPower,
} from '../../shared/economy.ts';
import { dur, esc, fmt } from '../logic/format.ts';
import { researchState } from '../logic/game.ts';
import { cd, costHTML, itemHTML, requirementsHTML, type V } from './common.ts';

function researchAction(v: V, k: string, level: number, miss: number): string {
  const { P, R, now } = v;
  const c = lvlCost(RES[k]!, level + 1);
  const state = researchState(P, R, k, miss);
  if (state === 'running')
    return `Forschung Stufe ${R.rq!.lvl}<br>${cd(R.rq!.end, now)}<br><button class="small red" data-act="cancelResearch">Abbrechen</button>`;
  if (state === 'missing')
    return '<span class="req">Voraussetzungen fehlen</span>';
  if (state === 'busy')
    return '<span class="dim">Es wird bereits geforscht</span>';
  if (state === 'labBusy')
    return '<span class="dim">Labor wird ausgebaut</span>';
  return `<button data-act="research" data-k="${k}" ${afford(P, c) ? '' : 'disabled'}>Forschen${level ? ` (Stufe ${level + 1})` : ''}</button>`;
}

export function research(v: V): string {
  const home = v.s.homePlanet;
  if (home && v.P.id !== home) {
    return `<h2>Forschung</h2><div class="notice">Die Forschung findet auf deinem Heimatplaneten statt. <button data-act="selectPlanet" data-id="${esc(home)}">Zum Heimatplaneten</button></div>`;
  }
  const { P, R, s } = v;
  if (!((P.b.lab ?? 0) > 0))
    return '<h2>Forschung</h2><div class="notice">Für Forschung brauchst du ein Forschungslabor.</div>';
  const items = Object.entries(RES).map(([k, d]) => {
    const level = R.research[k] ?? 0;
    const c = lvlCost(d, level + 1);
    const miss = reqMissing(d, P, R);
    const body =
      costHTML(c, P) +
      `<div class="dim">Forschungszeit: ${dur(researchTime(c, P, s.cfg))}</div>` +
      requirementsHTML(v, d.req, 'home');
    return itemHTML(
      v,
      'ic-r',
      k,
      d,
      level ? `(Stufe ${level})` : '',
      body,
      researchAction(v, k, level, miss.length),
    );
  });
  return `<h2>Forschung</h2><div class="box">${items.join('')}</div>`;
}

const SHARES = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0];
const g = (l: number): number => l * Math.pow(1.1, l);

function shareSelect(v: V, k: string): string {
  const current = v.P.pct[k] ?? 100;
  const options = SHARES.map(
    (x) => `<option ${current === x ? 'selected' : ''}>${x}</option>`,
  ).join('');
  return `<select data-chg="pct" data-k="${k}" data-nokeep aria-label="Leistung ${BUILD[k]?.n ?? UNIT[k]?.n}">${options}</select> %`;
}

function producerRows(v: V): string {
  const { P, s } = v;
  const pr = prod(P, s.cfg);
  const L = (k: string): number => P.b[k] ?? 0;
  const pc = (k: string): number => (P.pct[k] ?? 100) / 100;
  const sp = s.cfg.speed;
  const eSat = satPower(P);
  const cell = (x: string, cls = 'n'): string => `<td class="${cls}">${x}</td>`;
  const use = (k: string, f: number): string =>
    cell(`-${fmt(f * g(L(k)) * pc(k))}`, 'n bad');
  return [
    `<tr><td>Grundeinkommen</td>${cell(fmt(20 * sp))}${cell(fmt(10 * sp))}${cell('0')}${cell('0')}<td></td></tr>`,
    `<tr><td>Metallmine (Stufe ${L('metal')})</td>${cell(fmt(30 * g(L('metal')) * pc('metal') * pr.f * sp))}${cell('0')}${cell('0')}${use('metal', 10)}<td>${shareSelect(v, 'metal')}</td></tr>`,
    `<tr><td>Kristallmine (Stufe ${L('crystal')})</td>${cell('0')}${cell(fmt(20 * g(L('crystal')) * pc('crystal') * pr.f * sp))}${cell('0')}${use('crystal', 10)}<td>${shareSelect(v, 'crystal')}</td></tr>`,
    `<tr><td>Deuteriumsynth. (Stufe ${L('deut')})</td>${cell('0')}${cell('0')}${cell(fmt(pr.d))}${use('deut', 20)}<td>${shareSelect(v, 'deut')}</td></tr>`,
    `<tr><td>Solarkraftwerk (Stufe ${L('solar')})</td>${cell('0')}${cell('0')}${cell('0')}${cell(fmt(pr.eProd - eSat), 'n good')}<td>${shareSelect(v, 'solar')}</td></tr>`,
    `<tr><td>Solarsatelliten (${fmt(P.ships.sat ?? 0)})</td>${cell('0')}${cell('0')}${cell('0')}${cell(fmt(eSat), 'n good')}<td>${shareSelect(v, 'sat')}</td></tr>`,
  ].join('');
}

export function resources(v: V): string {
  const { P, s } = v;
  const pr = prod(P, s.cfg);
  const cp = caps(P, s.cfg);
  return `<h2>Rohstoffe auf ${esc(P.name)}</h2><div class="box"><div class="hd">Produktion pro Stunde (Produktionsfaktor ${Math.round(pr.f * 100)} %)</div><div class="bd"><table>
 <tr><th></th><th class="n">Metall</th><th class="n">Kristall</th><th class="n">Deuterium</th><th class="n">Energie</th><th>Leistung</th></tr>
 ${producerRows(v)}
 <tr><th>Lagerkapazität</th><th class="n">${fmt(cp.m)}</th><th class="n">${fmt(cp.c)}</th><th class="n">${fmt(cp.d)}</th><th class="n">-</th><th></th></tr>
 <tr><th>Summe / Stunde</th><th class="n">${fmt(pr.m)}</th><th class="n">${fmt(pr.c)}</th><th class="n">${fmt(pr.d)}</th><th class="n">${fmt(pr.eProd - pr.eUse)}</th><th></th></tr>
 <tr><td>pro Tag</td><td class="n">${fmt(pr.m * 24)}</td><td class="n">${fmt(pr.c * 24)}</td><td class="n">${fmt(pr.d * 24)}</td><td></td><td></td></tr>
 </table></div></div>`;
}
