// Missions as strategies (okf/architecture/patterns.md, section 4; owner,
// 2026-11-14, #116). Every mission is a folder src/features/missions/<m>/:
// rules.ts holds its typed data and `canSend`, texts.de.ts its name, and
// arrive.server.ts what happens at the target (the server only). This module
// reads the rules from the generated index for server and browser alike: the
// order of the fleet form, the generic check of the target kind when a fleet
// is sent or arrives, and the names in `MISSION`. No other code asks for a
// mission by its name.
import { MISSIONS } from '../features/index.gen.ts';
import { missionText } from './text.ts';
import type { Levels, Mission, Planet } from './types.ts';

/**
 * What a mission flies to: an own planet, a foreign one, any planet, a
 * free position without a planet, or a Trümmerfeld (#45), which is a place
 * of its own beside a planet at the same position (#119).
 */
export type TargetKind = 'own' | 'foreign' | 'any' | 'free' | 'debris';

/**
 * Why a fleet cannot be sent, as a code; the server turns it into today's
 * German message (src/server/game/fleet-actions.ts).
 */
export type SendError =
  | 'occupied'
  | 'noPlanet'
  | 'samePlanet'
  | 'notOwn'
  | 'ownTarget'
  | 'protected'
  | 'noColonyShip'
  | 'probesOnly'
  | 'noDebris'
  | 'noRecycler';

/** The fleet a player wants to send: its owner, its origin and its ships. */
export interface SendFleet {
  owner: string;
  /** The id of the planet it starts from. */
  from: string;
  ships: Levels;
}

/** What is at the target position when the fleet is sent. */
export interface SendTarget {
  /** The planet at the position, or null for a free position. */
  planet: Pick<Planet, 'id' | 'owner'> | null;
  /** Whether a Trümmerfeld lies at the position (#45). */
  debris: boolean;
  /**
   * Whether the noob protection keeps `owner` from this player. The server
   * determines it (it needs the points of every player), and only when it is
   * asked: after the other checks of a foreign target.
   */
  protects(owner: string): boolean;
}

/** The typed data and the send check of one mission (its rules.ts). */
export interface MissionRules {
  /** The place in the fleet form, in steps of 10; the first is preselected. */
  readonly order: number;
  readonly target: TargetKind;
  /** Whether the fleet takes the cargo the player loads. */
  readonly cargo: boolean;
  /** Whether the fleet flies back after the arrival. */
  readonly returns: boolean;
  /** Whether the defender sees the ships of the incoming fleet. */
  readonly visible: boolean;
  /** Whether the fleet comes home without a report of its own. */
  readonly silent: boolean;
  /** The check of the mission itself, after the target kind; a code or nothing. */
  canSend(fleet: SendFleet, target: SendTarget): SendError | undefined;
}

/** The generated index: every mission's rules, sorted by name. */
const INDEX: readonly (readonly [Mission, MissionRules])[] = MISSIONS;

const ORDERED = [...INDEX].sort(([, a], [, b]) => a.order - b.order);

const BY_NAME: ReadonlyMap<string, MissionRules> = new Map(INDEX);

/** The rules of a mission; undefined for a name that is no mission. */
export const missionRules = (m: string): MissionRules | undefined =>
  BY_NAME.get(m);

/** The names of the missions in the order of the fleet form. */
export const MISSION = Object.fromEntries(
  ORDERED.map(([m]) => [m, missionText(m)!.n]),
) as Readonly<Record<Mission, string>>;

/**
 * Whether the planet at the target (or none) suits a target kind for the
 * owner of a fleet; the same rule for sending and for the arrival. A
 * Trümmerfeld suits only whether it is there, whatever planet is there.
 */
export function suits(
  kind: TargetKind,
  owner: string,
  planet: Pick<Planet, 'owner'> | null,
  debris = false,
): boolean {
  if (kind === 'debris') return debris;
  if (kind === 'free') return !planet;
  if (!planet) return false;
  if (kind === 'any') return true;
  return (planet.owner === owner) === (kind === 'own');
}

/** A Trümmerfeld must lie at the position, whatever planet is there (#45). */
const debrisError = (target: SendTarget): SendError | undefined =>
  target.debris ? undefined : 'noDebris';

/** The generic check of the target kind, in today's order of the messages. */
function targetError(
  kind: TargetKind,
  fleet: SendFleet,
  target: SendTarget,
): SendError | undefined {
  const t = target.planet;
  if (kind === 'free') return t ? 'occupied' : undefined;
  if (!t) return 'noPlanet';
  if (t.id === fleet.from) return 'samePlanet';
  if (!suits(kind, fleet.owner, t))
    return kind === 'own' ? 'notOwn' : 'ownTarget';
  // Asked last, and only here: the server needs every player's points.
  return kind === 'foreign' && target.protects(t.owner)
    ? 'protected'
    : undefined;
}

/**
 * Why a fleet of this mission cannot fly to the target: first the target
 * kind, then the mission's own `canSend`; nothing when it may fly. Slots,
 * cargo and fuel are checked by the server for every mission alike.
 */
export const sendError = (
  rules: MissionRules,
  fleet: SendFleet,
  target: SendTarget,
): SendError | undefined =>
  (rules.target === 'debris'
    ? debrisError(target)
    : targetError(rules.target, fleet, target)) ?? rules.canSend(fleet, target);
