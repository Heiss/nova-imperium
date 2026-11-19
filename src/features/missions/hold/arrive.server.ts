// A Halten stays at the planet of its ally: from its arrival it holds for the
// holding time chosen at the launch and defends the planet in every battle
// there (the Sturmangriff asks for the fleets that hold), then the server
// sends it home (src/server/game/arrival.ts). Its arrival writes no report
// [V]: the host sees it under „Gehaltene Flotten“, the owner in the fleet
// movements.
import type { Fleet } from '../../../core/types.ts';
import type { Ctx } from '../../../server/game/context.ts';

export function onArrive(ctx: Ctx, f: Fleet): void {
  f.state = 'hold';
  ctx.fleets.save(f);
}
