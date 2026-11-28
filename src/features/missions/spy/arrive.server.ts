// An Auspex-Erkundung reports the target to its owner and warns the
// defender. By the classic rules (#175, okf/features/espionage-defense.md)
// the probes may be detected: then they fight the target's ships and
// defense, and only probes that survive deliver the report; else they fly
// back. What a report shows is in src/core/spy.ts, which the Lexicanum
// reads too (#285). The fleets that hold at the target (#55) show in the
// fleet of the report, and defend it against detected probes with the
// target (fight).
import {
  counterChance as drawnChance,
  counterMax,
  detected,
  shownChance,
} from '../../../core/espionage.ts';
import { countUnits } from '../../../core/flight.ts';
import { placeName } from '../../../core/moon.ts';
import { spyParts, spyScore } from '../../../core/spy.ts';
import type { Fleet, Levels, Planet } from '../../../core/types.ts';
import { activityLimits } from '../../../core/activity.ts';
import { placeActivity } from '../../../server/game/activity.ts';
import { type Ctx, addReport, coords } from '../../../server/game/context.ts';
import { withHeldFleets } from '../../../server/game/holding.ts';
import {
  type Fight,
  WON,
  afterHeld,
  battleReport,
  defenders,
  fight,
  heldBlocks,
  recordBattle,
  reportHeldOwners,
} from '../../../server/game/fight.ts';
import {
  type Arrival,
  researchAt,
  turnBack,
} from '../../../server/game/missions.ts';
import { roundRules } from '../../../server/game/round.ts';

/** The counter-espionage chance of this spying in percent, drawn up to its maximum (D1, D2). */
function chanceAt(ctx: Ctx, f: Fleet, t: Planet, attR: Levels, defR: Levels) {
  const max = counterMax({
    probes: f.ships.probe ?? 0,
    ships: countUnits(t.ships),
    target: defR.spy ?? 0,
    spy: attR.spy ?? 0,
  });
  return drawnChance(max, ctx.rng);
}

/**
 * Detected probes fight the target's ships and defense, and the fleets that
 * hold there (owner, 2026-11-19), with the battle of an attack (D4); both
 * sides get a battle report, and so does the owner of every fleet that held.
 * A target with neither ships, defense nor a fleet that holds gives no
 * battle (owner, 2026-11-17).
 */
function spyBattle(ctx: Ctx, f: Fleet, at: Arrival): Fight | null {
  const { t, att } = at;
  const held = defenders(ctx, f, t);
  if (!countUnits(t.ships) && !countUnits(t.def) && !held.length) return null;
  const x = fight(ctx, f, at, held);
  ctx.planets.save(t);
  afterHeld(ctx, x.held);
  recordBattle(ctx, f, t, x);
  const report = battleReport(f, at, x);
  const where = coords(f.toC);
  const title = countUnits(x.res.att)
    ? `Kampfbericht ${where} – ${WON[x.res.winner]}`
    : `Kontakt abgebrochen – deine Spähschädel wurden bei ${where} entdeckt und zerstört.`;
  addReport(ctx, f.owner, { ...report, title }, { topic: 'fleet' });
  const seen = `Kampfbericht ${placeName(t)} ${where} – Spähschädel von ${att.name}`;
  const defender = { ...report, ...heldBlocks(x, true), title: seen };
  addReport(ctx, t.owner, defender, { topic: 'spied' });
  reportHeldOwners(ctx, x, defender, 'spied');
  return x;
}

/** The defender always learns from where they were spied on, and the chance. */
function warn(
  ctx: Ctx,
  f: Fleet,
  { t, att }: Arrival,
  counter: number,
  lost: boolean,
): void {
  const text = `Eine fremde Flotte von ${att.name} ${coords(f.fromC)} wurde in der Nähe deines Planeten ${placeName(t)} ${coords(f.toC)} gesichtet. Chance auf Auspex-Abwehr: ${counter} %.${lost ? ' Die Spähschädel wurden abgeschossen!' : ''}`;
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
}

export function onArrive(ctx: Ctx, f: Fleet, at: Arrival): void {
  const { t, def } = at;
  const { attR, defR } = researchAt(at, f.arr);
  const diff = (attR.spy ?? 0) - (defR.spy ?? 0);
  const score = spyScore(f.ships.probe ?? 0, diff);
  const chance = chanceAt(ctx, f, t, attR, defR);
  const seen = detected(chance, ctx.rng);
  const details = { ships: t.ships, def: t.def, b: t.b, r: defR };
  const parts = Object.fromEntries(spyParts(score).map((k) => [k, details[k]]));
  const shown = withHeldFleets(ctx, t, attR.spy ?? 0, parts);
  const fought = seen ? spyBattle(ctx, f, at) : null;
  // Only probes that survive deliver the report (D3; owner, 2026-11-17).
  const lost = fought !== null && !countUnits(fought.res.att);
  const counter = shownChance(chance);
  const activity = placeActivity(
    ctx,
    t.id,
    f.arr,
    activityLimits(roundRules(ctx)),
  );
  if (!lost)
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
        activity,
        counter,
        ...shown,
      },
      { topic: 'fleet' },
    );
  warn(ctx, f, at, counter, lost);
  if (lost) ctx.fleets.delete(f.id);
  else turnBack(ctx, f, fought ? { ships: fought.res.att } : {});
}
