// A Bergung takes what the holds of the whole fleet carry from the
// Trümmerfeld and flies home (#45, owner, 2026-11-13). The dispatcher sends
// a fleet that finds no field any more back with its own report; the first
// fleet to arrive takes the debris, a later one what is left.
import { type Debris, isEmpty } from '../../../core/debris.ts';
import { capacity } from '../../../core/flight.ts';
import type { Fleet } from '../../../core/types.ts';
import {
  type Ctx,
  addReport,
  coords,
  fmt,
} from '../../../server/game/context.ts';
import { turnBack } from '../../../server/game/missions.ts';

/**
 * What a fleet with `free` cargo space takes from a field: both resources
 * evenly until the smaller one is used up, then the rest of the other
 * (classic). The cargo of every ship counts, not only the Bergungsbarken.
 */
export function harvest(field: Debris, free: number): Debris {
  const room = Math.max(0, free);
  const half = room / 2;
  if (field.m <= field.c) {
    const m = Math.min(field.m, half);
    return { m, c: Math.min(field.c, room - m) };
  }
  const c = Math.min(field.c, half);
  return { m: Math.min(field.m, room - c), c };
}

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
