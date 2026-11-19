// What one player sees: their planet, their and incoming fleets, reports,
// the players with points, the galaxy. Foreign fleets show only what an
// observer can see: of the ships what the observer's Auspex-Lehre
// recognizes (#228). The admin also gets the settings specification and the
// state of the „Endzeit“ (#161).
import { type ActivityLimits, activityLimits } from '../../core/activity.ts';
import {
  type Recognition,
  recognitionOf,
  type SeenShips,
  seenShips,
} from '../../core/fleet-recognition.ts';
import { UNIVERSE_SPECS } from '../../core/universe.ts';
import type { Fleet } from '../../core/types.ts';
import type { User } from '../db/repos/players.ts';
import { pushOff } from '../push-options.ts';
import { ownLabs, researchOf } from './actions.ts';
import { inactivities, planetActivities } from './activity.ts';
import { type Ctx, universe } from './context.ts';
import { endzeitState } from './endzeit.ts';
import { friendState } from './friends.ts';
import { guildState } from './guilds.ts';
import { gateState } from './jump-gate.ts';
import { mainPlanetOf, mainPlanetView } from './main-planet.ts';
import { achievementState } from './achievements.ts';
import { roundRules } from './round.ts';
import { categoryScores } from './highscore.ts';
import { pointsMap } from './points.ts';

export interface ForeignFleet extends SeenShips {
  id: string;
  owner: string;
  fromC: Fleet['fromC'];
  toC: Fleet['toC'];
  to: string;
  mission: Fleet['mission'];
  state: Fleet['state'];
  arr: number;
}

/**
 * An incoming fleet as an observer with the Auspex-Lehre `level` sees it:
 * of its ships only what the thresholds of the round allow, for every
 * mission (#228, D1, D2).
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
  ...seenShips(f.ships, level, recognition),
});

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

/** What only the admin gets: the settings specification and the „Endzeit“. */
const adminState = (ctx: Ctx, u: User) =>
  u.admin ? { specs: UNIVERSE_SPECS, endzeit: endzeitState(ctx) } : null;

/** The player's own account: research, options and the push kinds that are off (#192). */
const meOf = (ctx: Ctx, u: User) => ({
  id: u.id,
  name: u.name,
  research: u.research,
  rq: u.rq,
  probes: u.probes,
  explain: u.explain,
  pushOff: pushOff(ctx, u.id),
  readAt: u.readAt,
  admin: u.admin,
  // When the vacation mode started (#223); null outside of it.
  vacation: u.vacation,
});

/**
 * Every player with name and points, whether he is in vacation mode (#223),
 * and the inactivity of the account (#229) while it shows one.
 */
function playersOf(
  ctx: Ctx,
  pts: Readonly<Record<string, number>>,
  limits: ActivityLimits,
) {
  // The categories of the highscore, for every player (#78 D4).
  const scores = categoryScores(ctx);
  const idle = inactivities(ctx, limits);
  return Object.fromEntries(
    ctx.players.all().map((x) => [
      x.id,
      {
        name: x.name,
        points: pts[x.id] ?? 0,
        scores: scores[x.id],
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
 * round the browser knows the earliest end) and its push settings.
 */
function lockedState(ctx: Ctx, u: User): Record<string, unknown> {
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
  };
}

export function stateFor(
  ctx: Ctx,
  u: User,
  selected?: unknown,
): Record<string, unknown> {
  if (u.vacation !== null) return lockedState(ctx, u);
  const round = roundRules(ctx);
  // Without a selection the main planet (#221); the first planet stays the
  // home planet („Heimatplanet“).
  const main = mainPlanetOf(ctx, u, round);
  const requested =
    typeof selected === 'string' ? ctx.planets.get(selected) : null;
  const p = requested?.owner === u.id ? requested : main.planet;
  const pts = pointsMap(ctx);
  // The settled Auspex-Lehre: a level finished by now counts (#228).
  const spy = researchOf(ctx, u).research.spy ?? 0;
  const recognition = recognitionOf(round);
  const fleets = ctx.fleets
    .all()
    .filter(
      (f) =>
        f.owner === u.id || (p !== null && f.state === 'out' && f.to === p.id),
    )
    .map((f) => (f.owner === u.id ? f : foreignView(f, spy, recognition)));
  const limits = activityLimits(round);
  return {
    round,
    now: ctx.now(),
    cfg: universe(ctx),
    me: meOf(ctx, u),
    planet: p,
    homePlanet: ctx.planets.home(u.id)?.id ?? null,
    ...mainPlanetView(main, ctx.now()),
    labs: ownLabs(ctx, u.id),
    // The own Warp-Tore with their readiness (#230).
    gates: gateState(ctx, u.id),
    fleets,
    reports: ctx.reports.ofPlayer(u.id),
    // No guild data while guilds are off in the round (#191).
    guilds: round.guilds ? guildState(ctx, u.id, pts) : null,
    // The buddy list (#227): only the player's own friends and requests.
    friends: friendState(ctx, u.id, limits.recent),
    achievements: achievementState(ctx, u, round),
    players: playersOf(ctx, pts, limits),
    galaxy: galaxyOf(ctx, limits),
    // Every player sees every Trümmerfeld (#45).
    debris: ctx.debris.all(),
    // Every position locked after an abandonment, for the Sternenkarte (#224).
    locks: ctx.planets.locks(ctx.now()),
    admin: adminState(ctx, u),
  };
}
