import { isDatabaseBusy } from '../db/database.ts';
import { placeName } from '../../core/moon.ts';
import { queuePush } from '../push-store.ts';
// What happens when a fleet arrives or comes home. Each mission is a strategy
// in src/features/missions/<m>/ (owner, 2026-11-14, #116): the dispatcher
// checks through the target kind of its rules whether the target still fits,
// else the fleet turns back, and hands the arrival to the mission's
// `onArrive` from the generated server index.
import { MISSION_SERVERS } from '../../features/index.server.gen.ts';
import {
  launchOf,
  MISSION,
  type TargetKind,
  missionRules,
  suits,
} from '../../core/missions.ts';
import { isExpeditionPlace } from '../../core/expedition.ts';
import { settle } from '../../core/settle.ts';
import { inUniverse } from '../../core/universe.ts';
import type { Fleet, Planet } from '../../core/types.ts';
import { type Ctx, addReport, coords, resLine, universe } from './context.ts';
import { dueAt } from '../../core/holding.ts';
import { endHold } from './holding.ts';
import { dropPlanned, startPlanned } from './union-start.ts';
import { type MissionServer, land, playerOf, turnBack } from './missions.ts';
import { lockedUntil } from './position-lock.ts';
import { beginCause, dropCause, fleetBefore, journalFleet } from './journal.ts';
import { EVENT_KIND } from '../../core/round-events.ts';

// The formulas of the espionage (src/core/spy.ts, #285) and of the battle
// (with its mission and the shared battle of #175) are exported here as
// before.
export { spyScore } from '../../core/spy.ts';
export { plunder } from '../../features/missions/attack/arrive.server.ts';
export { rebuild } from './fight.ts';

const player = playerOf;

/** The generated index: every mission's server part, sorted by name. */
const SERVERS: ReadonlyMap<string, MissionServer> = new Map<
  string,
  MissionServer
>(MISSION_SERVERS);

/**
 * Missiles whose target is gone are lost: they cannot come back (#54) [V].
 */
function lostMissiles(ctx: Ctx, f: Fleet): void {
  addReport(
    ctx,
    f.owner,
    {
      time: f.arr,
      type: 'info',
      title: `${MISSION[f.mission]} ${coords(f.toC)}`,
      text: `An ${coords(f.toC)} wurde kein passendes Ziel gefunden. Deine Orbitalraketen sind verloren.`,
    },
    { topic: 'fleet' },
  );
  ctx.fleets.delete(f.id);
}

/** A fleet whose target no longer fits flies back with what it carries. */
function unsuitableTarget(ctx: Ctx, f: Fleet, kind: TargetKind): void {
  addReport(
    ctx,
    f.owner,
    {
      time: f.arr,
      type: 'info',
      title: 'Flotte kehrt um',
      text:
        kind === 'debris'
          ? 'An der Position war kein Trümmerfeld mehr.'
          : `An ${coords(f.toC)} wurde kein passendes Ziel gefunden. Deine Flotte kehrt zurück.`,
    },
    { topic: 'fleet' },
  );
  turnBack(ctx, f);
}

/**
 * Whether the target still fits the kind; a free one must also still exist
 * and must not be locked after an abandonment (#224, D2), a Trümmerfeld
 * must still be there (#45), and the expedition position must still be the
 * one after the last planet position (#93).
 */
function fits(ctx: Ctx, kind: TargetKind, f: Fleet, t: Planet | null): boolean {
  if (!suits(kind, f.owner, t, kind === 'debris' && !!ctx.debris.get(f.to)))
    return false;
  if (kind === 'expedition') return isExpeditionPlace(f.toC, universe(ctx));
  if (kind !== 'free') return true;
  return (
    inUniverse(f.toC, universe(ctx)) && lockedUntil(ctx, f.toC, f.arr) === null
  );
}

