// `colony` ({ g?, s?, p?, name?, b?, res?, def? }): an own planet of the player,
// by default on slot 15 of the home system.
import { addColony } from './lib/places.ts';
import type { SeedPart } from './lib/types.ts';

export const part: SeedPart = {
  order: 50,
  fields: ['colony'],
  apply(s) {
    if (s.d.colony) addColony(s);
  },
};
