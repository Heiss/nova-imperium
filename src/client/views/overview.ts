import { BUILD, MISSION, RES, SHIPS, UNIT } from '../../shared/catalog.ts';
import { coords, dt, esc, fmt } from '../logic/format.ts';
import { fleetEnd, nameOf, ranks, sortFleets } from '../logic/game.ts';
import type { ClientFleet } from '../logic/types.ts';
import { planetLook } from '../logic/planet.ts';
import { box, cd, planetHTML, type V } from './common.ts';

const shipList = (f: ClientFleet): string =>
  Object.entries(f.ships ?? {})
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${fmt(n)} ${SHIPS[k]?.n ?? k}`)
    .join(', ');

function fleetText(v: V, f: ClientFleet): string {
  const ships = shipList(f);
  const mission = MISSION[f.mission];
  if (f.owner !== v.s.me.id)
    return `Eine fremde Flotte von <b>${esc(nameOf(v.s.players, f.owner))}</b> ${coords(f.fromC)} erreicht deinen Planeten ${coords(f.toC)} · ${mission}${ships ? ` (${ships})` : ''}`;
  if (f.state === 'out')
    return `Deine Flotte (${ships}) von ${coords(f.fromC)} erreicht ${coords(f.toC)} · ${mission}`;
  return `Deine Flotte (${ships}) kehrt von ${coords(f.toC)} nach ${coords(f.fromC)} zurück`;
}

function fleetRow(v: V, f: ClientFleet): string {
  const mine = f.owner === v.s.me.id;
  const out = f.state === 'out';
  const cls = out ? `fl-${f.mission}` : 'fl-back';
  const button =
    mine && out
      ? `<button class="small" data-act="recall" data-id="${esc(f.id)}">Rückruf</button>`
      : '';
  return `<tr><td class="n w110">${cd(fleetEnd(f), v.now)}</td><td class="${cls}">${fleetText(v, f)}</td><td class="w80">${button}</td></tr>`;
}

export function fleetTable(v: V, includeIncoming: boolean): string {
  const list = sortFleets(
    v.s.fleets.filter((f) => f.owner === v.s.me.id || includeIncoming),
  );
  return list.length
    ? `<table>${list.map((f) => fleetRow(v, f)).join('')}</table>`
    : '<span class="dim">Keine Flottenbewegungen.</span>';
}

function activities(v: V): string {
  const { P, R, now } = v;
  const rows: string[] = [];
  if (P.bq)
    rows.push(
      `<tr><td>Gebäude</td><td>${BUILD[P.bq.key]?.n} (Stufe ${P.bq.lvl})</td><td class="n">${cd(P.bq.end, now)}</td></tr>`,
    );
  if (R.rq)
    rows.push(
      `<tr><td>Forschung</td><td>${RES[R.rq.key]?.n} (Stufe ${R.rq.lvl})</td><td class="n">${cd(R.rq.end, now)}</td></tr>`,
    );
  if (P.sq.length) {
    const list = P.sq.map((q) => `${fmt(q.n)}× ${UNIT[q.key]?.n}`).join(', ');
    rows.push(
      `<tr><td>Schiffsschmiede</td><td>${list}</td><td class="n">${cd((P.sqT ?? now) + P.sq[0]!.unit, now)} (nächste)</td></tr>`,
    );
  }
  return rows.length
    ? `<table>${rows.join('')}</table>`
    : '<span class="dim">Nichts in Arbeit – deine Minen langweilen sich.</span>';
}

export function overview(v: V): string {
  const { P, s } = v;
  const me = s.me.id;
  const rk = ranks(s.players);
  return `<h2>Übersicht – ${esc(P.name)} ${coords(P)}</h2>
 ${box('Flottenbewegungen', fleetTable(v, true))}
 <div class="box"><div class="bd ov">${planetHTML(P)}
 <table class="kv kv-grow">
 <tr><td>Planet</td><td>${esc(P.name)} <span class="lnk" data-act="rename">(umbenennen)</span></td></tr>
 <tr><td>Position</td><td>${coords(P)}</td></tr><tr><td>Planetentyp</td><td>${planetLook(P).name}</td></tr><tr><td>Temperatur</td><td>ca. ${P.temp - 40}°C bis ${P.temp}°C</td></tr>
 <tr><td>Punkte</td><td>${fmt(s.players[me]?.points)} (Platz ${rk[me] ?? '-'} von ${Object.keys(s.players).length})</td></tr>
 <tr><td>Serverzeit</td><td>${dt(v.now)}</td></tr></table></div></div>
 ${box('Aktivitäten', activities(v))}`;
}
