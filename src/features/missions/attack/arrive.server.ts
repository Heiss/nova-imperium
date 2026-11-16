// A Sturmangriff fights the ships and the defense of the target with the
// steps of src/server/game/fight.ts: the winner takes loot, the destroyed
// ships leave a Trümmerfeld (#45), at a planet without a moon the whole
// field may form one (#53), 70 % of the destroyed defense is rebuilt, both
// sides get a battle report; a fleet without survivors is gone.
import type { Fleet } from '../../../core/types.ts';
import type { Ctx } from '../../../server/game/context.ts';
import { battleReports, fight, flyHome } from '../../../server/game/fight.ts';
import type { Arrival } from '../../../server/game/missions.ts';

export { plunder, rebuild } from '../../../server/game/fight.ts';

export function onArrive(ctx: Ctx, f: Fleet, at: Arrival): void {
  const x = fight(ctx, f, at);
  battleReports(ctx, x);
  flyHome(ctx, x);
}
