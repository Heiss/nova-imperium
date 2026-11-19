// `moon` ({ b?, res?, ships?, def?, name?, diameter? }): the moon of the home
// planet, made or changed (issue #53); `colonyMoon` (the same fields): the
// moon of the colony of `colony`, made or changed (issue #230).
import { colonyId, moonOf } from './lib/places.ts';
import type { SeedPart } from './lib/types.ts';

export const part: SeedPart = {
  order: 51,
  fields: ['moon', 'colonyMoon'],
  apply(s) {
    if (s.d.colonyMoon && s.d.colony)
      moonOf(s, s.store.planet(colonyId(s))!, s.d.colonyMoon);
    if (s.d.moon) moonOf(s, s.planet, s.d.moon);
  },
};
