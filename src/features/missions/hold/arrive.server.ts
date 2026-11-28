// A Halten stays at the planet of its ally: from its arrival it holds for the
// holding time chosen at the launch and defends the planet in every battle
// there (the Sturmangriff, the Mondbruch and the detected Auspex-Erkundung
// ask for the fleets that hold), then the server sends it home
// (src/server/game/arrival.ts). At its arrival the host gets a report
// (#440, 242c); the owner sees it in the fleet movements. At a host who is
// in vacation mode it does not start to hold but turns home at once (owner,
// 2026-11-19), and its owner gets an info report. A hold that is no longer
// allowed when it arrives turns home there with the report of the re-check
// (#440, 4a).
import type { Fleet } from '../../../core/types.ts';
import type { Ctx } from '../../../server/game/context.ts';
import {
  endNotAllowed,
  holdArrived,
  holdError,
  sendHome,
} from '../../../server/game/holding.ts';
import { inVacation } from '../../../server/game/vacation.ts';

export function onArrive(ctx: Ctx, f: Fleet): void {
  // The host's vacation began after the launch (D2): the fleet is welcome no more.
  const host = ctx.planets.get(f.to);
  if (host && inVacation(ctx)(host.owner)) return sendHome(ctx, f, f.arr);
  const reason = holdError(ctx, f);
  if (reason) return endNotAllowed(ctx, f, reason, f.arr);
  f.state = 'hold';
  ctx.fleets.save(f);
  if (host) holdArrived(ctx, f, host.owner);
}
