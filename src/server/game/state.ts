// What one player sees: their planet, their and incoming fleets, reports,
// the players with points, the galaxy. Foreign fleets show only what an
// observer can see: of the ships what the observer's Auspex-Lehre
// recognizes (#228). The keys of a feature are a part of its own module
// (`serverFeature`, feature.ts), put in order by their numbers.
import { type ActivityLimits, activityLimits } from '../../core/activity.ts';
import { hasAuthenticator } from '../authenticator.ts';
import {
  type Recognition,
  recognitionOf,
  type SeenShips,
  seenShips,
} from '../../core/fleet-recognition.ts';
import {
  type ShownProtection,
  type ShownSystem,
  shownSystemOf,
} from '../../core/galaxy-shown.ts';
import type { PmOpen } from '../../core/private-messages.ts';
import type { Fleet } from '../../core/types.ts';
import { SERVER_FEATURES } from '../features.gen.ts';
import type { User } from '../db/repos/players.ts';
import { pushOff } from '../push-options.ts';
import { ownLabs, researchOf } from './actions.ts';
import { inactivities, planetActivities } from './activity.ts';
import { type Ctx, universe } from './context.ts';
import { mainPlanetOf } from './main-planet.ts';
import { heldByOthers } from './holding.ts';
import { isProtected } from './points.ts';
import { roundRules } from './round.ts';
import {
  type CategoryScores,
  exactPoints,
  type ScorePass,
  storedScores,
} from './scores.ts';
import {
  type CategoryModes,
  categoryModes,
  type HighscoreShows,
  highscoreShows,
  SHOWS,
} from '../../core/highscore-categories.ts';
import { assembleState } from './assemble.ts';
import type { StatePart, StateView } from './feature.ts';
import type { LockedState } from '../../core/state.ts';
import type { StateShape as Frame } from '../../core/state/frame.ts';
import type { StateShape as MessagesShape } from '../../core/state/private-messages.ts';
import { privateMessageState } from './private-messages.ts';

export interface ForeignFleet extends SeenShips {
  id: string;
  owner: string;
  fromC: Fleet['fromC'];
  toC: Fleet['toC'];
  to: string;
  mission: Fleet['mission'];
  state: Fleet['state'];
  arr: number;
  /** The holding time of a fleet that holds at the planet (#55). */
  hold?: number;
}

/**
 * An incoming fleet as an observer with the Auspex-Lehre `level` sees it:
 * of its ships only what the thresholds of the round allow, for every
 * mission (#228, D1, D2). A fleet that is holding at the planet shows all its
 * ships and its holding time to the host, whatever the level and the
 * thresholds (owner, 2026-11-19, #55); on its way there it follows them.
 */
export const foreignView = (
  f: Fleet,
  level: number,
  recognition: Recognition,
): ForeignFleet => ({
  id: f.id,
  owner: f.owner,
  fromC: f.fromC,
  toC: f.toC,
  to: f.to,
  mission: f.mission,
  state: f.state,
  arr: f.arr,
  ...(f.state === 'hold'
    ? { hold: f.hold ?? 0, ships: f.ships }
    : seenShips(f.ships, level, recognition)),
});

/** Whether a foreign fleet shows at the shown planet: on its way there, or holding there (#55). */
const atPlanet = (f: Fleet, p: { id: string } | null): boolean =>
  p !== null && f.to === p.id && f.state !== 'back';

/**
 * Every planet and moon (#53) of the universe, for every player, with its
 * public activity marker (#229) while it shows one.
 */
function galaxyOf(ctx: Ctx, limits: ActivityLimits) {
  const shown = planetActivities(ctx, limits);
  return ctx.planets.all().map((x) => ({
    id: x.id,
    kind: x.kind,
    name: x.name,
    g: x.g,
    s: x.s,
    p: x.p,
    temp: x.temp,
    owner: x.owner,
    ...(shown[x.id] ? { activity: shown[x.id] } : {}),
  }));
}

/**
 * The owners of the shown system that the noob protection covers against
 * `me` (151a): the rule of an attack or a missile (points.ts `isProtected`
 * with the exact points of the players concerned), computed for them only.
 * Their places where a fleet of a third player (neither the owner nor `me`)
 * holds are `lapsed` (#440): the protection is gone there for an attack and
 * an espionage of `me`.
 */
