// The box „Hauptplanet“ of the options (#221): the own planets without
// moons, the first planet named „Heimatplanet“ (D2), the current choice
// preselected, and while the lock holds the date it ends.
import { describe, expect, it } from 'vitest';
import { DAY_MS } from '../../core/main-planet.ts';
import { lockEnd, mainPlanetBox } from './main-planet.ts';
import type { GameState } from './types.ts';

const NOW = Date.UTC(2026, 10, 16, 12, 0);
const at = { temp: 20, owner: 'u_Anna' };

const state = (over: Partial<GameState> = {}) =>
  ({
    me: { id: 'u_Anna' },
    round: { mainLock: 7 },
    homePlanet: 'p1_2_3',
    mainPlanet: 'p1_2_3',
    mainLock: null,
    galaxy: [
      { ...at, id: 'p1_2_3', kind: 'planet', name: 'Heimat', g: 1, s: 2, p: 3 },
      { ...at, id: 'm1_2_3', kind: 'moon', name: 'Mond', g: 1, s: 2, p: 3 },
      {
        ...at,
        id: 'p2_5_9',
        kind: 'planet',
        name: 'Kolonie',
        g: 2,
        s: 5,
        p: 9,
      },
      {
        ...at,
        id: 'p1_4_7',
        kind: 'planet',
        name: 'Fremd',
        g: 1,
        s: 4,
        p: 7,
        owner: 'u_Bert',
      },
      {
        ...at,
        id: 'p3_1_1',
        kind: 'planet',
        name: '<b>X</b>',
        g: 3,
        s: 1,
        p: 1,
      },
    ],
    ...over,
  }) as unknown as GameState;

const options = (s: GameState, now = NOW): string[] =>
  mainPlanetBox(s, now).options.map(
    (o) => `${o.id}${o.selected ? ' selected' : ''}: ${o.label}`,
  );

describe('the box „Hauptplanet“', () => {
  it('offers every own planet, never a moon or a foreign planet', () => {
    expect(options(state())).toEqual([
      'p1_2_3 selected: Heimat [1:2:3] – Heimatplanet',
      'p2_5_9: Kolonie [2:5:9]',
      'p3_1_1: <b>X</b> [3:1:1]',
    ]);
  });

  it('preselects the chosen main planet; the first planet keeps its name', () => {
    expect(options(state({ mainPlanet: 'p2_5_9' }))).toEqual([
      'p1_2_3: Heimat [1:2:3] – Heimatplanet',
      'p2_5_9 selected: Kolonie [2:5:9]',
      'p3_1_1: <b>X</b> [3:1:1]',
    ]);
  });

  it('explains what the main planet does and names the lock of the round', () => {
    expect(mainPlanetBox(state(), NOW).intro).toBe(
      'Der Hauptplanet ist das Ziel von „zum Heimatsystem“ auf der Sternenkarte und der Planet, den das Spiel ohne Auswahl zeigt. Nach jedem Wechsel ist die Wahl 7 Tage gesperrt.',
    );
    expect(
      mainPlanetBox(state({ round: { mainLock: 1 } } as never), NOW).intro,
    ).toContain('Nach jedem Wechsel ist die Wahl 1 Tag gesperrt.');
  });

  it('can be changed without a lock', () => {
    for (const mainLock of [null, undefined, NOW, NOW - 1]) {
      const box = mainPlanetBox(state({ mainLock }), NOW);
      expect(box.locked).toBe(false);
      expect(box.note).toBeNull();
    }
  });

  it('is disabled while the lock holds and says when it ends', () => {
    const end = NOW + 7 * DAY_MS;
    for (const now of [NOW, end - 1]) {
      const box = mainPlanetBox(state({ mainLock: end }), now);
      expect(box.locked).toBe(true);
      expect(box.note).toBe(`Wieder änderbar ab ${lockEnd(end)}`);
    }
  });
});

describe('the end of the lock', () => {
  it('is a German date with the year and a clock time without seconds', () => {
    const t = new Date(2026, 10, 23, 9, 5, 30).getTime();
    expect(lockEnd(t)).toBe('23.11.2026, 09:05');
  });
});
