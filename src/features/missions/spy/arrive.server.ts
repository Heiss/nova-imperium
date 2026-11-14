// An Auspex-Erkundung reports the target to its owner, warns the defender,
// and may be shot down; else it flies back.
import { countUnits } from '../../../core/flight.ts';
import type { Fleet } from '../../../core/types.ts';
import { type Ctx, addReport, coords } from '../../../server/game/context.ts';
import {
  type Arrival,
  researchAt,
  turnBack,
} from '../../../server/game/missions.ts';

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

export function onArrive(ctx: Ctx, f: Fleet, at: Arrival): void {
  const { t, att, def } = at;
  const { attR, defR } = researchAt(at, f.arr);
  const diff = (attR.spy ?? 0) - (defR.spy ?? 0);
  const score = spyScore(f.ships.probe ?? 0, diff);
  const chance = counterChance(countUnits(t.ships), diff);
  const lost = ctx.rng() * 100 < chance;
  const details = { ships: t.ships, def: t.def, b: t.b, r: defR };
  const shown = Object.fromEntries(
    SPY_LEVELS.filter(([min]) => score >= min).map(([, k]) => [k, details[k]]),
  );
  addReport(ctx, f.owner, {
    time: f.arr,
    type: 'spy',
    title: `Auspex-Bericht von ${t.name} ${coords(f.toC)}`,
    participants: [f.owner, t.owner],
    name: t.name,
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
  });
  const text = `Eine fremde Flotte von ${att.name} ${coords(f.fromC)} wurde in der Nähe deines Planeten ${t.name} ${coords(f.toC)} gesichtet. Chance auf Auspex-Abwehr: ${chance} %.${lost ? ' Die Spähschädel wurden abgeschossen!' : ''}`;
  addReport(ctx, t.owner, {
    time: f.arr,
    type: 'info',
    title: 'Auspex-Aktivität',
    participants: [f.owner, t.owner],
    text,
  });
  if (lost) ctx.fleets.delete(f.id);
  else turnBack(ctx, f);
}
