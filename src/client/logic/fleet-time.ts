// The row of the time at the target in the fleet form (#55, #93): the stay
// of an expedition, the holding time of a Halten, nothing for the other
// missions. The component Fleet (#118) renders the row with these functions
// and `timeRow` writes it again whenever the chosen mission changes, so the
// two cannot differ.
import { staysByUniverseSpeed, stayDuration } from '../../core/expedition.ts';
import { HOLD_HOURS } from '../../core/holding.ts';
import { missionRules } from '../../core/missions.ts';
import type { Universe } from '../../core/types.ts';
import type { V } from '../views/common.ts';
import { dur } from './format.ts';
import { maxStay, staysAt } from './game.ts';

/** „1 Stunde“, „2 Stunden“. */
const hours = (h: number): string => (h === 1 ? '1 Stunde' : `${h} Stunden`);

/**
 * The row „Haltezeit“ (#55): the classic holding times, 1 hour preselected
 * [V]; shown only while the chosen mission holds (the form switches it).
 */
export function holdRow(mission: string): string {
  const options = HOLD_HOURS.map(
    (h) =>
      `<option value="${h}"${h === 1 ? ' selected' : ''}>${hours(h)}</option>`,
  ).join('');
  const hidden = missionRules(mission)?.holds ? '' : ' hidden';
  return `<tr id="t_hold"${hidden}><td><label for="t_h">Haltezeit</label></td><td><select id="t_h">${options}</select></td></tr>`;
}

/**
 * The row „Haltezeit“ of an expedition (#93): whole hours from 1 to the most
 * the research and the round allow, at the target. With the universe speed
 * dividing the stay, `timeRow` adds the real time beside it. It is a row of
 * its own with its own field `t_stay`, apart from the Halten (`t_hold`,
 * `t_h`): only one of the two is in the form, so no label exists twice.
 */
function stayRow(mission: string, v: Pick<V, 'R' | 's'>): string {
  const most = Math.max(1, maxStay(mission, v.R.research, v.s.cfg));
  return `<tr id="t_stay_row"><td>Haltezeit</td><td><input class="c3" type="number" id="t_stay" min="1" max="${most}" value="1" aria-label="Haltezeit in Stunden"> Stunden am Ziel <span id="t_real" class="dim"></span></td></tr>`;
}

/** The row of the time at the target for the mission: the stay of an expedition or the holding time of a Halten (hidden for the others). */
export const timeRowHtml = (mission: string, v: Pick<V, 'R' | 's'>): string =>
  staysAt(mission) ? stayRow(mission, v) : holdRow(mission);

/**
 * Brings the row of the time at the target in line with the chosen mission
 * (the fleet form calls it on every change): the row is replaced when the
 * mission changes from a stay to a holding time or back, else it is only
 * shown or hidden; the real duration of a stay is written beside it (#93).
 */
export function timeRow(mission: string, v: Pick<V, 'R' | 's'>): void {
  const row = document.querySelector<HTMLElement>('#t_hold, #t_stay_row');
  if (!row) return;
  if ((row.id === 't_stay_row') !== staysAt(mission))
    row.outerHTML = timeRowHtml(mission, v);
  else row.hidden = !staysAt(mission) && !missionRules(mission)?.holds;
  const real = document.getElementById('t_real');
  if (!real) return;
  const field = document.getElementById('t_stay') as HTMLInputElement;
  real.textContent = realStay(Number(field.value), v.s.cfg);
}

/** The real time of a stay of `hours` when the universe speed divides it (#93, owner, 2026-11-19) [V]; nothing otherwise. */
export const realStay = (hours: number, u: Universe): string =>
  staysByUniverseSpeed(u) && hours >= 1
    ? `entspricht ${dur(stayDuration(hours, u))} (durch Tempo ${u.speed} geteilt)`
    : '';
