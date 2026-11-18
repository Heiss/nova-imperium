// A Sturmangriff fights the ships and the defense of the target: the winner
// takes loot, the destroyed ships leave a Trümmerfeld (#45), at a planet
// without a moon the whole field may form one (#53), 70 % of the destroyed
// defense is rebuilt, both sides get a battle report; a fleet without
// survivors is gone. The battle, the loot, the reports and the flight home
// are shared with the Mondbruch (#95) and the battle with the detected
// Auspex-Erkundung (#175) in src/server/game/fight.ts.
import type { Fleet } from '../../../core/types.ts';
import type { Ctx } from '../../../server/game/context.ts';
import { attackReports, flyHome, raid } from '../../../server/game/fight.ts';
import type { Arrival } from '../../../server/game/missions.ts';

export { plunder } from '../../../server/game/fight.ts';

export function onArrive(ctx: Ctx, f: Fleet, at: Arrival): void {
  const x = raid(ctx, f, at);
  attackReports(ctx, f, at, x);
  flyHome(ctx, f, x);
}
