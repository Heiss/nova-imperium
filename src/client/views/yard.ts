import { DEF, SHIPS, type UnitDef, canFly } from '../../core/catalog.ts';
import { pieceEnergy, reqMissing, unitTime } from '../../core/economy.ts';
import { activeDrive, shipSpeed } from '../../core/flight.ts';
import { text } from '../../core/text.ts';
import type { Levels } from '../../core/types.ts';
import { orderMax, YARD_LOCK, yardLockedBy } from '../../core/yard.ts';
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
      return `<tr><td>${fmt(q.n)}× ${text(q.key)?.n}</td><td class="n">${when}</td></tr>`;
    })
    .join('');
  return `<div class="box"><div class="hd">Bauauftrag der Schiffsschmiede</div><div class="bd"><table>${rows}</table></div></div>`;
}

/** Speed of a flying ship; a ship that switches its drive names it (#57). */
function speedText(v: V, k: string): string {
  const drive = SHIPS[k]!.drives ? activeDrive(k, v.R)!.drive : null;
  const name = drive ? ` (${text(drive)!.n})` : '';
  return ` · Tempo ${fmt(shipSpeed(k, v.R))}${name}`;
}

function stats(v: V, k: string, d: UnitDef): string {
  const tech = v.R.research;
  const c = d.cost;
  const ship = canFly(k) ? SHIPS[k] : undefined;
  const cargo = ship ? ` · Ladung ${fmt(ship.cargo)}` : '';
  const speed = ship ? speedText(v, k) : '';
  return `<div class="dim">Angriff ${fmt(d.atk * (1 + 0.1 * (tech.weapons ?? 0)))} · Schild ${fmt(d.sh * (1 + 0.1 * (tech.shield ?? 0)))} · Struktur ${fmt((c[0] + c[1]) * (1 + 0.1 * (tech.armor ?? 0)))}${cargo}${speed}${energyText(v, k)}</div>`;
}

/** The energy of one piece of a ship that makes energy, „je …“ from its texts (#114). */
function energyText(v: V, k: string): string {
  const e = pieceEnergy(k, v.P, v.s.cfg, v.R.research);
  if (e === undefined) return '';
  const per = text(k)?.per;
  return ` · Energie ${fmt(e)}${per ? ` ${per}` : ''}`;
}

function orderBox(k: string, maxN: number, upgrading: boolean): string {
  const once = DEF[k]?.once ? ' max="1"' : '';
  return `<div class="flex center"><input type="number" min="0"${once} id="q_${k}" placeholder="0" aria-label="Anzahl"> <span class="lnk" data-act="maxq" data-k="${k}" data-max="${maxN}">(max ${fmt(maxN)})</span></div><button class="mt" data-act="order" data-k="${k}" ${upgrading || maxN === 0 ? 'disabled' : ''}>Bauen</button>`;
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
    return `<h2>${title}</h2><div class="notice">Dafür brauchst du eine Orbitale Schiffsschmiede.</div>`;
  const lock = yardLockedBy(P);
  const items = Object.entries(defs).map(([k, d]) => {
    const miss = reqMissing(d, P, R);
    const action = miss.length
      ? '<span class="req">Das Wissen ist noch verschlossen</span>'
      : orderBox(k, orderMax(P, k), !!lock);
    const body =
      costHTML(d.cost, P) +
      stats(v, k, d) +
      `<div class="dim">Bauzeit: ${dur(unitTime(d, P, s.cfg))} je Einheit</div>` +
      requirementsHTML(v, d.req);
    return itemHTML(
      v,
      cls,
      k,
      `(vorhanden: ${fmt(have[k] ?? 0)}${DEF[k]?.once ? ' · max. 1' : ''})`,
      body,
      action,
    );
  });
  const warn = lock ? `<div class="notice warn">${lockNotice(lock)}</div>` : '';
  return `<h2>${title}</h2>${queue(v)}${warn}<div class="box">${items.join('')}</div>`;
}

const lockNotice = (key: string): string =>
  key === 'yard'
    ? 'Die Schiffsschmiede wird gerade ausgebaut und kann nicht produzieren.'
    : `Die ${YARD_LOCK[key]} wird gerade ausgebaut, die Schiffsschmiede kann nicht produzieren.`;

export const shipyard = (v: V): string =>
  yard(v, 'Schiffsschmiede', SHIPS, 'ic-s', v.P.ships);
export const defense = (v: V): string =>
  yard(v, 'Verteidigung', DEF, 'ic-d', v.P.def);
