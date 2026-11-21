// The Raketenangriff on the Sternenkarte (#54): the button comes from
// logic/galaxy.ts; here the form in the dialog with the count and the main
// target. Its two actions are in features/missiles.ts.
import { placeName } from '../../core/moon.ts';
import { text } from '../../core/text.ts';
import { aimChoices, missilesHere } from '../logic/missiles.ts';
import { coords, esc, fmt } from '../logic/format.ts';
import type { GalaxyPlanet } from '../logic/types.ts';
import type { V } from './common.ts';

/** The data attributes of a target: its position, a moon with data-k="moon". */
const where = (pl: GalaxyPlanet): string =>
  `data-g="${pl.g}" data-s="${pl.s}" data-p="${pl.p}"${pl.kind === 'moon' ? ' data-k="moon"' : ''}`;

/** The form of the dialog: how many Orbitalraketen, and the main target. */
export function missileForm(v: V, pl: GalaxyPlanet): string {
  const max = missilesHere(v.P);
  const aims = aimChoices()
    .map((a) => `<option value="${a.key}">${esc(a.name)}</option>`)
    .join('');
  return `<p><b>Raketenangriff auf ${esc(placeName(pl))} ${coords(pl)}</b></p>
  <p><label>Anzahl <input type="number" id="mi_n" min="1" max="${max}" value="${max}"></label> <span class="dim">(max ${fmt(max)})</span></p>
  <p><label>Hauptziel <select id="mi_aim">${aims}</select></label></p>
  <button data-act="doMissile" ${where(pl)}>Starten</button> <button data-act="closeModal">Abbrechen</button>`;
}

/**
 * The confirmation of „Verschrotten“ in the lists of the shipyard (#54, owner,
 * 2026-11-21): the missiles are gone at once and nothing comes back; the
 * button sends the amount that was typed.
 */
export const tearDownDialog = (key: string, n: number): string =>
  `<p><b>${esc(text(key)!.n)}</b>: ${fmt(n)} verschrotten</p>
  <p>Die Raketen sind sofort weg, ihre Plätze in der Raketenkrypta werden frei. Du erhältst nichts zurück.</p>
  <p><button class="red" data-act="doTearDown" data-k="${esc(key)}" data-n="${n}">Verschrotten</button> <button data-act="closeModal">Abbrechen</button></p>`;
