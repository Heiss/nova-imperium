// The resource bar of the game (#118, bundle 1; okf/architecture/patterns.md,
// section 9): Adamant, Psikristall and Promethium of the shown planet as
// they run, each with its production per hour and its storage, and the
// energy. Pure, so the component ResourceBar.svelte only renders what this
// module computes; the clock of main.ts moves it every second.
import { caps, production } from '../../core/economy.ts';
import { settle, settleR } from '../../core/settle.ts';
import type { Planet } from '../../core/types.ts';
import { fmt } from './format.ts';
import type { ResourceKey } from './icons.ts';
import type { GameState } from './types.ts';

/** Adamant, Psikristall or Promethium in the bar. */
interface ResourceCell {
  label: string;
  icon: ResourceKey;
  value: string;
  /** Whether the storage is full. */
  full: boolean;
  /** The production per hour and the storage. */
  title: string;
}

export interface ResourceBar {
  /** The planet moved to the time of the bar. */
  planet: Planet;
  cells: ResourceCell[];
  /** The energy left over and the energy produced. */
  energy: { value: string; short: boolean };
}

const cell = (
  label: string,
  icon: ResourceKey,
  have: number,
  cap: number,
  per: number,
): ResourceCell => ({
  label,
  icon,
  value: fmt(have),
  full: have >= cap,
  title: `${per < 0 ? '' : '+'}${fmt(per)}/h · Lager ${fmt(cap)}`,
});

/** The bar of the shown planet of the state at the time `now`. */
export function resourceBar(
  game: GameState,
  planet: Planet,
  now: number,
): ResourceBar {
  const p = settle(planet, now, game.cfg, game.me);
  const pr = production(p, game.cfg, settleR(game.me, now).research);
  const cp = caps(p, game.cfg);
  const left = pr.eProd - pr.eUse;
  return {
    planet: p,
    cells: [
      cell('Adamant', 'metal', p.res.m, cp.m, pr.m),
      cell('Psikristall', 'crystal', p.res.c, cp.c, pr.c),
      cell('Promethium', 'deuterium', p.res.d, cp.d, pr.d),
    ],
    energy: { value: `${fmt(left)}/${fmt(pr.eProd)}`, short: left < 0 },
  };
}