export function arrive(ctx: Ctx, f: Fleet): void {
  const rules = missionRules(f.mission);
  if (!rules) throw new Error(`Unknown mission ${f.mission}`);
  // Both indexes list the same folders (gen-features).
  const server = SERVERS.get(f.mission)!;
  const t0 = ctx.planets.get(f.to);
  if (!fits(ctx, rules.target, f, t0))
    return launchOf(rules) === 'missiles'
      ? lostMissiles(ctx, f)
      : unsuitableTarget(ctx, f, rules.target);
  // A free target gets the raw target, which is nothing, and so does a
  // Trümmerfeld, which is no planet; the others the target settled to the
  // arrival, with both players.
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
          title: `Rückkehr zu ${placeName(o)} ${coords(f.fromC)}`,
          text: `Deine Flotte ist zurück${sum ? ' und bringt ' + resLine(f.cargo) + ' mit' : ''}.`,
        },
        { topic: 'fleet', kind: 'fleet' },
      );
    else
      queuePush(ctx, f.owner, {
        kind: 'fleet',
        topic: 'fleet',
        key: f.id,
        due: ctx.now(),
      });
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
  // The planned starts of attack unions (#478) go in the order of time with
  // the fleets: a battle at the planet before the start comes first.
  const starts = ctx.unions.dueStarts(now);
  let next = 0;
  const startUntil = (t: number): boolean => {
    for (; next < starts.length && starts[next]!.start!.at <= t; next++)
      if (!runStart(ctx, starts[next]!.id, now, log)) return false;
    return true;
  };
  for (const f of due) {
    if (!startUntil(dueAt(f))) return due.length + next;
    try {
      ctx.tx(() => {
        const live = ctx.fleets.get(f.id);
        if (!live || dueAt(live) > now) return;
        // The journal of the round: one event per arrival, end of holding and return (#235).
        const at = dueAt(live);
        beginCause(at);
        const before = fleetBefore(ctx, live);
        const kind = {
          out: EVENT_KIND.arrival,
          hold: EVENT_KIND.hold,
          back: EVENT_KIND.return,
        }[live.state];
        if (live.state === 'out') arrive(ctx, live);
        // A Halten flies home at the end of its holding time (#55).
        else if (live.state === 'hold') endHold(ctx, live);
        else comeHome(ctx, live);
        journalFleet(ctx, kind, live, at, before);
      });
    } catch (e) {
      dropCause();
      // Leave the fleet in place for the next tick when another writer holds
      // the lock, and every planned start after it too, so the order holds (#478).
      if (isDatabaseBusy(e)) return due.length + next;
      log(`Fleet ${f.id} failed and was removed`, e);
      ctx.fleets.delete(f.id);
    }
  }
  startUntil(now);
  return due.length + next;
}

/**
 * Starts the planned fleet of the union `id` when it is still due (#478);
 * false when another writer holds the lock, so the tick stops and the start
 * waits for the next one. A start that fails otherwise is logged and, after
 * the rollback, dissolves the union as a start that did not happen: the
 * joined fleets turn back and every owner gets his report.
 */
function runStart(
  ctx: Ctx,
  id: string,
  now: number,
  log: (msg: string, e: unknown) => void,
): boolean {
  try {
    ctx.tx(() => {
      const live = ctx.unions.get(id);
      if (!live?.start || live.start.at > now) return;
      startPlanned(ctx, live);
    });
    return true;
  } catch (e) {
    if (isDatabaseBusy(e)) return false;
    log(`Planned start ${id} failed and was removed`, e);
    failedStart(ctx, id, log);
    return true;
  }
}

/** Dissolves the union of a start that failed; if that fails too, its row goes alone. */
function failedStart(
  ctx: Ctx,
  id: string,
  log: (msg: string, e: unknown) => void,
): void {
  try {
    ctx.tx(() => {
      const row = ctx.unions.get(id);
      if (row?.start) dropPlanned(ctx, row);
    });
  } catch (e) {
    log(`Planned start ${id} could not be dissolved`, e);
    ctx.unions.delete(id);
  }
}
