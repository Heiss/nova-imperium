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
import type { Fleet, Levels, Mission, Planet } from './types.ts';
import { vacationProtects } from './vacation.ts';

/**
 * What a mission flies to: an own planet, a foreign one, any planet, a
 * free position without a planet, a Trümmerfeld (#45), which is a place
 * of its own beside a planet at the same position (#119), or a foreign moon
 * and nothing else (the Mondbruch, #95).
 */
export type TargetKind =
  'own' | 'foreign' | 'any' | 'free' | 'debris' | 'foreignMoon';

/**
 * Why a fleet cannot be sent, as a code; the server turns it into today's
 * German message (src/server/game/fleet-actions.ts).
 */
export type SendError =
  | 'occupied'
  | 'locked'
  | 'noPlanet'
  | 'samePlanet'
  | 'notOwn'
  | 'ownTarget'
  | 'protected'
  | 'vacation'
  | 'noColonyShip'
  | 'probesOnly'
  | 'noSpyTech'
  | 'noDebris'
  | 'noRecycler'
  | 'noMoon'
  | 'moonTarget'
  | 'notMoon'
  | 'noWorldbreaker'
  | 'surveyLocked'
  | 'surveyProbesOnly';

/**
 * How a mission starts: as a fleet from the fleet form, or as missiles from
 * the silo, launched in the Sternenkarte (#54). Missiles take no fleet slot
 * and cannot be recalled.
 */
export type Launch = 'fleet' | 'missiles';

/** The fleet a player wants to send: its owner, its origin and its ships. */
export interface SendFleet {
  owner: string;
  /** The id of the planet it starts from. */
  from: string;
  ships: Levels;
  /** The research of the owner at the start; missing: none (the espionage technology of #175, Q1, and the Vermessung of #190). */
  research?: Levels;
}

