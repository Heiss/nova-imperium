// A Vermessung surveys the free position (#190): the probes may be lost,
// then there is no report (D7); else the position gets its values at its
// first survey (D1), the owner a report of the tier the score reaches (D2),
// with the windows of score 4 shifted at random (owner, 2026-11-17), and
// the probes fly back. The dispatcher has checked that the position is
// still free and inside the universe.
import { colonyDiameter } from '../../../core/fields.ts';
import { distance } from '../../../core/flight.ts';
import { settleR } from '../../../core/settle.ts';
import {
  maxLoss,
  nearShift,
  rollTemp,
  surveyFindings,
  surveyLost,
  surveyScore,
  surveyTier,
} from '../../../core/survey.ts';
import type { Fleet } from '../../../core/types.ts';
import type { Survey } from '../../../server/db/repos/surveys.ts';
import { type Ctx, addReport, coords } from '../../../server/game/context.ts';
import { turnBack } from '../../../server/game/missions.ts';

/** The level of „Auspex-Kartographie“ of the owner at the arrival. */
function levelAt(ctx: Ctx, f: Fleet): number {
  const u = ctx.players.get(f.owner);
  return u ? (settleR(u, f.arr).research.carto ?? 0) : 0;
}

/** The values of the position: stored at its first survey (D1). */
function valuesOf(ctx: Ctx, f: Fleet): Survey {
  const known = ctx.surveys.get(f.toC);
  if (known) return known;
  const c = f.toC;
  const s: Survey = {
    id: ctx.id(),
    g: c.g,
    s: c.s,
    p: c.p,
    temp: rollTemp(c.p, ctx.rng),
    diameter: colonyDiameter(c.p, ctx.rng),
    created: f.arr,
  };
  ctx.surveys.add(s);
  return s;
}

export function onArrive(ctx: Ctx, f: Fleet): void {
  const probes = f.ships.probe ?? 0;
  const level = levelAt(ctx, f);
  if (surveyLost(maxLoss(probes, level, distance(f.fromC, f.toC)), ctx.rng))
    return ctx.fleets.delete(f.id);
  const values = valuesOf(ctx, f);
  const tier = surveyTier(surveyScore(probes, level));
  // The windows of tier `near` are placed once, here, and stored with the
  // report as their ends; the shift itself is not stored, it would tell
  // the true value.
  const findings = surveyFindings(
    f.toC,
    values,
    tier,
    nearShift(tier, ctx.rng),
  );
  addReport(
    ctx,
    f.owner,
    {
      time: f.arr,
      type: 'survey',
      title: `Vermessungsbericht ${coords(f.toC)}`,
      coords: f.toC,
      survey: values.id,
      ...findings,
    },
    { topic: 'fleet' },
  );
  turnBack(ctx, f);
}
