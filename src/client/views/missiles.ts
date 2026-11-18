// The Raketenangriff on the Sternenkarte (#54): the button comes from
// logic/galaxy.ts; here the form in the dialog with the count and the main
// target, and the two actions of the click handler of main.ts, which
// spreads them into its list (main.ts must not grow, #242).
import { placeName } from '../../core/moon.ts';
import { aimChoices, launchOrder, missilesHere } from '../logic/missiles.ts';
import { coords, esc, fmt } from '../logic/format.ts';
import { client } from '../logic/state.svelte.ts';
import type { GalaxyPlanet } from '../logic/types.ts';
import type { V } from './common.ts';

type Data = Record<string, string | undefined>;

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

const value = (id: string): string =>
  document.querySelector<HTMLInputElement>(`#${id}`)?.value ?? '';

/** The actions of the button and of the form. */
export const missileActs = (
  modal: (html: string) => void,
  act: (type: string, data?: object) => Promise<boolean>,
): Record<string, (d: Data) => unknown> => ({
  gmissile: (d) => {
    const pl = client.game?.galaxy.find((x) => x.id === d.id);
    if (pl && client.view) modal(missileForm(client.view, pl));
  },
  doMissile: (d) => {
    const order = launchOrder(d, value('mi_n'), value('mi_aim'));
    modal('');
    return act('missile', order);
  },
});
