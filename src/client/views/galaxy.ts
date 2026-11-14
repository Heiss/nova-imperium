import { MISSION } from '../../core/missions.ts';
import { placeName } from '../../core/moon.ts';
import { placeId } from '../../core/place.ts';
import { debrisAt, debrisMark, harvestButton } from '../logic/debris.ts';
import { esc, fmt } from '../logic/format.ts';
import { isProtected, nameOf, ranks } from '../logic/game.ts';
import { moonAt, moonMark, moonPicture } from '../logic/moon.ts';
import type { GalaxyPlanet } from '../logic/types.ts';
import { planetHTML, type V } from './common.ts';

/** Actions joined like the others; empty ones are left out. */
const join = (...actions: string[]): string =>
  actions.filter(Boolean).join(' · ');

/**
 * The actions at an own or a foreign planet or moon (#53): `at` holds the
 * position and, for a moon, data-k="moon".
 */
function planetActions(
  v: V,
  pl: GalaxyPlanet,
  mine: boolean,
  at: string,
): string {
  const id = pl.id;
  if (!mine)
    return `<span class="lnk" data-act="gspy" ${at}>Auspex-Erkundung</span> · <span class="lnk" data-act="gfleet" data-m="attack" ${at}>Sturmangriff</span> · <span class="lnk" data-act="gfleet" data-m="transport" ${at}>Versorgungsflug</span>`;
  return id === v.P.id
    ? `<span class="dim">${pl.kind === 'moon' ? 'Aktiver Mond' : 'Aktiver Planet'}</span>`
    : `<button class="small" data-act="selectPlanet" data-id="${esc(id)}">Wechseln</button> · <button class="small" data-act="gfleet" data-m="transport" ${at}>Versorgungsflug</button> · <button class="small" data-act="gfleet" data-m="deploy" ${at}>${MISSION.deploy}</button>`;
}

/** The owner and the noob protection of a planet or moon. */
function ownerCell(v: V, pl: GalaxyPlanet, rk: Record<string, number>): string {
  const { s } = v;
  const mine = pl.owner === s.me.id;
  const prot = !mine && isProtected(s.players, s.me.id, pl.owner);
  return `<td>${esc(nameOf(s.players, pl.owner))} <span class="dim">(Platz ${rk[pl.owner] ?? '-'})</span>${prot ? ' <span class="good" title="Noobschutz">(n)</span>' : ''}</td>`;
}

/** The row of the moon below its planet, once its symbol is opened (#53). */
function moonRow(v: V, moon: GalaxyPlanet, rk: Record<string, number>): string {
  const mine = moon.owner === v.s.me.id;
  const at = `data-g="${moon.g}" data-s="${moon.s}" data-p="${moon.p}" data-k="moon"`;
  const name = placeName(moon);
  return `<tr class="moon-row ${mine ? 'me' : ''}"><td class="n"></td><td><span class="gal-pl">${moonPicture(name, 28)}${esc(name)}</span></td>
   ${ownerCell(v, moon, rk)}<td>${planetActions(v, moon, mine, at)}</td></tr>`;
}

function row(v: V, p: number, rk: Record<string, number>): string {
  const { s, ui } = v;
  const c = { g: ui.gal, s: ui.sys, p };
  const pl = s.galaxy.find((x) => x.id === placeId({ ...c, kind: 'planet' }));
  const at = `data-g="${c.g}" data-s="${c.s}" data-p="${p}"`;
  // A Trümmerfeld for every player, with its button (#45).
  const field = debrisAt(s.debris, c);
  // A moon for every player, its symbol opens its actions (#53).
  const moon = moonAt(s.galaxy, c);
  const open = !!moon && ui.gmoon === moon.id;
  const mark =
    (moon ? ` ${moonMark(moon, open)}` : '') +
    (field ? ` ${debrisMark(field)}` : '');
  const harvest = field ? harvestButton(c) : '';
  if (!pl) {
    const colonize = v.P.ships.colony
      ? `<button class="small" data-act="gfleet" data-m="colonize" ${at}>Landnahme</button>`
      : '';
    return `<tr><td class="n">${p}</td><td colspan="2"><span class="dim">–</span>${mark}</td><td>${join(colonize, harvest)}</td></tr>`;
  }
  const mine = pl.owner === s.me.id;
  const moonLine = open ? moonRow(v, moon, rk) : '';
  return `<tr class="${mine ? 'me' : ''}"><td class="n">${p}</td><td><span class="gal-pl">${planetHTML(pl, true)}${esc(pl.name)}${mark}</span></td>
   ${ownerCell(v, pl, rk)}
   <td>${join(planetActions(v, pl, mine, at), harvest)}</td></tr>${moonLine}`;
}

export function galaxy(v: V): string {
  const { s, ui } = v;
  const rk = ranks(s.players);
  const rows = Array.from({ length: s.cfg.positions }, (_, i) =>
    row(v, i + 1, rk),
  ).join('');
  return `<h2>Sternenkarte</h2><div class="box"><div class="bd flex">
  Galaxie <button class="small" data-act="gnav" data-d="g-" aria-label="vorige Galaxie">◀</button><input class="c3" type="number" id="g_g" data-nokeep value="${ui.gal}" min="1" max="${s.cfg.galaxies}" aria-label="Galaxie"><button class="small" data-act="gnav" data-d="g+" aria-label="nächste Galaxie">▶</button>
  System <button class="small" data-act="gnav" data-d="s-" aria-label="voriges System">◀</button><input class="c3" type="number" id="g_s" data-nokeep value="${ui.sys}" min="1" max="${s.cfg.systems}" aria-label="System"><button class="small" data-act="gnav" data-d="s+" aria-label="nächstes System">▶</button>
  <button data-act="ggo">Anzeigen</button> <span class="lnk" data-act="ghome">zum Heimatsystem</span></div>
  <table class="gal"><tr><th class="n">Pos</th><th>Planet</th><th>Spieler</th><th>Aktionen</th></tr>${rows}</table>
  <div class="bd dim">Auspex-Erkundung schickt ${fmt(s.me.probes || 1)} Spähschädel – einstellbar unter „Hilfe &amp; Optionen“.</div></div>`;
}
