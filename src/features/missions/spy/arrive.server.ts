// An Auspex-Erkundung reports the target to its owner, warns the defender,
// and may be shot down; else it flies back. The fleets that hold at the
// target (#55) show in the fleet of the report.
import { countUnits } from '../../../core/flight.ts';
import { shipsOf, showsHeldApart } from '../../../core/holding.ts';
import { placeName } from '../../../core/moon.ts';
import type { Fleet, Levels, Planet } from '../../../core/types.ts';
import { type Ctx, addReport, coords } from '../../../server/game/context.ts';
import { heldAt } from '../../../server/game/holding.ts';
import {
  type Arrival,
  playerOf,
  researchAt,
  turnBack,
} from '../../../server/game/missions.ts';
import { roundRules } from '../../../server/game/round.ts';

/** How much a spy report shows: more probes and better technology show more. */
export function spyScore(probes: number, diff: number): number {
  return probes + Math.sign(diff) * diff * diff;
}

export function counterChance(defShips: number, diff: number): number {
  return defShips
    ? Math.min(100, Math.round(2 * Math.sqrt(defShips) * Math.pow(2, -diff)))
    : 0;
}

const SPY_LEVELS: [number, 'ships' | 'def' | 'b' | 'r'][] = [
  [2, 'ships'],
  [3, 'def'],
  [5, 'b'],
  [7, 'r'],
];

/** A fleet that holds at the target as the report shows it apart (#55). */
interface HeldFleet {
  name: string;
  ships: Levels;
}

/**
 * The fleet of the target as the spy sees it (owner, 2026-11-17): the fleets
 * that hold there count into the planet's fleet below the round's level of
 * the spy's Auspex-Lehre, and show apart under „Gehaltene Flotten“ from it.
 */
function fleetSeen(
  ctx: Ctx,
  t: Planet,
  spy: number,
): { ships: Levels; held?: HeldFleet[] } {
  const held = heldAt(ctx, t.id);
  if (!held.length) return { ships: t.ships };
  if (!showsHeldApart(spy, roundRules(ctx).heldSpy))
    return { ships: shipsOf([t, ...held]) };
  return {
    ships: t.ships,
    held: held.map((h) => ({
      name: playerOf(ctx, h.owner).name,
      ships: h.ships,
    })),
  };
}

/** What the report shows at a score; the held fleets apart only with the fleet (#55). */
function shownOf(
  ctx: Ctx,
  t: Planet,
  spy: number,
  score: number,
  r: Levels,
): Record<string, unknown> {
  const seen = fleetSeen(ctx, t, spy);
  const details = { ships: seen.ships, def: t.def, b: t.b, r };
  const shown: Record<string, unknown> = Object.fromEntries(
    SPY_LEVELS.filter(([min]) => score >= min).map(([, k]) => [k, details[k]]),
  );
  if (shown.ships && seen.held) shown.held = seen.held;
  return shown;
}

export function onArrive(ctx: Ctx, f: Fleet, at: Arrival): void {
  const { t, att, def } = at;
  const { attR, defR } = researchAt(at, f.arr);
  const diff = (attR.spy ?? 0) - (defR.spy ?? 0);
  const score = spyScore(f.ships.probe ?? 0, diff);
  const chance = counterChance(countUnits(t.ships), diff);
  const lost = ctx.rng() * 100 < chance;
  const shown = shownOf(ctx, t, attR.spy ?? 0, score, defR);
  addReport(
    ctx,
    f.owner,
    {
      time: f.arr,
      type: 'spy',
      title: `Auspex-Bericht von ${placeName(t)} ${coords(f.toC)}`,
      participants: [f.owner, t.owner],
      name: placeName(t),
      defName: def.name,
      coords: f.toC,
      res: {
        m: Math.floor(t.res.m),
        c: Math.floor(t.res.c),
        d: Math.floor(t.res.d),
      },
      counter: chance,
      lost,
      ...shown,
    },
    { topic: 'fleet' },
  );
  const text = `Eine fremde Flotte von ${att.name} ${coords(f.fromC)} wurde in der Nähe deines Planeten ${placeName(t)} ${coords(f.toC)} gesichtet. Chance auf Auspex-Abwehr: ${chance} %.${lost ? ' Die Spähschädel wurden abgeschossen!' : ''}`;
  addReport(
    ctx,
    t.owner,
    {
      time: f.arr,
      type: 'info',
      title: 'Auspex-Aktivität',
      participants: [f.owner, t.owner],
      text,
    },
    { topic: 'spied' },
  );
  if (lost) ctx.fleets.delete(f.id);
  else turnBack(ctx, f);
}
