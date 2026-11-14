// A Verlegung stays at the target with its ships and cargo, plus half of the
// fuel it burnt, rounded down; the fleet ends there (#129). The gift of the
// admin's „Endzeit“ is a Verlegung too and has its own arrival (#161).
import { deployFuel } from '../../../core/flight.ts';
import { placeName } from '../../../core/moon.ts';
import type { Fleet } from '../../../core/types.ts';
import {
  type Ctx,
  addReport,
  coords,
  fmt,
  resLine,
} from '../../../server/game/context.ts';
import { giftArrive } from '../../../server/game/endzeit.ts';
import { type Arrival, land } from '../../../server/game/missions.ts';

export function onArrive(ctx: Ctx, f: Fleet, { t }: Arrival): void {
  if (f.gift) return giftArrive(ctx, f, t);
  const rest = deployFuel(f.fuel);
  const load = { ...f.cargo, d: f.cargo.d + rest };
  land(t, f.ships, load);
  ctx.planets.save(t);
  addReport(
    ctx,
    f.owner,
    {
      time: f.arr,
      type: 'info',
      title: `Verlegung erreicht ${coords(f.toC)}`,
      text: `Deine Flotte bleibt auf ${placeName(t)} ${coords(f.toC)} und liefert ${resLine(load)}, davon ${fmt(rest)} übriger Treibstoff.`,
    },
    { topic: 'fleet' },
  );
  ctx.fleets.delete(f.id);
}
