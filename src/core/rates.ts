// The formulas the rate functions of the producers share (#114). They read
// no catalog, so the entries in src/features can use them; the resources
// page and the shipyard still show some of them until ProducerTable (#114,
// last pull request).
import type { RateCtx } from './components/produces.ts';
import type { Universe } from './types.ts';

/** Growth of a mine, the solar plant and the Fusionskraftwerk: l · 1.1^l. */
export const growth = (l: number): number => l * Math.pow(1.1, l);

/** The rate k · l · 1.1^l at the production share, in the order of the original formulas. */
export const grows =
  (k: number) =>
  (x: RateCtx): number =>
    k * growth(x.level) * (x.pct / 100);

/** Energy of one Solarsatellit: ⌊maximum temperature / 4 + 20⌋, never below 0. */
export const satEnergy = (temp: number): number =>
  Math.max(0, Math.floor(temp / 4 + 20));

/** Energy of `count` Solarsatelliten at the production share `pct` in %. */
export const satsEnergy = (count: number, temp: number, pct: number): number =>
  (count * satEnergy(temp) * pct) / 100;

/** Energy of a Fusionskraftwerk of level `level` at full share: 30 · F · (1.05 + 0.01 · T)^F, T = Energietechnik (#47). */
export const fusionEnergy = (level: number, tech: number): number =>
  30 * level * Math.pow(1.05 + 0.01 * tech, level);

/** Deuterium a Fusionskraftwerk of level `level` uses per hour at full share: 10 · F · 1.1^F times the universe speed (#47). */
export const fusionUse = (level: number, u: Universe): number =>
  10 * growth(level) * u.speed;
