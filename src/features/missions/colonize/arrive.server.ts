// A Landnahme founds a colony with the cargo at the free position; one
// Kolonistenarche stays, the other ships fly back empty. The dispatcher has
// checked that the position is still free and inside the universe.
import { countUnits } from '../../../core/flight.ts';
import type { Fleet } from '../../../core/types.ts';
import { type Ctx, addReport, coords } from '../../../server/game/context.ts';
import { turnBack } from '../../../server/game/missions.ts';
import { createPlanet } from '../../../server/game/planets.ts';

export function onArrive(ctx: Ctx, f: Fleet): void {
  createPlanet(ctx, f.owner, 'Kolonie', f.toC, f.arr, f.cargo);
  addReport(ctx, f.owner, {
    time: f.arr,
    type: 'info',
    title: `Kolonie gegründet ${coords(f.toC)}`,
    text: 'Deine Kolonistenarche hat eine neue Kolonie gegründet.',
  });
  const ships = { ...f.ships };
  if (ships.colony === 1) delete ships.colony;
  else ships.colony = ships.colony! - 1;
  if (!countUnits(ships)) return ctx.fleets.delete(f.id);
  turnBack(ctx, f, { ships, cargo: { m: 0, c: 0, d: 0 } });
}
