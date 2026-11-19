// A Sturmangriff fights the ships and the defense of the target, and the
// fleets that hold there with them (#55): the winner takes loot, the
// destroyed ships leave a Trümmerfeld (#45), at a planet without a moon the
// whole field may form one (#53), 70 % of the destroyed defense is rebuilt,
// every party gets a battle report; a fleet without survivors is gone. The
// battle, the loot, the reports and the flight home are shared with the
// Mondbruch (#95) and the battle with the detected Auspex-Erkundung (#175) in
// src/server/game/fight.ts; each of the three asks for the fleets that hold
// (owner, 2026-11-19).
import type { Fleet } from '../../../core/types.ts';
import type { Ctx } from '../../../server/game/context.ts';
import {
  attackReports,
  defenders,
  flyHome,
  raid,
} from '../../../server/game/fight.ts';
import type { Arrival } from '../../../server/game/missions.ts';

export { plunder } from '../../../server/game/fight.ts';

export function onArrive(ctx: Ctx, f: Fleet, at: Arrival): void {
  const x = raid(ctx, f, at, defenders(ctx, f, at.t));
  attackReports(ctx, f, at, x);
  flyHome(ctx, f, x);
}
