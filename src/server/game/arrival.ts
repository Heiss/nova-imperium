import { isDatabaseBusy } from '../db/database.ts';
import { queuePush } from '../push-store.ts';
// What happens when a fleet arrives or comes home. Each mission is a strategy
// in src/features/missions/<m>/ (owner, 2026-11-14, #116): the dispatcher
// checks through the target kind of its rules whether the target still fits,
// else the fleet turns back, and hands the arrival to the mission's
// `onArrive` from the generated server index.
import { MISSION_SERVERS } from '../../features/index.server.gen.ts';
import { type TargetKind, missionRules, suits } from '../../core/missions.ts';
import { settle } from '../../core/settle.ts';
import { inUniverse } from '../../core/universe.ts';
import type { Fleet, Planet } from '../../core/types.ts';
import { type Ctx, addReport, coords, resLine, universe } from './context.ts';
import { type MissionServer, type Player, land, turnBack } from './missions.ts';

// The formulas of the espionage and the battle live with their missions; they
// are exported here as before.
export {
  counterChance,
  spyScore,
} from '../../features/missions/spy/arrive.server.ts';
export {
  plunder,
  rebuild,
} from '../../features/missions/attack/arrive.server.ts';

const UNKNOWN = { name: 'Unbekannt', research: {}, rq: null };

const player = (ctx: Ctx, id: string): Player => ctx.players.get(id) ?? UNKNOWN;

/** The generated index: every mission's server part, sorted by name. */
const SERVERS: ReadonlyMap<string, MissionServer> = new Map<
  string,
  MissionServer
>(MISSION_SERVERS);

function unsuitableTarget(ctx: Ctx, f: Fleet): void {
  addReport(ctx, f.owner, {
    time: f.arr,
    type: 'info',
    title: 'Flotte kehrt um',
    text: `An ${coords(f.toC)} wurde kein passendes Ziel gefunden. Deine Flotte kehrt zurück.`,
  });
  turnBack(ctx, f);
}

/** Whether the target still fits the kind; a free one must also still exist. */
const fits = (ctx: Ctx, kind: TargetKind, f: Fleet, t: Planet | null) =>
  suits(kind, f.owner, t) &&
  (kind !== 'free' || inUniverse(f.toC, universe(ctx)));

export function arrive(ctx: Ctx, f: Fleet): void {
  const rules = missionRules(f.mission);
  if (!rules) throw new Error(`Unknown mission ${f.mission}`);
  // Both indexes list the same folders (gen-features).
  const server = SERVERS.get(f.mission)!;
  const t0 = ctx.planets.get(f.to);
  if (!fits(ctx, rules.target, f, t0)) return unsuitableTarget(ctx, f);
  // A free target gets the raw target, which is nothing; the others the
  // target settled to the arrival, with both players.
  if (!t0) return server.onArrive(ctx, f, null);
  const att = player(ctx, f.owner);
  const def = player(ctx, t0.owner);
  const t = settle(t0, f.arr, universe(ctx), def);
  server.onArrive(ctx, f, { t, att, def });
}

export function comeHome(ctx: Ctx, f: Fleet): void {
  const o0 = ctx.planets.get(f.from);
  if (o0 && o0.owner === f.owner) {
    const o = settle(o0, f.ret, universe(ctx), player(ctx, f.owner));
    land(o, f.ships, f.cargo);
    ctx.planets.save(o);
    const sum = f.cargo.m + f.cargo.c + f.cargo.d;
    if (!missionRules(f.mission)?.silent || f.recalled)
      addReport(
        ctx,
        f.owner,
        {
          time: f.ret,
          type: 'info',
          title: `Rückkehr zu ${o.name} ${coords(f.fromC)}`,
          text: `Deine Flotte ist zurück${sum ? ' und bringt ' + resLine(f.cargo) + ' mit' : ''}.`,
        },
        'fleet',
      );
    else queuePush(ctx, f.owner, 'fleet', f.id, ctx.now());
  }
  ctx.fleets.delete(f.id);
}

/** Processes all due fleets in time order. A broken fleet is logged and removed. */
export function tick(
  ctx: Ctx,
  log: (msg: string, e: unknown) => void = console.error,
): number {
  const now = ctx.now();
  const due = ctx.fleets.due(now);
  for (const f of due) {
    try {
      ctx.tx(() => {
        const live = ctx.fleets.get(f.id);
        if (!live || (live.state === 'out' ? live.arr : live.ret) > now) return;
        if (live.state === 'out') arrive(ctx, live);
        else comeHome(ctx, live);
      });
    } catch (e) {
      // Leave the fleet in place for the next tick when another writer holds the lock.
      if (isDatabaseBusy(e)) break;
      log(`Fleet ${f.id} failed and was removed`, e);
      ctx.fleets.delete(f.id);
    }
  }
  return due.length;
}
