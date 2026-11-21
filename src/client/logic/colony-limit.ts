// The limit of planets as the browser shows it (#237): the planets the player
// owns against the limit of the round, in the fleet form beside the Landnahme
// and in the overview. The rules are those of src/core/colony-limit.ts; the
// server checks them at the launch and at the arrival, the browser only
// previews.
import {
  colonyLevel,
  colonyRules,
  limitFor,
  limitLine,
  limitReached,
  limitText,
} from '../../core/colony-limit.ts';
import { missionRules } from '../../core/missions.ts';
import type { GameState } from './types.ts';

/** The ordinary planets the player owns, the home planet included; a moon does not count. */
export const ownedPlanets = (s: Pick<GameState, 'galaxy' | 'me'>): number =>
  s.galaxy.filter((p) => p.owner === s.me.id && p.kind === 'planet').length;

/** The colonization fleets of the player on their way out, which keep a place until they arrive. */
export const flyingColonies = (s: Pick<GameState, 'fleets' | 'me'>): number =>
  s.fleets.filter(
    (f) =>
      f.owner === s.me.id &&
      f.state === 'out' &&
      missionRules(f.mission)?.colonizes,
  ).length;

/** „Planeten: 6 / 8 · Kolonialverwaltung Stufe 1“ or „Planeten: 6 · unbegrenzt“. */
export const planetsLine = (s: GameState): string =>
  limitLine(colonyRules(s.cfg), ownedPlanets(s), colonyLevel(s.me.research));

/**
 * The line beside a Landnahme in the fleet form: the planets against the
 * limit, and the refusal words when the limit leaves no room for one more
 * colony (the server refuses it then). Nothing for a mission that founds no
 * colony.
 */
export function colonyNote(s: GameState, mission: string): string {
  if (!missionRules(mission)?.colonizes) return '';
  const rules = colonyRules(s.cfg);
  const limit = limitFor(rules, s.me.research);
  const count = { owned: ownedPlanets(s), flying: flyingColonies(s) };
  const line = planetsLine(s);
  return limit !== null && limitReached(limit, count)
    ? `${line} · ${limitText(limit, count, rules)}`
    : line;
}
