// A transport unloads its cargo at the target and flies back empty; a
// foreign owner gets a report of the delivery too.
import type { Fleet } from '../../../core/types.ts';
import {
  type Ctx,
  addReport,
  coords,
  resLine,
} from '../../../server/game/context.ts';
import { type Arrival, land, turnBack } from '../../../server/game/missions.ts';

export function onArrive(ctx: Ctx, f: Fleet, { t, att }: Arrival): void {
  land(t, {}, f.cargo);
  ctx.planets.save(t);
  const text = `Eine Flotte von ${att.name} erreicht ${t.name} ${coords(f.toC)} und liefert ${resLine(f.cargo)}.`;
  addReport(
    ctx,
    f.owner,
    {
      time: f.arr,
      type: 'info',
      title: `Transport erreicht ${coords(f.toC)}`,
      participants: [f.owner, t.owner],
      text,
    },
    { topic: 'fleet' },
  );
  if (t.owner !== f.owner)
    addReport(
      ctx,
      t.owner,
      {
        time: f.arr,
        type: 'info',
        title: `Lieferung von ${att.name}`,
        participants: [f.owner, t.owner],
        text,
      },
      { topic: 'delivery' },
    );
  turnBack(ctx, f, { cargo: { m: 0, c: 0, d: 0 } });
}
