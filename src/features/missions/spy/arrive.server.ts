// An Auspex-Erkundung reports the target to its owner and warns the
// defender. By the classic rules (#175, okf/features/espionage-defense.md)
// the probes may be detected: then they fight the target's ships and
// defense, and only probes that survive deliver the report; else they fly
// back.
import {
  counterChance as drawnChance,
  counterMax,
  detected,
  shownChance,
} from '../../../core/espionage.ts';
import { countUnits } from '../../../core/flight.ts';
import { placeName } from '../../../core/moon.ts';
import type { Fleet, Levels, Planet } from '../../../core/types.ts';
import { activityLimits } from '../../../core/activity.ts';
import { placeActivity } from '../../../server/game/activity.ts';
import { type Ctx, addReport, coords } from '../../../server/game/context.ts';
import {
  type Fight,
  WON,
  battleReport,
  fight,
  recordBattle,
} from '../../../server/game/fight.ts';
import {
  type Arrival,
  researchAt,
  turnBack,
} from '../../../server/game/missions.ts';
import { roundRules } from '../../../server/game/round.ts';

/** How much a spy report shows: more probes and better technology show more. */
export function spyScore(probes: number, diff: number): number {
  return probes + Math.sign(diff) * diff * diff;
}

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
 * Detected probes fight the target's ships and defense with the battle of
 * an attack (D4); both sides get a battle report. A target with neither
 * gives no battle (owner, 2026-11-17).
 */
function spyBattle(ctx: Ctx, f: Fleet, at: Arrival): Fight | null {
  const { t, att } = at;
  if (!countUnits(t.ships) && !countUnits(t.def)) return null;
  const x = fight(ctx, f, at);
  ctx.planets.save(t);
  recordBattle(ctx, f, t, x);
  const report = battleReport(f, at, x);
  const where = coords(f.toC);
  const title = countUnits(x.res.att)
    ? `Kampfbericht ${where} – ${WON[x.res.winner]}`
    : `Kontakt abgebrochen – deine Spähschädel wurden bei ${where} entdeckt und zerstört.`;
  addReport(ctx, f.owner, { ...report, title }, { topic: 'fleet' });
  const seen = `Kampfbericht ${placeName(t)} ${where} – Spähschädel von ${att.name}`;
  addReport(ctx, t.owner, { ...report, title: seen }, { topic: 'spied' });
  return x;
}

const SPY_LEVELS: [number, 'ships' | 'def' | 'b' | 'r'][] = [
  [2, 'ships'],
  [3, 'def'],
  [5, 'b'],
  [7, 'r'],
];

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
  const shown = Object.fromEntries(
    SPY_LEVELS.filter(([min]) => score >= min).map(([, k]) => [k, details[k]]),
  );
  const fought = seen ? spyBattle(ctx, f, at) : null;
  // Only probes that survive deliver the report (D3; owner, 2026-11-17).
  const lost = fought !== null && !countUnits(fought.res.att);
  const counter = shownChance(chance);
  const activity = placeActivity(ctx, t.id, f.arr, activityLimits(roundRules(ctx)));
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