export function protectedIn(
  ctx: Ctx,
  me: string,
  at: ShownSystem,
): ShownProtection {
  const places = ctx.planets
    .all()
    .filter((x) => x.g === at.g && x.s === at.s && x.owner !== me);
  const owners = [...new Set(places.map((x) => x.owner))];
  if (owners.length === 0) return { ...at, owners };
  const pts = exactPoints(ctx, [me, ...owners]);
  const covered = owners.filter((o) => isProtected(me, o, pts));
  const lapsed = places
    .filter(
      (x) => covered.includes(x.owner) && heldByOthers(ctx, x.id, x.owner, me),
    )
    .map((x) => x.id);
  return { ...at, owners: covered, ...(lapsed.length > 0 && { lapsed }) };
}

/** The player's own account: research, options and the push kinds that are off (#192). */
const meOf = (ctx: Ctx, u: User) => ({
  id: u.id,
  name: u.name,
  research: u.research,
  rq: u.rq,
  probes: u.probes,
  explain: u.explain,
  levelTable: u.levelTable,
  pushOff: pushOff(ctx, u.id),
  readAt: u.readAt,
  admin: u.admin,
  // When the vacation mode started (#223); null outside of it.
  vacation: u.vacation,
  // Whether an authenticator app is set up (#401): yes or no, never more.
  totp: hasAuthenticator(ctx, u.id),
});

/** Wirtschaft and Militär of a player in their modes: the number, or the points of the resources (#422). */
const shownScores = (
  c: CategoryScores | undefined,
  modes: CategoryModes,
): { economy: number; military: number } | undefined =>
  c && {
    economy: modes.economy ? c.economy.points : c.economy.count,
    military: modes.military ? c.military.points : c.military.count,
  };

/**
 * Every player with name and points, whether he is in vacation mode (#223),
 * and the inactivity of the account (#229) while it shows one.
 */
function playersOf(
  ctx: Ctx,
  me: string,
  pass: ScorePass,
  limits: ActivityLimits,
  modes: CategoryModes,
  shows: HighscoreShows,
) {
  // The points and the categories of the highscore, for every player (#78
  // D4), of the one pass of this state (#405); Wirtschaft and Militär only
  // in the mode the round sets now (#422).
  const pts = pass.total;
  const scores = pass.categories;
  const idle = inactivities(ctx, limits);
  return Object.fromEntries(
    ctx.players.all().map((x) => [
      x.id,
      {
        name: x.name,
        // What „Highscore zeigt“ lets through (#422, 175a to 177a, 182a):
        // the own points always, another's only while the highscore shows
        // something, Wirtschaft and Militär only with every category.
        ...(x.id === me || shows !== SHOWS.none
          ? { points: pts[x.id] ?? 0 }
          : {}),
        ...(shows === SHOWS.all
          ? { scores: shownScores(scores[x.id], modes) }
          : {}),
        // Who is in vacation mode, for the Sternenkarte (#223).
        ...(x.vacation !== null ? { vacation: true } : {}),
        ...(idle[x.id] ? { inactive: idle[x.id] } : {}),
      },
    ]),
  );
}

/**
 * What a player in vacation mode sees (#223, owner, 2026-11-18): a lock
 * screen instead of the game. The state keeps the shape of the full one but
 * holds none of the game: no planet, fleet, report, guild, player or
 * galaxy; only the rules of the round and the universe, the account with
 * its vacation (`me.vacation`, from which and the minimum duration of the
 * round the browser knows the earliest end), its push settings and, since
 * 2026-11-21 (Q28), its private messages.
 */
function lockedState(
  ctx: Ctx,
  u: User,
  pmOpen?: PmOpen,
): LockedState & MessagesShape {
  return {
    round: roundRules(ctx),
    now: ctx.now(),
    cfg: universe(ctx),
    me: { ...meOf(ctx, u), research: {}, rq: null, probes: 1, readAt: 0 },
    planet: null,
    labs: [],
    fleets: [],
    reports: [],
    players: {},
    galaxy: [],
    debris: [],
    admin: null,
    // The lock screen offers „Nachrichten“ (owner, 2026-11-21, Q28): the
    // player's own conversations, nothing else of the game.
    privateMessages: privateMessageState(ctx, u.id, pmOpen),
  };
}

