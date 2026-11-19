// A Bergung takes what the holds of the whole fleet carry from the
// Trümmerfeld and flies home (#45, owner, 2026-11-13). The dispatcher sends
// a fleet that finds no field any more back with its own report; the first
// fleet to arrive takes the debris, a later one what is left.
import { harvest, isEmpty } from '../../../core/debris.ts';
import { capacity } from '../../../core/flight.ts';
import type { Fleet } from '../../../core/types.ts';
import {
  type Ctx,
  addReport,
  coords,
  fmt,
} from '../../../server/game/context.ts';
import { turnBack } from '../../../server/game/missions.ts';

// The rule is in the core, where the Lexicanum reads it too (#288).
export { harvest };

export function onArrive(ctx: Ctx, f: Fleet): void {
  // The dispatcher checked that the field is there (target kind `debris`).
  const field = ctx.debris.get(f.to)!;
  const load = f.cargo.m + f.cargo.c + f.cargo.d;
  const take = harvest(field, capacity(f.ships) - load);
  const left = { ...field, m: field.m - take.m, c: field.c - take.c };
  if (isEmpty(left)) ctx.debris.delete(field.id);
  else ctx.debris.save(left);
  addReport(
    ctx,
    f.owner,
    {
      time: f.arr,
      type: 'info',
      title: `Bergung erreicht ${coords(f.toC)}`,
      text: `Deine Bergungsbarken haben ${fmt(take.m)} Adamant und ${fmt(take.c)} Psikristall geborgen.`,
    },
    { topic: 'fleet' },
  );
  turnBack(ctx, f, {
    cargo: { m: f.cargo.m + take.m, c: f.cargo.c + take.c, d: f.cargo.d },
  });
}
