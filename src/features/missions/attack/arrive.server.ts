// A Sturmangriff fights the ships and the defense of the target, and the
// fleets that hold there with them (#55): the winner takes loot, the
// destroyed ships leave a Trümmerfeld (#45), at a planet without a moon the
// whole field may form one (#53), 70 % of the destroyed defense is rebuilt,
// every party gets a battle report; a fleet without survivors is gone. The
// battle, the loot, the reports and the flight home are shared with the
// Mondbruch (#95) and the battle with the detected Auspex-Erkundung (#175) in
// src/server/game/fight.ts; each of the three asks for the fleets that hold
// (owner, 2026-11-19). The fleets of an attack union (#225) arrive together:
// the first of them to be due fights for all, as one battle with several
// attackers (src/server/game/union.ts).
import type { Fleet } from '../../../core/types.ts';
import type { Ctx } from '../../../server/game/context.ts';
import {
  attackReports,
  defenders,
  flyHome,
  flyHomeUnion,
  joinedOf,
  raid,
} from '../../../server/game/fight.ts';
import { type Arrival, playerOf, turnBack } from '../../../server/game/missions.ts';
import { arriving } from '../../../server/game/union.ts';

export { plunder } from '../../../server/game/fight.ts';

export function onArrive(ctx: Ctx, f: Fleet, at: Arrival): void {
  const union = arriving(ctx, f);
  if (!union) {
    const x = raid(ctx, f, at, defenders(ctx, f, at.t));
    attackReports(ctx, f, at, x);
    return flyHome(ctx, f, x);
  }
  // Every fleet of the union arrives now; one of a player who owns the
  // target would attack himself and turns back instead [V].
  const { lead } = union;
  const own = (m: Fleet): boolean => m.owner === at.t.owner;
  for (const m of union.rest.filter(own)) turnBack(ctx, m);
  const rest = union.rest.filter((m) => !own(m));
  const owners = [lead, ...rest].map((m) => m.owner);
  const led = { ...at, att: playerOf(ctx, lead.owner) };
  const x = raid(
    ctx,
    lead,
    led,
    defenders(ctx, lead, at.t, owners),
    joinedOf(ctx, rest, lead.arr),
  );
  attackReports(ctx, lead, led, x);
  flyHomeUnion(ctx, lead, x);
}