/** What is at the target position when the fleet is sent. */
export interface SendTarget {
  /** The planet at the position, or null for a free position. */
  planet: Pick<Planet, 'id' | 'owner'> | null;
  /** Whether a Trümmerfeld lies at the position (#45). */
  debris: boolean;
  /**
   * Whether the fleet flies to the moon of the position (#53); `planet` is
   * then the moon, or null without one. Missing: the planet.
   */
  moon?: boolean;
  /**
   * Whether the position is locked after a colony there was given up
   * (#224, D2): no colonization until the lock ends. Missing: not locked.
   */
  locked?: boolean;
  /**
   * Whether the noob protection keeps `owner` from this player. The server
   * determines it (it needs the points of every player), and only when it is
   * asked: after the other checks of a foreign target.
   */
  protects(owner: string): boolean;
  /**
   * Whether `owner` is in vacation mode (#223): every place of such a
   * player is protected from a new mission of another player (D2, Q2).
   */
  vacation(owner: string): boolean;
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
  /** Whether the fleet comes home without a report of its own. */
  readonly silent: boolean;
  /**
   * Whether its launch at a member of a guild writes an event into the chat
   * of that guild (#169 D3, „Nur beim Start“): the attack and the
   * Mondbruch (owner, 2026-11-16, #95).
   */
  readonly alertsGuild: boolean;
  /**
   * How it starts: from the silo for the missiles (#54); without it, from
   * the fleet form.
   */
  readonly launch?: Launch;
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

/** How a mission starts: from the fleet form unless it says otherwise. */
export const launchOf = (rules: MissionRules): Launch =>
  rules.launch ?? 'fleet';

/** The missions of the fleet form, in its order: no launch from the silo (#54). */
export const FLEET_MISSIONS: readonly Mission[] = ORDERED.filter(
  ([, r]) => launchOf(r) === 'fleet',
).map(([m]) => m);

/** The missions launched from the silo, which take no fleet slot (#54). */
export const SILO_MISSIONS: readonly Mission[] = ORDERED.filter(
  ([, r]) => launchOf(r) === 'missiles',
).map(([m]) => m);

/**
 * Whether a flight takes a fleet slot and can be recalled: a fleet from the
 * fleet form, not the gift of the „Endzeit“ (#161) and no missiles (#54).
 */
export const isFleet = (f: Pick<Fleet, 'mission' | 'gift'>): boolean => {
  const rules = missionRules(f.mission);
  return !f.gift && !!rules && launchOf(rules) === 'fleet';
};

/**
 * Whether the planet at the target (or none) suits a target kind for the
 * owner of a fleet; the same rule for sending and for the arrival. A
 * Trümmerfeld suits only whether it is there, whatever planet is there.
 */
export function suits(
  kind: TargetKind,
  owner: string,
  planet: (Pick<Planet, 'owner'> & Partial<Pick<Planet, 'kind'>>) | null,
  debris = false,
): boolean {
  if (kind === 'debris') return debris;
  if (kind === 'free') return !planet;
  if (!planet) return false;
  if (kind === 'any') return true;
  if (kind === 'foreignMoon')
    return planet.kind === 'moon' && planet.owner !== owner;
  return (planet.owner === owner) === (kind === 'own');
}

/** A Trümmerfeld must lie at the position, whatever planet is there (#45). */
const debrisError = (target: SendTarget): SendError | undefined =>
  target.debris ? undefined : 'noDebris';

/**
 * A free position and a Trümmerfeld are never a moon: colonization and
 * Bergung never target one (#53; owner, 2026-11-13).
 */
const NEVER_MOON: readonly TargetKind[] = ['free', 'debris'];

/** Nothing at the target: no planet, or no moon when the fleet flies to one. */
const nothing = (target: SendTarget): SendError =>
  target.moon ? 'noMoon' : 'noPlanet';

/**
 * The protection of a suitable planet: the vacation mode of its owner for
 * every mission of another player (#223), then the noob protection for a
 * foreign target.
 */
function shieldError(
  kind: TargetKind,
  fleet: SendFleet,
  target: SendTarget,
  t: Pick<Planet, 'owner'>,
): SendError | undefined {
  if (vacationProtects(t, fleet.owner, target.vacation)) return 'vacation';
  // Asked last, and only here: the server needs every player's points.
  return kind === 'foreign' && target.protects(t.owner)
    ? 'protected'
    : undefined;
}

/** A free position: no planet there, and no lock after an abandonment (#224, D2). */
function freeError(target: SendTarget): SendError | undefined {
  if (target.planet) return 'occupied';
  return target.locked ? 'locked' : undefined;
}

/** The generic check of the target kind, in today's order of the messages. */
function targetError(
  kind: TargetKind,
  fleet: SendFleet,
  target: SendTarget,
): SendError | undefined {
  const t = target.planet;
  if (kind === 'free') return freeError(target);
  if (!t) return nothing(target);
  if (t.id === fleet.from) return 'samePlanet';
  if (!suits(kind, fleet.owner, t))
    return kind === 'own' ? 'notOwn' : 'ownTarget';
  return shieldError(kind, fleet, target, t);
}

/**
 * A foreign moon is first a moon (`notMoon`), then a foreign target with
 * its checks (#95); the other kinds as before.
 */
function placeError(
  kind: TargetKind,
  fleet: SendFleet,
  target: SendTarget,
): SendError | undefined {
  if (kind !== 'foreignMoon') return targetError(kind, fleet, target);
  return target.moon ? targetError('foreign', fleet, target) : 'notMoon';
}

/**
 * Why a fleet of this mission cannot fly to the target: first the target
 * kind, then the mission's own `canSend`; nothing when it may fly. Slots,
 * cargo and fuel are checked by the server for every mission alike.
 */
export function sendError(
  rules: MissionRules,
  fleet: SendFleet,
  target: SendTarget,
): SendError | undefined {
  if (target.moon && NEVER_MOON.includes(rules.target)) return 'moonTarget';
  return (
    (rules.target === 'debris'
      ? debrisError(target)
      : placeError(rules.target, fleet, target)) ?? rules.canSend(fleet, target)
  );
}
