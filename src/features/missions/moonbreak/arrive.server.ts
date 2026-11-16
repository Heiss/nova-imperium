// A Mondbruch (#95, okf/features/moons.md; owner, 2026-11-13 and
// 2026-11-16) fights at the moon like a Sturmangriff: battle, Trümmerfeld of
// the battle, rebuilt defense, loot after a won battle, both battle reports.
// Only after a won battle (an undefended moon is one) and with Weltenbrecher
// left, two independent rolls follow: the moon breaks, and the Weltenbrecher
// are torn apart by their own shot; the other ships stay and bring home
// what of the loot their holds take. A broken moon and lost Weltenbrecher
// leave no Trümmerfeld.
import { type Moonbreak, moonbreak } from '../../../core/moonbreak.ts';
import { capacity } from '../../../core/flight.ts';
import type { Fleet, Levels, Resources } from '../../../core/types.ts';
import { record } from '../../../server/audit.ts';
import type { Ctx } from '../../../server/game/context.ts';
import type { Arrival } from '../../../server/game/missions.ts';
import { destroyMoon } from '../../../server/game/moons.ts';
import {
  type Fight,
  type ReportExtra,
  battleReports,
  cutLoot,
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

/**
 * The ships that fly home with their loot: without the Weltenbrecher when
 * they are lost, and the loot cut to the holds of the ships left (owner,
 * 2026-11-16); a fleet without ships carries nothing.
 */
function homeward(x: Fight, r: Moonbreak | null): Homeward {
  if (!r?.lost) return {};
  const ships = { ...x.res.att };
  delete ships.dstar;
  const { m, c, d } = x.f.cargo;
  return { ships, loot: cutLoot(x.loot, capacity(ships) - (m + c + d)) };
}

/** What flies home; nothing named keeps the ships and loot of the battle. */
interface Homeward {
  ships?: Levels;
  loot?: Resources;
}

export function onArrive(ctx: Ctx, f: Fleet, at: Arrival): void {
  const x = fight(ctx, f, at);
  const r = roll(ctx, x);
  battleReports(ctx, x, extra(r));
  const home = homeward(x, r);
  flyHome(ctx, x, home.ships, home.loot);
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
