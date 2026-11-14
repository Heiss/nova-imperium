// „Endzeit“ (issue #161, owner 2026-11-13/14): the gift of the admin at the
// end of a round. A fleet with 42 of every ship that flies and 1,000,000 of
// every resource as cargo; on its arrival the research and the buildings of
// the home planet are raised to the levels that every requirement needs,
// plus the minimums of the acceleration buildings and the IFN. Higher levels
// stay; nothing is taken away.
import { BUILD, MOBILE, RES, UNIT } from './catalog.ts';
import type { Levels, Requirements, Resources } from './types.ts';

/** Ships of every type that flies (D1); the Sonnenreliquiar cannot fly. */
export const GIFT_SHIPS_EACH = 42;
/** Of every resource, as cargo (issue #161). */
export const GIFT_RESOURCES = 1_000_000;

/**
 * The levels the gift raises at least, beyond the requirements (D2
 * additions, owner 2026-11-13): the acceleration buildings of the home
 * planet and the research network.
 */
export const GIFT_MINIMUM: Readonly<Required<Requirements>> = {
  b: { robot: 20, yard: 20, lab: 20, nanite: 5 },
  r: { ifn: 1 },
};

/** The flight time the admin dialog offers first (owner: about 4 h). */
export const GIFT_DEFAULT_MINUTES = 240;
/** The range of the flight time: 1 minute to 72 h (owner, 2026-11-14). */
export const GIFT_MINUTES = { min: 1, max: 72 * 60 } as const;

/** The highest level of each key, over all the given level tables. */
export function highest(tables: readonly (Levels | undefined)[]): Levels {
  const out: Levels = {};
  for (const table of tables)
    for (const [key, level] of Object.entries(table ?? {}))
      out[key] = Math.max(out[key] ?? 0, level);
  return out;
}

/**
 * The levels every entry of the catalog needs (D2), read from the
 * requirements (`req`) of every building, research, ship and defense, with
 * the minimums of the gift. Every entry is raised, so the requirements of a
 * requirement are met as well.
 */
export function giftLevels(
  entries: readonly { req?: Requirements }[] = [
    ...Object.values(BUILD),
    ...Object.values(RES),
    ...Object.values(UNIT),
  ],
  minimum: Required<Requirements> = GIFT_MINIMUM,
): Required<Requirements> {
  return {
    b: highest([...entries.map((e) => e.req?.b), minimum.b]),
    r: highest([...entries.map((e) => e.req?.r), minimum.r]),
  };
}

/** The gift's levels on top of what a player has: higher levels stay. */
export const raise = (have: Levels, need: Levels): Levels =>
  highest([have, need]);

/** The ships of the gift fleet: 42 of every ship that flies (D1). */
export function giftShips(): Levels {
  return Object.fromEntries(
    Object.keys(MOBILE).map((key) => [key, GIFT_SHIPS_EACH]),
  );
}

/** The cargo of the gift fleet: 1,000,000 of every resource. */
export const giftCargo = (): Resources => ({
  m: GIFT_RESOURCES,
  c: GIFT_RESOURCES,
  d: GIFT_RESOURCES,
});

/**
 * Whether a running build or research of `key` to `level` ends with the
 * gift: its level is not above the level the gift gives (owner,
 * 2026-11-14). It is cancelled and refunded on arrival.
 */
export const overtaken = (
  queue: { key: string; lvl: number } | null | undefined,
  levels: Levels,
): boolean => !!queue && queue.lvl <= (levels[queue.key] ?? 0);
