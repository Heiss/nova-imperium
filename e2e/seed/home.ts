// The fields of the home planet (#51): `res`, `b` (buildings), `ships`, `def`,
// `temp`, `pct` (production shares), `diameter`, `unlimited` (no field limit).
import type { SeedPart } from './lib/types.ts';

const FIELDS = [
  'res',
  'b',
  'ships',
  'def',
  'temp',
  'diameter',
  'unlimited',
  'pct',
] as const;

export const part: SeedPart = {
  order: 40,
  fields: FIELDS,
  apply({ d, home }) {
    for (const k of FIELDS)
      if (d[k] !== undefined) Object.assign(home, { [k]: d[k] });
  },
};