/** The value of one key of the frame; `view` is what `stateFor` works out once. */
type Build<K extends keyof Frame> = (
  ctx: Ctx,
  u: User,
  view: StateView,
) => Frame[K];

/**
 * A part of the frame with one key; its number fixes the place in the JSON
 * object, its type is the one of the key in `src/core/state/frame.ts` (#317).
 */
const keyed = <K extends keyof Frame>(
  order: number,
  key: K,
  build: Build<K>,
): StatePart => ({
  order,
  keys: [key],
  build: (ctx, u, view) => ({ [key]: build(ctx, u, view) }),
});

/** The own fleets in full, the foreign ones that come to the shown planet as the Auspex-Lehre sees them. */
const fleetsOf: Build<'fleets'> = (ctx, u, view) => {
  // The settled Auspex-Lehre: a level finished by now counts (#228).
  const spy = researchOf(ctx, u).research.spy ?? 0;
  const recognition = recognitionOf(view.round);
  return ctx.fleets
    .all()
    .filter((f) => f.owner === u.id || atPlanet(f, view.planet))
    .map((f) => (f.owner === u.id ? f : foreignView(f, spy, recognition)));
};

/**
 * The keys of the state that belong to no feature, with the numbers that fix
 * their place (a feature part takes a number in between, or the next free ten
 * above the highest, and sets its keys where the number puts them).
 */
const FRAME: readonly StatePart[] = [
  keyed(10, 'round', (_ctx, _u, view) => view.round),
  keyed(20, 'now', (ctx) => ctx.now()),
  keyed(30, 'cfg', (ctx) => universe(ctx)),
  keyed(40, 'me', (ctx, u) => meOf(ctx, u)),
  keyed(50, 'planet', (_ctx, _u, view) => view.planet),
  keyed(70, 'labs', (ctx, u) => ownLabs(ctx, u.id)),
  keyed(90, 'fleets', fleetsOf),
  keyed(100, 'reports', (ctx, u) => ctx.reports.ofPlayer(u.id)),
  keyed(140, 'players', (ctx, u, view) =>
    playersOf(
      ctx,
      u.id,
      view.scores,
      view.limits,
      categoryModes(view.round),
      highscoreShows(view.round),
    ),
  ),
  // „Stand“ of the highscore: when the stored pass was made (#405).
  keyed(145, 'scoresAt', (_ctx, _u, view) => view.scores.at),
  keyed(150, 'galaxy', (ctx, _u, view) => galaxyOf(ctx, view.limits)),
  // Only while the Sternenkarte names its system (151a); else no key.
  keyed(155, 'protectedOwners', (ctx, u, view) =>
    view.shown ? protectedIn(ctx, u.id, view.shown) : undefined,
  ),
  // Every player sees every Trümmerfeld (#45).
  keyed(160, 'debris', (ctx) => ctx.debris.all()),
];

/** The parts of the state in the order of their numbers: the frame and every server feature. */
export const STATE_PARTS = assembleState(FRAME, SERVER_FEATURES);

export function stateFor(
  ctx: Ctx,
  u: User,
  selected?: unknown,
  pmOpen?: PmOpen,
  shown?: unknown,
): Record<string, unknown> {
  if (u.vacation !== null) return lockedState(ctx, u, pmOpen);
  const round = roundRules(ctx);
  // Without a selection the main planet (#221); the first planet stays the
  // home planet („Heimatplanet“).
  const main = mainPlanetOf(ctx, u);
  const requested =
    typeof selected === 'string' ? ctx.planets.get(selected) : null;
  const scores = storedScores(ctx);
  const view: StateView = {
    round,
    main,
    planet: requested?.owner === u.id ? requested : main.planet,
    // The stored pass, N times a day (#405), read once for the whole state.
    pts: scores.total,
    scores,
    limits: activityLimits(round),
    pmOpen,
    // The system of the Sternenkarte, when the request names a valid one.
    shown: shownSystemOf(shown, universe(ctx)),
  };
  const state: Record<string, unknown> = {};
  for (const part of STATE_PARTS)
    Object.assign(state, part.build(ctx, u, view));
  return state;
}
