import { DEF, SHIPS, UNIT, type UnitDef } from '../../shared/catalog.ts';
import { maxAfford, reqMissing, unitTime } from '../../shared/economy.ts';
import { shipSpeed } from '../../shared/flight.ts';
import type { Levels } from '../../shared/types.ts';
import { dur, fmt } from '../logic/format.ts';
import { cd, costHTML, itemHTML, requirementsHTML, type V } from './common.ts';

function queue(v: V): string {
  const { P, now } = v;
  if (!P.sq.length) return '';
  const rows = P.sq
    .map((q, i) => {
      const when =
        i === 0
          ? 'nächste fertig in ' + cd((P.sqT ?? now) + q.unit, now)
          : 'je ' + dur(q.unit);
      return `<tr><td>${fmt(q.n)}× ${UNIT[q.key]?.n}</td><td class="n">${when}</td></tr>`;
    })
    .join('');
  return `<div class="box"><div class="hd">Bauauftrag der Werft</div><div class="bd"><table>${rows}</table></div></div>`;
}

function stats(v: V, k: string, d: UnitDef): string {
  const tech = v.R.research;
  const c = d.cost;
  const ship = SHIPS[k];
  const cargo = ship ? ` · Ladung ${fmt(ship.cargo)}` : '';
  const speed = ship ? ` · Tempo ${fmt(shipSpeed(k, v.R))}` : '';
  return `<div class="dim">Angriff ${fmt(d.atk * (1 + 0.1 * (tech.weapons ?? 0)))} · Schild ${fmt(d.sh * (1 + 0.1 * (tech.shield ?? 0)))} · Struktur ${fmt((c[0] + c[1]) * (1 + 0.1 * (tech.armor ?? 0)))}${cargo}${speed}</div>`;
}

function orderBox(k: string, maxN: number, upgrading: boolean): string {
  return `<div class="flex center"><input type="number" min="0" id="q_${k}" placeholder="0" aria-label="Anzahl"> <span class="lnk" data-act="maxq" data-k="${k}" data-max="${maxN}">(max ${fmt(maxN)})</span></div><button class="mt" data-act="order" data-k="${k}" ${upgrading || maxN === 0 ? 'disabled' : ''}>Bauen</button>`;
}

function yard(
  v: V,
  title: string,
  defs: Record<string, UnitDef>,
  cls: string,
  have: Levels,
): string {
  const { P, R, s } = v;
  if (!((P.b.yard ?? 0) > 0))
    return `<h2>${title}</h2><div class="notice">Dafür brauchst du eine Raumschiffwerft.</div>`;
  const upgrading = P.bq?.key === 'yard';
  const items = Object.entries(defs).map(([k, d]) => {
    const miss = reqMissing(d, P, R);
    const action = miss.length
      ? '<span class="req">Voraussetzungen fehlen</span>'
      : orderBox(k, maxAfford(P, d.cost), upgrading);
    const body =
      costHTML(d.cost, P) +
      stats(v, k, d) +
      `<div class="dim">Bauzeit: ${dur(unitTime(d, P, s.cfg))} je Einheit</div>` +
      requirementsHTML(v, d.req, 'here');
    return itemHTML(
      cls,
      k,
      d,
      `(vorhanden: ${fmt(have[k] ?? 0)})`,
      body,
      action,
    );
  });
  const warn = upgrading
    ? '<div class="notice warn">Die Werft wird gerade ausgebaut und kann nicht produzieren.</div>'
    : '';
  return `<h2>${title}</h2>${queue(v)}${warn}<div class="box">${items.join('')}</div>`;
}

export const shipyard = (v: V): string =>
  yard(v, 'Schiffswerft', SHIPS, 'ic-s', v.P.ships);
export const defense = (v: V): string =>
  yard(v, 'Verteidigung', DEF, 'ic-d', v.P.def);
