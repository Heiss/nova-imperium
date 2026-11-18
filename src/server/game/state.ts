// What one player sees: their planet, their and incoming fleets, reports,
// the players with points, the galaxy. Foreign fleets show only what an
// observer can see. The admin also gets the settings specification and the
// state of the „Endzeit“ (#161).
import { missionRules } from '../../core/missions.ts';
import { UNIVERSE_SPECS } from '../../core/universe.ts';
import type { Fleet } from '../../core/types.ts';
import type { User } from '../db/repos/players.ts';
import { pushOff } from '../push-options.ts';
import { ownLabs } from './actions.ts';
import { type Ctx, universe } from './context.ts';
import { endzeitState } from './endzeit.ts';
import { guildState } from './guilds.ts';
import { gateState } from './jump-gate.ts';
import { mainPlanetOf, mainPlanetView } from './main-planet.ts';
import { achievementState } from './achievements.ts';
import { roundRules } from './round.ts';
import { pointsMap } from './points.ts';

export interface ForeignFleet {
  id: string;
  owner: string;
  fromC: Fleet['fromC'];
  toC: Fleet['toC'];
  to: string;
  mission: Fleet['mission'];
  state: Fleet['state'];
  arr: number;
  ships: Fleet['ships'];
}

/** An incoming fleet: the ships are visible only for a mission that shows them (attack). */
export const foreignView = (f: Fleet): ForeignFleet => ({
  id: f.id,
  owner: f.owner,
  fromC: f.fromC,
  toC: f.toC,
  to: f.to,
  mission: f.mission,
  state: f.state,
  arr: f.arr,
  ships: missionRules(f.mission)?.visible ? f.ships : {},
});

/** Every planet and moon (#53) of the universe, for every player. */
function galaxyOf(ctx: Ctx) {
  return ctx.planets.all().map((x) => ({
    id: x.id,
    kind: x.kind,
    name: x.name,
    g: x.g,
    s: x.s,
    p: x.p,
    temp: x.temp,
    owner: x.owner,
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

export function stateFor(
  ctx: Ctx,
  u: User,
  selected?: unknown,
): Record<string, unknown> {
  const round = roundRules(ctx);
  // Without a selection the main planet (#221); the first planet stays the
  // home planet („Heimatplanet“).
  const main = mainPlanetOf(ctx, u, round);
  const requested =
    typeof selected === 'string' ? ctx.planets.get(selected) : null;
  const p = requested?.owner === u.id ? requested : main.planet;
  const pts = pointsMap(ctx);
  const fleets = ctx.fleets
    .all()
    .filter(
      (f) =>
        f.owner === u.id || (p !== null && f.state === 'out' && f.to === p.id),
    )
    .map((f) => (f.owner === u.id ? f : foreignView(f)));
  const players = Object.fromEntries(
    ctx.players.all().map((x) => [
      x.id,
      // Who is in vacation mode, for the Sternenkarte (#223).
      { name: x.name, points: pts[x.id] ?? 0, vacation: x.vacation !== null },
    ]),
  );
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
    achievements: achievementState(ctx, u, round),
    players,
    galaxy: galaxyOf(ctx),
    // Every player sees every Trümmerfeld (#45).
    debris: ctx.debris.all(),
    // Every position locked after an abandonment, for the Sternenkarte (#224).
    locks: ctx.planets.locks(ctx.now()),
    admin: adminState(ctx, u),
  };
}
