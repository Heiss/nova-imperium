// A Landnahme founds a colony with the cargo at the free position; one
// Kolonistenarche stays, the other ships fly back empty. The dispatcher has
// checked that the position is still free and inside the universe. Under
// the limit of planets of the round the fleet founds the colony only while
// the player owns fewer planets than the limit, read at the arrival with
// the research they have then (#237); else the whole fleet flies back with
// its ark and cargo.
import { arrivalBlocked, arrivalText } from '../../../core/colony-limit.ts';
import { countUnits } from '../../../core/flight.ts';
import type { Fleet } from '../../../core/types.ts';
import { limitOf, ownedPlanets } from '../../../server/game/colony-limit.ts';
import { type Ctx, addReport, coords } from '../../../server/game/context.ts';
import { playerOf, techAt, turnBack } from '../../../server/game/missions.ts';
import { createPlanet } from '../../../server/game/planets.ts';

/** The arrival finds the limit reached: nothing is founded, the fleet comes home. */
function refuse(ctx: Ctx, f: Fleet, limit: number): void {
  addReport(
    ctx,
    f.owner,
    {
      time: f.arr,
      type: 'info',
      title: `Landnahme ${coords(f.toC)} gescheitert`,
      text: arrivalText(limit),
    },
    { topic: 'fleet' },
  );
  turnBack(ctx, f);
}

export function onArrive(ctx: Ctx, f: Fleet): void {
  // The research of the arrival time: one finished during the flight counts.
  const limit = limitOf(ctx, techAt(playerOf(ctx, f.owner), f.arr));
  if (arrivalBlocked(limit, ownedPlanets(ctx, f.owner)))
    return refuse(ctx, f, limit!);
  createPlanet(ctx, f.owner, 'Kolonie', f.toC, f.arr, f.cargo);
  addReport(
    ctx,
    f.owner,
    {
      time: f.arr,
      type: 'info',
      title: `Kolonie gegründet ${coords(f.toC)}`,
      text: 'Deine Kolonistenarche hat eine neue Kolonie gegründet.',
    },
    { topic: 'fleet' },
  );
  const ships = { ...f.ships };
  if (ships.colony === 1) delete ships.colony;
  else ships.colony = ships.colony! - 1;
  if (!countUnits(ships)) return ctx.fleets.delete(f.id);
  turnBack(ctx, f, { ships, cargo: { m: 0, c: 0, d: 0 } });
}
