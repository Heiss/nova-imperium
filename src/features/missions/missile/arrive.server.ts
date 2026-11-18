// The impact of a Raketenangriff (#54, okf/features/missiles.md): the
// Abfangraketen of the target stop one Orbitalrakete each, at a moon those of
// its planet (owner, 2026-11-16, Q1); the rest destroy defense, the main
// target first, then the order of the catalog (D3). The destroyed defense
// is not rebuilt and leaves no Trümmerfeld [V]; the missiles are gone. Both
// players get a report [V].
import {
  INTERCEPTORS,
  STRIKER,
  type Strike,
  strike,
} from '../../../core/missiles.ts';
import { placeName } from '../../../core/moon.ts';
import { placeId } from '../../../core/place.ts';
import { settle } from '../../../core/settle.ts';
import { text } from '../../../core/text.ts';
import type { Fleet, Levels, Planet } from '../../../core/types.ts';
import { record } from '../../../server/audit.ts';
import {
  type Ctx,
  addReport,
  coords,
  fmt,
  universe,
} from '../../../server/game/context.ts';
import { type Arrival, researchAt } from '../../../server/game/missions.ts';

/**
 * The place whose Abfangraketen protect the target: the target itself, or
 * for a moon its planet, settled to the arrival; null when there is none.
 */
function shield(ctx: Ctx, at: Arrival, f: Fleet): Planet | null {
  if (at.t.kind === 'planet') return at.t;
  const p = ctx.planets.get(placeId({ ...f.toC, kind: 'planet' }));
  return p && p.owner === at.t.owner
    ? settle(p, f.arr, universe(ctx), at.def)
    : null;
}

/** Takes `n` of each key from a stock; a key at 0 is removed. */
function remove(stock: Levels, n: Levels): void {
  for (const [k, x] of Object.entries(n)) {
    const left = (stock[k] ?? 0) - x;
    if (left > 0) stock[k] = left;
    else delete stock[k];
  }
}

/** „Zerstört: 3 Raketenbatterie, 1 Lichtlanze.“ or that nothing was. */
const destroyedLine = (destroyed: Levels): string => {
  const parts = Object.entries(destroyed).map(
    ([k, n]) => `${fmt(n)} ${text(k)?.n ?? k}`,
  );
  return parts.length
    ? `Zerstört: ${parts.join(', ')}.`
    : 'Keine Verteidigung zerstört.';
};

export function onArrive(ctx: Ctx, f: Fleet, at: Arrival): void {
  const { t } = at;
  const { attR, defR } = researchAt(at, f.arr);
  const guard = shield(ctx, at, f);
  const interceptors: Levels = {};
  for (const k of INTERCEPTORS) interceptors[k] = guard?.def[k] ?? 0;
  const n = f.ships[STRIKER] ?? 0;
  const own = guard === t;
  const s = strike(n, { def: t.def, interceptors, own }, f.aim ?? null, {
    weapons: attR.weapons ?? 0,
    armor: defR.armor ?? 0,
  });
  remove(t.def, s.destroyed);
  if (guard && !own) {
    remove(guard.def, s.used);
    ctx.planets.save(guard);
  } else remove(t.def, s.used);
  ctx.planets.save(t);
  ctx.fleets.delete(f.id);
  record(ctx, {
    category: 'system',
    action: 'missile',
    actor: f.owner,
    target: t.owner,
    detail: {
      fleet: f.id,
      planet: t.id,
      missiles: n,
      intercepted: s.intercepted,
      scheduled: f.arr,
    },
  });
  reports(ctx, f, at, n, s);
}

/** The report for both sides: the attacker and the attacked. */
function reports(
  ctx: Ctx,
  f: Fleet,
  { t, att }: Arrival,
  n: number,
  s: Strike,
): void {
  const where = coords(f.toC);
  const body = `${fmt(n - s.intercepted)} Orbitalraketen trafen ${where}; ${fmt(s.intercepted)} wurden abgefangen. ${destroyedLine(s.destroyed)}`;
  const report = { time: f.arr, type: 'info' as const, text: body };
  addReport(
    ctx,
    f.owner,
    { ...report, title: `Raketenangriff ${where}` },
    { topic: 'fleet' },
  );
  addReport(
    ctx,
    t.owner,
    {
      ...report,
      title: `Feindkontakt! ${placeName(t)} ${where} wird von ${att.name} angegriffen`,
    },
    { topic: 'attacked' },
  );
}
