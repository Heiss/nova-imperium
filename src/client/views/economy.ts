import { BUILD, RES } from '../../shared/catalog.ts';
import {
  afford,
  buildTime,
  caps,
  lvlCost,
  prod,
  reqMissing,
  researchTime,
} from '../../shared/economy.ts';
import { dur, esc, fmt } from '../logic/format.ts';
import { buildState, researchState } from '../logic/game.ts';
import { cd, costHTML, itemHTML, needs, type V } from './common.ts';

function buildAction(v: V, k: string, level: number, miss: number): string {
  const { P, R, now } = v;
  const c = lvlCost(BUILD[k]!, level + 1);
  const state = buildState(P, R, k, miss);
  if (state === 'running')
    return `Ausbau auf Stufe ${P.bq!.lvl}<br>${cd(P.bq!.end, now)}<br><button class="small red" data-act="cancelBuild">Abbrechen</button>`;
  if (state === 'missing')
    return '<span class="req">Voraussetzungen fehlen</span>';
  if (state === 'queueBusy')
    return '<span class="dim">Bauschleife belegt</span>';
  if (state === 'yardBusy')
    return '<span class="dim">Werft arbeitet gerade</span>';
  if (state === 'labBusy')
    return '<span class="dim">Labor forscht gerade</span>';
  const label = level ? `Ausbauen auf Stufe ${level + 1}` : 'Bauen';
  return `<button data-act="build" data-k="${k}" ${afford(P, c) ? '' : 'disabled'}>${label}</button>`;
}

export function buildings(v: V): string {
  const { P, R, s } = v;
  const items = Object.entries(BUILD).map(([k, d]) => {
    const level = P.b[k] ?? 0;
    const c = lvlCost(d, level + 1);
    const miss = reqMissing(d, P, R);
    const body =
      costHTML(c, P) +
      `<div class="dim">Bauzeit: ${dur(buildTime(c, P, s.cfg))}</div>` +
      needs(miss);
    return itemHTML(
      'ic-b',
      k,
      d,
      level ? `(Stufe ${level})` : '',
      body,
      buildAction(v, k, level, miss.length),
    );
  });
  return `<h2>Gebäude</h2><div class="box">${items.join('')}</div>`;
}

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
      needs(miss);
    return itemHTML(
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
  return `<select data-chg="pct" data-k="${k}" data-nokeep aria-label="Leistung ${BUILD[k]?.n}">${options}</select> %`;
}

function producerRows(v: V): string {
  const { P, s } = v;
  const pr = prod(P, s.cfg);
  const L = (k: string): number => P.b[k] ?? 0;
  const pc = (k: string): number => (P.pct[k] ?? 100) / 100;
  const sp = s.cfg.speed;
  const cell = (x: string, cls = 'n'): string => `<td class="${cls}">${x}</td>`;
  const use = (k: string, f: number): string =>
    cell(`-${fmt(f * g(L(k)) * pc(k))}`, 'n bad');
  return [
    `<tr><td>Grundeinkommen</td>${cell(fmt(20 * sp))}${cell(fmt(10 * sp))}${cell('0')}${cell('0')}<td></td></tr>`,
    `<tr><td>Metallmine (Stufe ${L('metal')})</td>${cell(fmt(30 * g(L('metal')) * pc('metal') * pr.f * sp))}${cell('0')}${cell('0')}${use('metal', 10)}<td>${shareSelect(v, 'metal')}</td></tr>`,
    `<tr><td>Kristallmine (Stufe ${L('crystal')})</td>${cell('0')}${cell(fmt(20 * g(L('crystal')) * pc('crystal') * pr.f * sp))}${cell('0')}${use('crystal', 10)}<td>${shareSelect(v, 'crystal')}</td></tr>`,
    `<tr><td>Deuteriumsynth. (Stufe ${L('deut')})</td>${cell('0')}${cell('0')}${cell(fmt(pr.d))}${use('deut', 20)}<td>${shareSelect(v, 'deut')}</td></tr>`,
    `<tr><td>Solarkraftwerk (Stufe ${L('solar')})</td>${cell('0')}${cell('0')}${cell('0')}${cell(fmt(pr.eProd), 'n good')}<td>${shareSelect(v, 'solar')}</td></tr>`,
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
