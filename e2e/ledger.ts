// What the E2E helpers hand out in one run (#302): the areas of the universe,
// the names of players and planets, the tags of guilds. The helpers write it
// to a file next to the data folder (e2e/env.ts), and the seed command, which
// is another process, reads it to refuse what no helper handed out.
import { appendFileSync, readFileSync } from 'node:fs';
import { E2E_LEDGER, E2E_UNIVERSE } from './env.ts';

/** Consecutive systems one area owns: the home system and its neighbours. */
export const AREA_SYSTEMS = 4;

/**
 * Galaxy 1 stays free of areas: the registration form puts every new home
 * planet there (the form's first galaxy), on a random free position, until
 * `register` of the helpers moves it into the area of its test.
 */
const FIRST_AREA_GALAXY = 2;

/** One area: the systems `s` to `s + AREA_SYSTEMS - 1` of galaxy `g`. */
export interface Area {
  n: number;
  g: number;
  s: number;
}

export type Entry =
  | ({ kind: 'area'; owner: string } & Area)
  | { kind: 'name'; name: string; owner: string }
  | { kind: 'guild'; tag: string; owner: string };

/** The area with the number `n`: spread over the galaxies, then the systems. */
export function areaAt(n: number): Area {
  const galaxies = E2E_UNIVERSE.galaxies - FIRST_AREA_GALAXY + 1;
  const blocks = Math.floor(E2E_UNIVERSE.systems / AREA_SYSTEMS);
  if (n >= galaxies * blocks)
    throw new Error(
      `The E2E universe has no area left for test ${n + 1} (e2e/env.ts, E2E_UNIVERSE: ${galaxies * blocks} areas).`,
    );
  return {
    n,
    g: FIRST_AREA_GALAXY + (n % galaxies),
    s: 1 + Math.floor(n / galaxies) * AREA_SYSTEMS,
  };
}

/** The system `i` of an area, `i` below `AREA_SYSTEMS`. */
export function systemOf(area: Area, i: number): { g: number; s: number } {
  if (!Number.isInteger(i) || i < 0 || i >= AREA_SYSTEMS)
    throw new Error(
      `An area has the systems 0 to ${AREA_SYSTEMS - 1}, not ${i}.`,
    );
  return { g: area.g, s: area.s + i };
}

/** Whether a place lies in the area. */
export const inArea = (area: Area, c: { g: number; s: number }): boolean =>
  c.g === area.g && c.s >= area.s && c.s < area.s + AREA_SYSTEMS;

export function readLedger(): Entry[] {
  let text: string;
  try {
    text = readFileSync(E2E_LEDGER, 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw e;
  }
  return text
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => JSON.parse(line) as Entry);
}

export const record = (entry: Entry): void =>
  appendFileSync(E2E_LEDGER, `${JSON.stringify(entry)}\n`);

/** The next free area number. */
export const nextArea = (): number =>
  readLedger().filter((e) => e.kind === 'area').length;

/**
 * The first area from number `n` on with no planet in it (`planetsIn` reads
 * them), and the areas passed over with their planets. A new round puts the
 * home planet of every player on a random position of any galaxy, also into
 * an area no test has been handed yet (review of #347): such an area is
 * passed over, never cleared, so the game keeps its rule.
 */
export function firstEmptyArea(
  n: number,
  planetsIn: (area: Area) => string[],
): { area: Area; passed: { area: Area; planets: string[] }[] } {
  const passed: { area: Area; planets: string[] }[] = [];
  for (let i = n; ; i++) {
    const area = areaAt(i);
    const planets = planetsIn(area);
    if (!planets.length) return { area, passed };
    passed.push({ area, planets });
  }
}
