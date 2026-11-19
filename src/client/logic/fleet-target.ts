// The fleet form beside the target (out of main.ts, ratchet #242): what the
// target position is, the expedition position and the stay of an expedition
// (#93). The markup of the form is in views/fleet.ts.
import {
  expeditionPosition,
  isExpeditionPlace,
} from '../../core/expedition.ts';
import { missionRules } from '../../core/missions.ts';
import { placeId } from '../../core/place.ts';
import { debrisAt, debrisTip } from './debris.ts';
import { esc } from './format.ts';
import { nameOf, type FleetForm } from './game.ts';
import { moonAt, moonTarget } from './moon.ts';
import type { GameState } from './types.ts';

/**
 * Beside the target: its planet and owner, a free position, the expedition
 * position, or none; for a Bergung the Trümmerfeld there, or none (#45).
 */
export function targetInfo(s: GameState, f: FleetForm): string {
  const kind = missionRules(f.mission)?.target;
  if (kind === 'debris') {
    const field = debrisAt(s.debris, f.to);
    return field
      ? debrisTip(field)
      : '<span class="bad">kein Trümmerfeld</span>';
  }
  if (f.to.kind === 'moon')
    return moonTarget(moonAt(s.galaxy, f.to), (id) => nameOf(s.players, id));
  const target = s.galaxy.find(
    (p) => p.id === placeId({ ...f.to, kind: 'planet' }),
  );
  if (target)
    return `${esc(target.name)} (${esc(nameOf(s.players, target.owner))})`;
  // The position after the last planet position (#93).
  if (isExpeditionPlace(f.to, s.cfg))
    return kind === 'expedition'
      ? 'Expeditionsposition'
      : '<span class="bad">nur für Expeditionen</span>';
  return kind === 'free'
    ? 'Freie Position'
    : '<span class="bad">kein Planet</span>';
}

/** The highest position the target field takes: the expedition position (#93). */
export const maxPosition = (s: Pick<GameState, 'cfg'>): number =>
  expeditionPosition(s.cfg);
