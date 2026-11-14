import { RES, type ResearchDef } from '../../core/catalog.ts';
import {
  afford,
  lvlCost,
  production,
  reqMissing,
  researchTime,
} from '../../core/economy.ts';
import {
  energyNeed,
  energyShort,
  labSite,
  networkLab,
} from '../../core/research.ts';
import { dur, esc, fmt } from '../logic/format.ts';
import { researchState } from '../logic/game.ts';
import { cd, costHTML, itemHTML, requirementsHTML, type V } from './common.ts';

/** The name of the own planet where the running research started (#49). */
function researchPlace(v: V): string {
  const id = v.R.rq?.planet ?? v.s.homePlanet;
  if (id === v.P.id) return v.P.name;
  return v.s.galaxy.find((p) => p.id === id)?.name ?? '';
}

function researchAction(
  v: V,
  k: string,
  level: number,
  miss: number,
  short: number,
): string {
  const { P, R, now } = v;
  const c = lvlCost(RES[k]!, level + 1);
  const state = researchState(P, R, k, miss, short);
  if (state === 'running')
    return `Forschung Stufe ${R.rq!.lvl}<br>auf ${esc(researchPlace(v))}<br>${cd(R.rq!.end, now)}<br><button class="small red" data-act="cancelResearch">Abbrechen</button>`;
  if (state === 'missing')
    return '<span class="req">Das Wissen ist noch verschlossen</span>';
  if (state === 'busy')
    return '<span class="dim">Es wird bereits geforscht</span>';
  if (state === 'labBusy')
    return '<span class="dim">Scholarium wird ausgebaut</span>';
  if (state === 'noEnergy')
    return `<span class="req">Zu wenig Energie: es fehlen ${fmt(short)}</span>`;
  return `<button data-act="research" data-k="${k}" ${afford(P, c) ? '' : 'disabled'}>Forschen${level ? ` (Stufe ${level + 1})` : ''}</button>`;
}

/** Without a lab here: the own planets that have one (#49). */
function noLab(v: V): string {
  const others = v.s.labs
    .filter((l) => l.lab > 0 && l.id !== v.P.id)
    .map((l) => v.s.galaxy.find((p) => p.id === l.id))
    .filter((p) => !!p)
    .map(
      (p) =>
        ` <button data-act="selectPlanet" data-id="${esc(p.id)}">Zu ${esc(p.name)}</button>`,
    );
  const text = others.length
    ? 'Auf diesem Planeten gibt es kein Scholarium. Geforscht wird auf einem deiner Planeten mit Scholarium.'
    : 'Für Forschung brauchst du ein Scholarium.';
  return `<h2>Forschung</h2><div class="notice">${text}${others.join('')}</div>`;
}

/** The lab of this planet and how many others the IFN may link. */
function labLine(v: V): string {
  const ifn = v.R.research.ifn ?? 0;
  const net = ifn
    ? ` · Sternennetz der Gelehrten: bis zu ${ifn} weitere${ifn === 1 ? 's Scholarium' : ' Scholarien'}`
    : '';
  return `<div class="dim">Scholarium Stufe ${v.P.b.lab ?? 0}${net}</div>`;
}

function researchItem(v: V, k: string, d: ResearchDef): string {
  const { P, R, s } = v;
  const level = R.research[k] ?? 0;
  const c = lvlCost(d, level + 1);
  const lab = networkLab(k, labSite(P), s.labs, R.research.ifn ?? 0);
  const linked =
    lab === (P.b.lab ?? 0) ? '' : ` (Scholarien zusammen Stufe ${lab})`;
  const short = energyShort(d, level + 1, P, s.cfg, R.research);
  const energy = {
    need: energyNeed(d, level + 1),
    production: production(P, s.cfg, R.research).eProd,
  };
  const body =
    costHTML(c, P, 1, energy) +
    `<div class="dim">Forschungszeit: ${dur(researchTime(c, { b: { lab } }, s.cfg))}${linked}</div>` +
    requirementsHTML(v, d.req);
  return itemHTML(
    v,
    'ic-r',
    k,
    level ? `(Stufe ${level})` : '',
    body,
    researchAction(v, k, level, reqMissing(d, P, R).length, short),
  );
}

/** Research starts on the shown planet when it has a lab (#49). */
export function research(v: V): string {
  if (!((v.P.b.lab ?? 0) > 0)) return noLab(v);
  const items = Object.entries(RES).map(([k, d]) => researchItem(v, k, d));
  return `<h2>Forschung auf ${esc(v.P.name)}</h2>${labLine(v)}<div class="box">${items.join('')}</div>`;
}
