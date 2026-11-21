// What the fleet form shows and sends, worked out from the state of the form
// (logic/fleet-form.svelte.ts, #332) and the page: the component Fleet and
// the handlers of features/fleet.ts call the same function, so the form never
// shows one thing and sends another. A field nobody touched shows what the
// page says (the shortcuts of the Sternenkarte, a union, the shown planet).
import type { V } from '../views/common.ts';
import { colonyNote } from './colony-limit.ts';
import type { FleetDraft } from './fleet-form.svelte.ts';
import {
  maxPosition,
  type MissionOption,
  missionChoices,
  offeredMissions,
} from './fleet-target.ts';
import { clampInt } from './format.ts';
import { shown } from './galaxy-position.svelte.ts';
import { moonAt } from './moon.ts';

/** What the choices read of the view: the state of the game, the shown planet and the memory of the page. */
export type FleetSeen = Pick<V, 's' | 'P' | 'ui'>;

/** The target the form starts with: the one chosen elsewhere (the Sternenkarte, a union), else the shown planet. */
export const fleetTarget = ({
  P,
  ui,
}: Pick<V, 'P' | 'ui'>): NonNullable<V['ui']['ft']> =>
  ui.ft ?? { g: P.g, s: P.s, p: P.p };

/** The target, the kind of it and the mission, as the fields show them. */
export interface FleetChoice {
  /** The position, kept to the universe. */
  to: { g: number; s: number; p: number };
  /** A moon is there (#53); else „Mond“ is disabled. */
  moon: boolean;
  /** The planet, or its moon where one is and was chosen. */
  kind: 'planet' | 'moon';
  /** The options of the list „Auftrag“: only the missions that fit the target (#253). */
  missions: MissionOption[];
  /** The mission the list ends on, or empty when none fits the target. */
  mission: string;
  /** The planets against the limit for a Landnahme (#237). */
  limit: string;
}

/**
 * The choices of the form for `draft` at the time `now`. The kind is the one
 * chosen, else the one the page remembers (`ui.fk`) or aims at (`ui.ft`); a
 * moon only where one is (#53). The mission is the one chosen, else the one
 * the page remembers (`ui.fm`), while it fits the target, else the first that
 * does. The list of missions follows the kind as asked: `fleetCalc` settles a
 * moon that is not there (the state goes back to the planet) before it reads
 * the mission, so the two never differ for long.
 */
export function fleetChoice(
  v: FleetSeen,
  draft: FleetDraft,
  now: number,
): FleetChoice {
  const page = fleetTarget(v);
  const { cfg, galaxy } = v.s;
  const to = {
    g: clampInt(shown(draft.to.g, page.g), 1, cfg.galaxies),
    s: clampInt(shown(draft.to.s, page.s), 1, cfg.systems),
    p: clampInt(shown(draft.to.p, page.p), 1, maxPosition(v.s)),
  };
  const moon = !!moonAt(galaxy, to);
  const wanted =
    draft.kind ?? (v.ui.fk === 'moon' ? 'moon' : (page.kind ?? 'planet'));
  const { options, selected } = missionChoices(
    offeredMissions(v.s, v.P.id, { ...to, kind: wanted }, now),
    draft.mission || v.ui.fm,
  );
  return {
    to,
    moon,
    kind: moon && wanted === 'moon' ? 'moon' : 'planet',
    missions: options,
    mission: selected,
    limit: colonyNote(v.s, selected),
  };
}
