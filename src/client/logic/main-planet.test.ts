// The box „Hauptplanet“ of the options (#221): the own planets without
// moons, the first planet named „Heimatplanet“ (D2), the current choice
// preselected, and while the lock holds the date it ends.
import { describe, expect, it } from 'vitest';
import { DAY_MS } from '../../core/main-planet.ts';
import { lockEnd, mainPlanetHTML } from './main-planet.ts';
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

const options = (html: string): string[] =>
  [...html.matchAll(/<option[^>]*>[^<]*<\/option>/g)].map((m) => m[0]);

describe('the box „Hauptplanet“', () => {
  it('offers every own planet, never a moon or a foreign planet', () => {
    expect(options(mainPlanetHTML(state(), NOW))).toEqual([
      '<option value="p1_2_3" selected>Heimat [1:2:3] – Heimatplanet</option>',
      '<option value="p2_5_9">Kolonie [2:5:9]</option>',
      '<option value="p3_1_1">&lt;b&gt;X&lt;/b&gt; [3:1:1]</option>',
    ]);
  });

  it('preselects the chosen main planet; the first planet keeps its name', () => {
    expect(
      options(mainPlanetHTML(state({ mainPlanet: 'p2_5_9' }), NOW)),
    ).toEqual([
      '<option value="p1_2_3">Heimat [1:2:3] – Heimatplanet</option>',
      '<option value="p2_5_9" selected>Kolonie [2:5:9]</option>',
      '<option value="p3_1_1">&lt;b&gt;X&lt;/b&gt; [3:1:1]</option>',
    ]);
  });

  it('explains what the main planet does and names the lock of the round', () => {
    expect(mainPlanetHTML(state(), NOW)).toMatch(
      /^<p>Der Hauptplanet ist das Ziel von „zum Heimatsystem“ auf der Sternenkarte und der Planet, den das Spiel ohne Auswahl zeigt\. Nach jedem Wechsel ist die Wahl 7 Tage gesperrt\.<\/p><div class="flex"><label for="o_main">Hauptplanet<\/label> <select id="o_main"><option/,
    );
    expect(
      mainPlanetHTML(state({ round: { mainLock: 1 } } as never), NOW),
    ).toContain('Nach jedem Wechsel ist die Wahl 1 Tag gesperrt.');
  });

  it('can be changed without a lock', () => {
    for (const mainLock of [null, undefined, NOW, NOW - 1]) {
      const html = mainPlanetHTML(state({ mainLock }), NOW);
      expect(html).toContain('<select id="o_main"><option');
      expect(html).toMatch(
        /<\/select> <button data-act="mainPlanet">Ändern<\/button><\/div>$/,
      );
      expect(html).not.toContain('Wieder änderbar');
    }
  });

  it('is disabled while the lock holds and says when it ends', () => {
    const end = NOW + 7 * DAY_MS;
    for (const now of [NOW, end - 1]) {
      const html = mainPlanetHTML(state({ mainLock: end }), now);
      expect(html).toContain('<select id="o_main" disabled><option');
      expect(html).toContain(
        `<button data-act="mainPlanet" disabled>Ändern</button></div><p id="o_main_lock">Wieder änderbar ab ${lockEnd(end)}</p>`,
      );
    }
  });
});

describe('the end of the lock', () => {
  it('is a German date with the year and a clock time without seconds', () => {
    const t = new Date(2026, 10, 23, 9, 5, 30).getTime();
    expect(lockEnd(t)).toBe('23.11.2026, 09:05');
  });
});
