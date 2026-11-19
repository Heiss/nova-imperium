// An Auspex-Erkundung reports the target to its owner, warns the defender,
// and may be shot down; else it flies back. Its formulas are in
// src/core/spy.ts, which the Lexicanum reads too (#285). The fleets that hold
// at the target (#55) show in the fleet of the report.
import { countUnits } from '../../../core/flight.ts';
import { placeName } from '../../../core/moon.ts';
import { counterChance, spyParts, spyScore } from '../../../core/spy.ts';
import type { Fleet } from '../../../core/types.ts';
import { type Ctx, addReport, coords } from '../../../server/game/context.ts';
import { spyFleetSeen } from '../../../server/game/holding.ts';
import {
  type Arrival,
  researchAt,
  turnBack,
} from '../../../server/game/missions.ts';

export function onArrive(ctx: Ctx, f: Fleet, at: Arrival): void {
  const { t, att, def } = at;
  const { attR, defR } = researchAt(at, f.arr);
  const diff = (attR.spy ?? 0) - (defR.spy ?? 0);
  const score = spyScore(f.ships.probe ?? 0, diff);
  const chance = counterChance(countUnits(t.ships), diff);
  const lost = ctx.rng() * 100 < chance;
  const seen = spyFleetSeen(ctx, t, attR.spy ?? 0);
  const details = { ships: seen.ships, def: t.def, b: t.b, r: defR };
  const shown: Record<string, unknown> = Object.fromEntries(
    spyParts(score).map((k) => [k, details[k]]),
  );
  if (shown.ships && seen.held) shown.held = seen.held;
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
