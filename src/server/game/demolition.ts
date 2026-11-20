// Tearing down one building level („Zurückbauen“, #202,
// okf/features/demolition.md). The check is `demolitionErrors` of
// src/core/demolition.ts (patterns, section 7); the server words its codes.
// The demolition runs in the build queue like an upgrade, one level down:
// a negative refund factor pays when it starts, a positive one gives back
// when it ends. „Abbrechen“ (cancelBuild) gives back what the start paid,
// as for building, and the level stays.
import { pay } from '../../core/economy.ts';
import {
  type DemolitionError,
  demolitionErrors,
  demolitionOrder,
} from '../../core/demolition.ts';
import { BUILD } from '../../core/catalog.ts';
import { orderPush, queuePush } from '../push-store.ts';
import { type Handler, mine, researchOf } from './actions.ts';
import { fail, universe } from './context.ts';
import type { ServerFeature } from './feature.ts';

/**
 * The refusal of each code of `demolitionErrors`, the same as the
 * browser's (src/test/demolition-texts.test.ts). The waits and the price
 * are those of building (#214); a place or a level the interface never
 * offers is refused as every request it never sends [V].
 */
export const DEMOLITION_ERROR: Readonly<Record<DemolitionError, string>> = {
  place: 'Ungültig.',
  none: 'Ungültig.',
  fields: 'Keine freien Felder.',
  busy: 'Es wird bereits gebaut.',
  yardBusy: 'Die Schiffsschmiede arbeitet gerade.',
  labBusy: 'Das Scholarium forscht gerade.',
  cost: 'Der Zehnte reicht nicht aus.',
};

/** Starts tearing down one level of a building on the selected own planet (D1). */
export const demolish: Handler<'demolish'> = (ctx, u, d, event) => {
  const key = String(d.key);
  if (!Object.hasOwn(BUILD, key)) fail('Unbekanntes Gebäude.');
  const p = mine(ctx, u, d.planet);
  const uni = universe(ctx);
  const error = demolitionErrors(p, researchOf(ctx, u), key, uni)[0];
  if (error) fail(DEMOLITION_ERROR[error]);
  const q = demolitionOrder(p, key, uni, ctx.now());
  pay(p, q.cost);
  p.bq = q;
  ctx.planets.save(p);
  queuePush(ctx, u.id, orderPush('buildings', `${p.id}:${q.start}`, q.end));
  // As for building: the planet, the key, the new level and the due time.
  if (event) event.detail = { planet: p.id, key, level: q.lvl, due: q.end };
  return null;
};

export const serverFeature = {
  actions: { demolish },
} satisfies ServerFeature;
