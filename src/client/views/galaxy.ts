import { pid } from '../../shared/flight.ts';
import { esc, fmt } from '../logic/format.ts';
import { isProtected, nameOf, ranks } from '../logic/game.ts';
import { planetHTML, type V } from './common.ts';

function row(v: V, p: number, rk: Record<string, number>): string {
  const { s, ui } = v;
  const c = { g: ui.gal, s: ui.sys, p };
  const pl = s.galaxy.find((x) => x.id === pid(c));
  const at = `data-g="${c.g}" data-s="${c.s}" data-p="${p}"`;
  if (!pl) {
    const action = v.P.ships.colony
      ? `<button class="small" data-act="gfleet" data-m="colonize" ${at}>Landnahme</button>`
      : '';
    return `<tr><td class="n">${p}</td><td colspan="2" class="dim">–</td><td>${action}</td></tr>`;
  }
  const mine = pl.owner === s.me.id;
  const prot = !mine && isProtected(s.players, s.me.id, pl.owner);
  const actions = mine
    ? pl.id === v.P.id
      ? '<span class="dim">Aktiver Planet</span>'
      : `<button class="small" data-act="selectPlanet" data-id="${esc(pl.id)}">Wechseln</button> · <button class="small" data-act="gfleet" data-m="transport" ${at}>Versorgungsflug</button>`
    : `<span class="lnk" data-act="gspy" ${at}>Auspex-Erkundung</span> · <span class="lnk" data-act="gfleet" data-m="attack" ${at}>Sturmangriff</span> · <span class="lnk" data-act="gfleet" data-m="transport" ${at}>Versorgungsflug</span>`;
  return `<tr class="${mine ? 'me' : ''}"><td class="n">${p}</td><td><span class="gal-pl">${planetHTML(pl, true)}${esc(pl.name)}</span></td>
   <td>${esc(nameOf(s.players, pl.owner))} <span class="dim">(Platz ${rk[pl.owner] ?? '-'})</span>${prot ? ' <span class="good" title="Noobschutz">(n)</span>' : ''}</td>
   <td>${actions}</td></tr>`;
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
