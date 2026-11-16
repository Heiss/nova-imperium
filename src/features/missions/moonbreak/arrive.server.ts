// A Mondbruch (#95, okf/features/moons.md; owner, 2026-11-13 and
// 2026-11-16) fights at the moon like a Sturmangriff: battle, Trümmerfeld of
// the battle, rebuilt defense, loot after a won battle, both battle reports.
// Only after a won battle (an undefended moon is one) and with Weltenbrecher
// left, two independent rolls follow: the moon breaks, and the Weltenbrecher
// are torn apart by their own shot; the other ships stay. A broken moon and
// lost Weltenbrecher leave no Trümmerfeld.
import { type Moonbreak, moonbreak } from '../../../core/moonbreak.ts';
import type { Fleet, Levels } from '../../../core/types.ts';
import { record } from '../../../server/audit.ts';
import type { Ctx } from '../../../server/game/context.ts';
import type { Arrival } from '../../../server/game/missions.ts';
import { destroyMoon } from '../../../server/game/moons.ts';
import {
  type Fight,
  type ReportExtra,
  battleReports,
  fight,
  flyHome,
} from '../../../server/game/fight.ts';

/** The rolls after the battle, or null when there are none. */
function roll(ctx: Ctx, x: Fight): Moonbreak | null {
  const worldbreakers = x.res.att.dstar ?? 0;
  if (x.res.winner !== 'att' || worldbreakers <= 0) return null;
  return moonbreak(x.t.diameter, worldbreakers, ctx.rng);
}

/** The attacker reads the rolls, the owner that his moon is gone. */
const extra = (r: Moonbreak | null): ReportExtra =>
  r ? { att: { moonbreak: r }, def: r.broken ? { moonLost: true } : {} } : {};

/** The ships that fly home: without the Weltenbrecher when they are lost. */
function survivors(x: Fight, r: Moonbreak | null): Levels {
  if (!r?.lost) return x.res.att;
  const rest = { ...x.res.att };
  delete rest.dstar;
  return rest;
}

export function onArrive(ctx: Ctx, f: Fleet, at: Arrival): void {
  const x = fight(ctx, f, at);
  const r = roll(ctx, x);
  battleReports(ctx, x, extra(r));
  flyHome(ctx, x, survivors(x, r));
  if (!r) return;
  record(ctx, {
    category: 'system',
    action: 'moonbreak',
    actor: f.owner,
    target: x.t.owner,
    detail: { fleet: f.id, moon: x.t.id, ...r },
  });
  if (r.broken) destroyMoon(ctx, x.t);
}
