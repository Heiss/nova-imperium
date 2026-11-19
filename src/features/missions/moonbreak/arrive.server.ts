// A Mondbruch (#95, okf/features/moons.md; owner, 2026-11-13 and
// 2026-11-16) fights at the moon like a Sturmangriff: battle, Trümmerfeld of
// the battle, rebuilt defense, loot after a won battle, both battle reports
// (the steps are shared in src/server/game/fight.ts). The fleets that hold at
// the moon (#55) defend it with its owner (owner, 2026-11-19); when the moon
// breaks, the survivors move to its planet and hold on there (destroyMoon).
// Only after a won battle (an undefended moon is one) and with Weltenbrecher
// left, two independent rolls follow: the moon breaks, and the Weltenbrecher
// are torn apart by their own shot; the other ships stay and bring home
// what of the loot their holds take. A broken moon and lost Weltenbrecher
// leave no Trümmerfeld.
import { capacity } from '../../../core/flight.ts';
import { type Moonbreak, moonbreak } from '../../../core/moonbreak.ts';
import type { Fleet, Levels, Resources } from '../../../core/types.ts';
import { record } from '../../../server/audit.ts';
import type { Ctx } from '../../../server/game/context.ts';
import {
  type Raid,
  type ReportExtra,
  addResources,
  attackReports,
  cutLoot,
  defenders,
  flyHome,
  raid,
  total,
} from '../../../server/game/fight.ts';
import type { Arrival } from '../../../server/game/missions.ts';
import { destroyMoon } from '../../../server/game/moons.ts';

/** The rolls after the battle, or null when there are none. */
function roll(ctx: Ctx, at: Arrival, x: Raid): Moonbreak | null {
  const worldbreakers = x.res.att.dstar ?? 0;
  if (x.res.winner !== 'att' || worldbreakers <= 0) return null;
  return moonbreak(at.t.diameter, worldbreakers, ctx.rng);
}

/** The attacker reads the rolls, the owner that his moon is gone. */
const extra = (r: Moonbreak | null): ReportExtra =>
  r ? { att: { moonbreak: r }, def: r.broken ? { moonLost: true } : {} } : {};

/** What flies home; nothing named keeps the ships and the cargo of the battle. */
interface Homeward {
  ships?: Levels;
  cargo?: Resources;
}

/**
 * The ships that fly home with their cargo: without the Weltenbrecher when
 * they are lost, and then the cargo cut to the holds of the ships left
 * (owner, 2026-11-16 for the loot, 2026-11-18 for the cargo the fleet
 * already carried): what the fleet carried first, then the loot in what is
 * free; the rest is lost. A fleet without ships carries nothing.
 */
function homeward(f: Fleet, x: Raid, r: Moonbreak | null): Homeward {
  if (!r?.lost) return {};
  const ships = { ...x.res.att };
  delete ships.dstar;
  const room = capacity(ships);
  const carried = cutLoot(f.cargo, room);
  const loot = cutLoot(x.loot, room - total(carried));
  return { ships, cargo: addResources(carried, loot) };
}

export function onArrive(ctx: Ctx, f: Fleet, at: Arrival): void {
  const x = raid(ctx, f, at, defenders(ctx, f, at.t));
  const r = roll(ctx, at, x);
  attackReports(ctx, f, at, x, extra(r));
  const home = homeward(f, x, r);
  flyHome(ctx, f, x, home.ships, home.cargo);
  if (!r) return;
  record(ctx, {
    category: 'system',
    action: 'moonbreak',
    actor: f.owner,
    target: at.t.owner,
    detail: { fleet: f.id, moon: at.t.id, ...r },
  });
  if (r.broken) destroyMoon(ctx, at.t, f.arr);
}
