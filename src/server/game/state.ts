// What one player sees: their planet, their and incoming fleets, reports,
// the players with points, the galaxy. Foreign fleets show only what an
// observer can see. The admin also gets the settings specification.
import { missionRules } from '../../core/missions.ts';
import { UNIVERSE_SPECS } from '../../core/universe.ts';
import type { Fleet } from '../../core/types.ts';
import type { User } from '../db/repos/players.ts';
import { pushOff } from '../push-options.ts';
import { ownLabs } from './actions.ts';
import { type Ctx, universe } from './context.ts';
import { guildState } from './guilds.ts';
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

function galaxyOf(ctx: Ctx) {
  return ctx.planets.all().map((x) => ({
    id: x.id,
    name: x.name,
    g: x.g,
    s: x.s,
    p: x.p,
    temp: x.temp,
    owner: x.owner,
  }));
}

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
});

export function stateFor(
  ctx: Ctx,
  u: User,
  selected?: unknown,
): Record<string, unknown> {
  const home = ctx.planets.home(u.id);
  const requested =
    typeof selected === 'string' ? ctx.planets.get(selected) : null;
  const p = requested?.owner === u.id ? requested : home;
  const pts = pointsMap(ctx);
  const fleets = ctx.fleets
    .all()
    .filter(
      (f) =>
        f.owner === u.id || (p !== null && f.state === 'out' && f.to === p.id),
    )
    .map((f) => (f.owner === u.id ? f : foreignView(f)));
  const players = Object.fromEntries(
    ctx.players
      .all()
      .map((x) => [x.id, { name: x.name, points: pts[x.id] ?? 0 }]),
  );
  const round = roundRules(ctx);
  return {
    round,
    now: ctx.now(),
    cfg: universe(ctx),
    me: meOf(ctx, u),
    planet: p,
    homePlanet: home?.id ?? null,
    labs: ownLabs(ctx, u.id),
    fleets,
    reports: ctx.reports.ofPlayer(u.id),
    guilds: guildState(ctx, u.id, pts),
    achievements: achievementState(ctx, u, round),
    players,
    galaxy: galaxyOf(ctx),
    // Every player sees every Trümmerfeld (#45).
    debris: ctx.debris.all(),
    admin: u.admin ? { specs: UNIVERSE_SPECS } : null,
  };
}
