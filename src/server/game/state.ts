// What one player sees: their planet, their and incoming fleets, reports,
// the players with points, the galaxy. Foreign fleets show only what an
// observer can see. The admin also gets the settings specification.
import { UNIVERSE_SPECS } from '../../shared/universe.ts';
import type { Fleet } from '../../shared/types.ts';
import type { User } from '../db/store.ts';
import { type Ctx, universe } from './context.ts';
import { guildState } from './guilds.ts';
import { achievementState } from './achievements.ts';
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

/** An incoming fleet: the ships are visible only for an attack. */
export const foreignView = (f: Fleet): ForeignFleet => ({
  id: f.id,
  owner: f.owner,
  fromC: f.fromC,
  toC: f.toC,
  to: f.to,
  mission: f.mission,
  state: f.state,
  arr: f.arr,
  ships: f.mission === 'attack' ? f.ships : {},
});

export function stateFor(ctx: Ctx, u: User): Record<string, unknown> {
  const p = ctx.store.planetOfUser(u.id);
  const pts = pointsMap(ctx);
  const fleets = ctx.store
    .fleets()
    .filter(
      (f) =>
        f.owner === u.id || (p !== null && f.state === 'out' && f.to === p.id),
    )
    .map((f) => (f.owner === u.id ? f : foreignView(f)));
  const players = Object.fromEntries(
    ctx.store
      .users()
      .map((x) => [x.id, { name: x.name, points: pts[x.id] ?? 0 }]),
  );
  const galaxy = ctx.store.planets().map((x) => ({
    id: x.id,
    name: x.name,
    g: x.g,
    s: x.s,
    p: x.p,
    temp: x.temp,
    owner: x.owner,
  }));
  return {
    now: ctx.now(),
    cfg: universe(ctx),
    me: {
      id: u.id,
      name: u.name,
      research: u.research,
      rq: u.rq,
      probes: u.probes,
      readAt: u.readAt,
      admin: u.admin,
    },
    planet: p,
    fleets,
    reports: ctx.store.reports(u.id),
    guilds: guildState(ctx, u.id, pts),
    achievements: achievementState(ctx, u),
    players,
    galaxy,
    admin: u.admin ? { specs: UNIVERSE_SPECS } : null,
  };
}
