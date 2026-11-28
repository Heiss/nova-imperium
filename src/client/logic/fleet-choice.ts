// What the fleet form shows and sends, worked out from the state of the form
// (logic/fleet-form.svelte.ts, #332) and the page: the component Fleet and
// the handlers of features/fleet.ts call the same function, so the form never
// shows one thing and sends another. A field nobody touched shows what the
// page says (the shortcuts of the Sternenkarte, a union, the shown planet).
import { missionRules } from '../../core/missions.ts';
import type { V } from '../views/common.ts';
import { colonyNote } from './colony-limit.ts';
import type { FleetDraft } from './fleet-form.svelte.ts';
import {
  maxPosition,
  type MissionOption,
  missionChoices,
  offeredMissions,
} from './fleet-target.ts';
import { realStay } from './fleet-time.ts';
import { clampInt } from './format.ts';
import { maxStay, staysAt } from './game.ts';
import { shown } from './galaxy-position.svelte.ts';
import { moonAt } from './moon.ts';
import { unionOpen } from '../../core/union.ts';
import { joinChoices, PLAN } from './union.ts';

/** What the choices read of the view: the state of the game, the shown planet and the memory of the page. */
export type FleetSeen = Pick<V, 's' | 'P' | 'R' | 'ui'>;

/** The target the form starts with: the one chosen elsewhere (the Sternenkarte, a union), else the shown planet. */
export const fleetTarget = ({
  P,
  ui,
}: Pick<V, 'P' | 'ui'>): NonNullable<V['ui']['ft']> =>
  ui.ft ?? { g: P.g, s: P.s, p: P.p };

/** The target, its kind, the mission, the union and the time at the target, as the fields show them. */
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
  /** The attack union the fleet joins (#225), `plan` for a new one (#466), or empty for „Kein Verband“. */
  union: string;
  /** The arrival of a union the fleet plans, as the field holds it; empty while none is chosen. */
  plan: string;
  /** The mission stays at the target (an expedition, #93): the row has the hours of the stay, else the holding time. */
  stays: boolean;
  /** The mission holds (#55): the row of the holding time is shown, else hidden. */
  holds: boolean;
  /** The most hours of stay the research and the round allow, at least 1 (#93); 0 where the mission does not stay. */
  stayMost: number;
  /** The hours of stay shown. */
  stay: string;
  /** The real time of the stay beside it, when the universe speed divides it (#93). */
  real: string;
  /** The holding time shown, in hours. */
  hold: string;
}

/** The position the fields show, kept to the universe, and the kind of target asked for. */
function targetOf(v: FleetSeen, draft: FleetDraft) {
  const page = fleetTarget(v);
  const { cfg } = v.s;
  const to = {
    g: clampInt(shown(draft.to.g, page.g), 1, cfg.galaxies),
    s: clampInt(shown(draft.to.s, page.s), 1, cfg.systems),
    p: clampInt(shown(draft.to.p, page.p), 1, maxPosition(v.s)),
  };
  const wanted: FleetChoice['kind'] =
    draft.kind ?? (v.ui.fk === 'moon' ? 'moon' : (page.kind ?? 'planet'));
  return { to, wanted, moon: !!moonAt(v.s.galaxy, to) };
}

/**
 * The union chosen, else the one of the page, while the player can join it;
 * `plan` plans a new one with a Sturmangriff while the switch of the round
 * is on (#466): another mission drops it, so a hidden choice is never sent.
 */
function unionOf(v: FleetSeen, draft: FleetDraft, mission: string): string {
  const chosen = draft.union ?? v.ui.union ?? '';
  if (chosen === PLAN)
    return mission === 'attack' && unionOpen(v.s.round) ? PLAN : '';
  return joinChoices(v).some((c) => c.id === chosen) ? chosen : '';
}

/** The row of the time at the target for the mission: the stay of an expedition or the holding time of a Halten. */
function timeOf(v: FleetSeen, mission: string, draft: FleetDraft) {
  const stays = staysAt(mission);
  const stay = draft.stay ?? '1';
  return {
    stays,
    holds: !!missionRules(mission)?.holds,
    stayMost: stays ? Math.max(1, maxStay(mission, v.R.research, v.s.cfg)) : 0,
    stay,
    real: stays ? realStay(Number(stay), v.s.cfg) : '',
    hold: draft.hold ?? '1',
  };
}

/**
 * The choices of the form for `draft` at the time `now`. The kind is the one
 * chosen, else the one the page remembers (`ui.fk`) or aims at (`ui.ft`); a
 * moon only where one is (#53). The mission is the one chosen, else the one
 * the page remembers (`ui.fm`), while it fits the target, else the first that
 * does. The union is the one chosen, else the one of the page (`ui.union`),
 * while it is among those the player can join. The time at the target is the
 * stay of an expedition or the holding time of a Halten, by the mission; each
 * starts with 1 hour. The list of missions follows the kind as asked:
 * `fleetCalc` settles a moon that is not there (the state goes back to the
 * planet) before it reads the mission, so the two never differ for long.
 */
export function fleetChoice(
  v: FleetSeen,
  draft: FleetDraft,
  now: number,
): FleetChoice {
  const { to, wanted, moon } = targetOf(v, draft);
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
    union: unionOf(v, draft, selected),
    plan: draft.plan ?? '',
    ...timeOf(v, selected, draft),
  };
}
