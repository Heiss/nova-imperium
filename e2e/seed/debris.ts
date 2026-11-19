// `debris` ({ m, c }): a Trümmerfeld at the position of the home planet
// (issue #45).
import type { SeedPart } from './lib/types.ts';

export const part: SeedPart = {
  order: 55,
  fields: ['debris'],
  apply({ store, d, planet }) {
    if (d.debris) store.repos.debris.add(planet, d.debris);
  },
};
