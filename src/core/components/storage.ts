// The component `storage` (okf/architecture/patterns.md, sections 1 and 12;
// #114): an entry whose level raises the storage limit of one resource. The
// capacity formula is the same for every store and stays here (owner,
// 2026-11-13).
import type { Levels, Resources, Universe } from '../types.ts';

export interface Storage {
  /** The resource whose limit the entry raises. */
  res: keyof Resources;
}

/** An entry with its `storage` component. */
interface Store {
  key: string;
  storage: Storage;
}

/** The storage limit of a resource whose store has level `level`. */
export const capOf = (level: number, u: Universe): number =>
  u.baseStore + 50000 * (Math.ceil(Math.pow(1.6, level)) - 1);

/** The level of the store of `res` on a planet; 0 without a store. */
function storeLevel(
  stores: readonly Store[],
  res: keyof Resources,
  b: Levels,
): number {
  const store = stores.find((s) => s.storage.res === res);
  return store ? (b[store.key] ?? 0) : 0;
}

/** The storage limits of a planet with the buildings `b`. */
export const capacities = (
  stores: readonly Store[],
  b: Levels,
  u: Universe,
): Record<keyof Resources, number> => ({
  m: capOf(storeLevel(stores, 'm', b), u),
  c: capOf(storeLevel(stores, 'c', b), u),
  d: capOf(storeLevel(stores, 'd', b), u),
});
